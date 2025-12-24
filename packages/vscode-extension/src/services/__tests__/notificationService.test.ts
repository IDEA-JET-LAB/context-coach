/**
 * Unit tests for Notification Service - Story 18-4
 *
 * Tests cover:
 * - Showing interrupted session notifications
 * - Singular/plural message formatting
 * - View and Dismiss button handling
 * - Debouncing notifications
 * - Callback registration
 */

import {
  NotificationService,
  createNotificationService,
  DEFAULT_NOTIFICATION_CONFIG,
} from "../notificationService";
import type { InterruptedSession } from "../../types/interruptedSession";

// Mock VS Code module
jest.mock("vscode", () => ({
  window: {
    showInformationMessage: jest.fn(),
  },
}));

import * as vscode from "vscode";

const createMockOutputChannel = () => ({
  appendLine: jest.fn(),
  dispose: jest.fn(),
});

const createTestSession = (
  sessionId: string,
  overrides: Partial<InterruptedSession> = {}
): InterruptedSession => ({
  sessionId,
  sessionPath: `/Users/test/.claude/projects/-Users-test-${sessionId}/session.jsonl`,
  slug: `test-slug-${sessionId}`,
  lastActivity: new Date(),
  messageCount: 10,
  lastPrompt: "Test prompt for " + sessionId,
  lastToolUsed: "Read",
  ...overrides,
});

describe("NotificationService", () => {
  let service: NotificationService;
  let mockOutputChannel: ReturnType<typeof createMockOutputChannel>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOutputChannel = createMockOutputChannel();
    service = new NotificationService();
    service.initialize(mockOutputChannel as unknown as import("vscode").OutputChannel);
  });

  afterEach(() => {
    service.dispose();
  });

  describe("showInterruptedSessionNotification", () => {
    it("should return undefined for empty sessions array", async () => {
      const result = await service.showInterruptedSessionNotification([]);
      expect(result).toBeUndefined();
      expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });

    it("should show singular message for one session", async () => {
      (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

      await service.showInterruptedSessionNotification([createTestSession("s1")]);

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        "1 interrupted Claude Code session detected",
        "View",
        "Dismiss"
      );
    });

    it("should show plural message for multiple sessions", async () => {
      (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

      await service.showInterruptedSessionNotification([
        createTestSession("s1"),
        createTestSession("s2"),
        createTestSession("s3"),
      ]);

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        "3 interrupted Claude Code sessions detected",
        "View",
        "Dismiss"
      );
    });

    it("should return 'view' when user clicks View", async () => {
      (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue("View");

      const result = await service.showInterruptedSessionNotification([
        createTestSession("s1"),
      ]);

      expect(result).toBe("view");
    });

    it("should return 'dismiss' when user clicks Dismiss", async () => {
      (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue("Dismiss");

      const result = await service.showInterruptedSessionNotification([
        createTestSession("s1"),
      ]);

      expect(result).toBe("dismiss");
    });

    it("should return undefined when user dismisses without action", async () => {
      (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

      const result = await service.showInterruptedSessionNotification([
        createTestSession("s1"),
      ]);

      expect(result).toBeUndefined();
    });

    it("should call onView callback when user clicks View", async () => {
      (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue("View");
      const onViewSpy = jest.fn();
      service.onView(onViewSpy);

      const sessions = [createTestSession("s1")];
      await service.showInterruptedSessionNotification(sessions);

      expect(onViewSpy).toHaveBeenCalledWith(sessions);
    });

    it("should call onDismiss callback when user clicks Dismiss", async () => {
      (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue("Dismiss");
      const onDismissSpy = jest.fn();
      service.onDismiss(onDismissSpy);

      const sessions = [createTestSession("s1")];
      await service.showInterruptedSessionNotification(sessions);

      expect(onDismissSpy).toHaveBeenCalledWith(sessions);
    });

    it("should log notification", async () => {
      (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

      await service.showInterruptedSessionNotification([createTestSession("s1")]);

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Showing notification")
      );
    });
  });

  describe("debouncing", () => {
    it("should not show notification within debounce period", async () => {
      // First notification should show
      (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);
      await service.showInterruptedSessionNotification([createTestSession("s1")]);
      expect(vscode.window.showInformationMessage).toHaveBeenCalledTimes(1);

      // Second notification within debounce period should be suppressed
      jest.clearAllMocks();
      const result = await service.showInterruptedSessionNotification([
        createTestSession("s2"),
      ]);

      expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("debounced")
      );
    });
  });

  describe("suppressNotifications", () => {
    it("should not show notification when suppressed", async () => {
      const suppressedService = new NotificationService({
        suppressNotifications: true,
      });
      suppressedService.initialize(
        mockOutputChannel as unknown as import("vscode").OutputChannel
      );

      const result = await suppressedService.showInterruptedSessionNotification([
        createTestSession("s1"),
      ]);

      expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
      expect(result).toBeUndefined();

      suppressedService.dispose();
    });
  });

  describe("showNewStaleSessionNotification", () => {
    it("should show notification for single stale session", async () => {
      (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

      const session = createTestSession("project-name");
      await service.showNewStaleSessionNotification(session);

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining("inactive for 15+ minutes"),
        "View",
        "Dismiss"
      );
    });

    it("should return undefined when suppressed", async () => {
      const suppressedService = new NotificationService({
        suppressNotifications: true,
      });
      suppressedService.initialize(
        mockOutputChannel as unknown as import("vscode").OutputChannel
      );

      const result = await suppressedService.showNewStaleSessionNotification(
        createTestSession("s1")
      );

      expect(result).toBeUndefined();
      suppressedService.dispose();
    });
  });

  describe("createNotificationService", () => {
    it("should create a new NotificationService instance", () => {
      const newService = createNotificationService();
      expect(newService).toBeInstanceOf(NotificationService);
      newService.dispose();
    });

    it("should accept configuration options", () => {
      const newService = createNotificationService({
        debounceMs: 5000,
        suppressNotifications: true,
      });
      expect(newService).toBeInstanceOf(NotificationService);
      newService.dispose();
    });
  });

  describe("dispose", () => {
    it("should clear callbacks on dispose", async () => {
      const onViewSpy = jest.fn();
      service.onView(onViewSpy);

      service.dispose();

      // Re-create service to test
      (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue("View");
      service = new NotificationService();
      service.initialize(mockOutputChannel as unknown as import("vscode").OutputChannel);

      await service.showInterruptedSessionNotification([createTestSession("s1")]);

      // Original callback should not be called
      expect(onViewSpy).not.toHaveBeenCalled();
    });
  });

  describe("DEFAULT_NOTIFICATION_CONFIG", () => {
    it("should have expected default values", () => {
      expect(DEFAULT_NOTIFICATION_CONFIG.debounceMs).toBe(30000);
      expect(DEFAULT_NOTIFICATION_CONFIG.suppressNotifications).toBe(false);
    });
  });
});
