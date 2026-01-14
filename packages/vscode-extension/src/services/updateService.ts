/**
 * UpdateService - Checks for and installs extension updates
 *
 * Features:
 * - Checks for updates on startup and periodically
 * - Shows notification when update is available
 * - One-click download and install of updates
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { AuthService } from "./auth";
import { SettingsService } from "./settings";

/**
 * Extension info from the API
 */
interface ExtensionInfo {
  version: string;
  filename: string;
  releaseNotes?: string;
  minVSCodeVersion: string;
  publishedAt: string;
}

/**
 * Download info from the API
 */
interface DownloadInfo {
  downloadUrl: string;
  version: string;
  filename: string;
}

/**
 * UpdateService handles checking for and installing extension updates
 */
export class UpdateService {
  private readonly outputChannel: vscode.OutputChannel;
  private readonly authService: AuthService;
  private readonly settingsService: SettingsService;
  private readonly currentVersion: string;
  private checkInterval: NodeJS.Timeout | undefined;
  private lastCheckTime: number = 0;
  private dismissedVersion: string | undefined;

  // Check for updates every 4 hours
  private static readonly CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
  // Minimum time between checks (5 minutes)
  private static readonly MIN_CHECK_INTERVAL_MS = 5 * 60 * 1000;

  constructor(
    outputChannel: vscode.OutputChannel,
    authService: AuthService,
    currentVersion: string
  ) {
    this.outputChannel = outputChannel;
    this.authService = authService;
    this.settingsService = SettingsService.getInstance();
    this.currentVersion = currentVersion;
  }

  /**
   * Start the update checker - call on extension activation
   */
  async startUpdateChecker(): Promise<void> {
    this.log(`Starting update checker (current version: ${this.currentVersion})`);

    // Check immediately on startup (after a small delay to not block activation)
    // Using 2 seconds to ensure extension is fully loaded but still prompt
    setTimeout(async () => {
      this.log("Running automatic startup update check...");
      await this.checkForUpdates(false);
    }, 2000);

    // Set up periodic checks (every 4 hours)
    this.checkInterval = setInterval(() => {
      this.log("Running periodic update check...");
      this.checkForUpdates(false);
    }, UpdateService.CHECK_INTERVAL_MS);
  }

  /**
   * Stop the update checker
   */
  stopUpdateChecker(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }

  /**
   * Manually trigger an update check
   */
  async checkForUpdatesManual(): Promise<void> {
    await this.checkForUpdates(true);
  }

