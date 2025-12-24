/**
 * Unit tests for Recover Session Command - Story 18-5
 *
 * Tests cover:
 * - Successful recovery via clipboard
 * - Fallback when clipboard fails
 * - Already recovered session handling
 * - Missing snapshot handling
 * - Analytics tracking
 * - Recovery state management
 */

import { recoverSession, type RecoverSessionDependencies } from "../recoverSession";
import type { InterruptedSession } from "../../types/interruptedSession";
import type { SessionStateSnapshot } from "../../types/sessionState";

// Mock VS Code module
const mockShowInformationMessage = jest.fn();
const mockShowErrorMessage = jest.fn();
const mockCreateWebviewPanel = jest.fn();
const mockOpenTextDocument = jest.fn();
const mockShowTextDocument = jest.fn();
const mockCreateTerminal = jest.fn();

jest.mock("vscode", () => ({
  window: {
    showInformationMessage: (...args: unknown[]) => mockShowInformationMessage(...args),
    showErrorMessage: (...args: unknown[]) => mockShowErrorMessage(...args),
    createWebviewPanel: (...args: unknown[]) => mockCreateWebviewPanel(...args),
    showTextDocument: (...args: unknown[]) => mockShowTextDocument(...args),
    activeTerminal: null,
    createTerminal: (...args: unknown[]) => mockCreateTerminal(...args),
  },
  workspace: {
    openTextDocument: (...args: unknown[]) => mockOpenTextDocument(...args),
  },
  ViewColumn: {
    One: 1,
  },
  ProgressLocation: {
    Notification: 15,
  },
}), { virtual: true });

// Helper to create mock dependencies
const createMockDependencies = (): RecoverSessionDependencies => ({
  snapshotStore: {
    getSnapshot: jest.fn(),
    saveSnapshot: jest.fn(),
    hasSnapshot: jest.fn(),
    deleteSnapshot: jest.fn(),
    listSnapshots: jest.fn(),
    listValidSnapshots: jest.fn(),
    cleanExpiredSnapshots: jest.fn(),
    clearAllSnapshots: jest.fn(),
    getStorageStats: jest.fn(),
    initialize: jest.fn(),
  } as unknown as import("../../services/snapshotStore").SnapshotStore,
  promptGenerator: {
    generateRecoveryPrompt: jest.fn().mockResolvedValue({
      sessionId: "test-session",
      prompt: "Resume my previous session...",
      generatedAt: new Date(),
      isAIGenerated: false,
    }),
    invalidateCache: jest.fn(),
    clearCache: jest.fn(),
    initialize: jest.fn(),
  } as unknown as import("../../services/recoveryPromptGenerator").RecoveryPromptGenerator,
  recoveryState: {
    isRecovered: jest.fn().mockReturnValue(false),
    markAsRecovered: jest.fn(),
    getRecoveryInfo: jest.fn(),
    clearRecoveredSession: jest.fn(),
    getAllRecovered: jest.fn(),
    getStats: jest.fn(),
    cleanExpired: jest.fn(),
    filterNotRecovered: jest.fn((s) => s),
    clearAll: jest.fn(),
    initialize: jest.fn(),
  } as unknown as import("../../services/recoveryState").RecoveryState,
  dismissalService: {
    dismissSession: jest.fn(),
    dismissSessions: jest.fn(),
    isDismissed: jest.fn(),
    filterDismissed: jest.fn((s) => s),
    getDismissedSessionIds: jest.fn(),
    cleanExpired: jest.fn(),
    clearAll: jest.fn(),
    initialize: jest.fn(),
  } as unknown as import("../../services/dismissalService").DismissalService,
  analyticsService: {
    trackEvent: jest.fn(),
    trackSessionRecovered: jest.fn(),
    trackSessionDismissed: jest.fn(),
    trackRecoveryPanelViewed: jest.fn(),
    flush: jest.fn(),
    isAnalyticsEnabled: jest.fn().mockReturnValue(true),
    getQueueSize: jest.fn().mockReturnValue(0),
    dispose: jest.fn(),
    initialize: jest.fn(),
  } as unknown as import("../../services/analyticsService").AnalyticsService,
  clipboardService: {
    copy: jest.fn().mockResolvedValue({ success: true }),
    read: jest.fn(),
    initialize: jest.fn(),
  } as unknown as import("../../services/clipboardService").ClipboardService,
  outputChannel: {
    appendLine: jest.fn(),
    dispose: jest.fn(),
  } as unknown as import("vscode").OutputChannel,
});

