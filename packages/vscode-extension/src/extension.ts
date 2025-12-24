import * as vscode from "vscode";
import { showAnalyticsCommand } from "./commands/showAnalytics";
import { showSettingsCommand } from "./commands/showSettings";
import { signInCommand, signOutCommand } from "./commands/auth";
import {
  recoverSession,
  type RecoverSessionDependencies,
} from "./commands/recoverSession";
import { AuthService } from "./services/auth";
import { SettingsService } from "./services/settings";
import { AnalyticsPanelProvider } from "./providers/analyticsPanel";
import { CrashDetector } from "./services/crashDetector";
import { SnapshotStore } from "./services/snapshotStore";
import { buildSessionSnapshot } from "./services/snapshotBuilder";
import { RecoveryPromptCache } from "./services/recoveryPromptCache";
import { RecoveryPromptGenerator } from "./services/recoveryPromptGenerator";
import { NotificationService } from "./services/notificationService";
import { DismissalService } from "./services/dismissalService";
import { SessionWatcher } from "./watchers/sessionWatcher";
import { RecoveryPanelProvider } from "./providers/recoveryPanelProvider";
import { ClipboardService } from "./services/clipboardService";
import { RecoveryState } from "./services/recoveryState";
import { AnalyticsService } from "./services/analyticsService";
import { RealtimeService } from "./services/realtimeService";
import type { InterruptedSession } from "./types/interruptedSession";

/**
 * Output channel for Contextor extension logging
 */
let outputChannel: vscode.OutputChannel;

/**
 * Auth service instance (singleton per session)
 */
let authService: AuthService;

/**
 * Settings service instance
 */
let settingsService: SettingsService;

/**
 * Crash detector service instance
 */
let crashDetector: CrashDetector;

/**
 * Snapshot store service instance (Story 18-2)
 */
let snapshotStore: SnapshotStore;

/**
 * Recovery prompt cache instance (Story 18-3)
 */
let recoveryPromptCache: RecoveryPromptCache;

/**
 * Recovery prompt generator instance (Story 18-3)
 */
let recoveryPromptGenerator: RecoveryPromptGenerator;

/**
 * Notification service instance (Story 18-4)
 */
let notificationService: NotificationService;

/**
 * Dismissal service instance (Story 18-4)
 */
let dismissalService: DismissalService;

/**
 * Session watcher instance (Story 18-4)
 */
let sessionWatcher: SessionWatcher;

/**
 * Recovery panel provider instance (Story 18-4)
 */
let recoveryPanelProvider: RecoveryPanelProvider;

/**
 * Clipboard service instance (Story 18-5)
 */
let clipboardService: ClipboardService;

/**
 * Recovery state service instance (Story 18-5)
 */
let recoveryState: RecoveryState;

/**
 * Analytics service instance (Story 18-5)
 */
let analyticsService: AnalyticsService;

/**
 * Realtime service instance for instant updates
 */
let realtimeService: RealtimeService;

/**
 * Called when the extension is activated.
 * Activation happens on VS Code startup (onStartupFinished).
 */
