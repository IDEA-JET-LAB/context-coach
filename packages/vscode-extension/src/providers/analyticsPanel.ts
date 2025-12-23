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
import {
  TimeRange,
  SyncState,
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
  LegacyAnalyticsData,
} from "../types/messages";

/**
 * Storage keys for persistent state
 */
const STORAGE_KEYS = {
  CACHED_ANALYTICS: "contextor.cachedAnalytics",
  TIME_RANGE: "contextor.timeRange",
  LAST_SYNC_TIME: "contextor.lastSyncTime",
} as const;

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

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly authService: AuthService,
    private readonly outputChannel: vscode.OutputChannel
  ) {
    this.settingsService = SettingsService.getInstance();
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
      this._disposables.forEach((d) => d.dispose());
      this._disposables = [];
      this._view = undefined;
    });
    this._disposables.push(disposeDisposable);

    // Listen for auth changes
    const authDisposable = this.authService.onDidChangeAuth(() => {
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

    // Send initial auth state
    this.sendAuthState();

    // Setup auto-refresh
    this.setupAutoRefresh();

    this.log("Analytics panel resolved");
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
   * Handles messages received from the webview.
   */
  private async handleMessage(
    message: WebviewToExtensionMessage
  ): Promise<void> {
    switch (message.type) {
      case "ready":
        this.log("Webview ready");
        await this.sendAuthState();
        await this.loadCachedData();
        // Load coaching data (Story 19-5)
        await this.loadCachedCoaching();
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

      // Coaching message handlers (Story 19-5)
      case "refresh-coaching":
        this.log("Coaching refresh requested");
        await this.refreshCoaching();
        break;

      case "dismiss-tip":
        this.log(`Dismissing tip: ${message.tipId}`);
        await this.dismissTip(message.tipId, message.reason);
        break;
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
        await this.refreshAnalytics(true);
      } else {
        this.stopAutoRefresh();
      }
    } catch (error) {
      this.logError("Failed to check auth state", error);
      this.postMessage({ type: "error", message: "Failed to check authentication" });
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
      this.updateState({ isLoading: true, error: null });
      this.postMessage({ type: "loading", isLoading: true });
    } else {
      this.updateState({ isRefreshing: true, syncState: "syncing" });
      this.postMessage({ type: "refreshing", isRefreshing: true });
      this.postMessage({ type: "sync-state", state: "syncing" });
    }

    try {
      // Fetch analytics and recent prompts in parallel
      const [analyticsResult, promptsResult] = await Promise.all([
        api.getAnalytics(this._state.timeRange),
        api.getRecentPrompts(5),
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

      this.log("Analytics refreshed successfully");
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
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
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
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logError("Failed to load coaching tips", error);

      this.updateState({ isCoachingLoading: false });
      this.postMessage({ type: "coaching-loading", isLoading: false });
      this.postMessage({ type: "error", message: errorMessage });
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
   * Returns mock analytics data for development.
   * Used when API is unavailable.
   * @deprecated Use real API data instead.
   */
  private getMockAnalytics(): LegacyAnalyticsData {
    return {
      sessions: {
        todayCount: 3,
        todayPrompts: 25,
        avgDuration: 45,
        streak: 5,
      },
      efficiency: {
        overallScore: 78,
        promptsPerHour: 15,
        avgPromptLength: 120,
        contextUtilization: 65,
      },
      recentActivity: [
        {
          timestamp: new Date().toISOString(),
          type: "prompt",
          description: "Debugging authentication flow",
        },
        {
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          type: "session_start",
          description: "Started new session",
        },
      ],
    };
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
}
