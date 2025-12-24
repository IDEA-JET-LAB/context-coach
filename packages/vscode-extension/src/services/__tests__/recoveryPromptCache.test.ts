/**
 * Unit tests for Recovery Prompt Cache Service - Story 18-3
 *
 * Tests cover:
 * - Caching and retrieving prompts
 * - Expiration handling
 * - Snapshot hash invalidation
 * - Cleanup of expired entries
 * - Cache statistics
 */

import { RecoveryPromptCache, createRecoveryPromptCache } from "../recoveryPromptCache";
import type { SessionStateSnapshot } from "../../types/sessionState";
import { SNAPSHOT_CONSTANTS } from "../../types/sessionState";
import {
  RecoveryPrompt,
  SerializedRecoveryPromptCacheEntry,
  RECOVERY_CONSTANTS,
} from "../../types/recovery";

// Mock crypto
jest.mock("crypto", () => ({
  createHash: () => ({
    update: jest.fn().mockReturnThis(),
    digest: () => "abcdef123456",
  }),
}));

// Mock VS Code module
const mockGlobalState = new Map<string, unknown>();

const createMockContext = () => ({
  globalState: {
    get: jest.fn((key: string) => mockGlobalState.get(key)),
    update: jest.fn((key: string, value: unknown) => {
      if (value === undefined) {
        mockGlobalState.delete(key);
      } else {
        mockGlobalState.set(key, value);
      }
      return Promise.resolve();
    }),
    keys: jest.fn(() => Array.from(mockGlobalState.keys())),
  },
  subscriptions: [],
  extensionUri: { fsPath: "/test/extension", toString: () => "/test/extension" },
  secrets: {
    get: jest.fn(),
    store: jest.fn(),
    delete: jest.fn(),
  },
});

const createMockOutputChannel = () => ({
  appendLine: jest.fn(),
  dispose: jest.fn(),
});

