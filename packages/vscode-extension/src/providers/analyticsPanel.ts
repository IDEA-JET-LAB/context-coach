/**
 * AnalyticsPanelProvider - WebviewViewProvider for the Contextor Analytics sidebar panel
 * Story 19-4: Real-time Analytics Display
 *
 * Provides a webview-based analytics dashboard in the VS Code sidebar.
 * Shows prompt analytics, dimension scores, and coaching tips when authenticated.
 *
 * Features:
 * - Real-time analytics with dimension scores
 * - Auto-refresh (configurable interval)
 * - Time range selection (Today, 7 Days, 30 Days)
 * - Offline mode with cached data
 * - Sync status indicator
 */

import * as vscode from "vscode";
import { AuthService } from "../services/auth";
import { ContextorAPI } from "../services/api";
import { SettingsService } from "../services/settings";
import { ImportService, type ImportProgress, type DiscoveredProject } from "../services/importService";
import { CrashDetector } from "../services/crashDetector";
import { RealtimeService } from "../services/realtimeService";
import { WorkspaceConfigService } from "../services/workspaceConfig";
import {
  TimeRange,
  CachedAnalytics,
  AnalyticsData,
  RecentPrompt,
} from "../types/analytics";
import {
  CoachingTip,
  WeakDimension,
  CachedCoaching,
  COACHING_STORAGE_KEYS,
} from "../types/coaching";
import {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
  AnalyticsPanelState,
  DocumentItem,
  BmadVersionInfo,
  TeamTimeRange,
  TeamStatsData,
  TeamInfo,
} from "../types/messages";

/**
 * Storage keys for persistent state
 */
const STORAGE_KEYS = {
  CACHED_ANALYTICS: "contextor.cachedAnalytics",
  TIME_RANGE: "contextor.timeRange",
  LAST_SYNC_TIME: "contextor.lastSyncTime",
  IMPORT_HISTORY: "contextor.importHistory",
} as const;

/**
 * Import history data
 */
interface ImportHistoryData {
  timestamp: string;
  importedCount: number;
  skippedCount: number;
  totalSessions: number;
}

/**
 * WebviewViewProvider for the Contextor Analytics panel.
 * Displays analytics data in a sidebar webview.
 */
export class AnalyticsPanelProvider implements vscode.WebviewViewProvider {
  /**
   * Unique identifier for this view type.
   * Must match the view id in package.json.
   */
  public static readonly viewType = "contextor.analyticsView";

  /**
   * Reference to the webview view once resolved.
   * Used for sending messages to the webview.
   */
  private _view?: vscode.WebviewView;

  /**
   * Disposables to clean up when the view is disposed.
   */
  private _disposables: vscode.Disposable[] = [];

  /**
   * Auto-refresh interval timer.
   */
  private refreshTimer?: ReturnType<typeof setInterval>;

  /**
   * Settings service instance.
   */
  private readonly settingsService: SettingsService;

  /**
   * API client instance (initialized lazily).
   */
  private _api?: ContextorAPI;

  /**
   * Import service instance (initialized lazily).
   */
  private _importService?: ImportService;

  /**
   * Discovered projects cache for import selection.
   */
  private _discoveredProjects?: DiscoveredProject[];

  /**
   * Workspace config service for reading project ID.
   */
  private readonly workspaceConfigService: WorkspaceConfigService;

  /**
   * Current panel state.
   */
  private _state: AnalyticsPanelState = {
    analytics: null,
    recentPrompts: [],
    promptDetail: null,
    isLoading: false,
    isRefreshing: false,
    error: null,
    isOffline: false,
    syncState: "idle",
    lastSyncTime: null,
    timeRange: "7d",
    user: null,
    isAuthenticated: false,
    // Coaching state (Story 19-5)
    coachingTips: [],
    weakDimensions: [],
    dismissedTipIds: [],
    isCoachingLoading: false,
  };

  /**
   * Global state for persisting data.
   */
  private globalState?: vscode.Memento;

  /**
   * Realtime service for instant updates (optional).
   */
  private readonly realtimeService?: RealtimeService;

  /**
   * Debounce timer for session change refreshes.
   */
  private sessionChangeDebounceTimer?: ReturnType<typeof setTimeout>;

  /**
   * Last time we refreshed the last prompt (to avoid too frequent refreshes).
   */
  private lastPromptRefreshTime = 0;

  /**
   * Last known prompt ID (to avoid sending duplicate updates).
   */
  private lastKnownPromptId?: string;

  /**
   * Last known prompt score (to detect when analysis completes).
   */
  private lastKnownPromptScore?: number;

  /**
   * Initialization flag - prevents premature API calls during startup.
   * Set to true during initial setup, false after "ready" handler completes.
   */
  private _isInitializing = true;

  /**
   * Server health check state.
   */
  private _isServerOnline = true;
  private _healthCheckTimer?: ReturnType<typeof setInterval>;
  private _retryCountdown = 0;
  private _countdownTimer?: ReturnType<typeof setInterval>;

