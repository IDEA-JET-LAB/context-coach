/**
 * Unit tests for Session Watcher - Story 18-4
 *
 * Tests cover:
 * - Starting and stopping the watcher
 * - Session change callbacks
 * - Session stale callbacks
 * - Debouncing change notifications
 * - Tracked sessions management
 */

import {
  SessionWatcher,
  createSessionWatcher,
  DEFAULT_WATCHER_CONFIG,
} from "../sessionWatcher";

// Mock callbacks storage
let createCallback: ((uri: { fsPath: string }) => void) | null = null;
let changeCallback: ((uri: { fsPath: string }) => void) | null = null;
let deleteCallback: ((uri: { fsPath: string }) => void) | null = null;

// Mock VS Code module
const mockFileSystemWatcher = {
  onDidCreate: jest.fn((cb) => {
    createCallback = cb;
    return { dispose: jest.fn() };
  }),
  onDidChange: jest.fn((cb) => {
    changeCallback = cb;
    return { dispose: jest.fn() };
  }),
  onDidDelete: jest.fn((cb) => {
    deleteCallback = cb;
    return { dispose: jest.fn() };
  }),
  dispose: jest.fn(),
};

jest.mock("vscode", () => ({
  workspace: {
    createFileSystemWatcher: jest.fn(() => mockFileSystemWatcher),
  },
  RelativePattern: jest.fn((base, pattern) => ({ base, pattern })),
}));

// Mock fs module
jest.mock("fs", () => ({
  existsSync: jest.fn(() => true),
  readdirSync: jest.fn(() => []),
  statSync: jest.fn(() => ({
    mtime: new Date(),
  })),
}));

import * as fs from "fs";
import * as vscode from "vscode";

const createMockOutputChannel = () => ({
  appendLine: jest.fn(),
  dispose: jest.fn(),
});

