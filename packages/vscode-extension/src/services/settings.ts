/**
 * SettingsService - Centralized configuration management for Contextor VS Code extension
 *
 * Provides:
 * - Type-safe access to all extension settings
 * - Settings validation on load and change
 * - Event emission for configuration changes
 * - API endpoint validation with health check
 * - Notification gating utilities
 *
 * Usage:
 * ```typescript
 * const settings = SettingsService.getInstance();
 * const endpoint = settings.apiEndpoint;
 * settings.onDidChange((changes) => {
 *   if (changes.refreshInterval !== undefined) {
 *     // Handle refresh interval change
 *   }
 * });
 * ```
 */

import * as vscode from "vscode";

/**
 * Configuration interface for all Contextor settings
 */
export interface ContextorSettings {
  apiEndpoint: string;
  refreshInterval: number;
  showNotifications: boolean;
  showStatusBarItem: boolean;
  autoRefreshEnabled: boolean;
}

/**
 * Default settings values
 */
export const DEFAULT_SETTINGS: Readonly<ContextorSettings> = {
  apiEndpoint: "http://127.0.0.1:3050/api",
  refreshInterval: 30,
  showNotifications: true,
  showStatusBarItem: true,
  autoRefreshEnabled: true,
} as const;

/**
 * Minimum allowed refresh interval in seconds
 */
export const MIN_REFRESH_INTERVAL = 15;

/**
 * Maximum allowed refresh interval in seconds
 */
export const MAX_REFRESH_INTERVAL = 300;

/**
 * Timeout for API health check in milliseconds
 */
const HEALTH_CHECK_TIMEOUT_MS = 5000;

/**
 * Result of settings validation
 */
export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * SettingsService provides centralized configuration management
 * with validation, caching, and change events.
 */
export class SettingsService implements vscode.Disposable {
  private static instance: SettingsService | null = null;

  private readonly _onDidChange = new vscode.EventEmitter<Partial<ContextorSettings>>();

  /**
   * Event that fires when any Contextor setting changes.
   * The event data contains only the settings that changed.
   */
  readonly onDidChange = this._onDidChange.event;

  private readonly disposables: vscode.Disposable[] = [];
  private outputChannel: vscode.OutputChannel | null = null;

  /**
   * Cache for settings to avoid repeated configuration reads in hot paths
   */
  private cachedSettings: ContextorSettings | null = null;

