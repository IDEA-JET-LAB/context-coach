/**
 * Unit tests for Dismissal Service - Story 18-4
 *
 * Tests cover:
 * - Dismissing single and multiple sessions
 * - Checking dismissal status
 * - 7-day expiration handling
 * - Filtering dismissed sessions
 * - Cleanup of expired dismissals
 * - Storage statistics
 */

import {
  DismissalService,
  createDismissalService,
  DEFAULT_DISMISSAL_CONFIG,
} from "../dismissalService";

// Mock storage
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

describe("DismissalService", () => {
  let service: DismissalService;
  let mockContext: ReturnType<typeof createMockContext>;
  let mockOutputChannel: ReturnType<typeof createMockOutputChannel>;

  beforeEach(() => {
    mockGlobalState.clear();
    mockContext = createMockContext();
    mockOutputChannel = createMockOutputChannel();
    service = new DismissalService(
      mockContext as unknown as import("vscode").ExtensionContext
    );
    service.initialize(mockOutputChannel as unknown as import("vscode").OutputChannel);
  });

  afterEach(() => {
    service.dispose();
  });

  describe("dismissSession", () => {
    it("should dismiss a session", async () => {
      await service.dismissSession("session-1");

      expect(service.isDismissed("session-1")).toBe(true);
    });

    it("should store dismissal with expiration", async () => {
      const beforeDismiss = Date.now();
      await service.dismissSession("session-2");

      const storage = mockGlobalState.get(DEFAULT_DISMISSAL_CONFIG.storageKey) as {
        sessions: Record<string, unknown>;
      };
      const dismissal = storage.sessions["session-2"] as {
        dismissedAt: number;
        expiresAt: number;
      };

      expect(dismissal.dismissedAt).toBeGreaterThanOrEqual(beforeDismiss);
      expect(dismissal.expiresAt).toBeGreaterThan(dismissal.dismissedAt);

      // Check expiry is roughly 7 days out
      const expectedExpiry =
        dismissal.dismissedAt + DEFAULT_DISMISSAL_CONFIG.expiryDays * 24 * 60 * 60 * 1000;
      expect(dismissal.expiresAt).toBe(expectedExpiry);
    });

    it("should log dismissal", async () => {
      await service.dismissSession("session-log");

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Dismissed session: session-log")
      );
    });
  });

  describe("dismissSessions", () => {
    it("should dismiss multiple sessions at once", async () => {
      await service.dismissSessions(["s1", "s2", "s3"]);

      expect(service.isDismissed("s1")).toBe(true);
      expect(service.isDismissed("s2")).toBe(true);
      expect(service.isDismissed("s3")).toBe(true);
    });

    it("should do nothing for empty array", async () => {
      await service.dismissSessions([]);

      expect(mockContext.globalState.update).not.toHaveBeenCalled();
    });

    it("should log bulk dismissal", async () => {
      await service.dismissSessions(["s1", "s2"]);

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Dismissed 2 session(s)")
      );
    });
  });

  describe("isDismissed", () => {
    it("should return true for dismissed session", async () => {
      await service.dismissSession("dismissed-session");

      expect(service.isDismissed("dismissed-session")).toBe(true);
    });

    it("should return false for non-dismissed session", () => {
      expect(service.isDismissed("not-dismissed")).toBe(false);
    });

    it("should return false for expired dismissal", async () => {
      // Manually add an expired dismissal
      const expiredTime = Date.now() - 24 * 60 * 60 * 1000; // Yesterday
      mockGlobalState.set(DEFAULT_DISMISSAL_CONFIG.storageKey, {
        sessions: {
          "expired-session": {
            sessionId: "expired-session",
            dismissedAt: expiredTime - 7 * 24 * 60 * 60 * 1000,
            expiresAt: expiredTime,
          },
        },
        lastCleanup: Date.now(),
      });

      // Force cache refresh by getting storage
      await service.cleanExpired();

      expect(service.isDismissed("expired-session")).toBe(false);
    });
  });

  describe("filterDismissed", () => {
    it("should filter out dismissed sessions", async () => {
      await service.dismissSession("dismissed");

      const sessions = [
        { sessionId: "active-1", name: "Active 1" },
        { sessionId: "dismissed", name: "Dismissed" },
        { sessionId: "active-2", name: "Active 2" },
      ];

      const filtered = service.filterDismissed(sessions);

      expect(filtered.length).toBe(2);
      expect(filtered.map((s) => s.sessionId)).toEqual(["active-1", "active-2"]);
    });

    it("should return all sessions when none dismissed", () => {
      const sessions = [
        { sessionId: "s1", name: "S1" },
        { sessionId: "s2", name: "S2" },
      ];

      const filtered = service.filterDismissed(sessions);

      expect(filtered).toEqual(sessions);
    });

    it("should return empty array when all dismissed", async () => {
      await service.dismissSessions(["s1", "s2"]);

      const sessions = [
        { sessionId: "s1", name: "S1" },
        { sessionId: "s2", name: "S2" },
      ];

      const filtered = service.filterDismissed(sessions);

      expect(filtered).toEqual([]);
    });
  });

  describe("getDismissedSessionIds", () => {
    it("should return all dismissed session IDs", async () => {
      await service.dismissSessions(["s1", "s2", "s3"]);

      const ids = service.getDismissedSessionIds();

      expect(ids).toContain("s1");
      expect(ids).toContain("s2");
      expect(ids).toContain("s3");
      expect(ids.length).toBe(3);
    });

    it("should return empty array when none dismissed", () => {
      const ids = service.getDismissedSessionIds();
      expect(ids).toEqual([]);
    });

    it("should not include expired dismissals", async () => {
      await service.dismissSession("active");

      // Add an expired dismissal
      const storage = mockGlobalState.get(DEFAULT_DISMISSAL_CONFIG.storageKey) as {
        sessions: Record<string, unknown>;
        lastCleanup: number;
      };
      storage.sessions["expired"] = {
        sessionId: "expired",
        dismissedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
        expiresAt: Date.now() - 24 * 60 * 60 * 1000, // Expired yesterday
      };
      mockGlobalState.set(DEFAULT_DISMISSAL_CONFIG.storageKey, storage);

      const ids = service.getDismissedSessionIds();

      expect(ids).toContain("active");
      expect(ids).not.toContain("expired");
    });
  });

  describe("undismissSession", () => {
    it("should remove dismissal", async () => {
      await service.dismissSession("to-undismiss");
      expect(service.isDismissed("to-undismiss")).toBe(true);

      const result = await service.undismissSession("to-undismiss");

      expect(result).toBe(true);
      expect(service.isDismissed("to-undismiss")).toBe(false);
    });

    it("should return false for non-existent dismissal", async () => {
      const result = await service.undismissSession("not-dismissed");

      expect(result).toBe(false);
    });

    it("should log undismissal", async () => {
      await service.dismissSession("to-undismiss-log");
      await service.undismissSession("to-undismiss-log");

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Undismissed session: to-undismiss-log")
      );
    });
  });

  describe("cleanExpired", () => {
    it("should remove expired dismissals", async () => {
      // Add an active dismissal
      await service.dismissSession("active");

      // Add an expired dismissal
      const storage = mockGlobalState.get(DEFAULT_DISMISSAL_CONFIG.storageKey) as {
        sessions: Record<string, unknown>;
        lastCleanup: number;
      };
      storage.sessions["expired"] = {
        sessionId: "expired",
        dismissedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
        expiresAt: Date.now() - 24 * 60 * 60 * 1000,
      };
      mockGlobalState.set(DEFAULT_DISMISSAL_CONFIG.storageKey, storage);

      const cleaned = await service.cleanExpired();

      expect(cleaned).toBe(1);
      expect(service.isDismissed("active")).toBe(true);
      expect(service.isDismissed("expired")).toBe(false);
    });

    it("should return 0 when no expired dismissals", async () => {
      await service.dismissSession("fresh");

      const cleaned = await service.cleanExpired();

      expect(cleaned).toBe(0);
    });

    it("should log cleanup count when items removed", async () => {
      const storage = {
        sessions: {
          expired: {
            sessionId: "expired",
            dismissedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
            expiresAt: Date.now() - 24 * 60 * 60 * 1000,
          },
        },
        lastCleanup: Date.now() - 24 * 60 * 60 * 1000,
      };
      mockGlobalState.set(DEFAULT_DISMISSAL_CONFIG.storageKey, storage);

      await service.cleanExpired();

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Cleaned 1 expired dismissal")
      );
    });
  });

  describe("clearAll", () => {
    it("should clear all dismissals", async () => {
      await service.dismissSessions(["s1", "s2", "s3"]);

      const cleared = await service.clearAll();

      expect(cleared).toBe(3);
      expect(service.isDismissed("s1")).toBe(false);
      expect(service.isDismissed("s2")).toBe(false);
      expect(service.isDismissed("s3")).toBe(false);
    });

    it("should return 0 when no dismissals", async () => {
      const cleared = await service.clearAll();

      expect(cleared).toBe(0);
    });

    it("should log clear count", async () => {
      await service.dismissSession("to-clear");
      await service.clearAll();

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Cleared all 1 dismissal")
      );
    });
  });

  describe("getStats", () => {
    it("should return correct statistics", async () => {
      // Add 2 active dismissals
      await service.dismissSessions(["active1", "active2"]);

      // Add 1 expired dismissal
      const storage = mockGlobalState.get(DEFAULT_DISMISSAL_CONFIG.storageKey) as {
        sessions: Record<string, unknown>;
        lastCleanup: number;
      };
      storage.sessions["expired"] = {
        sessionId: "expired",
        dismissedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
        expiresAt: Date.now() - 24 * 60 * 60 * 1000,
      };
      mockGlobalState.set(DEFAULT_DISMISSAL_CONFIG.storageKey, storage);

      const stats = service.getStats();

      expect(stats.totalDismissed).toBe(3);
      expect(stats.activeCount).toBe(2);
      expect(stats.expiredCount).toBe(1);
    });

    it("should return zeros when empty", () => {
      const stats = service.getStats();

      expect(stats.totalDismissed).toBe(0);
      expect(stats.activeCount).toBe(0);
      expect(stats.expiredCount).toBe(0);
    });
  });

  describe("createDismissalService", () => {
    it("should create a new DismissalService instance", () => {
      const newService = createDismissalService(
        mockContext as unknown as import("vscode").ExtensionContext
      );
      expect(newService).toBeInstanceOf(DismissalService);
      newService.dispose();
    });

    it("should accept configuration options", () => {
      const newService = createDismissalService(
        mockContext as unknown as import("vscode").ExtensionContext,
        { expiryDays: 14 }
      );
      expect(newService).toBeInstanceOf(DismissalService);
      newService.dispose();
    });
  });

  describe("DEFAULT_DISMISSAL_CONFIG", () => {
    it("should have expected default values", () => {
      expect(DEFAULT_DISMISSAL_CONFIG.expiryDays).toBe(7);
      expect(DEFAULT_DISMISSAL_CONFIG.storageKey).toBe("contextor.dismissedSessions");
    });
  });

  describe("custom expiry days", () => {
    it("should respect custom expiry configuration", async () => {
      const customService = new DismissalService(
        mockContext as unknown as import("vscode").ExtensionContext,
        { expiryDays: 1 }
      );
      customService.initialize(
        mockOutputChannel as unknown as import("vscode").OutputChannel
      );

      const beforeDismiss = Date.now();
      await customService.dismissSession("custom-expiry");

      const storage = mockGlobalState.get(DEFAULT_DISMISSAL_CONFIG.storageKey) as {
        sessions: Record<string, unknown>;
      };
      const dismissal = storage.sessions["custom-expiry"] as {
        expiresAt: number;
      };

      // Check expiry is roughly 1 day out
      const expectedExpiry = beforeDismiss + 1 * 24 * 60 * 60 * 1000;
      expect(Math.abs(dismissal.expiresAt - expectedExpiry)).toBeLessThan(1000);

      customService.dispose();
    });
  });
});