export function activate(context: vscode.ExtensionContext): void {
  // Create output channel for logging
  outputChannel = vscode.window.createOutputChannel("Contextor");
  outputChannel.appendLine("Contextor extension is now active");

  // Initialize settings service first (other services depend on it)
  settingsService = SettingsService.getInstance();
  settingsService.initialize(outputChannel);
  context.subscriptions.push(settingsService);

  // Validate settings on startup
  validateSettingsOnStartup();

  // Initialize auth service
  authService = new AuthService(context, outputChannel);

  // Initialize crash detector service (Story 18-1)
  crashDetector = CrashDetector.getInstance();
  crashDetector.initialize(outputChannel);

  // Initialize snapshot store (Story 18-2)
  snapshotStore = new SnapshotStore(context);
  snapshotStore.initialize(outputChannel);

  // Initialize recovery prompt cache (Story 18-3)
  recoveryPromptCache = new RecoveryPromptCache(context);
  recoveryPromptCache.initialize(outputChannel);

  // Initialize recovery prompt generator (Story 18-3)
  recoveryPromptGenerator = new RecoveryPromptGenerator(
    recoveryPromptCache,
    authService,
    settingsService
  );
  recoveryPromptGenerator.initialize(outputChannel);

  // Initialize notification service (Story 18-4)
  notificationService = new NotificationService();
  notificationService.initialize(outputChannel);

  // Initialize dismissal service (Story 18-4)
  dismissalService = new DismissalService(context);
  dismissalService.initialize(outputChannel);

  // Initialize session watcher (Story 18-4)
  sessionWatcher = new SessionWatcher();
  sessionWatcher.initialize(outputChannel);

  // Initialize clipboard service (Story 18-5)
  clipboardService = new ClipboardService();
  clipboardService.initialize(outputChannel);

  // Initialize recovery state (Story 18-5)
  recoveryState = new RecoveryState(context);
  recoveryState.initialize(outputChannel);

  // Initialize analytics service (Story 18-5)
  analyticsService = new AnalyticsService(context, settingsService, authService);
  analyticsService.initialize(outputChannel);
  context.subscriptions.push(analyticsService);

  // Initialize realtime service for instant updates
  realtimeService = new RealtimeService(authService, outputChannel);
  void realtimeService.initialize();
  context.subscriptions.push(realtimeService);

  // Clean expired snapshots on startup (Story 18-2)
  cleanExpiredSnapshotsOnStartup();

  // Clean expired dismissals on startup (Story 18-4)
  cleanExpiredDismissalsOnStartup();

  // Subscribe to interrupted session detection
  context.subscriptions.push(
    crashDetector.onSessionsDetected(async (sessions) => {
      outputChannel.appendLine(
        `[CrashDetector] Detected ${sessions.length} interrupted session(s)`
      );

      // Build and store snapshots for detected sessions (Story 18-2)
      for (const session of sessions) {
        await captureSessionSnapshot(session);
      }

      // Filter out dismissed sessions (Story 18-4)
      const activeSessions = dismissalService.filterDismissed(sessions);

      if (activeSessions.length > 0) {
        // Update recovery panel (Story 18-4)
        recoveryPanelProvider.updateSessions(activeSessions);

        // Show notification with View/Dismiss options (Story 18-4)
        const action = await notificationService.showInterruptedSessionNotification(
          activeSessions
        );

        if (action === "view") {
          // Focus the recovery panel
          await vscode.commands.executeCommand("contextor.recoveryPanel.focus");
        } else if (action === "dismiss") {
          // Dismiss all detected sessions
          await dismissalService.dismissSessions(
            activeSessions.map((s) => s.sessionId)
          );
          // Update the panel
          recoveryPanelProvider.updateSessions([]);
        }
      }
    })
  );

  // Set up notification callbacks (Story 18-4)
  notificationService.onView(async (sessions) => {
    recoveryPanelProvider.updateSessions(sessions);
    await vscode.commands.executeCommand("contextor.recoveryPanel.focus");
  });

  notificationService.onDismiss(async (sessions) => {
    await dismissalService.dismissSessions(sessions.map((s) => s.sessionId));
    recoveryPanelProvider.updateSessions([]);
  });

  // Set up session watcher callbacks (Story 18-4)
  sessionWatcher.onSessionChange(async () => {
    // Re-scan for interrupted sessions when files change
    outputChannel.appendLine("[SessionWatcher] Session files changed, re-scanning...");
    await crashDetector.detectInterruptedSessions();
  });

  sessionWatcher.onSessionStale(async (sessionPath) => {
    outputChannel.appendLine(`[SessionWatcher] Session became stale: ${sessionPath}`);
    // The crash detector will pick this up on next scan
    await crashDetector.detectInterruptedSessions();
  });

  // Register commands
  context.subscriptions.push(
    // Analytics and settings commands
    vscode.commands.registerCommand("contextor.showAnalytics", () =>
      showAnalyticsCommand(context)
    ),
    vscode.commands.registerCommand("contextor.showSettings", () =>
      showSettingsCommand(context)
    ),

    // Auth commands
    vscode.commands.registerCommand("contextor.signIn", () =>
      signInCommand(authService)
    ),
    vscode.commands.registerCommand("contextor.signOut", () =>
      signOutCommand(authService)
    ),

    // Crash detection command (Story 18-1)
    vscode.commands.registerCommand(
      "contextor.scanForInterruptedSessions",
      () => scanForInterruptedSessionsCommand()
    ),

    // Clear snapshots command (Story 18-2)
    vscode.commands.registerCommand("contextor.clearSnapshots", () =>
      clearSnapshotsCommand()
    ),

    // Recovery panel commands (Story 18-4, 18-5)
    vscode.commands.registerCommand("contextor.showRecoveryPanel", () =>
      showRecoveryPanelCommand()
    ),
    vscode.commands.registerCommand("contextor.dismissAllSessions", () =>
      dismissAllSessionsCommand()
    ),
    vscode.commands.registerCommand(
      "contextor.recoverSession",
      (sessionId?: string) => recoverSessionCommand(sessionId)
    ),

    // Open web dashboard command
    vscode.commands.registerCommand("contextor.openWebApp", () => {
      const config = vscode.workspace.getConfiguration("contextor");
      const apiEndpoint = config.get<string>("apiEndpoint", "http://127.0.0.1:3050/api");
      // Extract base URL from API endpoint (remove /api suffix)
      const baseUrl = apiEndpoint.replace(/\/api\/?$/, "");
      const analyticsUrl = `${baseUrl}/analytics`;
      vscode.env.openExternal(vscode.Uri.parse(analyticsUrl));
    })
  );

  // Register URI handler for OAuth callback
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
        outputChannel.appendLine(`URI handler received: ${uri.path}`);

        // Handle OAuth callback
        if (uri.path === "/callback") {
          return authService.handleCallback(uri);
        }

        outputChannel.appendLine(`Unknown URI path: ${uri.path}`);
      },
    })
  );

  // Register Analytics Panel WebviewViewProvider
  const analyticsPanelProvider = new AnalyticsPanelProvider(
    context.extensionUri,
    authService,
    outputChannel,
    realtimeService
  );
  // Set global state for persistent analytics caching (Story 19-4)
  analyticsPanelProvider.setGlobalState(context.globalState);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      AnalyticsPanelProvider.viewType,
      analyticsPanelProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }
    )
  );
  outputChannel.appendLine("Contextor: Analytics panel registered");

  // Connect SessionWatcher to AnalyticsPanel for auto-refresh on new prompts
  sessionWatcher.onSessionChange(() => {
    analyticsPanelProvider.notifySessionChanged();
  });

  // Register Recovery Panel WebviewViewProvider (Story 18-4)
  recoveryPanelProvider = new RecoveryPanelProvider(
    context.extensionUri,
    snapshotStore,
    recoveryPromptGenerator,
    dismissalService,
    outputChannel
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      RecoveryPanelProvider.viewType,
      recoveryPanelProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }
    )
  );
  outputChannel.appendLine("Contextor: Recovery panel registered");

  // Start session watcher (Story 18-4)
  sessionWatcher.start();
  context.subscriptions.push(sessionWatcher);

  // Check authentication status on startup
  checkAuthStatus();

  // Scan for interrupted sessions on startup if enabled (Story 18-1)
  scanForInterruptedSessionsOnStartup();

  // Log activation complete
  outputChannel.appendLine("Contextor: All commands registered");
  console.log("Contextor extension is now active");
}