  private constructor() {
    // Subscribe to configuration changes
    const configDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("contextor")) {
        this.handleConfigChange(e);
      }
    });
    this.disposables.push(configDisposable);
    this.disposables.push(this._onDidChange);
  }

  /**
   * Gets the singleton instance of SettingsService.
   * Creates the instance on first call.
   */
  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  /**
   * Initializes the service with an output channel for logging.
   * Should be called during extension activation.
   */
  initialize(outputChannel: vscode.OutputChannel): void {
    this.outputChannel = outputChannel;
    this.log("SettingsService initialized");
  }

  /**
   * Resets the singleton instance (for testing purposes)
   */
  static resetInstance(): void {
    if (SettingsService.instance) {
      SettingsService.instance.dispose();
      SettingsService.instance = null;
    }
  }

  /**
   * Gets the API endpoint URL.
   * Falls back to default if the configured value is invalid.
   */
  get apiEndpoint(): string {
    const endpoint = this.getConfig<string>("apiEndpoint", DEFAULT_SETTINGS.apiEndpoint);

    // Validate URL format
    if (!this.isValidUrl(endpoint)) {
      this.logWarning(`Invalid API endpoint URL: ${endpoint}, using default`);
      return DEFAULT_SETTINGS.apiEndpoint;
    }

    return endpoint;
  }

  /**
   * Gets the refresh interval in seconds.
   * Enforces minimum of 15 seconds.
   */
  get refreshInterval(): number {
    const interval = this.getConfig<number>("refreshInterval", DEFAULT_SETTINGS.refreshInterval);

    // Enforce minimum
    if (interval < MIN_REFRESH_INTERVAL) {
      return MIN_REFRESH_INTERVAL;
    }

    // Enforce maximum
    if (interval > MAX_REFRESH_INTERVAL) {
      return MAX_REFRESH_INTERVAL;
    }

    return interval;
  }

  /**
   * Gets the notification preference.
   * When false, informational notifications are suppressed.
   */
  get showNotifications(): boolean {
    return this.getConfig<boolean>("showNotifications", DEFAULT_SETTINGS.showNotifications);
  }

  /**
   * Gets the status bar item visibility preference.
   */
  get showStatusBarItem(): boolean {
    return this.getConfig<boolean>("showStatusBarItem", DEFAULT_SETTINGS.showStatusBarItem);
  }

  /**
   * Gets the auto-refresh preference.
   */
  get autoRefreshEnabled(): boolean {
    return this.getConfig<boolean>("autoRefreshEnabled", DEFAULT_SETTINGS.autoRefreshEnabled);
  }

  /**
   * Gets all settings as a single object.
   * Useful for serialization or batch operations.
   */
  getAll(): ContextorSettings {
    if (this.cachedSettings) {
      return { ...this.cachedSettings };
    }

    const settings: ContextorSettings = {
      apiEndpoint: this.apiEndpoint,
      refreshInterval: this.refreshInterval,
      showNotifications: this.showNotifications,
      showStatusBarItem: this.showStatusBarItem,
      autoRefreshEnabled: this.autoRefreshEnabled,
    };

    this.cachedSettings = settings;
    return { ...settings };
  }

  /**
   * Validates all settings and returns a validation result.
   * Called on extension activation to detect configuration issues.
   */
  validateSettings(): ValidationResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Validate API endpoint format
    const rawEndpoint = this.getConfig<string>("apiEndpoint", DEFAULT_SETTINGS.apiEndpoint);
    if (!this.isValidUrl(rawEndpoint)) {
      errors.push(`Invalid API endpoint URL: ${rawEndpoint}`);
    }

    // Check refresh interval bounds
    const rawInterval = this.getConfig<number>("refreshInterval", DEFAULT_SETTINGS.refreshInterval);
    if (rawInterval < MIN_REFRESH_INTERVAL) {
      warnings.push(`Refresh interval (${rawInterval}s) below minimum (${MIN_REFRESH_INTERVAL}s)`);
    }
    if (rawInterval > MAX_REFRESH_INTERVAL) {
      warnings.push(`Refresh interval (${rawInterval}s) above maximum (${MAX_REFRESH_INTERVAL}s)`);
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
    };
  }

  /**
   * Validates the API endpoint by testing connectivity.
   * Makes a request to the /health endpoint.
   *
   * @param endpoint - The endpoint to validate
   * @returns Promise that resolves to true if endpoint is reachable
   */
  async validateApiEndpoint(endpoint: string): Promise<boolean> {
    if (!this.isValidUrl(endpoint)) {
      return false;
    }

    try {
      const healthUrl = `${endpoint}/health`;
      this.log(`Testing API endpoint: ${healthUrl}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

      try {
        const response = await fetch(healthUrl, {
          method: "GET",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          this.logWarning(`API endpoint returned ${response.status}`);
          return false;
        }

        this.log("API endpoint validation successful");
        return true;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        this.logWarning(`API endpoint validation timed out after ${HEALTH_CHECK_TIMEOUT_MS}ms`);
      } else {
        this.logWarning(`API endpoint validation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      return false;
    }
  }

  /**
   * Validates a URL string.
   * Checks for valid format and http/https protocol.
   */
  isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ["http:", "https:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Shows an informational notification if notifications are enabled.
   * Error messages are always shown regardless of setting.
   *
   * @param message - The message to display
   */
  showInfo(message: string): void {
    if (this.showNotifications) {
      vscode.window.showInformationMessage(message);
    }
  }

  /**
   * Shows a warning notification if notifications are enabled.
   *
   * @param message - The message to display
   */
  showWarning(message: string): void {
    if (this.showNotifications) {
      vscode.window.showWarningMessage(message);
    }
  }

  /**
   * Shows an error notification (always shown regardless of settings).
   *
   * @param message - The message to display
   */
  showError(message: string): void {
    // Errors are always shown
    vscode.window.showErrorMessage(message);
  }

  /**
   * Cleans up resources when the service is disposed.
   */
  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables.length = 0;
    this.cachedSettings = null;
    SettingsService.instance = null;
  }

  /**
   * Gets a configuration value from VS Code settings.
   */
  private getConfig<T>(key: string, defaultValue: T): T {
    const config = vscode.workspace.getConfiguration("contextor");
    return config.get<T>(key, defaultValue);
  }

  /**
   * Handles configuration change events.
   * Determines which settings changed and emits appropriate events.
   */
  private handleConfigChange(e: vscode.ConfigurationChangeEvent): void {
    // Invalidate cache
    this.cachedSettings = null;

    const changes: Partial<ContextorSettings> = {};

    if (e.affectsConfiguration("contextor.apiEndpoint")) {
      const newEndpoint = this.apiEndpoint;
      changes.apiEndpoint = newEndpoint;
      this.log(`API endpoint changed to: ${newEndpoint}`);

      // Validate new endpoint asynchronously
      void this.validateAndNotifyEndpoint(newEndpoint);
    }

    if (e.affectsConfiguration("contextor.refreshInterval")) {
      const rawInterval = this.getConfig<number>("refreshInterval", DEFAULT_SETTINGS.refreshInterval);
      const effectiveInterval = this.refreshInterval;
      changes.refreshInterval = effectiveInterval;

      if (rawInterval < MIN_REFRESH_INTERVAL) {
        this.showWarning(
          `Refresh interval (${rawInterval}s) is below minimum. Using ${MIN_REFRESH_INTERVAL}s instead.`
        );
      } else {
        this.log(`Refresh interval changed to: ${effectiveInterval}s`);
      }
    }

    if (e.affectsConfiguration("contextor.showNotifications")) {
      changes.showNotifications = this.showNotifications;
      this.log(`Show notifications changed to: ${this.showNotifications}`);
    }

    if (e.affectsConfiguration("contextor.showStatusBarItem")) {
      changes.showStatusBarItem = this.showStatusBarItem;
      this.log(`Show status bar item changed to: ${this.showStatusBarItem}`);
    }

    if (e.affectsConfiguration("contextor.autoRefreshEnabled")) {
      changes.autoRefreshEnabled = this.autoRefreshEnabled;
      this.log(`Auto-refresh enabled changed to: ${this.autoRefreshEnabled}`);
    }

    // Only fire event if something actually changed
    if (Object.keys(changes).length > 0) {
      this._onDidChange.fire(changes);
    }
  }

  /**
   * Validates the API endpoint and shows appropriate notifications.
   */
  private async validateAndNotifyEndpoint(endpoint: string): Promise<void> {
    // First check URL format
    if (!this.isValidUrl(endpoint)) {
      this.showError(`Invalid Contextor API endpoint URL: ${endpoint}. Please check your settings.`);
      return;
    }

    // Then test connectivity
    const isReachable = await this.validateApiEndpoint(endpoint);
    if (!isReachable) {
      vscode.window.showWarningMessage(
        `Contextor API endpoint (${endpoint}) is not reachable. Some features may not work.`
      );
    } else {
      this.showInfo("Contextor API endpoint updated successfully.");
    }
  }

  /**
   * Logs a message to the output channel.
   */
  private log(message: string): void {
    if (this.outputChannel) {
      const timestamp = new Date().toISOString();
      this.outputChannel.appendLine(`[${timestamp}] [Settings] ${message}`);
    }
  }

  /**
   * Logs a warning message to the output channel.
   */
  private logWarning(message: string): void {
    if (this.outputChannel) {
      const timestamp = new Date().toISOString();
      this.outputChannel.appendLine(`[${timestamp}] [Settings] WARNING: ${message}`);
    }
  }
}

/**
 * Convenience function to show an informational notification
 * that respects the showNotifications setting.
 */
export function showInfo(message: string): void {
  SettingsService.getInstance().showInfo(message);
}

/**
 * Convenience function to show a warning notification
 * that respects the showNotifications setting.
 */
export function showWarning(message: string): void {
  SettingsService.getInstance().showWarning(message);
}

/**
 * Convenience function to show an error notification.
 * Errors are always shown regardless of settings.
 */
export function showError(message: string): void {
  SettingsService.getInstance().showError(message);
}
