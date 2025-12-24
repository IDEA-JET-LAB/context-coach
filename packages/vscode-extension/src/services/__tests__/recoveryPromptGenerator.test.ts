/**
 * Unit tests for Recovery Prompt Generator Service - Story 18-3
 *
 * Tests cover:
 * - AI-powered prompt generation
 * - Local fallback generation
 * - Caching integration
 * - Error handling
 * - Prompt format and length limits
 */

import {
  RecoveryPromptGenerator,
  createRecoveryPromptGenerator,
} from "../recoveryPromptGenerator";
import { RecoveryPromptCache } from "../recoveryPromptCache";
import { AuthService } from "../auth";
import { SettingsService } from "../settings";
import type { SessionStateSnapshot } from "../../types/sessionState";
import { SNAPSHOT_CONSTANTS } from "../../types/sessionState";
import { RecoveryPrompt, RECOVERY_CONSTANTS } from "../../types/recovery";

// Mock fetch
global.fetch = jest.fn();

// Mock SettingsService
jest.mock("../settings", () => ({
  SettingsService: {
    getInstance: jest.fn().mockReturnValue({
      apiEndpoint: "https://api.contextor.co/api",
      onDidChange: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    }),
  },
}));

// Create mock implementations
const createMockCache = () => {
  const cacheMap = new Map<string, RecoveryPrompt>();

  return {
    get: jest.fn((sessionId: string) => cacheMap.get(sessionId) || null),
    set: jest.fn((prompt: RecoveryPrompt) => {
      cacheMap.set(prompt.sessionId, prompt);
      return Promise.resolve();
    }),
    delete: jest.fn((sessionId: string) => {
      const exists = cacheMap.has(sessionId);
      cacheMap.delete(sessionId);
      return Promise.resolve(exists);
    }),
    clearAll: jest.fn(() => {
      const count = cacheMap.size;
      cacheMap.clear();
      return Promise.resolve(count);
    }),
    initialize: jest.fn(),
    _cacheMap: cacheMap, // Expose for testing
  };
};

const createMockAuthService = (authenticated = true) => ({
  isAuthenticated: jest.fn().mockResolvedValue(authenticated),
  getAccessToken: jest.fn().mockResolvedValue(authenticated ? "test-token" : null),
  login: jest.fn(),
  logout: jest.fn(),
  getUser: jest.fn(),
  handleCallback: jest.fn(),
  onDidChangeAuth: { dispose: jest.fn() },
  dispose: jest.fn(),
});

const createMockOutputChannel = () => ({
  appendLine: jest.fn(),
  dispose: jest.fn(),
});