describe("SessionWatcher", () => {
  let watcher: SessionWatcher;
  let mockOutputChannel: ReturnType<typeof createMockOutputChannel>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset callbacks
    createCallback = null;
    changeCallback = null;
    deleteCallback = null;

    // Reset fs mocks to default behavior
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue([]);

    mockOutputChannel = createMockOutputChannel();
    watcher = new SessionWatcher();
    watcher.initialize(mockOutputChannel as unknown as import("vscode").OutputChannel);
  });

  afterEach(() => {
    watcher.dispose();
    jest.useRealTimers();
  });

  describe("start", () => {
    it("should create file system watcher", () => {
      watcher.start();

      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalled();
    });

    it("should not create duplicate watcher if already started", () => {
      watcher.start();
      watcher.start();

      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledTimes(1);
    });

    it("should log start message", () => {
      watcher.start();

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Started watching")
      );
    });

    it("should not start if base directory does not exist", () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      watcher.start();

      expect(vscode.workspace.createFileSystemWatcher).not.toHaveBeenCalled();
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("does not exist")
      );
    });

    it("should scan existing sessions on start", () => {
      (fs.readdirSync as jest.Mock)
        .mockReturnValueOnce([
          { name: "-Users-test-project", isDirectory: () => true },
        ])
        .mockReturnValueOnce([
          { name: "session.jsonl", isFile: () => true },
        ]);

      watcher.start();

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Scanned")
      );
    });
  });

  describe("stop", () => {
    it("should dispose file system watcher", () => {
      watcher.start();

      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalled();

      watcher.stop();

      expect(mockFileSystemWatcher.dispose).toHaveBeenCalled();
    });

    it("should clear tracked sessions", () => {
      watcher.start();

      // Simulate a session being tracked
      if (createCallback) {
        createCallback({ fsPath: "/test/session.jsonl" });
      }

      expect(watcher.getTrackedSessions().length).toBe(1);

      watcher.stop();

      expect(watcher.getTrackedSessions().length).toBe(0);
    });

    it("should log stop message", () => {
      watcher.start();
      watcher.stop();

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Stopped watching")
      );
    });
  });

  describe("dispose", () => {
    it("should stop watcher and clear callbacks", () => {
      const onChangeSpy = jest.fn();
      watcher.onSessionChange(onChangeSpy);
      watcher.start();

      // Save reference before dispose
      const savedChangeCallback = changeCallback;

      watcher.dispose();

      // Simulate a change after dispose - should not throw
      if (savedChangeCallback) {
        expect(() => savedChangeCallback({ fsPath: "/test/session.jsonl" })).not.toThrow();
      }
    });
  });

  describe("onSessionChange", () => {
    it("should call callback when session file changes", () => {
      const onChangeSpy = jest.fn();
      watcher.onSessionChange(onChangeSpy);
      watcher.start();

      // Simulate a file change
      if (changeCallback) {
        changeCallback({ fsPath: "/test/session.jsonl" });
      }

      // Advance timers to fire debounced callback
      jest.runAllTimers();

      expect(onChangeSpy).toHaveBeenCalled();
    });

    it("should debounce rapid changes", () => {
      const onChangeSpy = jest.fn();
      watcher.onSessionChange(onChangeSpy);
      watcher.start();

      // Simulate multiple rapid changes
      if (changeCallback) {
        changeCallback({ fsPath: "/test/session1.jsonl" });
        changeCallback({ fsPath: "/test/session2.jsonl" });
        changeCallback({ fsPath: "/test/session3.jsonl" });
      }

      // First call happens immediately, others are debounced
      expect(onChangeSpy).toHaveBeenCalledTimes(1);

      // Advance past debounce period
      jest.advanceTimersByTime(DEFAULT_WATCHER_CONFIG.debounceCooldownMs + 100);

      // Should still only be one more call after cooldown
      expect(onChangeSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("onSessionStale", () => {
    it("should call callback when session becomes stale", () => {
      const onStaleSpy = jest.fn();
      watcher.onSessionStale(onStaleSpy);
      watcher.start();

      // Simulate a file creation (starts tracking)
      if (createCallback) {
        createCallback({ fsPath: "/test/new-session.jsonl" });
      }

      // Advance time past stale threshold
      jest.advanceTimersByTime(
        DEFAULT_WATCHER_CONFIG.staleThresholdMinutes * 60 * 1000 + 100
      );

      expect(onStaleSpy).toHaveBeenCalledWith("/test/new-session.jsonl");
    });

    it("should reset stale timer on file change", () => {
      const onStaleSpy = jest.fn();
      watcher.onSessionStale(onStaleSpy);
      watcher.start();

      // Create session
      if (createCallback) {
        createCallback({ fsPath: "/test/session.jsonl" });
      }

      // Advance time halfway to stale
      jest.advanceTimersByTime(
        (DEFAULT_WATCHER_CONFIG.staleThresholdMinutes * 60 * 1000) / 2
      );

      // Change event resets the timer
      if (changeCallback) {
        changeCallback({ fsPath: "/test/session.jsonl" });
      }

      // Advance time past original stale time (but not reset time)
      jest.advanceTimersByTime(
        (DEFAULT_WATCHER_CONFIG.staleThresholdMinutes * 60 * 1000) / 2 + 100
      );

      // Should not be stale yet because timer was reset
      expect(onStaleSpy).not.toHaveBeenCalled();

      // Advance remaining time
      jest.advanceTimersByTime(
        (DEFAULT_WATCHER_CONFIG.staleThresholdMinutes * 60 * 1000) / 2
      );

      expect(onStaleSpy).toHaveBeenCalled();
    });
  });

  describe("getTrackedSessions", () => {
    it("should return tracked session paths", () => {
      watcher.start();

      if (createCallback) {
        createCallback({ fsPath: "/test/session1.jsonl" });
        createCallback({ fsPath: "/test/session2.jsonl" });
      }

      const tracked = watcher.getTrackedSessions();

      expect(tracked).toContain("/test/session1.jsonl");
      expect(tracked).toContain("/test/session2.jsonl");
      expect(tracked.length).toBe(2);
    });

    it("should return empty array when no sessions tracked", () => {
      const tracked = watcher.getTrackedSessions();
      expect(tracked).toEqual([]);
    });

    it("should remove deleted sessions from tracking", () => {
      watcher.start();

      if (createCallback) {
        createCallback({ fsPath: "/test/session.jsonl" });
      }
      expect(watcher.getTrackedSessions()).toContain("/test/session.jsonl");

      if (deleteCallback) {
        deleteCallback({ fsPath: "/test/session.jsonl" });
      }
      expect(watcher.getTrackedSessions()).not.toContain("/test/session.jsonl");
    });
  });

  describe("createSessionWatcher", () => {
    it("should create a new SessionWatcher instance", () => {
      const newWatcher = createSessionWatcher();
      expect(newWatcher).toBeInstanceOf(SessionWatcher);
      newWatcher.dispose();
    });

    it("should accept configuration options", () => {
      const newWatcher = createSessionWatcher({
        debounceCooldownMs: 5000,
        staleThresholdMinutes: 30,
      });
      expect(newWatcher).toBeInstanceOf(SessionWatcher);
      newWatcher.dispose();
    });
  });

  describe("DEFAULT_WATCHER_CONFIG", () => {
    it("should have expected default values", () => {
      expect(DEFAULT_WATCHER_CONFIG.debounceCooldownMs).toBe(10000);
      expect(DEFAULT_WATCHER_CONFIG.staleThresholdMinutes).toBe(15);
      expect(DEFAULT_WATCHER_CONFIG.baseDir).toContain(".claude/projects");
    });
  });

  describe("session events", () => {
    it("should log session creation", () => {
      watcher.start();

      if (createCallback) {
        createCallback({ fsPath: "/test/project/new-session.jsonl" });
      }

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Session created")
      );
    });

    it("should log session changes", () => {
      watcher.start();

      if (changeCallback) {
        changeCallback({ fsPath: "/test/project/session.jsonl" });
      }

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Session changed")
      );
    });

    it("should log session deletion", () => {
      watcher.start();

      // First create so we have something to delete
      if (createCallback) {
        createCallback({ fsPath: "/test/project/session.jsonl" });
      }

      if (deleteCallback) {
        deleteCallback({ fsPath: "/test/project/session.jsonl" });
      }

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Session deleted")
      );
    });

    it("should log when session becomes stale", () => {
      watcher.start();

      if (createCallback) {
        createCallback({ fsPath: "/test/project/session.jsonl" });
      }

      jest.advanceTimersByTime(
        DEFAULT_WATCHER_CONFIG.staleThresholdMinutes * 60 * 1000 + 100
      );

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Session became stale")
      );
    });
  });
});
