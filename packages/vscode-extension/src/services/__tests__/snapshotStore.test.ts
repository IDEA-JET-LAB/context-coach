/**
 * Unit tests for Snapshot Store Service - Story 18-2
 *
 * Tests cover:
 * - Saving and retrieving snapshots
 * - Serialization and deserialization of Date objects
 * - Expiration handling
 * - Listing snapshots
 * - Clearing snapshots
 * - Storage statistics
 */

import { SnapshotStore, createSnapshotStore } from "../snapshotStore";
import type {
  SessionStateSnapshot,
  SerializedSnapshot,
} from "../../types/sessionState";
import { SNAPSHOT_CONSTANTS } from "../../types/sessionState";

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

describe("SnapshotStore", () => {
  let store: SnapshotStore;
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

  beforeEach(() => {
    mockGlobalState.clear();
    mockContext = createMockContext();
    mockOutputChannel = createMockOutputChannel();
    store = new SnapshotStore(mockContext as unknown as import("vscode").ExtensionContext);
    store.initialize(mockOutputChannel as unknown as import("vscode").OutputChannel);
  });

  describe("saveSnapshot", () => {
    it("should save snapshot to globalState", async () => {
      const snapshot = createTestSnapshot("session-1");

      await store.saveSnapshot(snapshot);

      expect(mockContext.globalState.update).toHaveBeenCalledWith(
        `${SNAPSHOT_CONSTANTS.STORAGE_PREFIX}session-1`,
        expect.any(Object)
      );
    });

    it("should serialize dates to ISO strings", async () => {
      const snapshot = createTestSnapshot("session-2");

      await store.saveSnapshot(snapshot);

      const storedValue = mockGlobalState.get(
        `${SNAPSHOT_CONSTANTS.STORAGE_PREFIX}session-2`
      ) as SerializedSnapshot;

      expect(typeof storedValue.capturedAt).toBe("string");
      expect(typeof storedValue.expiresAt).toBe("string");
      expect(typeof storedValue.recentMessages[0].timestamp).toBe("string");
    });

    it("should log save operation", async () => {
      const snapshot = createTestSnapshot("session-log");

      await store.saveSnapshot(snapshot);

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Saved snapshot for session: session-log")
      );
    });
  });

  describe("getSnapshot", () => {
    it("should retrieve saved snapshot", async () => {
      const snapshot = createTestSnapshot("session-get");
      await store.saveSnapshot(snapshot);

      const retrieved = store.getSnapshot("session-get");

      expect(retrieved).not.toBeNull();
      expect(retrieved?.sessionId).toBe("session-get");
    });

    it("should deserialize dates back to Date objects", async () => {
      const snapshot = createTestSnapshot("session-dates");
      await store.saveSnapshot(snapshot);

      const retrieved = store.getSnapshot("session-dates");

      expect(retrieved?.capturedAt).toBeInstanceOf(Date);
      expect(retrieved?.expiresAt).toBeInstanceOf(Date);
      expect(retrieved?.recentMessages[0].timestamp).toBeInstanceOf(Date);
      expect(retrieved?.filesAffected[0].lastAccessed).toBeInstanceOf(Date);
      expect(retrieved?.toolsUsed[0].lastInvokedAt).toBeInstanceOf(Date);
    });

    it("should return null for non-existent snapshot", () => {
      const result = store.getSnapshot("non-existent");
      expect(result).toBeNull();
    });

    it("should return null for expired snapshot", async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      const snapshot = createTestSnapshot("session-expired", {
        expiresAt: expiredDate,
      });

      // Manually set the expired snapshot
      mockGlobalState.set(`${SNAPSHOT_CONSTANTS.STORAGE_PREFIX}session-expired`, {
        sessionId: "session-expired",
        capturedAt: snapshot.capturedAt.toISOString(),
        expiresAt: expiredDate.toISOString(),
        recentMessages: [],
        filesAffected: [],
        toolsUsed: [],
        pendingOperations: [],
        conversationContext: snapshot.conversationContext,
        gitContext: null,
      });

      const result = store.getSnapshot("session-expired");
      expect(result).toBeNull();
    });

    it("should handle missing optional timestamp", async () => {
      const snapshot = createTestSnapshot("session-no-timestamp");
      snapshot.recentMessages[0].timestamp = undefined;

      await store.saveSnapshot(snapshot);
      const retrieved = store.getSnapshot("session-no-timestamp");

      expect(retrieved?.recentMessages[0].timestamp).toBeUndefined();
    });
  });

  describe("listSnapshots", () => {
    it("should list all snapshot session IDs", async () => {
      await store.saveSnapshot(createTestSnapshot("session-a"));
      await store.saveSnapshot(createTestSnapshot("session-b"));
      await store.saveSnapshot(createTestSnapshot("session-c"));

      const list = store.listSnapshots();

      expect(list).toContain("session-a");
      expect(list).toContain("session-b");
      expect(list).toContain("session-c");
      expect(list.length).toBe(3);
    });

    it("should return empty array when no snapshots", () => {
      const list = store.listSnapshots();
      expect(list).toEqual([]);
    });

    it("should not include non-snapshot keys", () => {
      mockGlobalState.set("other.key", { data: "test" });
      mockGlobalState.set(`${SNAPSHOT_CONSTANTS.STORAGE_PREFIX}real-session`, {});

      const list = store.listSnapshots();

      expect(list).toEqual(["real-session"]);
    });
  });

  describe("listValidSnapshots", () => {
    it("should list only non-expired snapshots", async () => {
      const validSnapshot = createTestSnapshot("valid-session");
      await store.saveSnapshot(validSnapshot);

      // Add an expired snapshot directly
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      mockGlobalState.set(`${SNAPSHOT_CONSTANTS.STORAGE_PREFIX}expired-session`, {
        sessionId: "expired-session",
        capturedAt: expiredDate.toISOString(),
        expiresAt: expiredDate.toISOString(),
        recentMessages: [],
        filesAffected: [],
        toolsUsed: [],
        pendingOperations: [],
        conversationContext: {
          initialTask: "",
          currentTask: "",
          lastAction: "",
          errors: [],
          blockers: [],
        },
        gitContext: null,
      });

      const validList = store.listValidSnapshots();

      expect(validList.length).toBe(1);
      expect(validList[0].sessionId).toBe("valid-session");
    });

    it("should sort by capturedAt descending", async () => {
      const older = createTestSnapshot("older");
      older.capturedAt = new Date("2024-01-01T10:00:00Z");

      const newer = createTestSnapshot("newer");
      newer.capturedAt = new Date("2024-01-02T10:00:00Z");

      await store.saveSnapshot(older);
      await store.saveSnapshot(newer);

      const list = store.listValidSnapshots();

      expect(list[0].sessionId).toBe("newer");
      expect(list[1].sessionId).toBe("older");
    });

    it("should include capturedAt and expiresAt in results", async () => {
      const snapshot = createTestSnapshot("with-dates");
      await store.saveSnapshot(snapshot);

      const list = store.listValidSnapshots();

      expect(list[0].capturedAt).toBeInstanceOf(Date);
      expect(list[0].expiresAt).toBeInstanceOf(Date);
    });
  });

  describe("deleteSnapshot", () => {
    it("should delete existing snapshot", async () => {
      await store.saveSnapshot(createTestSnapshot("to-delete"));

      const result = await store.deleteSnapshot("to-delete");

      expect(result).toBe(true);
      expect(store.getSnapshot("to-delete")).toBeNull();
    });

    it("should return false for non-existent snapshot", async () => {
      const result = await store.deleteSnapshot("non-existent");
      expect(result).toBe(false);
    });

    it("should log deletion", async () => {
      await store.saveSnapshot(createTestSnapshot("to-delete-log"));
      await store.deleteSnapshot("to-delete-log");

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Deleted snapshot for session: to-delete-log")
      );
    });
  });

  describe("cleanExpiredSnapshots", () => {
    it("should remove expired snapshots", async () => {
      // Add a valid snapshot
      await store.saveSnapshot(createTestSnapshot("valid"));

      // Add an expired snapshot directly
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      mockGlobalState.set(`${SNAPSHOT_CONSTANTS.STORAGE_PREFIX}expired`, {
        sessionId: "expired",
        capturedAt: expiredDate.toISOString(),
        expiresAt: expiredDate.toISOString(),
        recentMessages: [],
        filesAffected: [],
        toolsUsed: [],
        pendingOperations: [],
        conversationContext: {
          initialTask: "",
          currentTask: "",
          lastAction: "",
          errors: [],
          blockers: [],
        },
        gitContext: null,
      });

      const cleaned = await store.cleanExpiredSnapshots();

      expect(cleaned).toBe(1);
      expect(store.listSnapshots()).toEqual(["valid"]);
    });

    it("should return 0 when no expired snapshots", async () => {
      await store.saveSnapshot(createTestSnapshot("fresh"));

      const cleaned = await store.cleanExpiredSnapshots();

      expect(cleaned).toBe(0);
    });

    it("should log cleanup count", async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      mockGlobalState.set(`${SNAPSHOT_CONSTANTS.STORAGE_PREFIX}exp1`, {
        sessionId: "exp1",
        expiresAt: expiredDate.toISOString(),
        capturedAt: expiredDate.toISOString(),
        recentMessages: [],
        filesAffected: [],
        toolsUsed: [],
        pendingOperations: [],
        conversationContext: { initialTask: "", currentTask: "", lastAction: "", errors: [], blockers: [] },
        gitContext: null,
      });

      await store.cleanExpiredSnapshots();

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Cleaned up 1 expired snapshot")
      );
    });
  });

  describe("clearAllSnapshots", () => {
    it("should remove all snapshots", async () => {
      await store.saveSnapshot(createTestSnapshot("s1"));
      await store.saveSnapshot(createTestSnapshot("s2"));
      await store.saveSnapshot(createTestSnapshot("s3"));

      const cleared = await store.clearAllSnapshots();

      expect(cleared).toBe(3);
      expect(store.listSnapshots()).toEqual([]);
    });

    it("should return 0 when no snapshots", async () => {
      const cleared = await store.clearAllSnapshots();
      expect(cleared).toBe(0);
    });

    it("should log clear count", async () => {
      await store.saveSnapshot(createTestSnapshot("to-clear"));
      await store.clearAllSnapshots();

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Cleared 1 snapshot")
      );
    });
  });

  describe("hasSnapshot", () => {
    it("should return true for existing snapshot", async () => {
      await store.saveSnapshot(createTestSnapshot("exists"));

      expect(store.hasSnapshot("exists")).toBe(true);
    });

    it("should return false for non-existent snapshot", () => {
      expect(store.hasSnapshot("not-exists")).toBe(false);
    });
  });

  describe("getStorageStats", () => {
    it("should return correct statistics", async () => {
      // Add 2 valid snapshots
      await store.saveSnapshot(createTestSnapshot("valid1"));
      await store.saveSnapshot(createTestSnapshot("valid2"));

      // Add 1 expired snapshot
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      mockGlobalState.set(`${SNAPSHOT_CONSTANTS.STORAGE_PREFIX}expired`, {
        sessionId: "expired",
        expiresAt: expiredDate.toISOString(),
        capturedAt: expiredDate.toISOString(),
        recentMessages: [],
        filesAffected: [],
        toolsUsed: [],
        pendingOperations: [],
        conversationContext: { initialTask: "", currentTask: "", lastAction: "", errors: [], blockers: [] },
        gitContext: null,
      });

      const stats = store.getStorageStats();

      expect(stats.totalSnapshots).toBe(3);
      expect(stats.validSnapshots).toBe(2);
      expect(stats.expiredSnapshots).toBe(1);
    });

    it("should return zeros when empty", () => {
      const stats = store.getStorageStats();

      expect(stats.totalSnapshots).toBe(0);
      expect(stats.validSnapshots).toBe(0);
      expect(stats.expiredSnapshots).toBe(0);
    });
  });

  describe("createSnapshotStore", () => {
    it("should create a new SnapshotStore instance", () => {
      const newStore = createSnapshotStore(
        mockContext as unknown as import("vscode").ExtensionContext
      );

      expect(newStore).toBeInstanceOf(SnapshotStore);
    });
  });

  describe("Serialization Edge Cases", () => {
    it("should handle null gitContext", async () => {
      const snapshot = createTestSnapshot("null-git", { gitContext: null });

      await store.saveSnapshot(snapshot);
      const retrieved = store.getSnapshot("null-git");

      expect(retrieved?.gitContext).toBeNull();
    });

    it("should handle empty arrays", async () => {
      const snapshot = createTestSnapshot("empty-arrays", {
        recentMessages: [],
        filesAffected: [],
        toolsUsed: [],
        pendingOperations: [],
      });

      await store.saveSnapshot(snapshot);
      const retrieved = store.getSnapshot("empty-arrays");

      expect(retrieved?.recentMessages).toEqual([]);
      expect(retrieved?.filesAffected).toEqual([]);
      expect(retrieved?.toolsUsed).toEqual([]);
      expect(retrieved?.pendingOperations).toEqual([]);
    });

    it("should handle complex lastArgs in toolsUsed", async () => {
      const complexArgs = {
        nested: {
          array: [1, 2, 3],
          object: { key: "value" },
        },
        boolean: true,
        number: 42,
      };

      const snapshot = createTestSnapshot("complex-args");
      snapshot.toolsUsed[0].lastArgs = complexArgs;

      await store.saveSnapshot(snapshot);
      const retrieved = store.getSnapshot("complex-args");

      expect(retrieved?.toolsUsed[0].lastArgs).toEqual(complexArgs);
    });

    it("should handle special characters in content", async () => {
      const snapshot = createTestSnapshot("special-chars");
      snapshot.recentMessages[0].content = 'Test with "quotes" and \n newlines';
      snapshot.conversationContext.initialTask = "Task with emoji: \u{1F600}";

      await store.saveSnapshot(snapshot);
      const retrieved = store.getSnapshot("special-chars");

      expect(retrieved?.recentMessages[0].content).toBe(
        'Test with "quotes" and \n newlines'
      );
      expect(retrieved?.conversationContext.initialTask).toBe(
        "Task with emoji: \u{1F600}"
      );
    });

    it("should handle pendingOperations correctly", async () => {
      const snapshot = createTestSnapshot("with-pending");
      snapshot.pendingOperations = [
        {
          toolName: "Bash",
          args: { command: "npm test" },
          startedAt: new Date("2024-01-15T10:00:00Z"),
        },
      ];

      await store.saveSnapshot(snapshot);
      const retrieved = store.getSnapshot("with-pending");

      expect(retrieved?.pendingOperations.length).toBe(1);
      expect(retrieved?.pendingOperations[0].toolName).toBe("Bash");
      expect(retrieved?.pendingOperations[0].startedAt).toBeInstanceOf(Date);
    });
  });
});