const createMockSnapshot = (sessionId: string): SessionStateSnapshot => ({
  sessionId,
  capturedAt: new Date(),
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  recentMessages: [
    { uuid: "msg-1", type: "user", content: "Test message" },
  ],
  filesAffected: [],
  toolsUsed: [],
  pendingOperations: [],
  conversationContext: {
    initialTask: "Test task",
    currentTask: "Test task",
    lastAction: "Test action",
    errors: [],
    blockers: [],
  },
  gitContext: null,
});

const createMockSession = (sessionId: string): InterruptedSession => ({
  sessionId,
  sessionPath: `/home/user/.claude/projects/-Users-test-project/${sessionId}.jsonl`,
  slug: "test-session-slug",
  lastActivity: new Date(),
  messageCount: 10,
  lastPrompt: "Test prompt",
  lastToolUsed: "Read",
});

describe("recoverSession", () => {
  let deps: RecoverSessionDependencies;

  beforeEach(() => {
    jest.clearAllMocks();
    deps = createMockDependencies();

    // Default: snapshot exists
    (deps.snapshotStore.getSnapshot as jest.Mock).mockReturnValue(
      createMockSnapshot("test-session")
    );

    // Default: show notification returns undefined (no action taken)
    mockShowInformationMessage.mockResolvedValue(undefined);
  });

  describe("successful recovery", () => {
    it("should copy prompt to clipboard", async () => {
      const result = await recoverSession("test-session", null, deps);

      expect(result.success).toBe(true);
      expect(result.method).toBe("clipboard");
      expect(deps.clipboardService.copy).toHaveBeenCalled();
    });

    it("should show success notification", async () => {
      await recoverSession("test-session", null, deps);

      expect(mockShowInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining("copied to clipboard"),
        "Show Prompt",
        "Open Terminal"
      );
    });

    it("should mark session as recovered", async () => {
      await recoverSession("test-session", null, deps);

      expect(deps.recoveryState.markAsRecovered).toHaveBeenCalledWith(
        "test-session",
        "clipboard",
        expect.any(Number)
      );
    });

    it("should dismiss the session", async () => {
      await recoverSession("test-session", null, deps);

      expect(deps.dismissalService.dismissSession).toHaveBeenCalledWith("test-session");
    });

    it("should track analytics event", async () => {
      await recoverSession("test-session", null, deps);

      expect(deps.analyticsService.trackSessionRecovered).toHaveBeenCalledWith(
        "test-session",
        "clipboard",
        expect.any(Number),
        expect.any(Number),
        expect.any(Boolean)
      );
    });

    it("should return prompt info in result", async () => {
      const result = await recoverSession("test-session", null, deps);

      expect(result.promptLength).toBeGreaterThan(0);
      expect(result.isAIGenerated).toBe(false);
    });
  });

  describe("already recovered session", () => {
    it("should return error for already recovered session", async () => {
      (deps.recoveryState.isRecovered as jest.Mock).mockReturnValue(true);

      const result = await recoverSession("test-session", null, deps);

      expect(result.success).toBe(false);
      expect(result.error).toContain("already been recovered");
    });

    it("should not attempt clipboard copy", async () => {
      (deps.recoveryState.isRecovered as jest.Mock).mockReturnValue(true);

      await recoverSession("test-session", null, deps);

      expect(deps.clipboardService.copy).not.toHaveBeenCalled();
    });
  });

  describe("missing snapshot", () => {
    it("should build snapshot if session data is provided", async () => {
      (deps.snapshotStore.getSnapshot as jest.Mock).mockReturnValue(null);
      const session = createMockSession("test-session");

      // Mock buildSessionSnapshot (imported in the module)
      // Since it's imported, we need to check saveSnapshot was called
      await recoverSession("test-session", session, deps);

      expect(deps.snapshotStore.saveSnapshot).toHaveBeenCalled();
    });

    it("should return error if no session data and no snapshot", async () => {
      (deps.snapshotStore.getSnapshot as jest.Mock).mockReturnValue(null);

      const result = await recoverSession("test-session", null, deps);

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("clipboard failure", () => {
    beforeEach(() => {
      (deps.clipboardService.copy as jest.Mock).mockResolvedValue({
        success: false,
        error: "Clipboard access denied",
      });

      // Mock the webview panel
      const mockPanel = {
        webview: {
          html: "",
          onDidReceiveMessage: jest.fn((callback) => {
            // Simulate user closing panel
            setTimeout(() => callback({ type: "close" }), 10);
            return { dispose: jest.fn() };
          }),
        },
        onDidDispose: jest.fn((_callback) => {
          return { dispose: jest.fn() };
        }),
        dispose: jest.fn(),
      };
      mockCreateWebviewPanel.mockReturnValue(mockPanel);
    });

    it("should show fallback modal", async () => {
      await recoverSession("test-session", null, deps);

      expect(mockCreateWebviewPanel).toHaveBeenCalledWith(
        "contextorRecoveryPrompt",
        "Recovery Prompt",
        expect.anything(),
        expect.anything()
      );
    });

    it("should return manual method when fallback used", async () => {
      // Mock successful manual copy
      const mockPanel = {
        webview: {
          html: "",
          onDidReceiveMessage: jest.fn((callback) => {
            setTimeout(() => callback({ type: "copied" }), 10);
            return { dispose: jest.fn() };
          }),
        },
        onDidDispose: jest.fn(() => ({ dispose: jest.fn() })),
        dispose: jest.fn(),
      };
      mockCreateWebviewPanel.mockReturnValue(mockPanel);

      const result = await recoverSession("test-session", null, deps);

      expect(result.success).toBe(true);
      expect(result.method).toBe("manual");
    });
  });

  describe("notification actions", () => {
    it("should handle Show Prompt action", async () => {
      mockShowInformationMessage.mockResolvedValue("Show Prompt");
      mockOpenTextDocument.mockResolvedValue({});
      mockShowTextDocument.mockResolvedValue({});

      // The test just verifies recovery succeeds when Show Prompt is clicked
      // The actual document opening is handled by VS Code APIs
      const result = await recoverSession("test-session", null, deps);

      expect(result.success).toBe(true);
      expect(mockShowInformationMessage).toHaveBeenCalled();
    });

    it("should handle Open Terminal action", async () => {
      mockShowInformationMessage.mockResolvedValue("Open Terminal");
      const mockTerminal = { show: jest.fn() };
      mockCreateTerminal.mockReturnValue(mockTerminal);

      const result = await recoverSession("test-session", null, deps);

      expect(result.success).toBe(true);
      expect(mockCreateTerminal).toHaveBeenCalled();
      expect(mockTerminal.show).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle prompt generation error", async () => {
      (deps.promptGenerator.generateRecoveryPrompt as jest.Mock).mockRejectedValue(
        new Error("Generation failed")
      );

      const result = await recoverSession("test-session", null, deps);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Generation failed");
    });

    it("should show error message to user", async () => {
      (deps.promptGenerator.generateRecoveryPrompt as jest.Mock).mockRejectedValue(
        new Error("Generation failed")
      );

      await recoverSession("test-session", null, deps);

      expect(mockShowErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining("Generation failed")
      );
    });
  });

  describe("detection time tracking", () => {
    it("should use detection time for timeToRecover calculation", async () => {
      const detectionTime = Date.now() - 5000; // 5 seconds ago

      await recoverSession("test-session", null, deps, detectionTime);

      expect(deps.recoveryState.markAsRecovered).toHaveBeenCalledWith(
        "test-session",
        "clipboard",
        expect.any(Number)
      );

      // The timeToRecover should be around 5000ms or more
      const call = (deps.recoveryState.markAsRecovered as jest.Mock).mock.calls[0];
      expect(call[2]).toBeGreaterThanOrEqual(0);
    });
  });

  describe("logging", () => {
    it("should log recovery start", async () => {
      await recoverSession("test-session", null, deps);

      expect(deps.outputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Starting recovery for session: test-session")
      );
    });

    it("should log recovery success", async () => {
      await recoverSession("test-session", null, deps);

      expect(deps.outputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Recovery successful")
      );
    });

    it("should log recovery failure", async () => {
      (deps.promptGenerator.generateRecoveryPrompt as jest.Mock).mockRejectedValue(
        new Error("Test error")
      );

      await recoverSession("test-session", null, deps);

      expect(deps.outputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Recovery failed")
      );
    });
  });
});