describe("RecoveryPromptGenerator", () => {
  let generator: RecoveryPromptGenerator;
  let mockCache: ReturnType<typeof createMockCache>;
  let mockAuth: ReturnType<typeof createMockAuthService>;
  let mockOutputChannel: ReturnType<typeof createMockOutputChannel>;
  let mockSettings: SettingsService;

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
          content: "Help me fix the authentication bug in login.ts",
          timestamp: now,
        },
        {
          uuid: "msg-2",
          type: "assistant",
          content: "I'll help you fix the authentication bug.",
          timestamp: now,
        },
        {
          uuid: "msg-3",
          type: "user",
          content: "Also check the session handling",
          timestamp: now,
        },
      ],
      filesAffected: [
        {
          path: "/src/auth/login.ts",
          operation: "edit",
          lastAccessed: now,
        },
        {
          path: "/src/session/handler.ts",
          operation: "read",
          lastAccessed: now,
        },
      ],
      toolsUsed: [
        {
          name: "Edit",
          count: 3,
          lastArgs: { file_path: "/src/auth/login.ts" },
          lastInvokedAt: now,
        },
        {
          name: "Read",
          count: 2,
          lastArgs: { file_path: "/src/session/handler.ts" },
          lastInvokedAt: now,
        },
      ],
      pendingOperations: [],
      conversationContext: {
        initialTask: "Help me fix the authentication bug",
        currentTask: "Check the session handling",
        lastAction: "Edited login.ts",
        errors: [],
        blockers: [],
      },
      gitContext: {
        branch: "fix/auth-bug",
        hasUncommittedChanges: true,
        lastGitOperation: "git status",
      },
      ...overrides,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();

    mockCache = createMockCache();
    mockAuth = createMockAuthService();
    mockOutputChannel = createMockOutputChannel();
    mockSettings = SettingsService.getInstance();

    generator = new RecoveryPromptGenerator(
      mockCache as unknown as RecoveryPromptCache,
      mockAuth as unknown as AuthService,
      mockSettings
    );
    generator.initialize(
      mockOutputChannel as unknown as import("vscode").OutputChannel
    );
  });

  describe("generateRecoveryPrompt", () => {
    describe("caching", () => {
      it("should return cached prompt if available", async () => {
        const snapshot = createTestSnapshot("cached-session");
        const cachedPrompt: RecoveryPrompt = {
          sessionId: "cached-session",
          prompt: "Cached prompt content",
          generatedAt: new Date(),
          isAIGenerated: true,
        };

        mockCache.get.mockReturnValue(cachedPrompt);

        const result = await generator.generateRecoveryPrompt(snapshot);

        expect(result).toEqual(cachedPrompt);
        expect(mockAuth.isAuthenticated).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
      });

      it("should cache newly generated prompts", async () => {
        const snapshot = createTestSnapshot("new-session");
        mockCache.get.mockReturnValue(null);
        mockAuth.isAuthenticated.mockResolvedValue(false);

        await generator.generateRecoveryPrompt(snapshot);

        expect(mockCache.set).toHaveBeenCalledWith(
          expect.objectContaining({
            sessionId: "new-session",
          }),
          snapshot
        );
      });
    });

    describe("API generation", () => {
      it("should call API when authenticated", async () => {
        const snapshot = createTestSnapshot("api-session");
        mockCache.get.mockReturnValue(null);

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              summary: {
                task: "Fixing authentication bug in login.ts",
                lastAction: "Edited login.ts to fix session handling",
                pending: "Need to test the changes",
              },
            }),
        });

        const result = await generator.generateRecoveryPrompt(snapshot);

        expect(global.fetch).toHaveBeenCalledWith(
          "https://api.contextor.co/api/recovery/api-session",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              Authorization: "Bearer test-token",
            }),
          })
        );
        expect(result.isAIGenerated).toBe(true);
      });

      it("should include messages in API request", async () => {
        const snapshot = createTestSnapshot("msg-session");
        mockCache.get.mockReturnValue(null);

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              summary: {
                task: "Task",
                lastAction: "Action",
                pending: "Pending",
              },
            }),
        });

        await generator.generateRecoveryPrompt(snapshot);

        const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
        const body = JSON.parse(fetchCall[1].body);

        expect(body.messages).toBeDefined();
        expect(body.messages.length).toBeLessThanOrEqual(
          RECOVERY_CONSTANTS.MAX_MESSAGES_FOR_API
        );
      });

      it("should include filesAffected and lastTool in API request", async () => {
        const snapshot = createTestSnapshot("context-session");
        mockCache.get.mockReturnValue(null);

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              summary: {
                task: "Task",
                lastAction: "Action",
                pending: "Pending",
              },
            }),
        });

        await generator.generateRecoveryPrompt(snapshot);

        const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
        const body = JSON.parse(fetchCall[1].body);

        expect(body.filesAffected).toBeDefined();
        expect(body.lastTool).toBe("Edit");
      });
    });

    describe("API error handling", () => {
      it("should fall back to local generation on API error", async () => {
        const snapshot = createTestSnapshot("error-session");
        mockCache.get.mockReturnValue(null);

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        });

        const result = await generator.generateRecoveryPrompt(snapshot);

        expect(result.isAIGenerated).toBe(false);
        expect(result.prompt).toContain("Resume my previous session");
      });

      it("should fall back to local generation on rate limit", async () => {
        const snapshot = createTestSnapshot("rate-limited");
        mockCache.get.mockReturnValue(null);

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 429,
          headers: {
            get: () => "60",
          },
        });

        const result = await generator.generateRecoveryPrompt(snapshot);

        expect(result.isAIGenerated).toBe(false);
      });

      it("should fall back to local generation on network error", async () => {
        const snapshot = createTestSnapshot("network-error");
        mockCache.get.mockReturnValue(null);

        (global.fetch as jest.Mock).mockRejectedValue(
          new Error("Network error")
        );

        const result = await generator.generateRecoveryPrompt(snapshot);

        expect(result.isAIGenerated).toBe(false);
      });

      it("should fall back to local generation on timeout", async () => {
        const snapshot = createTestSnapshot("timeout");
        mockCache.get.mockReturnValue(null);

        const abortError = new Error("Aborted");
        abortError.name = "AbortError";
        (global.fetch as jest.Mock).mockRejectedValue(abortError);

        const result = await generator.generateRecoveryPrompt(snapshot);

        expect(result.isAIGenerated).toBe(false);
      });

      it("should fall back to local generation when not authenticated", async () => {
        const snapshot = createTestSnapshot("unauth-session");
        mockCache.get.mockReturnValue(null);
        mockAuth.isAuthenticated.mockResolvedValue(false);

        const result = await generator.generateRecoveryPrompt(snapshot);

        expect(global.fetch).not.toHaveBeenCalled();
        expect(result.isAIGenerated).toBe(false);
      });

      it("should fall back to local generation when no access token", async () => {
        const snapshot = createTestSnapshot("no-token");
        mockCache.get.mockReturnValue(null);
        mockAuth.getAccessToken.mockResolvedValue(null);

        const result = await generator.generateRecoveryPrompt(snapshot);

        expect(result.isAIGenerated).toBe(false);
      });

      it("should fall back when API returns success: false", async () => {
        const snapshot = createTestSnapshot("api-failure");
        mockCache.get.mockReturnValue(null);

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              success: false,
              error: { code: "ERROR", message: "Something went wrong" },
            }),
        });

        const result = await generator.generateRecoveryPrompt(snapshot);

        expect(result.isAIGenerated).toBe(false);
      });
    });

    describe("local generation", () => {
      it("should include current task in local prompt", async () => {
        const snapshot = createTestSnapshot("local-task");
        mockCache.get.mockReturnValue(null);
        mockAuth.isAuthenticated.mockResolvedValue(false);

        const result = await generator.generateRecoveryPrompt(snapshot);

        expect(result.prompt).toContain("Check the session handling");
      });

      it("should include files touched in local prompt", async () => {
        const snapshot = createTestSnapshot("local-files");
        mockCache.get.mockReturnValue(null);
        mockAuth.isAuthenticated.mockResolvedValue(false);

        const result = await generator.generateRecoveryPrompt(snapshot);

        expect(result.prompt).toContain("login.ts");
      });

      it("should include last tool used in local prompt", async () => {
        const snapshot = createTestSnapshot("local-tool");
        mockCache.get.mockReturnValue(null);
        mockAuth.isAuthenticated.mockResolvedValue(false);

        const result = await generator.generateRecoveryPrompt(snapshot);

        expect(result.prompt).toContain("Edit");
      });

      it("should include last request in local prompt", async () => {
        const snapshot = createTestSnapshot("local-request");
        mockCache.get.mockReturnValue(null);
        mockAuth.isAuthenticated.mockResolvedValue(false);

        const result = await generator.generateRecoveryPrompt(snapshot);

        expect(result.prompt).toContain("session handling");
      });
    });

    describe("empty and minimal snapshots", () => {
      it("should handle empty message array", async () => {
        const snapshot = createTestSnapshot("empty-messages", {
          recentMessages: [],
        });
        mockCache.get.mockReturnValue(null);

        const result = await generator.generateRecoveryPrompt(snapshot);

        expect(result.prompt).toContain("Resume my previous session");
        expect(result.isAIGenerated).toBe(false);
      });

      it("should handle snapshot with only one message", async () => {
        const snapshot = createTestSnapshot("single-message", {
          recentMessages: [
            { uuid: "msg-1", type: "user", content: "Help me" },
          ],
        });
        mockCache.get.mockReturnValue(null);
        mockAuth.isAuthenticated.mockResolvedValue(false);

        const result = await generator.generateRecoveryPrompt(snapshot);

        expect(result.prompt).toContain("Help me");
      });

      it("should handle snapshot with no files affected", async () => {
        const snapshot = createTestSnapshot("no-files", {
          filesAffected: [],
        });
        mockCache.get.mockReturnValue(null);
        mockAuth.isAuthenticated.mockResolvedValue(false);

        const result = await generator.generateRecoveryPrompt(snapshot);

        // Should not contain "Files touched" or should handle gracefully
        expect(result.prompt).toBeTruthy();
      });

      it("should handle snapshot with no tools used", async () => {
        const snapshot = createTestSnapshot("no-tools", {
          toolsUsed: [],
        });
        mockCache.get.mockReturnValue(null);
        mockAuth.isAuthenticated.mockResolvedValue(false);

        const result = await generator.generateRecoveryPrompt(snapshot);

        expect(result.prompt).toBeTruthy();
      });
    });

    describe("prompt length limits", () => {
      it("should keep prompt under MAX_PROMPT_LENGTH", async () => {
        // Create snapshot with very long content
        const longContent = "x".repeat(2000);
        const snapshot = createTestSnapshot("long-content", {
          conversationContext: {
            initialTask: longContent,
            currentTask: longContent,
            lastAction: longContent,
            errors: [],
            blockers: [],
          },
        });
        mockCache.get.mockReturnValue(null);
        mockAuth.isAuthenticated.mockResolvedValue(false);

        const result = await generator.generateRecoveryPrompt(snapshot);

        expect(result.prompt.length).toBeLessThanOrEqual(
          RECOVERY_CONSTANTS.MAX_PROMPT_LENGTH
        );
      });

      it("should truncate long AI-generated prompts", async () => {
        const snapshot = createTestSnapshot("long-ai");
        mockCache.get.mockReturnValue(null);

        const longTask = "A".repeat(200);
        const longAction = "B".repeat(200);
        const longPending = "C".repeat(200);

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              summary: {
                task: longTask,
                lastAction: longAction,
                pending: longPending,
              },
            }),
        });

        const result = await generator.generateRecoveryPrompt(snapshot);

        expect(result.prompt.length).toBeLessThanOrEqual(
          RECOVERY_CONSTANTS.MAX_PROMPT_LENGTH
        );
      });
    });
  });

  describe("invalidateCache", () => {
    it("should delete cache entry", async () => {
      await generator.invalidateCache("session-to-invalidate");

      expect(mockCache.delete).toHaveBeenCalledWith("session-to-invalidate");
    });
  });

  describe("clearCache", () => {
    it("should clear all cache entries", async () => {
      await generator.clearCache();

      expect(mockCache.clearAll).toHaveBeenCalled();
    });
  });

  describe("AI prompt format", () => {
    it("should include all summary fields in AI prompt", async () => {
      const snapshot = createTestSnapshot("ai-format");
      mockCache.get.mockReturnValue(null);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            summary: {
              task: "Building a new feature",
              lastAction: "Created the component",
              pending: "Add unit tests",
            },
          }),
      });

      const result = await generator.generateRecoveryPrompt(snapshot);

      expect(result.prompt).toContain("Building a new feature");
      expect(result.prompt).toContain("Created the component");
      expect(result.prompt).toContain("Add unit tests");
    });

    it("should include last request in AI prompt", async () => {
      const snapshot = createTestSnapshot("ai-last-request");
      mockCache.get.mockReturnValue(null);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            summary: {
              task: "Task",
              lastAction: "Action",
              pending: "None",
            },
          }),
      });

      const result = await generator.generateRecoveryPrompt(snapshot);

      expect(result.prompt).toContain("last request");
    });
  });

  describe("createRecoveryPromptGenerator", () => {
    it("should create a new generator instance", () => {
      const newGenerator = createRecoveryPromptGenerator(
        mockCache as unknown as RecoveryPromptCache,
        mockAuth as unknown as AuthService
      );

      expect(newGenerator).toBeInstanceOf(RecoveryPromptGenerator);
    });
  });

  describe("logging", () => {
    it("should log when using cached prompt", async () => {
      const snapshot = createTestSnapshot("log-cached");
      mockCache.get.mockReturnValue({
        sessionId: "log-cached",
        prompt: "Cached",
        generatedAt: new Date(),
        isAIGenerated: true,
      });

      await generator.generateRecoveryPrompt(snapshot);

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Using cached recovery prompt")
      );
    });

    it("should log when generating local prompt", async () => {
      const snapshot = createTestSnapshot("log-local");
      mockCache.get.mockReturnValue(null);
      mockAuth.isAuthenticated.mockResolvedValue(false);

      await generator.generateRecoveryPrompt(snapshot);

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Generating local prompt")
      );
    });

    it("should log API call", async () => {
      const snapshot = createTestSnapshot("log-api");
      mockCache.get.mockReturnValue(null);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            summary: { task: "T", lastAction: "A", pending: "P" },
          }),
      });

      await generator.generateRecoveryPrompt(snapshot);

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Calling API for session")
      );
    });
  });
});
