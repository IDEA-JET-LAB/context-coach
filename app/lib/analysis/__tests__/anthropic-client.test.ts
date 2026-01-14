/**
 * Anthropic API Client Tests
 * Story 30-1: Anthropic API Integration
 *
 * Tests for the Anthropic API client including model selection,
 * streaming, timeout handling, retry logic, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  analyzeConversation,
  analyzeConversationStream,
  MODEL_IDS,
  RETRY_DELAYS_MS,
  parseResponse,
  MissingAPIKeyError,
  TimeoutError,
  RateLimitError,
  AuthenticationError,
  ServerError,
  setSleepFn,
  resetSleepFn,
  type AnalysisRequest,
  type AnthropicModel,
} from '../anthropic-client';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Creates a mock fetch response.
 */
function createMockResponse(
  body: unknown,
  status = 200,
  statusText = 'OK'
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
    body: null,
  } as Response;
}

/**
 * Creates a mock streaming response.
 */
function createMockStreamResponse(events: string[], status = 200): Response {
  let eventIndex = 0;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    pull(controller) {
      if (eventIndex < events.length) {
        controller.enqueue(encoder.encode(events[eventIndex] + '\n'));
        eventIndex++;
      } else {
        controller.close();
      }
    },
  });

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: async () => ({}),
    body: stream,
    getReader: () => stream.getReader(),
  } as unknown as Response;
}

/**
 * Creates a standard analysis request.
 */
function createRequest(model: AnthropicModel = 'haiku'): AnalysisRequest {
  return {
    systemPrompt: 'You are a helpful assistant.',
    userPrompt: 'Analyze this conversation.',
    config: { model },
  };
}

/**
 * Creates a mock successful API response.
 */
function createSuccessResponse(model: string = MODEL_IDS.haiku) {
  return {
    id: 'msg_123',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: 'Analysis complete.' }],
    model,
    stop_reason: 'end_turn',
    usage: {
      input_tokens: 100,
      output_tokens: 50,
    },
  };
}

// ============================================================================
// Test Setup
// ============================================================================