  /**
   * Check for available updates
   */
  private async checkForUpdates(isManual: boolean): Promise<void> {
    // Rate limit checks (unless manual)
    if (!isManual) {
      const now = Date.now();
      if (now - this.lastCheckTime < UpdateService.MIN_CHECK_INTERVAL_MS) {
        return;
      }
      this.lastCheckTime = now;
    }

    try {
      this.log("Checking for updates...");

      const apiEndpoint = this.settingsService.apiEndpoint;
      const response = await fetch(`${apiEndpoint}/extension/info`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (isManual) {
          vscode.window.showErrorMessage(
            `Failed to check for updates: ${response.status}`
          );
        }
        this.log(`Update check failed: HTTP ${response.status}`);
        return;
      }

      const result = (await response.json()) as {
        success?: boolean;
        data?: ExtensionInfo;
        error?: { message: string };
      };

      if (!result.success || !result.data) {
        this.log(`Update check failed: ${result.error?.message || "No data"}`);
        if (isManual) {
          vscode.window.showErrorMessage(
            result.error?.message || "Failed to get version info"
          );
        }
        return;
      }

      const latestVersion = result.data.version;
      this.log(`Latest version: ${latestVersion}, Current: ${this.currentVersion}`);

      // Compare versions
      const comparison = this.compareVersions(latestVersion, this.currentVersion);

      if (comparison > 0) {
        // New version available
        this.log(`Update available: ${latestVersion}`);

        // Check if user dismissed this version
        if (this.dismissedVersion === latestVersion && !isManual) {
          this.log("User dismissed this version, skipping notification");
          return;
        }

        this.showUpdateNotification(result.data);
      } else if (isManual) {
        vscode.window.showInformationMessage(
          `Contextor is up to date (v${this.currentVersion})`
        );
      } else {
        this.log("No update available");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log(`Update check error: ${errorMsg}`);
      if (isManual) {
        vscode.window.showErrorMessage(`Failed to check for updates: ${errorMsg}`);
      }
    }
  }

  /**
   * Show notification about available update
   */
  private async showUpdateNotification(info: ExtensionInfo): Promise<void> {
    const message = `Contextor v${info.version} is available (you have v${this.currentVersion})`;
    const releaseNotes = info.releaseNotes ? `\n\n${info.releaseNotes}` : "";

    const selection = await vscode.window.showInformationMessage(
      message + releaseNotes,
      "Update Now",
      "Later",
      "Skip This Version"
    );

    if (selection === "Update Now") {
      await this.downloadAndInstall();
    } else if (selection === "Skip This Version") {
      this.dismissedVersion = info.version;
      this.log(`User skipped version ${info.version}`);
    }
  }

  /**
   * Download and install the latest version
   */
  async downloadAndInstall(): Promise<void> {
    try {
      // Check if authenticated
      const isAuth = await this.authService.isAuthenticated();
      if (!isAuth) {
        vscode.window.showErrorMessage(
          "Please sign in to download updates."
        );
        return;
      }

      const accessToken = await this.authService.getAccessToken();
      if (!accessToken) {
        vscode.window.showErrorMessage(
          "Authentication expired. Please sign in again."
        );
        return;
      }

      // Show progress
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Updating Contextor",
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: "Getting download URL..." });

          // Get download URL
          const apiEndpoint = this.settingsService.apiEndpoint;
          const downloadResponse = await fetch(`${apiEndpoint}/extension/download`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (!downloadResponse.ok) {
            throw new Error(`Failed to get download URL: ${downloadResponse.status}`);
          }

          const downloadResult = (await downloadResponse.json()) as {
            success?: boolean;
            data?: DownloadInfo;
            error?: { message: string };
          };

          if (!downloadResult.success || !downloadResult.data) {
            throw new Error(downloadResult.error?.message || "Failed to get download info");
          }

          progress.report({ message: "Downloading extension..." });
          this.log(`Downloading from: ${downloadResult.data.downloadUrl}`);

          // Download the VSIX file
          const vsixResponse = await fetch(downloadResult.data.downloadUrl);
          if (!vsixResponse.ok) {
            throw new Error(`Download failed: ${vsixResponse.status}`);
          }

          const arrayBuffer = await vsixResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // Save to temp directory
          const tempDir = os.tmpdir();
          const vsixPath = path.join(tempDir, downloadResult.data.filename);
          fs.writeFileSync(vsixPath, buffer);
          this.log(`Downloaded to: ${vsixPath}`);

          progress.report({ message: "Installing extension..." });

          // Install the extension
          await vscode.commands.executeCommand(
            "workbench.extensions.installExtension",
            vscode.Uri.file(vsixPath)
          );

          this.log("Extension installed successfully");

          // Clean up temp file
          try {
            fs.unlinkSync(vsixPath);
          } catch {
            // Ignore cleanup errors
          }

          // Prompt to reload
          const reload = await vscode.window.showInformationMessage(
            `Contextor has been updated to v${downloadResult.data.version}. Reload to activate?`,
            "Reload Now",
            "Later"
          );

          if (reload === "Reload Now") {
            await vscode.commands.executeCommand("workbench.action.reloadWindow");
          }
        }
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log(`Update failed: ${errorMsg}`);
      vscode.window.showErrorMessage(`Failed to update: ${errorMsg}`);
    }
  }

  /**
   * Compare semver versions
   * Returns positive if a > b, negative if a < b, 0 if equal
   */
  private compareVersions(a: string, b: string): number {
    const partsA = a.split(".").map(Number);
    const partsB = b.split(".").map(Number);

    for (let i = 0; i < 3; i++) {
      const partA = partsA[i] ?? 0;
      const partB = partsB[i] ?? 0;
      if (partA > partB) return 1;
      if (partA < partB) return -1;
    }
    return 0;
  }

  /**
   * Log a message
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] [UpdateService] ${message}`);
  }
}