/**
 * Checks and displays authentication status on startup.
 */
async function checkAuthStatus(): Promise<void> {
  try {
    const isAuthenticated = await authService.isAuthenticated();
    if (isAuthenticated) {
      const user = await authService.getUser();
      outputChannel.appendLine(
        `Authenticated as: ${user?.email || "unknown user"}`
      );
    } else {
      outputChannel.appendLine("Not authenticated");
    }
  } catch (error) {
    outputChannel.appendLine(
      `Error checking auth status: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): void {
  if (outputChannel) {
    outputChannel.appendLine("Contextor extension deactivated");
    outputChannel.dispose();
  }
  console.log("Contextor extension deactivated");
}

/**
 * Validates settings on startup and shows warnings for invalid values.
 */
function validateSettingsOnStartup(): void {
  const result = settingsService.validateSettings();

  if (result.errors.length > 0 || result.warnings.length > 0) {
    const issues = [...result.errors, ...result.warnings];
    const message = `Contextor settings issues: ${issues.join(", ")}. Using defaults where necessary.`;

    if (result.errors.length > 0) {
      vscode.window.showErrorMessage(message);
    } else {
      vscode.window.showWarningMessage(message);
    }

    outputChannel.appendLine(`Settings validation: ${issues.join("; ")}`);
  } else {
    outputChannel.appendLine("Settings validation passed");
  }
}

/**
 * Scans for interrupted sessions on startup if auto-scan is enabled.
 * Story 18-1: Interrupted Session Detection
 */
async function scanForInterruptedSessionsOnStartup(): Promise<void> {
  const config = vscode.workspace.getConfiguration("contextor");
  const autoScan = config.get<boolean>("crashDetection.autoScan", true);

  if (!autoScan) {
    outputChannel.appendLine("Crash detection auto-scan disabled");
    return;
  }

  outputChannel.appendLine("Starting automatic crash detection scan...");

  try {
    await crashDetector.detectInterruptedSessions();
  } catch (error) {
    outputChannel.appendLine(
      `Error during startup crash detection: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Command handler for scanning interrupted sessions.
 * Story 18-1: Interrupted Session Detection
 */
async function scanForInterruptedSessionsCommand(): Promise<void> {
  outputChannel.appendLine("Manual crash detection scan triggered");

  try {
    // Show progress notification
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Contextor: Scanning for interrupted sessions...",
        cancellable: false,
      },
      async () => {
        const result = await crashDetector.detectInterruptedSessions();

        if (result.interruptedSessions.length === 0) {
          vscode.window.showInformationMessage(
            `Contextor: No interrupted sessions found. Scanned ${result.totalFilesScanned} files in ${result.durationMs}ms.`
          );
          return;
        }

        // Show quick pick with interrupted sessions
        const items = result.interruptedSessions.map((session) => ({
          label: session.sessionId,
          description: `${session.messageCount} messages`,
          detail: `Last activity: ${formatTimeAgo(session.lastActivity)} | Last prompt: "${truncate(session.lastPrompt, 50)}"`,
          session,
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: `Found ${result.interruptedSessions.length} interrupted session(s). Select to view details.`,
          matchOnDescription: true,
          matchOnDetail: true,
        });

        if (selected) {
          // Show session details in an information message with action
          const action = await vscode.window.showInformationMessage(
            `Session: ${selected.session.sessionId}\n` +
              `Messages: ${selected.session.messageCount}\n` +
              `Last prompt: "${truncate(selected.session.lastPrompt, 100)}"\n` +
              `Last tool: ${selected.session.lastToolUsed || "none"}\n` +
              `Path: ${selected.session.sessionPath}`,
            "Open File",
            "Copy Path"
          );

          if (action === "Open File") {
            const uri = vscode.Uri.file(selected.session.sessionPath);
            await vscode.window.showTextDocument(uri);
          } else if (action === "Copy Path") {
            await vscode.env.clipboard.writeText(selected.session.sessionPath);
            vscode.window.showInformationMessage("Path copied to clipboard");
          }
        }
      }
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Contextor: Failed to scan for interrupted sessions: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Formats a date as a relative time string.
 */
function formatTimeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ago`;
  }
  return `${minutes}m ago`;
}

/**
 * Truncates a string to a maximum length.
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength - 3) + "...";
}

/**
 * Cleans up expired snapshots on startup.
 * Story 18-2: Session State Snapshot
 */
async function cleanExpiredSnapshotsOnStartup(): Promise<void> {
  try {
    const cleaned = await snapshotStore.cleanExpiredSnapshots();
    if (cleaned > 0) {
      outputChannel.appendLine(
        `[SnapshotStore] Cleaned up ${cleaned} expired snapshot(s) on startup`
      );
    }
  } catch (error) {
    outputChannel.appendLine(
      `[SnapshotStore] Error cleaning expired snapshots: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Captures and stores a session state snapshot.
 * Story 18-2: Session State Snapshot
 */
async function captureSessionSnapshot(
  session: InterruptedSession
): Promise<void> {
  try {
    // Skip if we already have a snapshot for this session
    if (snapshotStore.hasSnapshot(session.sessionId)) {
      outputChannel.appendLine(
        `[SnapshotStore] Snapshot already exists for session: ${session.sessionId}`
      );
      return;
    }

    outputChannel.appendLine(
      `[SnapshotStore] Building snapshot for session: ${session.sessionId}`
    );

    const snapshot = await buildSessionSnapshot(session);
    await snapshotStore.saveSnapshot(snapshot);

    outputChannel.appendLine(
      `[SnapshotStore] Snapshot captured: ${snapshot.recentMessages.length} messages, ` +
        `${snapshot.filesAffected.length} files, ${snapshot.toolsUsed.length} tools`
    );
  } catch (error) {
    outputChannel.appendLine(
      `[SnapshotStore] Error capturing snapshot for session ${session.sessionId}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Command handler for clearing all stored snapshots.
 * Story 18-2: Session State Snapshot
 */
async function clearSnapshotsCommand(): Promise<void> {
  const stats = snapshotStore.getStorageStats();

  if (stats.totalSnapshots === 0) {
    vscode.window.showInformationMessage(
      "Contextor: No session snapshots to clear."
    );
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Contextor: Clear all ${stats.totalSnapshots} stored session snapshot(s)?`,
    { modal: true },
    "Clear All"
  );

  if (confirm === "Clear All") {
    const cleared = await snapshotStore.clearAllSnapshots();
    vscode.window.showInformationMessage(
      `Contextor: Cleared ${cleared} session snapshot(s).`
    );
    outputChannel.appendLine(
      `[SnapshotStore] User cleared ${cleared} snapshot(s)`
    );
  }
}

/**
 * Cleans up expired dismissals on startup.
 * Story 18-4: Recovery Notification UI
 */
async function cleanExpiredDismissalsOnStartup(): Promise<void> {
  try {
    const cleaned = await dismissalService.cleanExpired();
    if (cleaned > 0) {
      outputChannel.appendLine(
        `[DismissalService] Cleaned up ${cleaned} expired dismissal(s) on startup`
      );
    }
  } catch (error) {
    outputChannel.appendLine(
      `[DismissalService] Error cleaning expired dismissals: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Command handler for showing the recovery panel.
 * Story 18-4: Recovery Notification UI
 */
async function showRecoveryPanelCommand(): Promise<void> {
  outputChannel.appendLine("Showing recovery panel");

  try {
    // Focus the recovery panel
    await vscode.commands.executeCommand("contextor.recoveryPanel.focus");
  } catch (error) {
    outputChannel.appendLine(
      `Error showing recovery panel: ${error instanceof Error ? error.message : String(error)}`
    );
    // Try to reveal the Contextor sidebar instead
    await vscode.commands.executeCommand("workbench.view.extension.contextor");
  }
}

/**
 * Command handler for dismissing all interrupted sessions.
 * Story 18-4: Recovery Notification UI
 */
async function dismissAllSessionsCommand(): Promise<void> {
  outputChannel.appendLine("Dismissing all sessions");

  const lastResult = crashDetector.getLastScanResult();
  if (!lastResult || lastResult.interruptedSessions.length === 0) {
    vscode.window.showInformationMessage(
      "Contextor: No interrupted sessions to dismiss."
    );
    return;
  }

  const activeSessions = dismissalService.filterDismissed(
    lastResult.interruptedSessions
  );

  if (activeSessions.length === 0) {
    vscode.window.showInformationMessage(
      "Contextor: All interrupted sessions are already dismissed."
    );
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Contextor: Dismiss ${activeSessions.length} interrupted session(s)?`,
    { modal: true },
    "Dismiss All"
  );

  if (confirm === "Dismiss All") {
    await dismissalService.dismissSessions(
      activeSessions.map((s) => s.sessionId)
    );
    recoveryPanelProvider.updateSessions([]);
    vscode.window.showInformationMessage(
      `Contextor: Dismissed ${activeSessions.length} session(s).`
    );
  }
}

/**
 * Command handler for recovering a single session.
 * If sessionId is provided, recover that session directly.
 * Otherwise, opens a quick pick to select the session.
 * Story 18-4, 18-5: Recovery Notification UI and One-Click Resume
 */
async function recoverSessionCommand(sessionId?: string): Promise<void> {
  outputChannel.appendLine(
    `Recover session command triggered${sessionId ? `: ${sessionId}` : ""}`
  );

  // Build dependencies for the recover session function
  const deps: RecoverSessionDependencies = {
    snapshotStore,
    promptGenerator: recoveryPromptGenerator,
    recoveryState,
    dismissalService,
    analyticsService,
    clipboardService,
    outputChannel,
  };

  // If a specific sessionId was provided (from recovery panel), recover it directly
  if (sessionId) {
    const lastResult = crashDetector.getLastScanResult();
    const session = lastResult?.interruptedSessions.find(
      (s) => s.sessionId === sessionId
    );

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Contextor: Generating recovery prompt...",
        cancellable: false,
      },
      async () => {
        const result = await recoverSession(sessionId, session || null, deps);

        if (result.success) {
          // Update recovery panel to remove recovered session
          const remainingSessions = (
            lastResult?.interruptedSessions || []
          ).filter(
            (s) =>
              s.sessionId !== sessionId && !recoveryState.isRecovered(s.sessionId)
          );
          const activeSessions = dismissalService.filterDismissed(remainingSessions);
          recoveryPanelProvider.updateSessions(activeSessions);
        }

        return result;
      }
    );
    return;
  }

  // No sessionId provided - show quick pick to select session
  const lastResult = crashDetector.getLastScanResult();
  if (!lastResult || lastResult.interruptedSessions.length === 0) {
    // Scan first
    await crashDetector.detectInterruptedSessions();
    const newResult = crashDetector.getLastScanResult();
    if (!newResult || newResult.interruptedSessions.length === 0) {
      vscode.window.showInformationMessage(
        "Contextor: No interrupted sessions found."
      );
      return;
    }
  }

  const updatedResult = crashDetector.getLastScanResult()!;

  // Filter out dismissed and already recovered sessions
  let activeSessions = dismissalService.filterDismissed(
    updatedResult.interruptedSessions
  );
  activeSessions = recoveryState.filterNotRecovered(activeSessions);

  if (activeSessions.length === 0) {
    vscode.window.showInformationMessage(
      "Contextor: No interrupted sessions available for recovery."
    );
    return;
  }

  // Show quick pick to select session
  const items = activeSessions.map((session) => ({
    label: extractProjectName(session.sessionPath),
    description: `${session.messageCount} messages`,
    detail: `${formatTimeAgo(session.lastActivity)} - "${truncate(session.lastPrompt, 50)}"`,
    session,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: "Select a session to recover",
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (selected) {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Contextor: Generating recovery prompt...",
        cancellable: false,
      },
      async () => {
        const result = await recoverSession(
          selected.session.sessionId,
          selected.session,
          deps
        );

        if (result.success) {
          // Update recovery panel
          const remainingSessions = activeSessions.filter(
            (s) => s.sessionId !== selected.session.sessionId
          );
          recoveryPanelProvider.updateSessions(remainingSessions);
        }
      }
    );
  }
}

/**
 * Extracts project name from session path.
 */
function extractProjectName(sessionPath: string): string {
  const parts = sessionPath.split("/");
  const projectDir = parts[parts.length - 2];

  if (projectDir && projectDir.startsWith("-")) {
    // Convert normalized path back to readable name
    const pathParts = projectDir.slice(1).split("-");
    return pathParts[pathParts.length - 1] || projectDir;
  }

  return projectDir || "Unknown";
}