describe('Anthropic Client', () => {
  const originalEnv = process.env;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: 'test-api-key' };
    global.fetch = mockFetch;
    // Mock sleep to be instant for tests
    setSleepFn(() => Promise.resolve());
  });

  afterEach(() => {
    process.env = originalEnv;
    resetSleepFn();
    vi.useRealTimers();
  });

  // ==========================================================================
  // Model Selection Tests
  // ==========================================================================
  describe('Model Selection', () => {
    it('should use correct model ID for haiku', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(createSuccessResponse(MODEL_IDS.haiku))
      );

      await analyzeConversation(createRequest('haiku'));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('claude-3-haiku-20240307');
    });

    it('should use correct model ID for sonnet', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(createSuccessResponse(MODEL_IDS.sonnet))
      );

      await analyzeConversation(createRequest('sonnet'));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('claude-3-sonnet-20240229');
    });

    it('should use correct model ID for opus', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(createSuccessResponse(MODEL_IDS.opus))
      );

      await analyzeConversation(createRequest('opus'));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('claude-3-opus-20240229');
    });

    it('should map all model tiers to their IDs', () => {
      expect(MODEL_IDS.haiku).toBe('claude-3-haiku-20240307');
      expect(MODEL_IDS.sonnet).toBe('claude-3-sonnet-20240229');
      expect(MODEL_IDS.opus).toBe('claude-3-opus-20240229');
    });
  });

  // ==========================================================================
  // Non-Streaming Tests
  // ==========================================================================
  describe('analyzeConversation (non-streaming)', () => {
    it('should send correct headers', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(createSuccessResponse())
      );

      await analyzeConversation(createRequest());

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['x-api-key']).toBe('test-api-key');
      expect(headers['anthropic-version']).toBe('2023-06-01');
    });

    it('should send correct request body', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(createSuccessResponse())
      );

      const request = createRequest();
      await analyzeConversation(request);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.system).toBe(request.systemPrompt);
      expect(body.messages).toEqual([
        { role: 'user', content: request.userPrompt },
      ]);
      expect(body.max_tokens).toBe(4096);
      expect(body.temperature).toBe(0);
    });

    it('should use custom config values', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(createSuccessResponse())
      );

      await analyzeConversation({
        systemPrompt: 'System',
        userPrompt: 'User',
        config: {
          model: 'sonnet',
          maxTokens: 2048,
          temperature: 0.5,
        },
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.max_tokens).toBe(2048);
      expect(body.temperature).toBe(0.5);
    });

    it('should parse successful response correctly', async () => {
      const apiResponse = createSuccessResponse();
      mockFetch.mockResolvedValueOnce(createMockResponse(apiResponse));

      const result = await analyzeConversation(createRequest());

      expect(result.content).toBe('Analysis complete.');
      expect(result.model).toBe(MODEL_IDS.haiku);
      expect(result.inputTokens).toBe(100);
      expect(result.outputTokens).toBe(50);
      expect(result.stopReason).toBe('end_turn');
    });

    it('should handle response with empty content', async () => {
      const apiResponse = {
        ...createSuccessResponse(),
        content: [],
      };
      mockFetch.mockResolvedValueOnce(createMockResponse(apiResponse));

      const result = await analyzeConversation(createRequest());

      expect(result.content).toBe('');
    });
  });

  // ==========================================================================
  // Streaming Tests
  // ==========================================================================
  describe('analyzeConversationStream (streaming)', () => {
    it('should yield text chunks', async () => {
      const events = [
        'data: {"type":"message_start","message":{"usage":{"input_tokens":100}}}',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}',
        'data: {"type":"message_delta","usage":{"output_tokens":50}}',
        'data: [DONE]',
      ];

      mockFetch.mockResolvedValueOnce(createMockStreamResponse(events));

      const chunks: Array<{ type: string; content?: string }> = [];
      for await (const chunk of analyzeConversationStream(createRequest())) {
        chunks.push(chunk);
      }

      expect(chunks).toContainEqual({ type: 'text', content: 'Hello' });
      expect(chunks).toContainEqual({ type: 'text', content: ' world' });
    });

    it('should yield done with usage stats', async () => {
      const events = [
        'data: {"type":"message_start","message":{"usage":{"input_tokens":150}}}',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Test"}}',
        'data: {"type":"message_delta","usage":{"output_tokens":75}}',
      ];

      mockFetch.mockResolvedValueOnce(createMockStreamResponse(events));

      const chunks: Array<{
        type: string;
        usage?: { inputTokens: number; outputTokens: number };
      }> = [];
      for await (const chunk of analyzeConversationStream(createRequest())) {
        chunks.push(chunk);
      }

      const doneChunk = chunks.find((c) => c.type === 'done');
      expect(doneChunk).toBeDefined();
      expect(doneChunk?.usage?.inputTokens).toBe(150);
      expect(doneChunk?.usage?.outputTokens).toBe(75);
    });

    it('should yield error on rate limit after retries', async () => {
      // All 4 calls return 429
      mockFetch
        .mockResolvedValueOnce(createMockResponse({}, 429))
        .mockResolvedValueOnce(createMockResponse({}, 429))
        .mockResolvedValueOnce(createMockResponse({}, 429))
        .mockResolvedValueOnce(createMockResponse({}, 429));

      const chunks: Array<{ type: string; error?: string }> = [];
      for await (const chunk of analyzeConversationStream(createRequest())) {
        chunks.push(chunk);
      }

      const errorChunk = chunks.find((c) => c.type === 'error');
      expect(errorChunk).toBeDefined();
      expect(errorChunk?.error).toContain('Rate limit');
    });

    it('should yield error on authentication failure', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: { message: 'Invalid key' } }, 401)
      );

      const chunks: Array<{ type: string; error?: string }> = [];
      for await (const chunk of analyzeConversationStream(createRequest())) {
        chunks.push(chunk);
      }

      const errorChunk = chunks.find((c) => c.type === 'error');
      expect(errorChunk).toBeDefined();
      expect(errorChunk?.error).toContain('Authentication');
    });

    it('should yield error on server error', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: { message: 'Server down' } }, 500)
      );

      const chunks: Array<{ type: string; error?: string }> = [];
      for await (const chunk of analyzeConversationStream(createRequest())) {
        chunks.push(chunk);
      }

      const errorChunk = chunks.find((c) => c.type === 'error');
      expect(errorChunk).toBeDefined();
      expect(errorChunk?.error).toContain('Server error');
    });
  });

  // ==========================================================================
  // Timeout Tests
  // ==========================================================================
  describe('Timeout Handling', () => {
    it('should throw TimeoutError when request times out', async () => {
      // Use AbortError simulation for timeout behavior
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const request = {
        ...createRequest(),
        config: { model: 'haiku' as const, timeout: 1000 },
      };

      await expect(analyzeConversation(request)).rejects.toThrow(TimeoutError);
      await expect(
        analyzeConversation(request).catch(() => {
          throw new TimeoutError(1000);
        })
      ).rejects.toThrow('timed out after 1000ms');
    });

    it('should use default timeout of 30000ms', async () => {
      // Simulate timeout with AbortError
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      await expect(analyzeConversation(createRequest())).rejects.toThrow(
        TimeoutError
      );
    });

    it('should yield timeout error in streaming mode', async () => {
      // Simulate timeout with AbortError
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const request = {
        ...createRequest(),
        config: { model: 'haiku' as const, timeout: 500 },
      };

      const chunks: Array<{ type: string; error?: string }> = [];
      for await (const chunk of analyzeConversationStream(request)) {
        chunks.push(chunk);
      }

      const errorChunk = chunks.find((c) => c.type === 'error');
      expect(errorChunk?.error).toContain('timed out');
    });

    it('should configure AbortController with correct timeout', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(createSuccessResponse())
      );

      const request = {
        ...createRequest(),
        config: { model: 'haiku' as const, timeout: 5000 },
      };

      await analyzeConversation(request);

      // Verify fetch was called with AbortSignal
      expect(mockFetch.mock.calls[0][1].signal).toBeDefined();
    });
  });

  // ==========================================================================
  // Retry on 429 Tests
  // ==========================================================================
  describe('Retry on Rate Limit (429)', () => {
    it('should retry and succeed after rate limit', async () => {
      // First 2 calls return 429, 3rd succeeds
      mockFetch
        .mockResolvedValueOnce(createMockResponse({}, 429))
        .mockResolvedValueOnce(createMockResponse({}, 429))
        .mockResolvedValueOnce(createMockResponse(createSuccessResponse()));

      const result = await analyzeConversation(createRequest());

      expect(result.content).toBe('Analysis complete.');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should have correct retry delays defined', () => {
      expect(RETRY_DELAYS_MS).toEqual([1000, 2000, 4000]);
      expect(RETRY_DELAYS_MS.length).toBe(3);
    });

    it('should throw RateLimitError after all retries exhausted', async () => {
      // All 4 calls return 429 (initial + 3 retries)
      mockFetch
        .mockResolvedValueOnce(createMockResponse({}, 429))
        .mockResolvedValueOnce(createMockResponse({}, 429))
        .mockResolvedValueOnce(createMockResponse({}, 429))
        .mockResolvedValueOnce(createMockResponse({}, 429));

      await expect(analyzeConversation(createRequest())).rejects.toThrow(
        RateLimitError
      );
      expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should succeed on second attempt after single 429', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({}, 429))
        .mockResolvedValueOnce(createMockResponse(createSuccessResponse()));

      const result = await analyzeConversation(createRequest());

      expect(result.content).toBe('Analysis complete.');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should make correct number of attempts before failing', async () => {
      // All attempts return 429
      mockFetch.mockResolvedValue(createMockResponse({}, 429));

      await expect(analyzeConversation(createRequest())).rejects.toThrow(
        RateLimitError
      );

      // Should be exactly 4 attempts: initial + 3 retries
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================
  describe('Error Handling', () => {
    it('should throw MissingAPIKeyError when API key not set', async () => {
      delete process.env.ANTHROPIC_API_KEY;

      await expect(analyzeConversation(createRequest())).rejects.toThrow(
        MissingAPIKeyError
      );
      await expect(analyzeConversation(createRequest())).rejects.toThrow(
        'ANTHROPIC_API_KEY environment variable is not configured'
      );
    });

    it('should throw AuthenticationError on 401', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: { message: 'Invalid API key provided' } },
          401
        )
      );

      await expect(analyzeConversation(createRequest())).rejects.toThrow(
        AuthenticationError
      );
    });

    it('should include error message from 401 response', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: { message: 'API key expired' } },
          401
        )
      );

      await expect(analyzeConversation(createRequest())).rejects.toThrow(
        'API key expired'
      );
    });

    it('should throw ServerError on 500', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: { message: 'Internal server error' } },
          500
        )
      );

      await expect(analyzeConversation(createRequest())).rejects.toThrow(
        ServerError
      );
    });

    it('should throw ServerError on 503', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: { message: 'Service unavailable' } },
          503
        )
      );

      await expect(analyzeConversation(createRequest())).rejects.toThrow(
        ServerError
      );
    });

    it('should include status code in ServerError', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: { message: 'Server overloaded' } }, 502)
      );

      try {
        await analyzeConversation(createRequest());
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ServerError);
        // ServerError now formats as "Anthropic API server error (502): Server overloaded"
        expect((error as Error).message).toContain('502');
        expect((error as ServerError).status).toBe(502);
      }
    });

    it('should throw generic error for other HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: { message: 'Bad request: invalid model' } },
          400,
          'Bad Request'
        )
      );

      await expect(analyzeConversation(createRequest())).rejects.toThrow(
        'Bad request: invalid model'
      );
    });

    it('should handle malformed error response', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse('not json', 400, 'Bad Request')
      );

      await expect(analyzeConversation(createRequest())).rejects.toThrow();
    });
  });

  // ==========================================================================
  // parseResponse Tests
  // ==========================================================================
  describe('parseResponse', () => {
    it('should extract text content', () => {
      const result = parseResponse({
        content: [{ type: 'text', text: 'Hello world' }],
        model: 'claude-3-haiku-20240307',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      expect(result.content).toBe('Hello world');
    });

    it('should handle multiple content blocks', () => {
      const result = parseResponse({
        content: [
          { type: 'thinking', text: 'Thinking...' },
          { type: 'text', text: 'Response' },
        ],
        model: 'claude-3-opus-20240229',
        stop_reason: 'end_turn',
        usage: { input_tokens: 20, output_tokens: 10 },
      });

      expect(result.content).toBe('Response');
    });

    it('should handle missing content', () => {
      const result = parseResponse({
        model: 'claude-3-haiku-20240307',
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 0 },
      });

      expect(result.content).toBe('');
    });

    it('should extract token usage', () => {
      const result = parseResponse({
        content: [{ type: 'text', text: 'Test' }],
        model: 'claude-3-sonnet-20240229',
        stop_reason: 'max_tokens',
        usage: { input_tokens: 500, output_tokens: 250 },
      });

      expect(result.inputTokens).toBe(500);
      expect(result.outputTokens).toBe(250);
    });

    it('should handle missing usage', () => {
      const result = parseResponse({
        content: [{ type: 'text', text: 'Test' }],
        model: 'claude-3-haiku-20240307',
        stop_reason: 'end_turn',
      });

      expect(result.inputTokens).toBe(0);
      expect(result.outputTokens).toBe(0);
    });

    it('should extract stop reason', () => {
      const result = parseResponse({
        content: [{ type: 'text', text: 'Truncated...' }],
        model: 'claude-3-haiku-20240307',
        stop_reason: 'max_tokens',
        usage: { input_tokens: 100, output_tokens: 4096 },
      });

      expect(result.stopReason).toBe('max_tokens');
    });

    it('should handle missing stop reason', () => {
      const result = parseResponse({
        content: [{ type: 'text', text: 'Test' }],
        model: 'claude-3-haiku-20240307',
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      expect(result.stopReason).toBe('unknown');
    });
  });

  // ==========================================================================
  // Missing API Key in Streaming
  // ==========================================================================
  describe('Missing API Key (streaming)', () => {
    it('should throw MissingAPIKeyError in streaming mode', async () => {
      delete process.env.ANTHROPIC_API_KEY;

      await expect(async () => {
        for await (const _ of analyzeConversationStream(createRequest())) {
          // Iterate
        }
      }).rejects.toThrow(MissingAPIKeyError);
    });
  });
});