  /**
   * Health check interval in milliseconds (15 seconds).
   */
  private static readonly HEALTH_CHECK_INTERVAL = 15000;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly authService: AuthService,
    private readonly outputChannel: vscode.OutputChannel,
    realtimeService?: RealtimeService
  ) {
    this.settingsService = SettingsService.getInstance();
    this.realtimeService = realtimeService;
    this.workspaceConfigService = new WorkspaceConfigService(outputChannel);

    // Subscribe to realtime prompt updates (Supabase Realtime)
    if (this.realtimeService) {
      const realtimeDisposable = this.realtimeService.onNewPrompt((promptId) => {
        this.log(`Realtime: New prompt detected: ${promptId}`);
        // Refresh last prompt when a new one is analyzed
        void this.handleFetchLastPrompt();
      });
      this._disposables.push(realtimeDisposable);
    }
  }

  /**
   * Called when a Claude Code session file changes.
   * Triggers a debounced refresh of the last prompt.
   */
  public notifySessionChanged(): void {
    // Debounce: wait 2 seconds after last change before refreshing
    // This gives time for the prompt to be analyzed on the server
    if (this.sessionChangeDebounceTimer) {
      clearTimeout(this.sessionChangeDebounceTimer);
    }

    this.sessionChangeDebounceTimer = setTimeout(() => {
      this.sessionChangeDebounceTimer = undefined;

      // Only refresh if we haven't refreshed in the last 5 seconds
      const now = Date.now();
      if (now - this.lastPromptRefreshTime < 5000) {
        this.log("Session change: skipping refresh (too soon)");
        return;
      }

      this.log("Session change: triggering last prompt refresh");
      this.lastPromptRefreshTime = now;
      void this.handleFetchLastPrompt(true); // Auto-refresh: skip if unchanged
    }, 2000);
  }

  /**
   * Sets the global state for persisting data.
   * Called from extension.ts after construction.
   */
  setGlobalState(globalState: vscode.Memento): void {
    this.globalState = globalState;

    // Restore persisted time range
    const savedTimeRange = globalState.get<TimeRange>(STORAGE_KEYS.TIME_RANGE);
    if (savedTimeRange) {
      this._state.timeRange = savedTimeRange;
    }

    // Restore last sync time
    const lastSyncTime = globalState.get<string>(STORAGE_KEYS.LAST_SYNC_TIME);
    if (lastSyncTime) {
      this._state.lastSyncTime = lastSyncTime;
    }

    // Restore dismissed tip IDs (Story 19-5)
    const dismissedTipIds = globalState.get<string[]>(COACHING_STORAGE_KEYS.DISMISSED_TIPS);
    if (dismissedTipIds) {
      this._state.dismissedTipIds = dismissedTipIds;
    }
  }

  /**
   * Gets the API client, creating it if necessary.
   */
  private getApi(): ContextorAPI {
    if (!this._api) {
      this._api = new ContextorAPI(this.authService, this.outputChannel);
    }
    return this._api;
  }

  /**
   * Gets the ImportService, creating it if necessary.
   */
  private getImportService(): ImportService {
    if (!this._importService) {
      this._importService = new ImportService(this.authService);
      this._importService.initialize(this.outputChannel);
      // Set up progress callback with detailed status
      this._importService.setProgressCallback((progress: ImportProgress) => {
        this.postMessage({
          type: "import-status",
          status: {
            state: progress.state,
            totalSessions: progress.totalProjects,
            importedCount: progress.importedCount,
            skippedCount: progress.skippedCount,
            errorMessage: progress.errorMessage,
            statusMessage: progress.statusMessage,
            currentProject: progress.currentProject,
            progress: progress.progress,
          },
        } as ExtensionToWebviewMessage);
      });
    }
    return this._importService;
  }

  /**
   * Called when the view is first made visible.
   * Sets up the webview with appropriate options and content.
   */
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    // Configure webview options
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "webviews", "analytics", "dist"),
        vscode.Uri.joinPath(this.extensionUri, "dist"),
      ],
    };

    // Set the HTML content
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    const messageDisposable = webviewView.webview.onDidReceiveMessage(
      async (message: WebviewToExtensionMessage) => {
        await this.handleMessage(message);
      }
    );
    this._disposables.push(messageDisposable);

    // Handle view visibility changes (pause/resume auto-refresh)
    const visibilityDisposable = webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.log("Panel became visible, resuming auto-refresh");
        this.setupAutoRefresh();
      } else {
        this.log("Panel hidden, pausing auto-refresh");
        this.stopAutoRefresh();
      }
    });
    this._disposables.push(visibilityDisposable);

    // Handle view disposal
    const disposeDisposable = webviewView.onDidDispose(() => {
      this.stopAutoRefresh();
      this.stopHealthCheck();
      this._disposables.forEach((d) => d.dispose());
      this._disposables = [];
      this._view = undefined;
    });
    this._disposables.push(disposeDisposable);

    // Listen for auth changes - but not during initialization to prevent race conditions
    const authDisposable = this.authService.onDidChangeAuth(() => {
      if (this._isInitializing) {
        this.log("Auth state changed during init - ignoring (will be handled by ready handler)");
        return;
      }
      this.log("Auth state changed, refreshing analytics");
      this.sendAuthState();
    });
    this._disposables.push(authDisposable);

    // Listen for settings changes
    const settingsDisposable = this.settingsService.onDidChange((changes) => {
      if (changes.refreshInterval !== undefined || changes.autoRefreshEnabled !== undefined) {
        this.log("Refresh settings changed, updating timer");
        this.setupAutoRefresh();
      }
    });
    this._disposables.push(settingsDisposable);

    // NOTE: Don't call sendAuthState() or setupAutoRefresh() here.
    // Wait for webview "ready" message which properly waits for SecretStorage.
    // The "ready" handler calls sendAuthStateWithRetry() after waitForReady().
    // Auto-refresh is set up after successful auth in sendAuthState().

    this.log("Analytics panel resolved (v4 - deferred init until ready)");
  }

  /**
   * Sets up the auto-refresh timer based on settings.
   */
  private setupAutoRefresh(): void {
    // Clear existing timer
    this.stopAutoRefresh();

    // Check if auto-refresh is enabled
    if (!this.settingsService.autoRefreshEnabled) {
      this.log("Auto-refresh disabled");
      return;
    }

    const intervalSeconds = this.settingsService.refreshInterval;
    const intervalMs = intervalSeconds * 1000;

    this.log(`Setting up auto-refresh with interval: ${intervalSeconds}s`);

    this.refreshTimer = setInterval(() => {
      if (this._view?.visible && !this._state.isOffline) {
        this.log("Auto-refresh triggered");
        void this.refreshAnalytics(false);
      }
    }, intervalMs);
  }

  /**
   * Stops the auto-refresh timer.
   */
  private stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  /**
   * Checks if the Contextor server is reachable.
   * Uses the health endpoint to verify server availability.
   */
  private async checkServerHealth(): Promise<boolean> {
    try {
      const apiEndpoint = this.settingsService.apiEndpoint;
      const response = await fetch(`${apiEndpoint}/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        // Short timeout for health checks
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error) {
      this.log(`Server health check failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Starts the server health check timer.
   * Checks every 15 seconds and notifies the webview of server status.
   */
  private startHealthCheck(): void {
    // Stop existing timer if any
    this.stopHealthCheck();

    this.log("Starting server health check (every 15 seconds)");

    // Do an immediate check
    void this.performHealthCheck();

    // Start countdown timer (updates every second)
    this._retryCountdown = Math.floor(AnalyticsPanelProvider.HEALTH_CHECK_INTERVAL / 1000);
    this._countdownTimer = setInterval(() => {
      this._retryCountdown = Math.max(0, this._retryCountdown - 1);
      if (!this._isServerOnline) {
        this.postMessage({
          type: "server-status",
          isServerOnline: false,
          retryCountdown: this._retryCountdown,
        });
      }
    }, 1000);

    // Start health check timer
    this._healthCheckTimer = setInterval(() => {
      this._retryCountdown = Math.floor(AnalyticsPanelProvider.HEALTH_CHECK_INTERVAL / 1000);
      void this.performHealthCheck();
    }, AnalyticsPanelProvider.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Performs a single health check and updates state.
   */
  private async performHealthCheck(): Promise<void> {
    const isOnline = await this.checkServerHealth();
    const wasOffline = !this._isServerOnline;
    this._isServerOnline = isOnline;

    // Notify webview of status
    this.postMessage({
      type: "server-status",
      isServerOnline: isOnline,
      retryCountdown: isOnline ? undefined : this._retryCountdown,
    });

    if (isOnline) {
      this.log("Server is online");
      if (wasOffline) {
        this.log("Server came back online!");
        // Optionally refresh auth state when server comes back
        // The user can now try to sign in
      }
    } else {
      this.log("Server is offline");
    }
  }

  /**
   * Stops the server health check timer.
   */
  private stopHealthCheck(): void {
    if (this._healthCheckTimer) {
      clearInterval(this._healthCheckTimer);
      this._healthCheckTimer = undefined;
    }
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer);
      this._countdownTimer = undefined;
    }
    this._retryCountdown = 0;
  }

  /**
   * Handles messages received from the webview.
   */
  private async handleMessage(
    message: WebviewToExtensionMessage
  ): Promise<void> {
    switch (message.type) {
      case "ready":
        this.log("Webview ready (v5 - with init flag and longer delays)");

        // Send extension version immediately
        {
          const extensionVersion = vscode.extensions.getExtension("ideajetlab.contextor-vscode")?.packageJSON?.version || "unknown";
          this.postMessage({
            type: "extension-version",
            version: extensionVersion,
          } as ExtensionToWebviewMessage);
        }

        // Reset import state on init (fix stuck spinner after reload)
        this.postMessage({
          type: "import-status",
          status: {
            state: "idle",
            totalSessions: 0,
            importedCount: 0,
            skippedCount: 0,
          },
        } as ExtensionToWebviewMessage);
        // Send import history if available
        this.sendImportHistory();

        // Extra delay before any auth/API operations to let VS Code fully stabilize
        this.log("Waiting 1 second for VS Code to stabilize...");
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Wait for SecretStorage to be ready (fix 404 on reload)
        // Increased timeout to 7 seconds for slower systems
        this.log("Waiting for SecretStorage warmup...");
        await this.authService.waitForReady(7000);
        this.log("SecretStorage warmup complete");

        // Another small delay before making any API calls
        await new Promise((resolve) => setTimeout(resolve, 500));

        this.log("Sending auth state...");
        await this.sendAuthStateWithRetry(5);

        // Load cached data first (fast, no API calls)
        await this.loadCachedData();
        await this.loadCachedCoaching();

        // Mark initialization as complete BEFORE making optional API calls
        this._isInitializing = false;
        this.log("Initialization complete, auth change listener now active");

        // Check and send workspace installation status
        await this.sendWorkspaceStatus();

        // Coaching refresh is optional and silent - won't break UI if it fails
        await this.refreshCoaching();
        break;

      case "refresh":
        this.log("Refresh requested by webview");
        await this.refreshAnalytics(false);
        break;

      case "time-range-change":
        this.log(`Time range changed to: ${message.timeRange}`);
        await this.handleTimeRangeChange(message.timeRange);
        break;

      case "prompt-click":
        this.log(`Prompt clicked: ${message.promptId}`);
        await this.loadPromptDetail(message.promptId);
        break;

      case "prompt-detail-close":
        this.log("Prompt detail closed");
        this.updateState({ promptDetail: null });
        break;

      case "retry":
        this.log("Retry requested");
        await this.refreshAnalytics(false);
        break;

      case "error":
        this.log(`Webview error: ${message.error}`);
        break;

      case "login":
        this.log("Login requested from webview");
        await vscode.commands.executeCommand("contextor.signIn");
        break;

      case "logout":
        this.log("Logout requested from webview");
        await vscode.commands.executeCommand("contextor.signOut");
        break;

      case "open-web":
        this.log("Open web requested from webview");
        vscode.env.openExternal(vscode.Uri.parse(this.settingsService.apiEndpoint.replace('/api', '')));
        break;

      case "signup":
        this.log("Signup requested from webview");
        await this.handleSignup(message.email, message.password);
        break;

      case "signup-google":
        this.log("Google signup requested from webview");
        await this.handleSignupWithGoogle();
        break;

      // Coaching message handlers (Story 19-5)
      case "refresh-coaching":
        this.log("Coaching refresh requested");
        await this.refreshCoaching();
        break;

      case "dismiss-tip":
        this.log(`Dismissing tip: ${message.tipId}`);
        await this.dismissTip(message.tipId, message.reason);
        break;

      // Session message handlers
      case "scan-sessions":
        this.log("Session scan requested from webview");
        await this.handleScanSessions();
        break;

      case "recover-session":
        this.log(`Recover session requested: ${message.sessionId}`);
        await this.handleRecoverSession(message.sessionId);
        break;

      case "dismiss-session":
        this.log(`Dismiss session requested: ${message.sessionId}`);
        await this.handleDismissSession(message.sessionId);
        break;

      // Import message handlers
      case "start-import":
        this.log("Import requested from webview");
        await this.handleStartImport();
        break;

      case "cancel-import":
        this.log("Import cancellation requested");
        this.handleCancelImport();
        break;

      case "confirm-import-projects":
        this.log(`Confirm import for ${message.selectedPaths.length} projects${message.teamId ? ` to team ${message.teamId}` : ""}`);
        await this.handleConfirmImportProjects(message.selectedPaths, message.teamId);
        break;

      case "fetch-import-teams":
        this.log("Fetch import teams requested");
        await this.handleFetchImportTeams();
        break;

      // Last prompt message handler
      case "fetch-last-prompt":
        this.log("Last prompt requested from webview");
        await this.handleFetchLastPrompt();
        break;

      // Terminal command handler
      case "run-terminal-command":
        this.log(`Terminal command requested: ${message.command}`);
        this.handleRunTerminalCommand(message.command);
        break;

      // Start a new Claude Code conversation
      case "start-conversation":
        this.log("Start conversation requested");
        this.handleStartConversation();
        break;

      // Conversation message handlers (Phase 3)
      case "fetch-conversations":
        this.log("Conversations requested from webview");
        await this.handleFetchConversations();
        break;

      case "select-conversation":
        this.log(`Conversation selected: ${message.sessionId}`);
        await this.handleSelectConversation(message.sessionId);
        break;

      case "close-conversation":
        this.log("Conversation closed");
        // No-op on extension side, state handled in webview
        break;

      case "open-conversation-in-browser":
        this.log(`Open conversation in browser: ${message.sessionId}`);
        this.handleOpenConversationInBrowser(message.sessionId);
        break;

      // Project status handler (BMAD)
      case "fetch-project-status":
        this.log("Project status requested from webview");
        await this.handleFetchProjectStatus();
        break;

      case "open-status-file":
        this.log("Open status file requested");
        await this.handleOpenStatusFile();
        break;

      case "run-validation":
        this.log(`Validation requested for epic: ${message.epicId}, story: ${message.storyId || "all"}`);
        await this.handleRunValidation(message.epicId, message.storyId);
        break;

      case "install-bmad":
        this.log("BMAD installation requested");
        this.handleInstallBmad();
        break;

      case "refresh-workspace-status":
        this.log("Workspace status refresh requested");
        await this.sendWorkspaceStatus();
        break;

      case "register-project":
        this.log("Project registration requested");
        await this.handleRegisterProject();
        break;

      case "fetch-documents":
        this.log("Fetch documents requested");
        await this.handleFetchDocuments();
        break;

      case "open-document":
        if ("path" in message) {
          this.log(`Open document requested: ${message.path}`);
          await this.handleOpenDocument(message.path);
        }
        break;

      case "create-document":
        if ("doc" in message) {
          this.log(`Create document requested: ${message.doc.name}`);
          await this.handleCreateDocument(message.doc);
        }
        break;

      case "fetch-bmad-version":
        this.log("BMAD version check requested");
        await this.handleFetchBmadVersion();
        break;

      case "upgrade-bmad":
        this.log("BMAD upgrade requested");
        this.handleUpgradeBmad();
        break;

      case "fetch-teams":
        this.log("Teams list requested");
        await this.handleFetchTeams();
        break;

      case "fetch-team-stats":
        this.log("Team stats requested");
        await this.handleFetchTeamStats(message.teamId, message.timeRange);
        break;
    }
  }

  // ============================================
  // Session Methods
  // ============================================

  /**
   * Handles session scan request from webview.
   */
  private async handleScanSessions(): Promise<void> {
    this.postMessage({ type: "sessions-loading", isLoading: true } as ExtensionToWebviewMessage);

    try {
      // Use CrashDetector directly (not via command which shows QuickPick)
      const crashDetector = CrashDetector.getInstance();
      const result = await crashDetector.detectInterruptedSessions();

      this.log(`Session scan complete: found ${result.interruptedSessions.length} sessions`);

      // Map to webview session format
      const sessions = result.interruptedSessions.map((session) => ({
        sessionId: session.sessionId,
        projectName: this.extractProjectName(session.sessionPath),
        lastActivity: session.lastActivity.toISOString(),
        lastPrompt: session.lastPrompt,
        messageCount: session.messageCount,
        isInterrupted: true,
        cwd: session.cwd,
        gitBranch: session.gitBranch,
      }));

      // Send sessions to webview
      this.postMessage({ type: "sessions", sessions } as ExtensionToWebviewMessage);
      this.postMessage({ type: "sessions-loading", isLoading: false } as ExtensionToWebviewMessage);
    } catch (error) {
      this.logError("Failed to scan sessions", error);
      this.postMessage({ type: "sessions-loading", isLoading: false } as ExtensionToWebviewMessage);
    }
  }

  /**
   * Extracts project name from session path.
   */
  private extractProjectName(sessionPath: string): string {
    const parts = sessionPath.split("/");
    const projectDir = parts[parts.length - 2];

    if (projectDir && projectDir.startsWith("-")) {
      // Convert normalized path back to readable name
      const pathParts = projectDir.slice(1).split("-");
      return pathParts[pathParts.length - 1] || projectDir;
    }

    return projectDir || "Unknown";
  }

  /**
   * Handles session recovery request from webview.
   */
  private async handleRecoverSession(sessionId: string): Promise<void> {
    try {
      await vscode.commands.executeCommand("contextor.recoverSession", sessionId);
      this.postMessage({
        type: "session-recovered",
        sessionId,
        success: true,
      } as ExtensionToWebviewMessage);
    } catch (error) {
      this.logError(`Failed to recover session ${sessionId}`, error);
      this.postMessage({
        type: "session-recovered",
        sessionId,
        success: false,
      } as ExtensionToWebviewMessage);
    }
  }

  /**
   * Handles session dismissal request from webview.
   */
  private async handleDismissSession(sessionId: string): Promise<void> {
    try {
      // The dismissal service is accessed via extension.ts
      // For now, we can emit a command or directly handle it
      this.postMessage({
        type: "session-dismissed",
        sessionId,
      } as ExtensionToWebviewMessage);
    } catch (error) {
      this.logError(`Failed to dismiss session ${sessionId}`, error);
    }
  }

  // ============================================
  // Import Methods
  // ============================================

  /**
   * Handles import start request from webview.
   */
  private async handleStartImport(): Promise<void> {
    const importService = this.getImportService();

    try {
      // Step 1: Show scanning status
      this.postMessage({
        type: "import-status",
        status: {
          state: "scanning",
          totalSessions: 0,
          importedCount: 0,
          skippedCount: 0,
        },
      } as ExtensionToWebviewMessage);

      // Step 2: Discover projects
      this.log("Discovering Claude Code projects...");
      const projects = await importService.discoverProjects();

      if (projects.length === 0) {
        vscode.window.showInformationMessage(
          "Contextor: No Claude Code conversations found to import."
        );
        this.postMessage({
          type: "import-status",
          status: {
            state: "complete",
            totalSessions: 0,
            importedCount: 0,
            skippedCount: 0,
            statusMessage: "No Claude Code projects found",
          },
        } as ExtensionToWebviewMessage);
        return;
      }

      // Step 3: Cache projects and send to webview for selection
      this.log(`Found ${projects.length} projects with conversations`);
      this._discoveredProjects = projects;

      // Convert to webview-friendly format with display names
      const discoveredProjectsInfo = projects.map(p => ({
        path: p.path,
        normalizedPath: p.normalizedPath,
        sessionCount: p.sessionCount,
        estimatedPrompts: p.estimatedPrompts,
        oldestSession: p.oldestSession.toISOString(),
        newestSession: p.newestSession.toISOString(),
        displayName: this.extractProjectDisplayName(p.path),
      }));

      // Send projects to webview for user selection
      this.postMessage({
        type: "import-status",
        status: {
          state: "selecting",
          totalSessions: projects.length,
          importedCount: 0,
          skippedCount: 0,
          discoveredProjects: discoveredProjectsInfo,
        },
      } as ExtensionToWebviewMessage);
    } catch (error) {
      this.logError("Failed to scan projects", error);
      this.postMessage({
        type: "import-status",
        status: {
          state: "error",
          totalSessions: 0,
          importedCount: 0,
          skippedCount: 0,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      } as ExtensionToWebviewMessage);
      vscode.window.showErrorMessage(
        `Contextor: Failed to scan projects - ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Extract a display-friendly project name from a full path.
   */
  private extractProjectDisplayName(projectPath: string): string {
    const parts = projectPath.split("/").filter(Boolean);
    // Return the last meaningful part (project folder name)
    return parts[parts.length - 1] || projectPath;
  }

  /**
   * Handles fetching teams for import team selection.
   */
  private async handleFetchImportTeams(): Promise<void> {
    const importService = this.getImportService();

    this.postMessage({
      type: "import-teams-loading",
      isLoading: true,
    } as ExtensionToWebviewMessage);

    try {
      const teams = await importService.fetchUserTeams();

      if (!teams || teams.length === 0) {
        this.log("No teams found for import");
        this.postMessage({
          type: "import-teams",
          teams: [],
        } as ExtensionToWebviewMessage);
      } else {
        this.log(`Found ${teams.length} teams for import`);
        this.postMessage({
          type: "import-teams",
          teams: teams.map(t => ({ id: t.id, name: t.name })),
        } as ExtensionToWebviewMessage);
      }
    } catch (error) {
      this.logError("Failed to fetch teams for import", error);
      this.postMessage({
        type: "import-teams",
        teams: [],
      } as ExtensionToWebviewMessage);
    } finally {
      this.postMessage({
        type: "import-teams-loading",
        isLoading: false,
      } as ExtensionToWebviewMessage);
    }
  }

  /**
   * Handles confirmed project import from webview.
   * @param selectedPaths - Paths of selected projects
   * @param teamId - Optional team ID to import to
   */
  private async handleConfirmImportProjects(selectedPaths: string[], teamId?: string): Promise<void> {
    const importService = this.getImportService();

    if (!this._discoveredProjects) {
      this.logError("No discovered projects to import", null);
      this.postMessage({
        type: "import-status",
        status: {
          state: "error",
          totalSessions: 0,
          importedCount: 0,
          skippedCount: 0,
          errorMessage: "No projects discovered. Please scan again.",
        },
      } as ExtensionToWebviewMessage);
      return;
    }

    // Filter to only selected projects
    const projectsToImport = this._discoveredProjects.filter(p =>
      selectedPaths.includes(p.path)
    );

    if (projectsToImport.length === 0) {
      this.log("No projects selected for import");
      this.postMessage({
        type: "import-status",
        status: {
          state: "idle",
          totalSessions: 0,
          importedCount: 0,
          skippedCount: 0,
        },
      } as ExtensionToWebviewMessage);
      return;
    }

    try {
      this.log(`Starting import of ${projectsToImport.length} projects${teamId ? ` to team ${teamId}` : ""}...`);
      const result = await importService.startImport(projectsToImport, teamId);

      // Show completion message and save history
      if (result.state === "complete") {
        // Save import history for display in UI
        await this.saveImportHistory(
          result.importedCount,
          result.skippedCount,
          projectsToImport.length
        );
        vscode.window.showInformationMessage(
          `Contextor: Import complete! ${result.importedCount} prompts imported, ${result.skippedCount} duplicates skipped.`
        );
      } else if (result.state === "cancelled") {
        vscode.window.showInformationMessage("Contextor: Import cancelled.");
      } else if (result.state === "error") {
        vscode.window.showErrorMessage(
          `Contextor: Import failed - ${result.errorMessage}`
        );
      }

      // Clear cached projects
      this._discoveredProjects = undefined;
    } catch (error) {
      this.logError("Failed to import projects", error);
      this.postMessage({
        type: "import-status",
        status: {
          state: "error",
          totalSessions: 0,
          importedCount: 0,
          skippedCount: 0,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      } as ExtensionToWebviewMessage);
      vscode.window.showErrorMessage(
        `Contextor: Import failed - ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Handles import cancellation request from webview.
   */
  private handleCancelImport(): void {
    if (this._importService) {
      this._importService.cancel();
      this.log("Import cancelled by user");
    }

    // Clear cached projects and reset state
    this._discoveredProjects = undefined;
    this.postMessage({
      type: "import-status",
      status: {
        state: "idle",
        totalSessions: 0,
        importedCount: 0,
        skippedCount: 0,
      },
    } as ExtensionToWebviewMessage);
  }

  /**
   * Saves import history to persistent storage.
   */
  private async saveImportHistory(
    importedCount: number,
    skippedCount: number,
    totalSessions: number
  ): Promise<void> {
    if (!this.globalState) return;

    const history: ImportHistoryData = {
      timestamp: new Date().toISOString(),
      importedCount,
      skippedCount,
      totalSessions,
    };

    await this.globalState.update(STORAGE_KEYS.IMPORT_HISTORY, history);
    this.log(`Import history saved: ${importedCount} imported, ${skippedCount} skipped`);

    // Send to webview
    this.sendImportHistory();
  }

  /**
   * Sends import history to the webview.
   */
  private sendImportHistory(): void {
    if (!this.globalState) return;

    const history = this.globalState.get<ImportHistoryData>(STORAGE_KEYS.IMPORT_HISTORY);

    this.postMessage({
      type: "import-history",
      history: history || null,
    } as ExtensionToWebviewMessage);
  }

  // ============================================
  // Terminal Command Methods
  // ============================================

  /**
   * Sends a command to the active terminal.
   * If no terminal is active, shows an error message.
   */
  private handleRunTerminalCommand(command: string): void {
    const terminal = vscode.window.activeTerminal;

    if (!terminal) {
      this.log("No active terminal found");
      vscode.window.showWarningMessage(
        "Contextor: No active terminal. Please click on your Claude Code terminal first, then try again."
      );
      return;
    }

    this.log(`Sending command to terminal "${terminal.name}": ${command}`);
    // Note: Claude Code uses raw terminal mode, so we can only paste the command.
    // User must press Enter manually to execute.
    terminal.sendText(command, false);
    terminal.show(); // Ensure the terminal is visible
  }

  /**
   * Start a new Claude Code conversation in a new terminal.
   * Opens a terminal in the workspace folder and runs 'claude'.
   */
  private handleStartConversation(): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspacePath = workspaceFolders?.[0]?.uri.fsPath;

    if (!workspacePath) {
      vscode.window.showWarningMessage(
        "Contextor: Please open a workspace folder first."
      );
      return;
    }

    // Create a new terminal with Claude Code
    const terminal = vscode.window.createTerminal({
      name: "Claude Code",
      cwd: workspacePath,
    });

    terminal.show();
    terminal.sendText("claude --dangerously-skip-permissions");

    vscode.window.showInformationMessage(
      "Contextor: Starting new Claude Code conversation..."
    );
  }

  // ============================================
  // Project Status Methods (BMAD)
  // ============================================

  /**
   * Handles fetch project status request from webview.
   * Reads and parses sprint-status.yaml from the workspace.
   */
  private async handleFetchProjectStatus(): Promise<void> {
    this.postMessage({ type: "project-status-loading", isLoading: true } as ExtensionToWebviewMessage);

    try {
      // Find sprint-status.yaml in workspace
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        this.postMessage({ type: "project-status", status: null } as ExtensionToWebviewMessage);
        this.postMessage({ type: "project-status-loading", isLoading: false } as ExtensionToWebviewMessage);
        return;
      }

      // Search for sprint-status.yaml
      const pattern = new vscode.RelativePattern(workspaceFolders[0], "**/sprint-status.yaml");
      const files = await vscode.workspace.findFiles(pattern, "**/node_modules/**", 1);

      if (files.length === 0) {
        this.log("No sprint-status.yaml found in workspace");
        this.postMessage({ type: "project-status", status: null } as ExtensionToWebviewMessage);
        this.postMessage({ type: "project-status-loading", isLoading: false } as ExtensionToWebviewMessage);
        return;
      }

      // Read and parse the YAML file
      const fileUri = files[0];
      const content = await vscode.workspace.fs.readFile(fileUri);
      const text = new TextDecoder().decode(content);

      // Parse YAML (simple parser for development_status format)
      const status = this.parseSprintStatus(text);

      // Check for validation files in _bmad-output/stories/
      const validationPattern = new vscode.RelativePattern(
        workspaceFolders[0],
        "_bmad-output/stories/validation-*.md"
      );
      const validationFiles = await vscode.workspace.findFiles(validationPattern, null, 500);

      // Build a set of validated story IDs (e.g., "1-1", "2-3")
      const validatedStoryIds = new Set<string>();
      for (const file of validationFiles) {
        // Extract story ID from filename (e.g., "validation-1-1-name.md" → "1-1")
        const filename = file.path.split("/").pop() || "";
        const match = filename.match(/^validation-(\d+(?:\.\d+)?-\d+)/);
        if (match) {
          validatedStoryIds.add(match[1]);
        }
      }

      // Add validation status to epics and stories
      for (const epic of status.epics) {
        const epicNumber = epic.id.replace(/^epic-/, "");

        // Check if epic was already marked as validated from comments in sprint-status.yaml
        const epicValidatedFromComments = epic.isValidated === true;
        let epicValidated = true; // Epic is validated if all non-optional stories are validated

        for (const story of epic.stories) {
          // Extract story number from ID (e.g., "1-1-name" → "1-1")
          const storyMatch = story.id.match(/^(\d+(?:\.\d+)?-\d+)/);
          const storyNumber = storyMatch ? storyMatch[1] : "";

          // Story is validated if: has validation file OR epic is validated in comments
          story.isValidated = validatedStoryIds.has(storyNumber) || epicValidatedFromComments;

          // Epic is not validated if any non-optional story is not validated
          if (!story.isValidated && story.status !== "optional") {
            epicValidated = false;
          }
        }

        // Epic is validated if: marked in comments OR all non-optional stories are validated
        epic.isValidated = epic.stories.length > 0 ? (epicValidatedFromComments || epicValidated) : undefined;
      }

      this.log(`Project status loaded: ${status.epics.length} epics, ${validatedStoryIds.size} validated stories`);
      this.postMessage({ type: "project-status", status } as ExtensionToWebviewMessage);
      this.postMessage({ type: "project-status-loading", isLoading: false } as ExtensionToWebviewMessage);
    } catch (error) {
      this.logError("Failed to fetch project status", error);
      this.postMessage({
        type: "project-status-error",
        error: error instanceof Error ? error.message : "Failed to load status",
      } as ExtensionToWebviewMessage);
      this.postMessage({ type: "project-status-loading", isLoading: false } as ExtensionToWebviewMessage);
    }
  }

  /**
   * Parses sprint-status.yaml content into structured data.
   */
  private parseSprintStatus(content: string): {
    project: string;
    generated: string;
    epics: Array<{
      id: string;
      name: string;
      status: string;
      description?: string;
      isValidated?: boolean;
      stories: Array<{ id: string; name: string; status: string; isValidated?: boolean }>;
    }>;
  } {
    const lines = content.split("\n");
    const epics: Array<{
      id: string;
      name: string;
      status: string;
      description?: string;
      isValidated?: boolean;
      stories: Array<{ id: string; name: string; status: string; isValidated?: boolean }>;
    }> = [];

    let project = "Unknown";
    let generated = new Date().toISOString().split("T")[0];
    let currentEpic: {
      id: string;
      name: string;
      status: string;
      description?: string;
      isValidated?: boolean;
      stories: Array<{ id: string; name: string; status: string; isValidated?: boolean }>;
    } | null = null;

    for (const line of lines) {
      // Extract project name
      if (line.startsWith("project:")) {
        project = line.split(":")[1]?.trim() || project;
        continue;
      }

      // Extract generated date
      if (line.startsWith("generated:")) {
        generated = line.split(":").slice(1).join(":").trim() || generated;
        continue;
      }

      // Skip comments and empty lines
      if (line.trim().startsWith("#") || !line.trim()) continue;

      // Check for epic line (e.g., "epic-1: done", "epic-24: in-progress")
      const epicMatch = line.match(/^\s*(epic-\d+(?:\.\d+)?(?:-\w+)?)\s*:\s*([\w-]+)/);
      if (epicMatch) {
        const [, epicId, status] = epicMatch;

        // Save previous epic if exists
        if (currentEpic) {
          epics.push(currentEpic);
        }

        // Find epic name and validation status from comments above (look back in lines)
        const epicLineIndex = lines.indexOf(line);
        const epicName = this.findEpicName(lines, epicLineIndex, epicId);
        const isValidatedInComments = this.isEpicValidatedInComments(lines, epicLineIndex);

        currentEpic = {
          id: epicId,
          name: epicName,
          status: status,
          stories: [],
          isValidated: isValidatedInComments ? true : undefined, // Will be refined later based on story validation
        };
        continue;
      }

      // Check for retrospective line (e.g., "epic-1-retrospective: optional")
      if (line.match(/epic-\d+(?:\.\d+)?-retrospective\s*:/)) {
        continue; // Skip retrospective lines
      }

      // Check for story line (e.g., "1-1-project-initialization: done")
      const storyMatch = line.match(/^\s*(\d+(?:\.\d+)?-\d+-[\w-]+)\s*:\s*(\S+)/);
      if (storyMatch && currentEpic) {
        const [, storyId, status] = storyMatch;
        const storyName = this.formatStoryName(storyId);
        currentEpic.stories.push({
          id: storyId,
          name: storyName,
          status: status.replace(/#.*$/, "").trim(), // Remove trailing comments
        });
      }
    }

    // Don't forget to add the last epic
    if (currentEpic) {
      epics.push(currentEpic);
    }

    return { project, generated, epics };
  }

  /**
   * Finds epic name from comments above the epic line.
   */
  private findEpicName(lines: string[], epicLineIndex: number, epicId: string): string {
    // Look backwards for a comment containing the epic name (increased to 10 lines for Phase 3 epics with more metadata)
    for (let i = epicLineIndex - 1; i >= 0 && i >= epicLineIndex - 10; i--) {
      const line = lines[i].trim();
      if (line.startsWith("#") && line.includes("Epic")) {
        // Extract name after "Epic N:" or just the description
        const match = line.match(/Epic\s+\d+(?:\.\d+)?[.:]\s*(.+)/);
        if (match) {
          return match[1].trim();
        }
      }
    }

    // Fallback: format the epic ID
    return epicId.replace(/-/g, " ").replace(/epic /i, "Epic ");
  }

  /**
   * Checks if an epic is marked as validated in comments above the epic line.
   * Looks for patterns like "# Status: VALIDATED" or "VALIDATED & READY"
   */
  private isEpicValidatedInComments(lines: string[], epicLineIndex: number): boolean {
    // Look backwards for a comment containing validation status
    for (let i = epicLineIndex - 1; i >= 0 && i >= epicLineIndex - 10; i--) {
      const line = lines[i].trim();
      if (line.startsWith("#")) {
        // Check for "VALIDATED" keyword (case-insensitive)
        if (/\bVALIDATED\b/i.test(line)) {
          return true;
        }
      }
      // Stop if we hit another epic or non-comment content
      if (!line.startsWith("#") && line.trim() !== "") {
        break;
      }
    }
    return false;
  }

  /**
   * Formats story ID into readable name.
   */
  private formatStoryName(storyId: string): string {
    // Convert "1-1-project-initialization" to "Project Initialization"
    const parts = storyId.split("-").slice(2); // Remove numeric prefix
    return parts
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  /**
   * Opens the sprint-status.yaml file in the editor.
   */
  private async handleOpenStatusFile(): Promise<void> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showWarningMessage("No workspace folder open");
        return;
      }

      // Search for sprint-status.yaml
      const pattern = new vscode.RelativePattern(workspaceFolders[0], "**/sprint-status.yaml");
      const files = await vscode.workspace.findFiles(pattern, "**/node_modules/**", 1);

      if (files.length === 0) {
        vscode.window.showWarningMessage("No sprint-status.yaml found in workspace");
        return;
      }

      // Open the file in the editor
      const document = await vscode.workspace.openTextDocument(files[0]);
      await vscode.window.showTextDocument(document, { preview: false });
      this.log(`Opened status file: ${files[0].fsPath}`);
    } catch (error) {
      this.logError("Failed to open status file", error);
      vscode.window.showErrorMessage("Failed to open sprint-status.yaml");
    }
  }

  /**
   * Runs validation for an epic or story in a new terminal.
   * Opens Claude with permissions and pastes the validation command.
   */
  private async handleRunValidation(epicId: string, storyId?: string): Promise<void> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showWarningMessage("No workspace folder open");
        return;
      }

      // Extract epic number from ID (e.g., "epic-1" → "1")
      const epicNumber = epicId.replace(/^epic-/, "");

      // Build the validation command
      let validationTarget: string;
      let terminalName: string;

      if (storyId) {
        // Story validation - extract story number (e.g., "1-1-name" → "1-1")
        const storyMatch = storyId.match(/^(\d+(?:\.\d+)?-\d+)/);
        const storyNumber = storyMatch ? storyMatch[1] : storyId;
        validationTarget = `story ${storyNumber}`;
        terminalName = `Validate Story ${storyNumber}`;
      } else {
        // Epic validation
        validationTarget = `epic ${epicNumber}`;
        terminalName = `Validate Epic ${epicNumber}`;
      }

      // Create a new terminal
      const terminal = vscode.window.createTerminal({
        name: terminalName,
        cwd: workspaceFolders[0].uri.fsPath,
      });

      // Show the terminal
      terminal.show();

      // Build the Claude command with dangerously skip permissions
      // The validation workflow will check PRD and architecture alignment
      const command = `claude --dangerously-skip-permissions "Run BMAD validation workflow for ${validationTarget}. Check alignment with PRD and architecture files. Generate validation report in _bmad-output/stories/ folder."`;

      // Send the command to the terminal
      terminal.sendText(command);

      this.log(`Started validation for ${validationTarget}`);
      vscode.window.showInformationMessage(`Starting validation for ${validationTarget}...`);
    } catch (error) {
      this.logError("Failed to run validation", error);
      vscode.window.showErrorMessage("Failed to start validation");
    }
  }

  // ============================================
  // Workspace Status Methods
  // ============================================

  /**
   * Checks and sends workspace installation status to webview.
   * Detects if Contextor and BMAD are installed in the current workspace.
   */
  private async sendWorkspaceStatus(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      this.postMessage({
        type: "workspace-status",
        status: {
          contextorInstalled: false,
          bmadInstalled: false,
          projectId: null,
          projectName: null,
        },
      } as ExtensionToWebviewMessage);
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    // Check Contextor installation
    const contextorConfig = await this.workspaceConfigService.getWorkspaceConfig();
    const contextorInstalled = contextorConfig !== null;

    // Check BMAD installation (look for _bmad or .bmad folder - supports both v6+ and legacy)
    let bmadInstalled = false;
    try {
      // Check for v6+ structure (_bmad folder)
      const bmadV6Folders = await vscode.workspace.findFiles(
        new vscode.RelativePattern(workspaceFolders[0], "_bmad/**/*"),
        null,
        1
      );
      if (bmadV6Folders.length > 0) {
        bmadInstalled = true;
      } else {
        // Check for legacy structure (.bmad folder)
        const bmadLegacyFolders = await vscode.workspace.findFiles(
          new vscode.RelativePattern(workspaceFolders[0], ".bmad/**/*"),
          null,
          1
        );
        bmadInstalled = bmadLegacyFolders.length > 0;
      }
    } catch {
      bmadInstalled = false;
    }

    this.log(`Workspace status: Contextor=${contextorInstalled}, BMAD=${bmadInstalled}`);

    // Reset the view title to default
    if (this._view) {
      this._view.title = "Contextor";
    }

    this.postMessage({
      type: "workspace-status",
      status: {
        contextorInstalled,
        bmadInstalled,
        projectId: contextorConfig?.project_id ?? null,
        projectName: contextorConfig?.project_name ?? null,
        teamId: contextorConfig?.team_id ?? null,
      },
    } as ExtensionToWebviewMessage);
  }

  /**
   * Handles BMAD installation request from webview.
   * Opens a new terminal and runs the V6 alpha installation command.
   */
  private handleInstallBmad(): void {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!workspacePath) {
      vscode.window.showErrorMessage("Please open a workspace folder first.");
      return;
    }

    const terminal = vscode.window.createTerminal({
      name: "BMAD Installation",
      cwd: workspacePath,
    });

    terminal.show();

    // Run BMAD v6 Alpha installation command directly
    terminal.sendText("npx bmad-method@alpha install");

    vscode.window.showInformationMessage(
      "Installing BMAD Method v6 Alpha. Follow the prompts in the terminal."
    );

    this.log("BMAD installation started: npx bmad-method@alpha install");
  }

  /**
   * Handles project registration request from webview.
   * Calls the API to create a project and saves the config locally.
   */
  private async handleRegisterProject(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage("No workspace folder open. Please open a folder first.");
      return;
    }

    const workspaceFolder = workspaceFolders[0];
    const workspacePath = workspaceFolder.uri.fsPath;
    const defaultProjectName = workspaceFolder.name;

    // First, fetch user's teams
    const api = this.getApi();
    const teamsResult = await api.getMyTeams();

    if (!teamsResult.success || !teamsResult.data) {
      const errorMessage = teamsResult.error?.message || "Failed to fetch teams";
      vscode.window.showErrorMessage(`Contextor: ${errorMessage}`);
      return;
    }

    const teams = teamsResult.data;

    if (teams.length === 0) {
      // No teams - show message with link to web app
      const action = await vscode.window.showWarningMessage(
        "You don't have any teams yet. Create a team in the web app first.",
        "Open Web App"
      );
      if (action === "Open Web App") {
        const config = vscode.workspace.getConfiguration("contextor");
        const apiEndpoint = config.get<string>("apiEndpoint", "http://127.0.0.1:3050/api");
        const webUrl = apiEndpoint.replace("/api", "");
        vscode.env.openExternal(vscode.Uri.parse(`${webUrl}/dashboard/settings/team`));
      }
      return;
    }

    // Ask user to select a team
    interface TeamQuickPickItem extends vscode.QuickPickItem {
      teamId: string;
    }

    const teamItems: TeamQuickPickItem[] = teams.map((team) => ({
      label: team.name,
      description: team.role === "admin" ? "Admin" : "Member",
      teamId: team.id,
    }));

    // Add option to create new team
    const createNewOption: TeamQuickPickItem = {
      label: "$(add) Create New Team...",
      description: "Open web app to create a new team",
      teamId: "__create_new__",
    };

    const selectedTeam = await vscode.window.showQuickPick(
      [...teamItems, createNewOption],
      {
        title: "Select Team",
        placeHolder: "Choose a team for this project",
      }
    );

    if (!selectedTeam) {
      return; // User cancelled
    }

    if (selectedTeam.teamId === "__create_new__") {
      const config = vscode.workspace.getConfiguration("contextor");
      const apiEndpoint = config.get<string>("apiEndpoint", "http://127.0.0.1:3050/api");
      const webUrl = apiEndpoint.replace("/api", "");
      vscode.env.openExternal(vscode.Uri.parse(`${webUrl}/teams/new`));
      return;
    }

    // Ask user for project name
    const projectName = await vscode.window.showInputBox({
      title: "Register Project",
      prompt: "Enter a name for this project",
      value: defaultProjectName,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return "Project name is required";
        }
        if (value.length > 100) {
          return "Project name must be 100 characters or less";
        }
        return null;
      },
    });

    if (!projectName) {
      return; // User cancelled
    }

    // Show progress
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Registering project...",
        cancellable: false,
      },
      async () => {
        try {
          const result = await api.registerProject(projectName.trim(), workspacePath, selectedTeam.teamId);

          if (!result.success || !result.data) {
            const errorMessage = result.error?.message || "Failed to register project";
            vscode.window.showErrorMessage(`Contextor: ${errorMessage}`);
            return;
          }

          // Create .contextor directory
          const contextorDir = vscode.Uri.joinPath(workspaceFolder.uri, ".contextor");
          try {
            await vscode.workspace.fs.createDirectory(contextorDir);
          } catch {
            // Directory may already exist
          }

          // Write config.json
          const configPath = vscode.Uri.joinPath(contextorDir, "config.json");
          const configContent = JSON.stringify(result.data.config, null, 2);
          await vscode.workspace.fs.writeFile(configPath, Buffer.from(configContent, "utf-8"));

          this.log(`Project registered: ${result.data.project.name} (${result.data.project.id})`);
          this.log(`Config saved to: ${configPath.fsPath}`);

          // Parse install token to get API key and user info
          const tokenPayload = this.parseInstallToken(result.data.installToken);
          if (tokenPayload) {
            // Write .user file with API key
            const userConfig = {
              user_id: tokenPayload.user_id,
              user_name: tokenPayload.user_name,
              api_key: tokenPayload.api_key,
              configured_at: new Date().toISOString(),
            };
            const userPath = vscode.Uri.joinPath(contextorDir, ".user");
            await vscode.workspace.fs.writeFile(userPath, Buffer.from(JSON.stringify(userConfig, null, 2), "utf-8"));
            this.log(`User config saved to: ${userPath.fsPath}`);

            // Install capture hook
            await this.installCaptureHook(workspacePath);
            this.log("Capture hook installed");
          } else {
            this.log("Warning: Could not parse install token");
          }

          // Show success message
          vscode.window.showInformationMessage(
            `Project "${result.data.project.name}" registered successfully in team "${selectedTeam.label}"!`
          );

          // Refresh workspace status
          await this.sendWorkspaceStatus();

        } catch (error) {
          this.logError("Failed to register project", error);
          vscode.window.showErrorMessage(
            `Contextor: Failed to register project - ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }
    );
  }

  // ============================================
  // Documents Methods
  // ============================================

  /**
   * Handles fetch documents request from webview.
   * Scans the workspace for BMAD documents and returns a file tree.
   */
  private async handleFetchDocuments(): Promise<void> {
    this.postMessage({ type: "documents-loading", isLoading: true } as ExtensionToWebviewMessage);

    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        this.postMessage({ type: "documents", documents: [] } as ExtensionToWebviewMessage);
        return;
      }

      const workspaceRoot = workspaceFolders[0].uri;
      const documents: DocumentItem[] = [];

      // Scan for key BMAD documents and folders
      const bmadPatterns = [
        "_bmad-output",      // BMAD output folder
        "_bmad",             // BMAD config folder
      ];

      // Scan for key document files in root
      const rootDocs = [
        "prd.md",
        "PRD.md",
        "architecture.md",
        "ARCHITECTURE.md",
        "README.md",
      ];

      // Check for root documents
      for (const docName of rootDocs) {
        const docUri = vscode.Uri.joinPath(workspaceRoot, docName);
        try {
          await vscode.workspace.fs.stat(docUri);
          documents.push({
            id: docName,
            name: docName,
            path: docUri.fsPath,
            type: "file",
          });
        } catch {
          // File doesn't exist, skip
        }
      }

      // Scan for BMAD folders
      for (const pattern of bmadPatterns) {
        const folderUri = vscode.Uri.joinPath(workspaceRoot, pattern);
        try {
          const stat = await vscode.workspace.fs.stat(folderUri);
          if (stat.type === vscode.FileType.Directory) {
            const folder = await this.scanFolder(folderUri, pattern);
            if (folder) {
              documents.push(folder);
            }
          }
        } catch {
          // Folder doesn't exist, skip
        }
      }

      this.log(`Found ${documents.length} document items`);
      this.postMessage({ type: "documents", documents } as ExtensionToWebviewMessage);
    } catch (error) {
      this.logError("Failed to fetch documents", error);
      this.postMessage({ type: "documents", documents: [] } as ExtensionToWebviewMessage);
    }
  }

  /**
   * Recursively scans a folder and returns a DocumentItem tree.
   */
  private async scanFolder(folderUri: vscode.Uri, folderId: string): Promise<DocumentItem | null> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(folderUri);
      const children: DocumentItem[] = [];

      // Sort entries: folders first, then files, alphabetically
      entries.sort((a, b) => {
        if (a[1] !== b[1]) {
          return a[1] === vscode.FileType.Directory ? -1 : 1;
        }
        return a[0].localeCompare(b[0]);
      });

      for (const [name, type] of entries) {
        // Skip hidden files and certain folders
        if (name.startsWith(".") || name === "node_modules") {
          continue;
        }

        const childUri = vscode.Uri.joinPath(folderUri, name);
        const childId = `${folderId}/${name}`;

        if (type === vscode.FileType.Directory) {
          // Recursively scan subdirectories (limit depth)
          const depth = folderId.split("/").length;
          if (depth < 4) { // Max depth of 4 levels
            const childFolder = await this.scanFolder(childUri, childId);
            if (childFolder) {
              children.push(childFolder);
            }
          }
        } else if (type === vscode.FileType.File) {
          // Only include relevant file types
          const ext = name.split(".").pop()?.toLowerCase();
          if (["md", "yaml", "yml", "json", "txt"].includes(ext || "")) {
            children.push({
              id: childId,
              name,
              path: childUri.fsPath,
              type: "file",
            });
          }
        }
      }

      return {
        id: folderId,
        name: folderUri.path.split("/").pop() || folderId,
        path: folderUri.fsPath,
        type: "folder",
        children,
      };
    } catch (error) {
      this.logError(`Failed to scan folder ${folderUri.fsPath}`, error);
      return null;
    }
  }

  /**
   * Opens a document in VS Code editor.
   */
  private async handleOpenDocument(path: string): Promise<void> {
    try {
      const uri = vscode.Uri.file(path);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc);
      this.log(`Opened document: ${path}`);
    } catch (error) {
      this.logError(`Failed to open document: ${path}`, error);
      vscode.window.showErrorMessage(`Failed to open document: ${path}`);
    }
  }

  /**
   * Handles create document request from webview.
   * Opens a terminal with Claude and runs the appropriate BMAD workflow or agent.
   */
  private async handleCreateDocument(doc: {
    id: string;
    name: string;
    filename: string;
    workflow: string | null;
    agent: string | null;
  }): Promise<void> {
    try {
      const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspacePath) {
        vscode.window.showErrorMessage("No workspace folder open");
        return;
      }

      // Create terminal for Claude Code
      const terminal = vscode.window.createTerminal({
        name: `BMAD: ${doc.name}`,
        cwd: workspacePath,
      });
      terminal.show();

      // Build the command to run (skip permissions for smoother UX)
      let command: string;
      const skipPerms = "--dangerously-skip-permissions";

      if (doc.workflow) {
        // Has a dedicated workflow - run it directly
        command = `claude ${skipPerms} "${doc.workflow}"`;
      } else if (doc.agent) {
        // No workflow, but has an agent - start conversation with agent about the document
        const agentSkill = `/bmad:bmm:agents:${doc.agent}`;
        const prompt = `Please help me create the ${doc.name} document (${doc.filename}) for this project. Let's discuss what should be included.`;
        command = `claude ${skipPerms} "${agentSkill}" --prompt "${prompt.replace(/"/g, '\\"')}"`;
      } else {
        // Fallback - just ask Claude about creating the document
        const prompt = `Please help me create the ${doc.name} document (${doc.filename}) for this project following BMAD methodology.`;
        command = `claude ${skipPerms} --prompt "${prompt.replace(/"/g, '\\"')}"`;
      }

      // Send the command to the terminal
      terminal.sendText(command);

      vscode.window.showInformationMessage(
        `Starting ${doc.name} creation workflow. Follow the prompts in the terminal.`
      );

      this.log(`Started document creation: ${doc.name} with command: ${command}`);
    } catch (error) {
      this.logError(`Failed to create document: ${doc.name}`, error);
      vscode.window.showErrorMessage(`Failed to start document creation: ${doc.name}`);
    }
  }

  // ============================================
  // Conversation Methods (Phase 3)
  // ============================================

  /**
   * Handles fetch conversations request from webview.
   * Fetches recent conversations (sessions) from the API.
   */
  private async handleFetchConversations(): Promise<void> {
    const isAuth = await this.authService.isAuthenticated();
    if (!isAuth) {
      this.postMessage({ type: "conversations", conversations: [] } as ExtensionToWebviewMessage);
      return;
    }

    this.postMessage({ type: "conversations-loading", isLoading: true } as ExtensionToWebviewMessage);

    try {
      const api = this.getApi();
      const result = await api.getConversations();

      if (!result.success || !result.data) {
        this.log("No conversations found or failed to fetch");
        this.postMessage({ type: "conversations", conversations: [] } as ExtensionToWebviewMessage);
        this.postMessage({ type: "conversations-loading", isLoading: false } as ExtensionToWebviewMessage);
        return;
      }

      this.log(`Fetched ${result.data.length} conversations`);
      this.postMessage({ type: "conversations", conversations: result.data } as ExtensionToWebviewMessage);
      this.postMessage({ type: "conversations-loading", isLoading: false } as ExtensionToWebviewMessage);
    } catch (error) {
      this.logError("Failed to fetch conversations", error);
      this.postMessage({ type: "conversations", conversations: [] } as ExtensionToWebviewMessage);
      this.postMessage({ type: "conversations-loading", isLoading: false } as ExtensionToWebviewMessage);
    }
  }

  /**
   * Handles conversation selection request from webview.
   * Fetches the messages for the selected conversation.
   */
  private async handleSelectConversation(sessionId: string): Promise<void> {
    const isAuth = await this.authService.isAuthenticated();
    if (!isAuth) {
      this.postMessage({ type: "conversation-messages", messages: [] } as ExtensionToWebviewMessage);
      return;
    }

    this.postMessage({ type: "conversation-messages-loading", isLoading: true } as ExtensionToWebviewMessage);

    try {
      const api = this.getApi();
      const result = await api.getConversationMessages(sessionId);

      if (!result.success || !result.data) {
        this.log(`No messages found for conversation ${sessionId}`);
        this.postMessage({ type: "conversation-messages", messages: [] } as ExtensionToWebviewMessage);
        this.postMessage({ type: "conversation-messages-loading", isLoading: false } as ExtensionToWebviewMessage);
        return;
      }

      this.log(`Fetched ${result.data.length} messages for conversation ${sessionId}`);
      this.postMessage({ type: "conversation-messages", messages: result.data } as ExtensionToWebviewMessage);
      this.postMessage({ type: "conversation-messages-loading", isLoading: false } as ExtensionToWebviewMessage);
    } catch (error) {
      this.logError(`Failed to fetch messages for conversation ${sessionId}`, error);
      this.postMessage({ type: "conversation-messages", messages: [] } as ExtensionToWebviewMessage);
      this.postMessage({ type: "conversation-messages-loading", isLoading: false } as ExtensionToWebviewMessage);
    }
  }

  /**
   * Handles open conversation in browser request.
   * Opens the web app conversation thread view.
   */
  private handleOpenConversationInBrowser(sessionId: string): void {
    const settings = this.settingsService;
    const baseUrl = settings.apiEndpoint.replace("/api", "");
    const url = `${baseUrl}/conversations/${sessionId}`;

    vscode.env.openExternal(vscode.Uri.parse(url));
    this.log(`Opened conversation in browser: ${url}`);
  }

  // ============================================
  // Last Prompt Methods
  // ============================================

  /**
   * Handles fetch last prompt request from webview.
   * @param isAutoRefresh - If true, skip update if prompt ID hasn't changed
   */
  private async handleFetchLastPrompt(isAutoRefresh = false): Promise<void> {
    const isAuth = await this.authService.isAuthenticated();
    if (!isAuth) {
      this.postMessage({ type: "last-prompt", prompt: null } as ExtensionToWebviewMessage);
      return;
    }

    // Only show loading indicator for manual refreshes
    if (!isAutoRefresh) {
      this.postMessage({ type: "last-prompt-loading", isLoading: true } as ExtensionToWebviewMessage);
    }

    try {
      // Get project ID from workspace config to filter prompts by current project
      const projectId = await this.workspaceConfigService.getProjectId();
      if (projectId) {
        this.log(`Fetching last prompt for project: ${projectId}`);
      } else {
        this.log("No workspace config found, fetching all prompts");
      }

      const api = this.getApi();
      const result = await api.getLastPrompt(projectId);

      if (!result.success || !result.data) {
        this.log("No last prompt found or failed to fetch");
        if (!isAutoRefresh) {
          this.postMessage({ type: "last-prompt", prompt: null } as ExtensionToWebviewMessage);
          this.postMessage({ type: "last-prompt-loading", isLoading: false } as ExtensionToWebviewMessage);
        }
        return;
      }

      // Debug logging
      const currentScore = result.data.overall_score ?? 0;
      this.log(`[DEBUG] API returned: id=${result.data.id}, score=${currentScore}`);
      this.log(`[DEBUG] Cached: id=${this.lastKnownPromptId}, score=${this.lastKnownPromptScore}`);
      this.log(`[DEBUG] isAutoRefresh=${isAutoRefresh}`);

      // Skip update if prompt AND score haven't changed (for auto-refresh only)
      // We check both ID and score because:
      // 1. Same ID but score changed = analysis completed, must update UI
      // 2. Different ID = new prompt, must update UI
      const idSame = this.lastKnownPromptId === result.data.id;
      const scoreSame = this.lastKnownPromptScore === currentScore;
      this.log(`[DEBUG] idSame=${idSame}, scoreSame=${scoreSame}`);

      if (isAutoRefresh && idSame && scoreSame) {
        this.log(`Last prompt unchanged (${result.data.id}, score=${currentScore}), skipping update`);
        return;
      }

      // Log what changed
      if (idSame && !scoreSame) {
        this.log(`Score updated for prompt ${result.data.id}: ${this.lastKnownPromptScore} -> ${currentScore}`);
      } else if (!idSame) {
        this.log(`New prompt detected: ${this.lastKnownPromptId} -> ${result.data.id}`);
      }

      this.lastKnownPromptId = result.data.id;
      this.lastKnownPromptScore = currentScore;
      this.log(`Sending prompt to UI: ${result.data.id}, score=${currentScore}`);
      this.postMessage({ type: "last-prompt", prompt: result.data } as ExtensionToWebviewMessage);
      this.postMessage({ type: "last-prompt-loading", isLoading: false } as ExtensionToWebviewMessage);
    } catch (error) {
      this.logError("Failed to fetch last prompt", error);
      if (!isAutoRefresh) {
        this.postMessage({ type: "last-prompt", prompt: null } as ExtensionToWebviewMessage);
        this.postMessage({ type: "last-prompt-loading", isLoading: false } as ExtensionToWebviewMessage);
      }
    }
  }

  /**
   * Sends the current authentication state to the webview.
   */
  private async sendAuthState(): Promise<void> {
    if (!this._view) return;

    try {
      const isAuth = await this.authService.isAuthenticated();
      const user = isAuth ? await this.authService.getUser() : null;

      this.updateState({
        isAuthenticated: isAuth,
        user: user || null,
      });

      this.postMessage({ type: "auth", authenticated: isAuth, user: user || undefined });

      if (isAuth) {
        this.stopHealthCheck(); // Stop health check when authenticated
        this.setupAutoRefresh(); // Start auto-refresh now that we're authenticated
        await this.refreshAnalytics(true);
      } else {
        this.stopAutoRefresh();
        this.startHealthCheck(); // Start health check when not authenticated
      }
    } catch (error) {
      this.logError("Failed to check auth state", error);
      this.postMessage({ type: "error", message: "Failed to check authentication" });
      // Start health check on error too (might be server down)
      this.startHealthCheck();
    }
  }

  /**
   * Sends auth state with retry logic (fix 404 on reload).
   * Retries up to maxRetries times with exponential backoff.
   * Key fix: Retry even when auth returns false, as SecretStorage might not be ready.
   */
  private async sendAuthStateWithRetry(maxRetries = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.sendAuthState();

        // If authenticated and we got analytics (or analytics loading), we're good
        if (this._state.isAuthenticated) {
          this.log(`Auth succeeded on attempt ${attempt}`);
          return;
        }

        // Not authenticated - could be:
        // 1. User is genuinely not logged in
        // 2. SecretStorage wasn't ready yet (token exists but couldn't be read)
        // On first attempts, assume it might be SecretStorage timing issue
        if (attempt < maxRetries) {
          this.log(`Auth attempt ${attempt}/${maxRetries}: not authenticated, retrying...`);
          // Exponential backoff: 500ms, 1000ms, 2000ms
          await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
        } else {
          // Final attempt - user is genuinely not logged in
          this.log(`Auth final attempt: user not authenticated`);
          return;
        }
      } catch (error) {
        this.log(`Auth attempt ${attempt}/${maxRetries} threw error, retrying...`);
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
        } else {
          this.logError("All auth retry attempts failed", error);
        }
      }
    }
  }

  /**
   * Refreshes analytics data from the API.
   * @param isInitialLoad - Whether this is the initial load (show loading skeleton)
   */
  private async refreshAnalytics(isInitialLoad: boolean): Promise<void> {
    if (!this._view) return;

    const isAuth = await this.authService.isAuthenticated();
    if (!isAuth) {
      this.postMessage({ type: "auth", authenticated: false });
      return;
    }

    // Check connectivity
    const api = this.getApi();
    const isOnline = await api.checkConnectivity();
    if (!isOnline) {
      this.updateState({ isOffline: true, syncState: "offline" });
      this.postMessage({ type: "offline", isOffline: true });
      // Load cached data if available
      await this.loadCachedData();
      return;
    }

    // Update loading state
    if (isInitialLoad && !this._state.analytics) {
      this.log("Setting isLoading=true (initial load)");
      this.updateState({ isLoading: true, error: null });
      this.postMessage({ type: "loading", isLoading: true });
    } else {
      this.log("Setting isRefreshing=true (manual refresh)");
      this.updateState({ isRefreshing: true, syncState: "syncing" });
      this.postMessage({ type: "refreshing", isRefreshing: true });
      this.postMessage({ type: "sync-state", state: "syncing" });
    }

    try {
      // Get project ID from workspace config to filter analytics by current project
      const projectId = await this.workspaceConfigService.getProjectId();
      if (projectId) {
        this.log(`Fetching analytics for project: ${projectId}`);
      } else {
        this.log("No project ID found - fetching all analytics");
      }

      // Fetch analytics and recent prompts in parallel
      const [analyticsResult, promptsResult] = await Promise.all([
        api.getAnalytics(this._state.timeRange, projectId),
        api.getRecentPrompts(5, projectId),
      ]);

      if (!analyticsResult.success) {
        throw new Error(analyticsResult.error?.message || "Failed to load analytics");
      }

      if (!promptsResult.success) {
        throw new Error(promptsResult.error?.message || "Failed to load prompts");
      }

      const now = new Date().toISOString();

      // Update state
      this.updateState({
        analytics: analyticsResult.data!,
        recentPrompts: promptsResult.data!,
        isLoading: false,
        isRefreshing: false,
        error: null,
        isOffline: false,
        syncState: "synced",
        lastSyncTime: now,
      });

      // Cache the data
      await this.cacheAnalytics(analyticsResult.data!, promptsResult.data!);

      // Persist last sync time
      if (this.globalState) {
        await this.globalState.update(STORAGE_KEYS.LAST_SYNC_TIME, now);
      }

      // Send data to webview
      this.postMessage({
        type: "analytics",
        data: analyticsResult.data!,
        recentPrompts: promptsResult.data!,
      });

      this.postMessage({ type: "sync-state", state: "synced", lastSyncTime: now });
      this.postMessage({ type: "loading", isLoading: false });
      this.postMessage({ type: "refreshing", isRefreshing: false });

      this.log(`Analytics refreshed: ${analyticsResult.data?.summary.promptCount} prompts, score ${analyticsResult.data?.summary.overallScore}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logError("Failed to load analytics", error);

      this.updateState({
        isLoading: false,
        isRefreshing: false,
        error: errorMessage,
        syncState: "error",
      });

      this.postMessage({ type: "loading", isLoading: false });
      this.postMessage({ type: "refreshing", isRefreshing: false });
      this.postMessage({ type: "sync-state", state: "error" });
      this.postMessage({ type: "error", message: errorMessage });
    }
  }

  /**
   * Handles time range change from webview.
   */
  private async handleTimeRangeChange(timeRange: TimeRange): Promise<void> {
    this._state.timeRange = timeRange;

    // Persist the selection
    if (this.globalState) {
      await this.globalState.update(STORAGE_KEYS.TIME_RANGE, timeRange);
    }

    // Refresh data with new time range
    await this.refreshAnalytics(false);
  }

  /**
   * Loads prompt detail for a specific prompt.
   */
  private async loadPromptDetail(promptId: string): Promise<void> {
    if (!this._view) return;

    try {
      this.updateState({ isLoading: true });
      this.postMessage({ type: "loading", isLoading: true });

      const api = this.getApi();
      const result = await api.getPromptDetail(promptId);

      if (!result.success) {
        throw new Error(result.error?.message || "Failed to load prompt detail");
      }

      this.updateState({
        promptDetail: result.data!,
        isLoading: false,
      });

      this.postMessage({ type: "prompt-detail", detail: result.data! });
      this.postMessage({ type: "loading", isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logError("Failed to load prompt detail", error);

      this.updateState({
        isLoading: false,
        error: errorMessage,
      });

      this.postMessage({ type: "loading", isLoading: false });
      this.postMessage({ type: "error", message: errorMessage });
    }
  }

  /**
   * Caches analytics data for offline mode.
   */
  private async cacheAnalytics(
    analytics: AnalyticsData,
    recentPrompts: RecentPrompt[]
  ): Promise<void> {
    if (!this.globalState) return;

    const cached: CachedAnalytics = {
      data: analytics,
      recentPrompts,
      cachedAt: new Date().toISOString(),
      timeRange: this._state.timeRange,
    };

    await this.globalState.update(STORAGE_KEYS.CACHED_ANALYTICS, cached);
    this.log("Analytics cached for offline mode");
  }

  /**
   * Loads cached analytics data.
   */
  private async loadCachedData(): Promise<void> {
    if (!this.globalState) return;

    const cached = this.globalState.get<CachedAnalytics>(STORAGE_KEYS.CACHED_ANALYTICS);

    if (cached && cached.timeRange === this._state.timeRange) {
      this.log("Loading cached analytics data");

      this.updateState({
        analytics: cached.data,
        recentPrompts: cached.recentPrompts,
        lastSyncTime: cached.cachedAt,
      });

      this.postMessage({
        type: "analytics",
        data: cached.data,
        recentPrompts: cached.recentPrompts,
      });
    }
  }

  /**
   * Updates the internal state and sends to webview.
   */
  private updateState(updates: Partial<AnalyticsPanelState>): void {
    this._state = { ...this._state, ...updates };
    this.postMessage({ type: "state", state: updates });
  }

  /**
   * Sends a message to the webview.
   */
  private postMessage(message: ExtensionToWebviewMessage): void {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  /**
   * Generates HTML content for the webview with proper CSP headers.
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    // Get URIs for resources
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionUri,
        "webviews",
        "analytics",
        "dist",
        "index.js"
      )
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionUri,
        "webviews",
        "analytics",
        "dist",
        "index.css"
      )
    );

    // Generate a unique nonce for CSP
    const nonce = this.getNonce();

    // Build HTML with Content Security Policy
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} https: data:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <title>Contextor Analytics</title>
  <style>
    body { background: var(--vscode-sideBar-background, #1e1e1e); color: var(--vscode-foreground, #ccc); padding: 16px; }
    #debug { font-size: 11px; color: #888; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div id="debug">Loading Contextor...</div>
  <div id="root"></div>
  <script nonce="${nonce}">
    document.getElementById('debug').textContent = 'Script started...';
    window.onerror = function(msg, url, line, col, error) {
      var fullMsg = 'Error: ' + msg;
      if (error && error.stack) {
        fullMsg += '\\n' + error.stack.substring(0, 500);
      }
      document.getElementById('debug').innerHTML = '<pre style="white-space:pre-wrap;font-size:10px;">' + fullMsg + '</pre>';
      document.getElementById('debug').style.color = '#f44';
      return true;
    };
    window.addEventListener('unhandledrejection', function(e) {
      document.getElementById('debug').innerHTML = '<pre style="white-space:pre-wrap;font-size:10px;">Promise rejected: ' + (e.reason ? e.reason.toString() : 'unknown') + '</pre>';
      document.getElementById('debug').style.color = '#f44';
    });
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
  <script nonce="${nonce}">
    document.getElementById('debug').textContent = 'React script loaded...';
    setTimeout(function() {
      var root = document.getElementById('root');
      if (!root || !root.innerHTML || root.innerHTML.trim() === '') {
        document.getElementById('debug').textContent = 'React failed to mount! Root is empty.';
        document.getElementById('debug').style.color = '#f44';
      } else {
        document.getElementById('debug').style.display = 'none';
      }
    }, 2000);
  </script>
</body>
</html>`;
  }

  /**
   * Generates a cryptographically secure nonce for CSP.
   */
  private getNonce(): string {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  // ============================================
  // Coaching Methods (Story 19-5)
  // ============================================

  /**
   * Refreshes coaching tips from the API.
   * Note: Coaching failures are silent - they don't override the main UI.
   */
  private async refreshCoaching(): Promise<void> {
    if (!this._view) return;

    const isAuth = await this.authService.isAuthenticated();
    if (!isAuth) {
      return;
    }

    this.updateState({ isCoachingLoading: true });
    this.postMessage({ type: "coaching-loading", isLoading: true });

    try {
      const api = this.getApi();
      const result = await api.getCoachingTips();

      if (!result.success) {
        throw new Error(result.error?.message || "Failed to load coaching tips");
      }

      const tips = result.data!.tips;
      const weakDimensions = result.data!.weakDimensions;

      // Filter out dismissed tips
      const visibleTips = tips.filter(
        (tip) => !this._state.dismissedTipIds.includes(tip.id)
      );

      this.updateState({
        coachingTips: visibleTips,
        weakDimensions,
        isCoachingLoading: false,
      });

      // Cache coaching data
      await this.cacheCoaching(tips, weakDimensions);

      this.postMessage({
        type: "coaching",
        tips: visibleTips,
        weakDimensions,
      });
      this.postMessage({ type: "coaching-loading", isLoading: false });

      this.log("Coaching tips refreshed successfully");
    } catch (error) {
      // IMPORTANT: Don't send global error for coaching failures.
      // Coaching is optional - don't break the main UI if it fails.
      this.logError("Failed to load coaching tips (silent failure)", error);
      this.updateState({ isCoachingLoading: false });
      this.postMessage({ type: "coaching-loading", isLoading: false });
      // Just log it, don't send error to webview which would override the UI
    }
  }

  /**
   * Dismisses a coaching tip and persists the dismissal.
   */
  private async dismissTip(
    tipId: string,
    reason?: "applied" | "not_relevant" | "already_know"
  ): Promise<void> {
    // Update local state immediately
    const dismissedTipIds = [...this._state.dismissedTipIds, tipId];
    const visibleTips = this._state.coachingTips.filter(
      (tip) => tip.id !== tipId
    );

    this.updateState({
      dismissedTipIds,
      coachingTips: visibleTips,
    });

    // Persist to global state
    if (this.globalState) {
      await this.globalState.update(COACHING_STORAGE_KEYS.DISMISSED_TIPS, dismissedTipIds);
    }

    // Notify webview
    this.postMessage({ type: "tip-dismissed", tipId });
    this.postMessage({
      type: "coaching",
      tips: visibleTips,
      weakDimensions: this._state.weakDimensions,
    });

    // Sync dismissal to server (fire and forget)
    try {
      const api = this.getApi();
      await api.dismissTip(tipId, reason);
      this.log(`Tip ${tipId} dismissed and synced to server`);
    } catch (error) {
      // Dismissal is already persisted locally, server sync can retry later
      this.logError("Failed to sync tip dismissal to server", error);
    }
  }

  /**
   * Caches coaching data for offline mode.
   */
  private async cacheCoaching(
    tips: CoachingTip[],
    weakDimensions: WeakDimension[]
  ): Promise<void> {
    if (!this.globalState) return;

    const cached: CachedCoaching = {
      data: {
        tips,
        weakDimensions,
        lastUpdated: new Date().toISOString(),
      },
      cachedAt: new Date().toISOString(),
    };

    await this.globalState.update(COACHING_STORAGE_KEYS.COACHING_CACHE, cached);
    this.log("Coaching data cached for offline mode");
  }

  /**
   * Loads cached coaching data.
   */
  private async loadCachedCoaching(): Promise<void> {
    if (!this.globalState) return;

    const cached = this.globalState.get<CachedCoaching>(COACHING_STORAGE_KEYS.COACHING_CACHE);

    if (cached) {
      this.log("Loading cached coaching data");

      // Filter out dismissed tips
      const visibleTips = cached.data.tips.filter(
        (tip) => !this._state.dismissedTipIds.includes(tip.id)
      );

      this.updateState({
        coachingTips: visibleTips,
        weakDimensions: cached.data.weakDimensions,
      });

      this.postMessage({
        type: "coaching",
        tips: visibleTips,
        weakDimensions: cached.data.weakDimensions,
      });
    }
  }

  /**
   * Logs a message to the output channel.
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] [AnalyticsPanel] ${message}`);
  }

  /**
   * Logs an error to the output channel.
   */
  private logError(message: string, error: unknown): void {
    const timestamp = new Date().toISOString();
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    this.outputChannel.appendLine(
      `[${timestamp}] [AnalyticsPanel] ERROR: ${message}: ${errorMessage}`
    );
  }

  // ============================================
  // Install Token & Hook Utilities
  // ============================================

  /**
   * Parse an install token to extract the payload.
   * Token format: ctx_<base64url encoded JSON>
   */
  private parseInstallToken(token: string): {
    project_id: string;
    project_name: string;
    team_id: string;
    team_name: string;
    user_id: string;
    user_name: string;
    api_key: string;
    api_endpoint: string;
  } | null {
    try {
      if (!token.startsWith("ctx_")) {
        return null;
      }
      const base64Payload = token.substring(4);
      const jsonPayload = Buffer.from(base64Payload, "base64url").toString("utf-8");
      const payload = JSON.parse(jsonPayload);

      if (!payload.project_id || !payload.api_key || !payload.api_endpoint) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Install the Contextor capture hook in the workspace.
   * Creates .claude/settings.json and .claude/hooks/contextor-capture.sh
   */
  private async installCaptureHook(workspacePath: string): Promise<void> {
    const workspaceUri = vscode.Uri.file(workspacePath);

    // Create .claude directory
    const claudeDir = vscode.Uri.joinPath(workspaceUri, ".claude");
    try {
      await vscode.workspace.fs.createDirectory(claudeDir);
    } catch {
      // Directory may already exist
    }

    // Create hooks directory
    const hooksDir = vscode.Uri.joinPath(claudeDir, "hooks");
    try {
      await vscode.workspace.fs.createDirectory(hooksDir);
    } catch {
      // Directory may already exist
    }

    // Read existing settings.json
    const settingsPath = vscode.Uri.joinPath(claudeDir, "settings.json");
    let settings: { hooks?: { UserPromptSubmit?: Array<{ matcher?: string; hooks: Array<{ type: string; command: string; timeout?: number }> }> }; [key: string]: unknown } = {};
    try {
      const content = await vscode.workspace.fs.readFile(settingsPath);
      settings = JSON.parse(Buffer.from(content).toString("utf-8"));
    } catch {
      // File doesn't exist or is invalid
    }

    // Configure Contextor hook
    const hookCommand = `bash "$CLAUDE_PROJECT_DIR"/.claude/hooks/contextor-capture.sh`;
    const newHookEntry = {
      matcher: ".*",
      hooks: [{ type: "command", command: hookCommand, timeout: 5000 }],
    };

    settings.hooks ??= {};
    const existing = settings.hooks.UserPromptSubmit ?? [];

    // Check if Contextor hook already exists
    const idx = existing.findIndex((entry) =>
      entry.hooks?.some((h) => h.command.includes("contextor-capture"))
    );

    if (idx >= 0) {
      existing[idx] = newHookEntry;
    } else {
      existing.push(newHookEntry);
    }

    settings.hooks.UserPromptSubmit = existing;

    // Write settings.json
    await vscode.workspace.fs.writeFile(
      settingsPath,
      Buffer.from(JSON.stringify(settings, null, 2) + "\n", "utf-8")
    );

    // Write capture script
    const captureScript = this.getCaptureScriptContent();
    const scriptPath = vscode.Uri.joinPath(hooksDir, "contextor-capture.sh");
    await vscode.workspace.fs.writeFile(scriptPath, Buffer.from(captureScript, "utf-8"));

    // Make script executable (Unix only)
    try {
      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      const execAsync = promisify(exec);
      await execAsync(`chmod +x "${scriptPath.fsPath}"`);
    } catch {
      // Ignore chmod errors on Windows
    }
  }

  /**
   * Generate the capture script content.
   */
  private getCaptureScriptContent(): string {
    return `#!/bin/bash
# Contextor Capture - Silent background prompt capture
# Errors are logged to debug file if DEBUG_CONTEXTOR=1

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "\${SCRIPT_DIR}/../.." && pwd)"

USER_CONFIG="\${PROJECT_ROOT}/.contextor/.user"
SHARED_CONFIG="\${PROJECT_ROOT}/.contextor/config.json"
DEBUG_LOG="\${PROJECT_ROOT}/.contextor/.debug.log"

# Debug logging function - only logs if DEBUG_CONTEXTOR=1
debug_log() {
  if [[ "\${DEBUG_CONTEXTOR}" == "1" ]]; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $1" >> "\${DEBUG_LOG}" 2>/dev/null
  fi
}

# Exit silently if not configured or deps missing
if ! command -v jq >/dev/null 2>&1; then
  debug_log "ERROR: jq not found in PATH"
  exit 0
fi
if ! command -v curl >/dev/null 2>&1; then
  debug_log "ERROR: curl not found in PATH"
  exit 0
fi
if [[ ! -f "\${USER_CONFIG}" ]]; then
  debug_log "ERROR: User config not found at \${USER_CONFIG}"
  exit 0
fi
if [[ ! -f "\${SHARED_CONFIG}" ]]; then
  debug_log "ERROR: Shared config not found at \${SHARED_CONFIG}"
  exit 0
fi

# Read config
API_KEY=$(jq -r '.api_key // empty' "\${USER_CONFIG}" 2>/dev/null)
API_ENDPOINT=$(jq -r '.api_endpoint // empty' "\${SHARED_CONFIG}" 2>/dev/null)
PROJECT_ID=$(jq -r '.project_id // empty' "\${SHARED_CONFIG}" 2>/dev/null)
USER_ID=$(jq -r '.user_id // empty' "\${USER_CONFIG}" 2>/dev/null)

if [[ -z "\${API_KEY}" ]]; then
  debug_log "ERROR: api_key is empty or missing from user config"
  exit 0
fi
if [[ -z "\${API_ENDPOINT}" ]]; then
  debug_log "ERROR: api_endpoint is empty or missing from shared config"
  exit 0
fi

# Read prompt from stdin
INPUT=$(cat)
PROMPT=$(echo "\${INPUT}" | jq -r '.prompt // empty' 2>/dev/null)
if [[ -z "\${PROMPT}" ]]; then
  debug_log "ERROR: No prompt found in input JSON"
  exit 0
fi

debug_log "INFO: Capturing prompt (\${#PROMPT} chars) to \${API_ENDPOINT}/prompts/capture"

# Send to API in background (non-blocking, 10s timeout)
{
  RESPONSE=$(curl -s --max-time 10 -w "\\n%{http_code}" -X POST "\${API_ENDPOINT}/prompts/capture" \\
    -H "Content-Type: application/json" \\
    -H "Authorization: Bearer \${API_KEY}" \\
    -d "$(jq -n \\
      --arg user_id "\${USER_ID}" \\
      --arg prompt "\${PROMPT}" \\
      --arg project_id "\${PROJECT_ID}" \\
      '{user_id:$user_id,prompt:$prompt,timestamp:(now|todate),metadata:{source:"claude-code-hook",project_id:$project_id}}')" 2>&1)

  HTTP_CODE=$(echo "\${RESPONSE}" | tail -n1)
  BODY=$(echo "\${RESPONSE}" | sed '\$d')

  if [[ "\${HTTP_CODE}" -ge 200 && "\${HTTP_CODE}" -lt 300 ]]; then
    debug_log "INFO: Capture successful (HTTP \${HTTP_CODE})"
  else
    debug_log "ERROR: Capture failed (HTTP \${HTTP_CODE}): \${BODY}"
  fi
} &

exit 0
`;
  }

  // ============================================
  // BMAD Version Methods
  // ============================================

  /**
   * Fetches BMAD version information.
   * Checks installed version from _bmad folder and latest from npm registry.
   */
  private async handleFetchBmadVersion(): Promise<void> {
    this.postMessage({ type: "bmad-version-loading", isLoading: true } as ExtensionToWebviewMessage);

    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        this.postMessage({
          type: "bmad-version-info",
          versionInfo: {
            installedVersion: null,
            latestVersion: null,
            updateAvailable: false,
            lastChecked: new Date().toISOString(),
          },
        } as ExtensionToWebviewMessage);
        return;
      }

      const workspaceRoot = workspaceFolders[0].uri;

      // Check for installed BMAD version
      const installedVersion = await this.getInstalledBmadVersion(workspaceRoot);

      // Check for latest version from npm
      const latestVersion = await this.getLatestBmadVersion();

      // Compare versions
      const updateAvailable = installedVersion !== null && latestVersion !== null
        ? this.isNewerVersion(latestVersion, installedVersion)
        : false;

      const versionInfo: BmadVersionInfo = {
        installedVersion,
        latestVersion,
        updateAvailable,
        lastChecked: new Date().toISOString(),
      };

      this.log(`BMAD version info: installed=${installedVersion}, latest=${latestVersion}, update=${updateAvailable}`);
      this.postMessage({ type: "bmad-version-info", versionInfo } as ExtensionToWebviewMessage);
    } catch (error) {
      this.logError("Failed to fetch BMAD version", error);
      this.postMessage({
        type: "bmad-version-info",
        versionInfo: {
          installedVersion: null,
          latestVersion: null,
          updateAvailable: false,
          lastChecked: new Date().toISOString(),
        },
      } as ExtensionToWebviewMessage);
    }
  }

  /**
   * Gets the installed BMAD version from _bmad/_config/manifest.yaml or .bmad folder
   * Supports both v6+ (_bmad) and legacy (.bmad) folder structures
   */
  private async getInstalledBmadVersion(workspaceRoot: vscode.Uri): Promise<string | null> {
    try {
      // Try v6+ structure first: _bmad/_config/manifest.yaml
      const manifestPath = vscode.Uri.joinPath(workspaceRoot, "_bmad", "_config", "manifest.yaml");
      try {
        const content = await vscode.workspace.fs.readFile(manifestPath);
        const yamlContent = Buffer.from(content).toString("utf-8");

        // Parse YAML manually (simple regex for version field)
        const versionMatch = yamlContent.match(/^\s*version:\s*(.+)$/m);
        if (versionMatch && versionMatch[1]) {
          return versionMatch[1].trim();
        }
      } catch {
        // manifest.yaml doesn't exist
      }

      // Check if _bmad folder exists (v6+ without manifest)
      try {
        const bmadFolder = vscode.Uri.joinPath(workspaceRoot, "_bmad");
        const stat = await vscode.workspace.fs.stat(bmadFolder);
        if (stat.type === vscode.FileType.Directory) {
          // BMAD v6+ is installed but version unknown
          return "unknown";
        }
      } catch {
        // _bmad folder doesn't exist
      }

      // Check for legacy .bmad folder structure (pre-v6)
      try {
        const legacyBmadFolder = vscode.Uri.joinPath(workspaceRoot, ".bmad");
        const stat = await vscode.workspace.fs.stat(legacyBmadFolder);
        if (stat.type === vscode.FileType.Directory) {
          // Legacy BMAD installation detected
          return "legacy (pre-v6)";
        }
      } catch {
        // .bmad folder doesn't exist
      }

      return null;
    } catch (error) {
      this.logError("Error checking installed BMAD version", error);
      return null;
    }
  }

  /**
   * Gets the latest BMAD v6 alpha version from npm registry.
   * We only support v6 alpha - v4.x is outdated.
   */
  private async getLatestBmadVersion(): Promise<string | null> {
    try {
      const https = await import("https");

      return new Promise((resolve) => {
        // Fetch the main package info to get dist-tags
        const req = https.get("https://registry.npmjs.org/bmad-method", {
          headers: { "Accept": "application/json" },
          timeout: 5000,
        }, (res) => {
          let data = "";

          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            try {
              const pkg = JSON.parse(data);
              // Get the alpha dist-tag (v6 alpha), not latest (v4.x is outdated)
              const alphaVersion = pkg["dist-tags"]?.alpha;
              if (alphaVersion) {
                resolve(alphaVersion);
              } else {
                this.log("No alpha dist-tag found in npm registry");
                resolve(null);
              }
            } catch {
              this.log("Failed to parse npm registry response");
              resolve(null);
            }
          });
        });

        req.on("error", (error) => {
          this.logError("Failed to fetch latest BMAD version from npm", error);
          resolve(null);
        });

        req.on("timeout", () => {
          req.destroy();
          this.log("npm registry request timed out");
          resolve(null);
        });
      });
    } catch (error) {
      this.logError("Error fetching latest BMAD version", error);
      return null;
    }
  }

  /**
   * Compares two semver versions including prerelease (alpha) versions.
   * Returns true if newVersion is newer than currentVersion.
   * Handles formats like: 6.0.0-alpha.19, 6.0.0-alpha.20
   */
  private isNewerVersion(newVersion: string, currentVersion: string): boolean {
    if (currentVersion === "unknown") return true;

    try {
      const parseSemver = (v: string) => {
        const clean = v.replace(/^v/, "");
        // Split into base version and prerelease
        const [base, prerelease] = clean.split("-");
        const parts = base.split(".").map(n => parseInt(n, 10) || 0);

        // Parse prerelease (e.g., "alpha.19" -> { tag: "alpha", num: 19 })
        let prereleaseNum = 0;
        if (prerelease) {
          const match = prerelease.match(/\.(\d+)$/);
          if (match) {
            prereleaseNum = parseInt(match[1], 10) || 0;
          }
        }

        return {
          major: parts[0] || 0,
          minor: parts[1] || 0,
          patch: parts[2] || 0,
          prerelease: prerelease || null,
          prereleaseNum,
        };
      };

      const current = parseSemver(currentVersion);
      const latest = parseSemver(newVersion);

      // Compare major.minor.patch first
      if (latest.major > current.major) return true;
      if (latest.major < current.major) return false;
      if (latest.minor > current.minor) return true;
      if (latest.minor < current.minor) return false;
      if (latest.patch > current.patch) return true;
      if (latest.patch < current.patch) return false;

      // Same base version, compare prerelease numbers
      // Both are alpha versions (e.g., 6.0.0-alpha.19 vs 6.0.0-alpha.20)
      if (current.prerelease && latest.prerelease) {
        return latest.prereleaseNum > current.prereleaseNum;
      }

      // Latest is stable (no prerelease) but current is prerelease -> latest is newer
      if (current.prerelease && !latest.prerelease) return true;

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Opens a terminal with the BMAD upgrade command.
   */
  private handleUpgradeBmad(): void {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!workspacePath) {
      vscode.window.showErrorMessage("Please open a workspace folder first.");
      return;
    }

    const terminal = vscode.window.createTerminal({
      name: "BMAD Upgrade",
      cwd: workspacePath,
    });

    terminal.show();

    // Run BMAD v6 Alpha upgrade command
    terminal.sendText("npx bmad-method@alpha install");

    vscode.window.showInformationMessage(
      "Upgrading BMAD Method v6 Alpha. Follow the prompts in the terminal."
    );

    this.log("BMAD upgrade started: npx bmad-method@alpha install");
  }

  /**
   * Fetches the list of teams the user belongs to.
   */
  private async handleFetchTeams(): Promise<void> {
    this.postMessage({ type: "teams-loading", isLoading: true } as ExtensionToWebviewMessage);

    try {
      const token = await this.authService.getAccessToken();
      if (!token) {
        this.log("No auth token for teams - user not authenticated");
        this.postMessage({ type: "teams", teams: [] } as ExtensionToWebviewMessage);
        this.postMessage({ type: "teams-loading", isLoading: false } as ExtensionToWebviewMessage);
        return;
      }

      const apiUrl = this.settingsService.apiEndpoint;

      this.log(`Fetching teams from ${apiUrl}/extension/teams`);

      const response = await fetch(`${apiUrl}/extension/teams`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logError(`Teams API error: ${response.status}`, errorText);
        throw new Error(`Failed to fetch teams: ${response.status}`);
      }

      const result = await response.json() as { data?: { teams?: TeamInfo[] } };
      this.log(`Teams API response: ${JSON.stringify(result)}`);

      if (result.data) {
        this.postMessage({
          type: "teams",
          teams: result.data.teams || [],
        } as ExtensionToWebviewMessage);
      } else {
        this.log("No data in teams response");
        this.postMessage({ type: "teams", teams: [] } as ExtensionToWebviewMessage);
      }
      this.postMessage({ type: "teams-loading", isLoading: false } as ExtensionToWebviewMessage);
    } catch (error) {
      this.logError("Failed to fetch teams", error);
      this.postMessage({ type: "teams", teams: [] } as ExtensionToWebviewMessage);
      this.postMessage({ type: "teams-loading", isLoading: false } as ExtensionToWebviewMessage);
    }
  }

  /**
   * Fetches team stats from the API.
   */
  private async handleFetchTeamStats(teamId?: string, timeRange?: TeamTimeRange): Promise<void> {
    this.postMessage({ type: "team-stats-loading", isLoading: true } as ExtensionToWebviewMessage);

    try {
      const token = await this.authService.getAccessToken();
      if (!token) {
        this.log("No auth token for team stats");
        this.postMessage({ type: "team-stats-loading", isLoading: false } as ExtensionToWebviewMessage);
        return;
      }

      const apiUrl = this.settingsService.apiEndpoint;
      const range = timeRange || "today";

      const params = new URLSearchParams({ timeRange: range });
      if (teamId) {
        params.append("teamId", teamId);
      }

      const response = await fetch(`${apiUrl}/extension/team-stats?${params.toString()}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch team stats: ${response.status}`);
      }

      const result = await response.json() as { data?: TeamStatsData };

      if (result.data) {
        this.postMessage({
          type: "team-stats",
          data: result.data,
        } as ExtensionToWebviewMessage);
      }
      this.postMessage({ type: "team-stats-loading", isLoading: false } as ExtensionToWebviewMessage);
    } catch (error) {
      this.logError("Failed to fetch team stats", error);
      this.postMessage({ type: "team-stats-loading", isLoading: false } as ExtensionToWebviewMessage);
    }
  }

  /**
   * Handles email/password signup request from the webview.
   */
  private async handleSignup(email: string, password: string): Promise<void> {
    this.postMessage({ type: "signup-loading", isLoading: true } as ExtensionToWebviewMessage);

    try {
      const result = await this.authService.signup(email, password);

      this.postMessage({
        type: "signup-result",
        success: result.success,
        message: result.message,
        requiresEmailConfirmation: result.requiresEmailConfirmation,
      } as ExtensionToWebviewMessage);

      if (result.success && !result.requiresEmailConfirmation) {
        // Signup was successful and user is authenticated - refresh auth state
        await this.sendAuthState();
      }
    } catch (error) {
      this.logError("Signup failed", error);
      this.postMessage({
        type: "signup-result",
        success: false,
        message: "An unexpected error occurred. Please try again.",
      } as ExtensionToWebviewMessage);
    } finally {
      this.postMessage({ type: "signup-loading", isLoading: false } as ExtensionToWebviewMessage);
    }
  }

  /**
   * Handles Google signup request from the webview.
   * Opens the web app signup page in the browser.
   */
  private async handleSignupWithGoogle(): Promise<void> {
    try {
      await this.authService.signupWithGoogle();
    } catch (error) {
      this.logError("Google signup failed", error);
      vscode.window.showErrorMessage("Failed to open browser for signup. Please try again.");
    }
  }
}
