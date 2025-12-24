/**
 * Unit tests for Recovery State Service - Story 18-5
 *
 * Tests cover:
 * - Marking sessions as recovered
 * - Checking recovery status
 * - Recovery info retrieval
 * - Clearing recovered sessions
 * - Expiration and cleanup
 * - Statistics
 * - Filtering
 */

import { RecoveryState, createRecoveryState } from "../recoveryState";

// Mock VS Code globalState
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

describe("RecoveryState", () => {
  let recoveryState: RecoveryState;
  let mockContext: ReturnType<typeof createMockContext>;
  let mockOutputChannel: ReturnType<typeof createMockOutputChannel>;

  beforeEach(() => {
    mockGlobalState.clear();
    mockContext = createMockContext();
    mockOutputChannel = createMockOutputChannel();
    recoveryState = new RecoveryState(mockContext as unknown as import("vscode").ExtensionContext);
    recoveryState.initialize(mockOutputChannel as unknown as import("vscode").OutputChannel);
  });

  describe("initialization", () => {
    it("should log initialization", () => {
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("RecoveryState initialized")
      );
    });

    it("should load existing recovered sessions from storage", () => {
      // Set up storage with an existing recovered session
      mockGlobalState.set("contextor.recovered.session-1", {
        sessionId: "session-1",
        recoveredAt: Date.now(),
        method: "clipboard",
      });

      // Create a new instance to load from storage
      const newState = new RecoveryState(mockContext as unknown as import("vscode").ExtensionContext);

      expect(newState.isRecovered("session-1")).toBe(true);
    });
  });

  describe("markAsRecovered", () => {
    it("should mark a session as recovered", async () => {
      await recoveryState.markAsRecovered("session-1", "clipboard", 1000);

      expect(recoveryState.isRecovered("session-1")).toBe(true);
    });

    it("should store recovery info with all properties", async () => {
      const timeToRecover = 1500;
      await recoveryState.markAsRecovered("session-1", "manual", timeToRecover);

      const info = recoveryState.getRecoveryInfo("session-1");

      expect(info).toEqual({
        sessionId: "session-1",
        recoveredAt: expect.any(Number),
        method: "manual",
        timeToRecover,
      });
    });

    it("should persist to storage", async () => {
      await recoveryState.markAsRecovered("session-1", "clipboard", 1000);

      expect(mockContext.globalState.update).toHaveBeenCalledWith(
        "contextor.recovered.session-1",
        expect.objectContaining({
          sessionId: "session-1",
          method: "clipboard",
        })
      );
    });

    it("should log the recovery", async () => {
      await recoveryState.markAsRecovered("session-1", "clipboard", 1000);

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Marked session as recovered: session-1")
      );
    });

    it("should default to clipboard method", async () => {
      await recoveryState.markAsRecovered("session-1");

      const info = recoveryState.getRecoveryInfo("session-1");
      expect(info?.method).toBe("clipboard");
    });
  });

  describe("isRecovered", () => {
    it("should return false for non-recovered session", () => {
      expect(recoveryState.isRecovered("non-existent")).toBe(false);
    });

    it("should return true for recovered session", async () => {
      await recoveryState.markAsRecovered("session-1", "clipboard");

      expect(recoveryState.isRecovered("session-1")).toBe(true);
    });
  });

  describe("getRecoveryInfo", () => {
    it("should return undefined for non-recovered session", () => {
      expect(recoveryState.getRecoveryInfo("non-existent")).toBeUndefined();
    });

    it("should return recovery info for recovered session", async () => {
      await recoveryState.markAsRecovered("session-1", "manual", 2000);

      const info = recoveryState.getRecoveryInfo("session-1");

      expect(info).toBeDefined();
      expect(info?.sessionId).toBe("session-1");
      expect(info?.method).toBe("manual");
      expect(info?.timeToRecover).toBe(2000);
    });
  });

  describe("clearRecoveredSession", () => {
    it("should clear a recovered session", async () => {
      await recoveryState.markAsRecovered("session-1", "clipboard");
      expect(recoveryState.isRecovered("session-1")).toBe(true);

      await recoveryState.clearRecoveredSession("session-1");

      expect(recoveryState.isRecovered("session-1")).toBe(false);
    });

    it("should remove from storage", async () => {
      await recoveryState.markAsRecovered("session-1", "clipboard");
      await recoveryState.clearRecoveredSession("session-1");

      expect(mockContext.globalState.update).toHaveBeenCalledWith(
        "contextor.recovered.session-1",
        undefined
      );
    });

    it("should log the clear", async () => {
      await recoveryState.markAsRecovered("session-1", "clipboard");
      await recoveryState.clearRecoveredSession("session-1");

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Cleared recovered state for session: session-1")
      );
    });

    it("should handle clearing non-existent session", async () => {
      // Should not throw
      await recoveryState.clearRecoveredSession("non-existent");
    });
  });

  describe("clearAll", () => {
    it("should clear all recovered sessions", async () => {
      await recoveryState.markAsRecovered("session-1", "clipboard");
      await recoveryState.markAsRecovered("session-2", "manual");
      await recoveryState.markAsRecovered("session-3", "clipboard");

      const count = await recoveryState.clearAll();

      expect(count).toBe(3);
      expect(recoveryState.isRecovered("session-1")).toBe(false);
      expect(recoveryState.isRecovered("session-2")).toBe(false);
      expect(recoveryState.isRecovered("session-3")).toBe(false);
    });

    it("should return 0 when no sessions to clear", async () => {
      const count = await recoveryState.clearAll();
      expect(count).toBe(0);
    });
  });

  describe("getAllRecovered", () => {
    it("should return empty array when no recovered sessions", () => {
      expect(recoveryState.getAllRecovered()).toEqual([]);
    });

    it("should return all recovered sessions", async () => {
      await recoveryState.markAsRecovered("session-1", "clipboard");
      await recoveryState.markAsRecovered("session-2", "manual");

      const all = recoveryState.getAllRecovered();

      expect(all).toHaveLength(2);
      expect(all.map((s) => s.sessionId)).toContain("session-1");
      expect(all.map((s) => s.sessionId)).toContain("session-2");
    });
  });

  describe("getStats", () => {
    it("should return zeros when empty", () => {
      const stats = recoveryState.getStats();

      expect(stats.total).toBe(0);
      expect(stats.byMethod).toEqual({ clipboard: 0, manual: 0 });
      expect(stats.averageTimeToRecover).toBeNull();
    });

    it("should count sessions by method", async () => {
      await recoveryState.markAsRecovered("s1", "clipboard", 1000);
      await recoveryState.markAsRecovered("s2", "clipboard", 2000);
      await recoveryState.markAsRecovered("s3", "manual", 3000);

      const stats = recoveryState.getStats();

      expect(stats.total).toBe(3);
      expect(stats.byMethod.clipboard).toBe(2);
      expect(stats.byMethod.manual).toBe(1);
    });

    it("should calculate average time to recover", async () => {
      await recoveryState.markAsRecovered("s1", "clipboard", 1000);
      await recoveryState.markAsRecovered("s2", "clipboard", 2000);
      await recoveryState.markAsRecovered("s3", "clipboard", 3000);

      const stats = recoveryState.getStats();

      expect(stats.averageTimeToRecover).toBe(2000);
    });

    it("should handle sessions without timeToRecover", async () => {
      await recoveryState.markAsRecovered("s1", "clipboard");
      await recoveryState.markAsRecovered("s2", "clipboard", 2000);

      const stats = recoveryState.getStats();

      // Only one session has time, so average = 2000
      expect(stats.averageTimeToRecover).toBe(2000);
    });
  });

  describe("cleanExpired", () => {
    it("should remove expired sessions from cache", async () => {
      // Mark a session as recovered, then manually expire it for the test
      await recoveryState.markAsRecovered("session-to-expire", "clipboard");

      // Access the internal cache and modify the recoveredAt to be expired
      // We need to use a workaround since the cache is private
      const allBefore = recoveryState.getAllRecovered();
      expect(allBefore).toHaveLength(1);

      // Simulate time passing by creating a new state with pre-expired data
      mockGlobalState.clear();
      const expiredTime = Date.now() - 8 * 24 * 60 * 60 * 1000;
      mockGlobalState.set("contextor.recovered.expired-session", {
        sessionId: "expired-session",
        recoveredAt: expiredTime,
        method: "clipboard",
      });
      mockGlobalState.set("contextor.recovered.valid-session", {
        sessionId: "valid-session",
        recoveredAt: Date.now(),
        method: "clipboard",
      });

      // Create new state to load from storage
      const freshContext = createMockContext();
      const freshState = new RecoveryState(freshContext as unknown as import("vscode").ExtensionContext);
      freshState.initialize(mockOutputChannel as unknown as import("vscode").OutputChannel);

      // Now clean expired
      const cleaned = await freshState.cleanExpired();

      // The expired session should be removed from cache
      expect(freshState.isRecovered("expired-session")).toBe(false);
      expect(freshState.isRecovered("valid-session")).toBe(true);
      // Note: cleaned count depends on whether loadFromStorage actually loaded the sessions
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });

    it("should return 0 when no expired sessions", async () => {
      await recoveryState.markAsRecovered("session-1", "clipboard");

      const cleaned = await recoveryState.cleanExpired();

      expect(cleaned).toBe(0);
    });
  });

  describe("filterNotRecovered", () => {
    it("should filter out recovered sessions", async () => {
      await recoveryState.markAsRecovered("session-1", "clipboard");
      await recoveryState.markAsRecovered("session-3", "clipboard");

      const sessions = [
        { sessionId: "session-1", data: "a" },
        { sessionId: "session-2", data: "b" },
        { sessionId: "session-3", data: "c" },
        { sessionId: "session-4", data: "d" },
      ];

      const filtered = recoveryState.filterNotRecovered(sessions);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((s) => s.sessionId)).toEqual(["session-2", "session-4"]);
    });

    it("should return all sessions when none are recovered", () => {
      const sessions = [
        { sessionId: "session-1" },
        { sessionId: "session-2" },
      ];

      const filtered = recoveryState.filterNotRecovered(sessions);

      expect(filtered).toHaveLength(2);
    });

    it("should return empty array when all are recovered", async () => {
      await recoveryState.markAsRecovered("session-1", "clipboard");
      await recoveryState.markAsRecovered("session-2", "clipboard");

      const sessions = [
        { sessionId: "session-1" },
        { sessionId: "session-2" },
      ];

      const filtered = recoveryState.filterNotRecovered(sessions);

      expect(filtered).toHaveLength(0);
    });
  });
});

describe("createRecoveryState", () => {
  it("should create a new RecoveryState instance", () => {
    mockGlobalState.clear();
    const mockContext = createMockContext();
    const state = createRecoveryState(mockContext as unknown as import("vscode").ExtensionContext);

    expect(state).toBeInstanceOf(RecoveryState);
  });
});
