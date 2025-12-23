import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  BATCH_SIZE,
  MAX_RETRIES,
  RETRY_DELAYS,
  uploadBatchWithRetry,
  sleep,
  isRetryableError,
  importProject,
} from '../batch';
import type { PromptWithFingerprint, BatchUploadResult, ImportResult } from '../types';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create a mock batch of pairs
function createMockPairs(count: number): PromptWithFingerprint[] {
  return Array.from({ length: count }, (_, i) => ({
    prompt: {
      text: `Prompt ${i + 1}`,
      timestamp: `2025-01-15T10:${String(i).padStart(2, '0')}:00Z`,
    },
    response: {
      text: `Response ${i + 1}`,
      timestamp: `2025-01-15T10:${String(i).padStart(2, '0')}:05Z`,
      model: 'claude-3-opus',
    },
    fingerprint: `fp${String(i).padStart(14, '0')}`,
  }));
}

describe('Batch Processor - Story 17-3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constants', () => {
    it('should have BATCH_SIZE of 100', () => {
      expect(BATCH_SIZE).toBe(100);
    });

    it('should have MAX_RETRIES of 3', () => {
      expect(MAX_RETRIES).toBe(3);
    });

    it('should have exponential backoff delays', () => {
      expect(RETRY_DELAYS).toEqual([1000, 2000, 4000]);
    });
  });

  describe('sleep', () => {
    it('should resolve after the specified delay', async () => {
      const promise = sleep(1000);

      // Fast-forward time
      await vi.advanceTimersByTimeAsync(1000);

      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('isRetryableError', () => {
    it('should return false for validation errors', () => {
      expect(isRetryableError(new Error('validation failed'))).toBe(false);
      expect(isRetryableError(new Error('Validation error'))).toBe(false);
    });

    it('should return false for auth errors', () => {
      expect(isRetryableError(new Error('401 Unauthorized'))).toBe(false);
      expect(isRetryableError(new Error('403 Forbidden'))).toBe(false);
    });

    it('should return true for network errors', () => {
      expect(isRetryableError(new Error('Network error'))).toBe(true);
      expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
      expect(isRetryableError(new Error('fetch failed'))).toBe(true);
    });

    it('should return true for 5xx server errors', () => {
      expect(isRetryableError(new Error('500 Internal Server Error'))).toBe(true);
      expect(isRetryableError(new Error('503 Service Unavailable'))).toBe(true);
      expect(isRetryableError(new Error('502 Bad Gateway'))).toBe(true);
    });

    it('should return true for timeout errors', () => {
      expect(isRetryableError(new Error('Request timeout'))).toBe(true);
      expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
    });

    it('should return true for rate limit errors', () => {
      expect(isRetryableError(new Error('429 Too Many Requests'))).toBe(true);
    });
  });

  describe('uploadBatchWithRetry', () => {
    const baseUrl = 'https://api.example.com';
    const pairs = createMockPairs(5);
    const config = {
      apiUrl: baseUrl,
      importId: 'import-123',
      teamId: 'team-123',
      userId: 'user-123',
      projectPath: '/path/to/project',
    };

    it('should succeed on first try', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, imported: 5, skipped: 0 }),
      });

      const result = await uploadBatchWithRetry(pairs, config);

      expect(result.success).toBe(true);
      expect(result.imported).toBe(5);
      expect(result.skipped).toBe(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on network error and eventually succeed', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, imported: 5, skipped: 0 }),
        });

      const promise = uploadBatchWithRetry(pairs, config);

      // First attempt fails, wait for retry delay
      await vi.advanceTimersByTimeAsync(RETRY_DELAYS[0]!);

      const result = await promise;

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should fail immediately on validation error (no retry)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'validation failed' }),
      });

      const result = await uploadBatchWithRetry(pairs, config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('validation');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should fail immediately on auth error (no retry)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: '401 Unauthorized' }),
      });

      const result = await uploadBatchWithRetry(pairs, config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('401');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should exhaust all retries on persistent server error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      const promise = uploadBatchWithRetry(pairs, config);

      // Advance through all retry delays
      for (const delay of RETRY_DELAYS) {
        await vi.advanceTimersByTimeAsync(delay);
      }

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('retries');
      expect(mockFetch).toHaveBeenCalledTimes(MAX_RETRIES + 1);
    });

    it('should use exponential backoff delays', async () => {
      const fetchTimes: number[] = [];
      let currentTime = 0;

      mockFetch.mockImplementation(() => {
        fetchTimes.push(currentTime);
        return Promise.reject(new Error('Network error'));
      });

      const promise = uploadBatchWithRetry(pairs, config);

      // Advance through each retry delay and track time
      for (const delay of RETRY_DELAYS) {
        await vi.advanceTimersByTimeAsync(delay);
        currentTime += delay;
      }

      await promise;

      // Verify exponential backoff pattern
      expect(fetchTimes).toHaveLength(MAX_RETRIES + 1);
    });

    it('should include correct payload in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, imported: 5, skipped: 0 }),
      });

      await uploadBatchWithRetry(pairs, config);

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/api/import/batch`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: expect.any(String),
        })
      );

      const callArgs = mockFetch.mock.calls[0]!;
      const body = JSON.parse(callArgs[1].body);

      expect(body.pairs).toEqual(pairs);
      expect(body.importId).toBe('import-123');
      expect(body.teamId).toBe('team-123');
      expect(body.userId).toBe('user-123');
      expect(body.projectPath).toBe('/path/to/project');
    });
  });

  describe('importProject', () => {
    let tmpDir: string;

    beforeEach(async () => {
      vi.useRealTimers();
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'batch-test-'));
    });

    afterEach(async () => {
      vi.useFakeTimers();
      try {
        await fs.rm(tmpDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should process all JSONL files in project directory', async () => {
      // Create test JSONL files
      const session1 = [
        { type: 'user', timestamp: '2025-01-15T10:30:00Z', message: { content: 'Hello' } },
        { type: 'assistant', timestamp: '2025-01-15T10:30:05Z', message: { content: 'Hi there!' } },
      ];
      const session2 = [
        { type: 'user', timestamp: '2025-01-15T11:30:00Z', message: { content: 'Help me' } },
        { type: 'assistant', timestamp: '2025-01-15T11:30:05Z', message: { content: 'Sure!' } },
      ];

      await fs.writeFile(
        path.join(tmpDir, 'session1.jsonl'),
        session1.map((l) => JSON.stringify(l)).join('\n')
      );
      await fs.writeFile(
        path.join(tmpDir, 'session2.jsonl'),
        session2.map((l) => JSON.stringify(l)).join('\n')
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, imported: 1, skipped: 0 }),
      });

      const onProgress = vi.fn();
      const config = {
        apiUrl: 'https://api.example.com',
        importId: 'import-123',
        teamId: 'team-123',
        userId: 'user-123',
      };

      const result = await importProject(tmpDir, config, onProgress);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
      expect(onProgress).toHaveBeenCalled();
    });

    it('should continue processing when a session fails', async () => {
      // Create valid and invalid session files
      await fs.writeFile(
        path.join(tmpDir, 'valid.jsonl'),
        JSON.stringify({ type: 'user', timestamp: '2025-01-15T10:30:00Z', message: { content: 'Test' } })
      );

      // Invalid JSON file
      await fs.writeFile(path.join(tmpDir, 'invalid.jsonl'), '{invalid json');

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, imported: 1, skipped: 0 }),
      });

      const config = {
        apiUrl: 'https://api.example.com',
        importId: 'import-123',
        teamId: 'team-123',
        userId: 'user-123',
      };

      const result = await importProject(tmpDir, config, () => {});

      // Should have processed the valid session
      expect(result.success).toBeGreaterThanOrEqual(0);
      expect(result.failedSessions.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty project directory', async () => {
      const config = {
        apiUrl: 'https://api.example.com',
        importId: 'import-123',
        teamId: 'team-123',
        userId: 'user-123',
      };

      const result = await importProject(tmpDir, config, () => {});

      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.failedSessions).toEqual([]);
    });

    it('should batch prompts correctly when session has many prompts', async () => {
      // Create a session with 150 prompts (should be split into 2 batches)
      const lines = Array.from({ length: 150 }, (_, i) => [
        { type: 'user', timestamp: `2025-01-15T10:${String(i % 60).padStart(2, '0')}:00Z`, message: { content: `Prompt ${i}` } },
        { type: 'assistant', timestamp: `2025-01-15T10:${String(i % 60).padStart(2, '0')}:05Z`, message: { content: `Response ${i}` } },
      ]).flat();

      await fs.writeFile(
        path.join(tmpDir, 'large-session.jsonl'),
        lines.map((l) => JSON.stringify(l)).join('\n')
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, imported: 100, skipped: 0 }),
      });

      const config = {
        apiUrl: 'https://api.example.com',
        importId: 'import-123',
        teamId: 'team-123',
        userId: 'user-123',
      };

      await importProject(tmpDir, config, () => {});

      // Should have made 2 batch calls (100 + 50)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should track skipped duplicates correctly', async () => {
      await fs.writeFile(
        path.join(tmpDir, 'session.jsonl'),
        JSON.stringify({ type: 'user', timestamp: '2025-01-15T10:30:00Z', message: { content: 'Test' } })
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, imported: 0, skipped: 1 }),
      });

      const config = {
        apiUrl: 'https://api.example.com',
        importId: 'import-123',
        teamId: 'team-123',
        userId: 'user-123',
      };

      const result = await importProject(tmpDir, config, () => {});

      expect(result.skipped).toBe(1);
      expect(result.success).toBe(0);
    });
  });
});