describe("RecoveryPromptCache", () => {
  let cache: RecoveryPromptCache;
  let mockContext: ReturnType<typeof createMockContext>;
  let mockOutputChannel: ReturnType<typeof createMockOutputChannel>;

  const createTestSnapshot = (
    sessionId: string,
    overrides: Partial<SessionStateSnapshot> = {}
  ): SessionStateSnapshot => {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + SNAPSHOT_CONSTANTS.EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );

    return {
      sessionId,
      capturedAt: now,
      expiresAt,
      recentMessages: [
        {
          uuid: "msg-1",
          type: "user",
          content: "Test message",
          timestamp: now,
        },
      ],
      filesAffected: [
        {
          path: "/path/to/file.ts",
          operation: "read",
          lastAccessed: now,
        },
      ],
      toolsUsed: [
        {
          name: "Read",
          count: 1,
          lastArgs: { file_path: "/path/to/file.ts" },
          lastInvokedAt: now,
        },
      ],
      pendingOperations: [],
      conversationContext: {
        initialTask: "Initial task",
        currentTask: "Current task",
        lastAction: "Last action",
        errors: [],
        blockers: [],
      },
      gitContext: {
        branch: "main",
        hasUncommittedChanges: false,
        lastGitOperation: null,
      },
      ...overrides,
    };
  };

  const createTestPrompt = (sessionId: string): RecoveryPrompt => ({
    sessionId,
    prompt: "Test recovery prompt for " + sessionId,
    generatedAt: new Date(),
    isAIGenerated: true,
  });

  beforeEach(() => {
    mockGlobalState.clear();
    mockContext = createMockContext();
    mockOutputChannel = createMockOutputChannel();
    cache = new RecoveryPromptCache(
      mockContext as unknown as import("vscode").ExtensionContext
    );
    cache.initialize(
      mockOutputChannel as unknown as import("vscode").OutputChannel
    );
  });

  describe("set", () => {
    it("should cache a recovery prompt", async () => {
      const snapshot = createTestSnapshot("session-1");
      const prompt = createTestPrompt("session-1");

      await cache.set(prompt, snapshot);

      expect(mockContext.globalState.update).toHaveBeenCalledWith(
        `${RECOVERY_CONSTANTS.CACHE_STORAGE_PREFIX}session-1`,
        expect.any(Object)
      );
    });

    it("should serialize dates to ISO strings", async () => {
      const snapshot = createTestSnapshot("session-2");
      const prompt = createTestPrompt("session-2");

      await cache.set(prompt, snapshot);

      const storedValue = mockGlobalState.get(
        `${RECOVERY_CONSTANTS.CACHE_STORAGE_PREFIX}session-2`
      ) as SerializedRecoveryPromptCacheEntry;

      expect(typeof storedValue.prompt.generatedAt).toBe("string");
      expect(typeof storedValue.expiresAt).toBe("string");
    });

    it("should include snapshot hash", async () => {
      const snapshot = createTestSnapshot("session-hash");
      const prompt = createTestPrompt("session-hash");

      await cache.set(prompt, snapshot);

      const storedValue = mockGlobalState.get(
        `${RECOVERY_CONSTANTS.CACHE_STORAGE_PREFIX}session-hash`
      ) as SerializedRecoveryPromptCacheEntry;

      expect(storedValue.snapshotHash).toBeDefined();
      expect(typeof storedValue.snapshotHash).toBe("string");
    });

    it("should set expiration time", async () => {
      const snapshot = createTestSnapshot("session-exp");
      const prompt = createTestPrompt("session-exp");

      const beforeSet = Date.now();
      await cache.set(prompt, snapshot);
      const afterSet = Date.now();

      const storedValue = mockGlobalState.get(
        `${RECOVERY_CONSTANTS.CACHE_STORAGE_PREFIX}session-exp`
      ) as SerializedRecoveryPromptCacheEntry;

      const expiresAt = new Date(storedValue.expiresAt).getTime();
      expect(expiresAt).toBeGreaterThanOrEqual(
        beforeSet + RECOVERY_CONSTANTS.CACHE_EXPIRY_MS
      );
      expect(expiresAt).toBeLessThanOrEqual(
        afterSet + RECOVERY_CONSTANTS.CACHE_EXPIRY_MS + 100
      );
    });

    it("should log cache operation", async () => {
      const snapshot = createTestSnapshot("session-log");
      const prompt = createTestPrompt("session-log");

      await cache.set(prompt, snapshot);

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Cached recovery prompt for session: session-log")
      );
    });
  });

  describe("get", () => {
    it("should retrieve cached prompt", async () => {
      const snapshot = createTestSnapshot("session-get");
      const prompt = createTestPrompt("session-get");

      await cache.set(prompt, snapshot);
      const retrieved = cache.get("session-get", snapshot);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.sessionId).toBe("session-get");
      expect(retrieved?.prompt).toBe(prompt.prompt);
    });

    it("should deserialize dates back to Date objects", async () => {
      const snapshot = createTestSnapshot("session-dates");
      const prompt = createTestPrompt("session-dates");

      await cache.set(prompt, snapshot);
      const retrieved = cache.get("session-dates", snapshot);

      expect(retrieved?.generatedAt).toBeInstanceOf(Date);
    });

    it("should return null for non-existent cache entry", () => {
      const snapshot = createTestSnapshot("non-existent");
      const result = cache.get("non-existent", snapshot);
      expect(result).toBeNull();
    });

    it("should return null for expired cache entry", async () => {
      const snapshot = createTestSnapshot("session-expired");
      const prompt = createTestPrompt("session-expired");

      // Store directly with expired date
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      mockGlobalState.set(
        `${RECOVERY_CONSTANTS.CACHE_STORAGE_PREFIX}session-expired`,
        {
          prompt: {
            sessionId: "session-expired",
            prompt: prompt.prompt,
            generatedAt: prompt.generatedAt.toISOString(),
            isAIGenerated: true,
          },
          snapshotHash: "abcdef123456",
          expiresAt: expiredDate.toISOString(),
        }
      );

      const result = cache.get("session-expired", snapshot);
      expect(result).toBeNull();
    });

    it("should return null when snapshot hash changes", async () => {
      const prompt = createTestPrompt("session-hash-change");

      // Store with one hash
      mockGlobalState.set(
        `${RECOVERY_CONSTANTS.CACHE_STORAGE_PREFIX}session-hash-change`,
        {
          prompt: {
            sessionId: "session-hash-change",
            prompt: prompt.prompt,
            generatedAt: prompt.generatedAt.toISOString(),
            isAIGenerated: true,
          },
          snapshotHash: "different-hash",
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        }
      );

      // Get with different snapshot (different hash)
      const snapshot2 = createTestSnapshot("session-hash-change", {
        recentMessages: [
          { uuid: "msg-2", type: "user", content: "Different message" },
        ],
      });

      const result = cache.get("session-hash-change", snapshot2);
      expect(result).toBeNull();
    });

    it("should log when cache entry is expired", async () => {
      const snapshot = createTestSnapshot("log-expired");
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      mockGlobalState.set(
        `${RECOVERY_CONSTANTS.CACHE_STORAGE_PREFIX}log-expired`,
        {
          prompt: {
            sessionId: "log-expired",
            prompt: "test",
            generatedAt: new Date().toISOString(),
            isAIGenerated: true,
          },
          snapshotHash: "abcdef123456",
          expiresAt: expiredDate.toISOString(),
        }
      );

      cache.get("log-expired", snapshot);

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Cache entry expired for session: log-expired")
      );
    });
  });

  describe("delete", () => {
    it("should delete existing cache entry", async () => {
      const snapshot = createTestSnapshot("to-delete");
      const prompt = createTestPrompt("to-delete");

      await cache.set(prompt, snapshot);
      const result = await cache.delete("to-delete");

      expect(result).toBe(true);
      expect(cache.get("to-delete", snapshot)).toBeNull();
    });

    it("should return false for non-existent entry", async () => {
      const result = await cache.delete("non-existent");
      expect(result).toBe(false);
    });

    it("should log deletion", async () => {
      const snapshot = createTestSnapshot("to-delete-log");
      const prompt = createTestPrompt("to-delete-log");

      await cache.set(prompt, snapshot);
      await cache.delete("to-delete-log");

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Deleted cache entry for session: to-delete-log")
      );
    });
  });

  describe("has", () => {
    it("should return true for valid cached entry", async () => {
      const snapshot = createTestSnapshot("has-test");
      const prompt = createTestPrompt("has-test");

      await cache.set(prompt, snapshot);

      expect(cache.has("has-test", snapshot)).toBe(true);
    });

    it("should return false for non-existent entry", () => {
      const snapshot = createTestSnapshot("not-exists");
      expect(cache.has("not-exists", snapshot)).toBe(false);
    });

    it("should return false for expired entry", async () => {
      const snapshot = createTestSnapshot("expired-has");
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      mockGlobalState.set(
        `${RECOVERY_CONSTANTS.CACHE_STORAGE_PREFIX}expired-has`,
        {
          prompt: {
            sessionId: "expired-has",
            prompt: "test",
            generatedAt: new Date().toISOString(),
            isAIGenerated: true,
          },
          snapshotHash: "abcdef123456",
          expiresAt: expiredDate.toISOString(),
        }
      );

      expect(cache.has("expired-has", snapshot)).toBe(false);
    });
  });

  describe("cleanExpiredEntries", () => {
    it("should remove expired entries", async () => {
      // Add a valid entry
      const validSnapshot = createTestSnapshot("valid");
      const validPrompt = createTestPrompt("valid");
      await cache.set(validPrompt, validSnapshot);

      // Add an expired entry directly
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      mockGlobalState.set(
        `${RECOVERY_CONSTANTS.CACHE_STORAGE_PREFIX}expired`,
        {
          prompt: {
            sessionId: "expired",
            prompt: "test",
            generatedAt: new Date().toISOString(),
            isAIGenerated: true,
          },
          snapshotHash: "hash",
          expiresAt: expiredDate.toISOString(),
        }
      );

      const cleaned = await cache.cleanExpiredEntries();

      expect(cleaned).toBe(1);
    });

    it("should return 0 when no expired entries", async () => {
      const snapshot = createTestSnapshot("fresh");
      const prompt = createTestPrompt("fresh");
      await cache.set(prompt, snapshot);

      const cleaned = await cache.cleanExpiredEntries();

      expect(cleaned).toBe(0);
    });

    it("should log cleanup count", async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      mockGlobalState.set(
        `${RECOVERY_CONSTANTS.CACHE_STORAGE_PREFIX}exp1`,
        {
          prompt: {
            sessionId: "exp1",
            prompt: "test",
            generatedAt: new Date().toISOString(),
            isAIGenerated: true,
          },
          snapshotHash: "hash",
          expiresAt: expiredDate.toISOString(),
        }
      );

      await cache.cleanExpiredEntries();

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Cleaned up 1 expired cache entries")
      );
    });
  });

  describe("clearAll", () => {
    it("should remove all cache entries", async () => {
      const snapshot1 = createTestSnapshot("s1");
      const snapshot2 = createTestSnapshot("s2");
      await cache.set(createTestPrompt("s1"), snapshot1);
      await cache.set(createTestPrompt("s2"), snapshot2);

      const cleared = await cache.clearAll();

      expect(cleared).toBe(2);
    });

    it("should return 0 when no entries", async () => {
      const cleared = await cache.clearAll();
      expect(cleared).toBe(0);
    });

    it("should log clear count", async () => {
      const snapshot = createTestSnapshot("to-clear");
      await cache.set(createTestPrompt("to-clear"), snapshot);
      await cache.clearAll();

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Cleared 1 cache entries")
      );
    });
  });

  describe("getStats", () => {
    it("should return correct statistics", async () => {
      // Add 2 valid entries
      const snapshot1 = createTestSnapshot("valid1");
      const snapshot2 = createTestSnapshot("valid2");
      await cache.set(createTestPrompt("valid1"), snapshot1);
      await cache.set(createTestPrompt("valid2"), snapshot2);

      // Add 1 expired entry
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      mockGlobalState.set(
        `${RECOVERY_CONSTANTS.CACHE_STORAGE_PREFIX}expired`,
        {
          prompt: {
            sessionId: "expired",
            prompt: "test",
            generatedAt: new Date().toISOString(),
            isAIGenerated: true,
          },
          snapshotHash: "hash",
          expiresAt: expiredDate.toISOString(),
        }
      );

      const stats = cache.getStats();

      expect(stats.totalEntries).toBe(3);
      expect(stats.validEntries).toBe(2);
      expect(stats.expiredEntries).toBe(1);
    });

    it("should return zeros when empty", () => {
      const stats = cache.getStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.validEntries).toBe(0);
      expect(stats.expiredEntries).toBe(0);
    });
  });

  describe("createRecoveryPromptCache", () => {
    it("should create a new RecoveryPromptCache instance", () => {
      const newCache = createRecoveryPromptCache(
        mockContext as unknown as import("vscode").ExtensionContext
      );

      expect(newCache).toBeInstanceOf(RecoveryPromptCache);
    });
  });

  describe("isAIGenerated flag", () => {
    it("should preserve isAIGenerated true", async () => {
      const snapshot = createTestSnapshot("ai-true");
      const prompt: RecoveryPrompt = {
        sessionId: "ai-true",
        prompt: "AI generated prompt",
        generatedAt: new Date(),
        isAIGenerated: true,
      };

      await cache.set(prompt, snapshot);
      const retrieved = cache.get("ai-true", snapshot);

      expect(retrieved?.isAIGenerated).toBe(true);
    });

    it("should preserve isAIGenerated false", async () => {
      const snapshot = createTestSnapshot("ai-false");
      const prompt: RecoveryPrompt = {
        sessionId: "ai-false",
        prompt: "Local generated prompt",
        generatedAt: new Date(),
        isAIGenerated: false,
      };

      await cache.set(prompt, snapshot);
      const retrieved = cache.get("ai-false", snapshot);

      expect(retrieved?.isAIGenerated).toBe(false);
    });
  });
});
