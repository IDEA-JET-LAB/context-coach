/**
 * ImportService - Discovers and imports Claude Code transcripts
 * Integrates with the backend API for batch upload
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import { AuthService } from "./auth";
import { SettingsService } from "./settings";

/**
 * Discovered project info
 */
export interface DiscoveredProject {
  path: string;
  normalizedPath: string;
  sessionCount: number;
  estimatedPrompts: number;
  oldestSession: Date;
  newestSession: Date;
}

/**
 * Import progress for UI updates
 */
export interface ImportProgress {
  state: "idle" | "scanning" | "importing" | "complete" | "error" | "cancelled";
  currentProject?: string;
  projectIndex: number;
  totalProjects: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  errorMessage?: string;
  /** Detailed status message for user feedback */
  statusMessage?: string;
  /** Progress percentage (0-100) */
  progress?: number;
}

/**
 * Prompt-response pair with fingerprint
 */
interface PromptWithFingerprint {
  prompt: {
    text: string;
    timestamp: string;
  };
  fingerprint: string;
}

/**
 * Import service for Claude Code transcripts
 */
export class ImportService {
  private outputChannel?: vscode.OutputChannel;
  private authService: AuthService;
  private settingsService: SettingsService;
  private isCancelled = false;
  private onProgressCallback?: (progress: ImportProgress) => void;

  constructor(authService: AuthService) {
    this.authService = authService;
    this.settingsService = SettingsService.getInstance();
  }

  /**
   * Initialize the service with output channel for logging.
   */
  initialize(outputChannel: vscode.OutputChannel): void {
    this.outputChannel = outputChannel;
    this.log("ImportService initialized");
  }

  /**
   * Set progress callback for UI updates.
   */
  setProgressCallback(callback: (progress: ImportProgress) => void): void {
    this.onProgressCallback = callback;
  }

  /**
   * Cancel ongoing import.
   */
  cancel(): void {
    this.isCancelled = true;
    this.log("Import cancelled by user");
  }

  /**
   * Discover Claude Code projects with transcripts.
   * Emits progress updates during scanning.
   */
  async discoverProjects(): Promise<DiscoveredProject[]> {
    const claudeDir = path.join(os.homedir(), ".claude", "projects");

    // Emit initial status
    this.updateProgress({
      state: "scanning",
      statusMessage: "Locating Claude Code directory...",
      projectIndex: 0,
      totalProjects: 0,
      importedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      progress: 0,
    });

    if (!fs.existsSync(claudeDir)) {
      this.log("Claude projects directory does not exist");
      this.updateProgress({
        state: "complete",
        statusMessage: "No Claude Code projects found",
        projectIndex: 0,
        totalProjects: 0,
        importedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        progress: 100,
      });
      return [];
    }

    const projects: DiscoveredProject[] = [];

    try {
      this.updateProgress({
        state: "scanning",
        statusMessage: "Reading project directories...",
        projectIndex: 0,
        totalProjects: 0,
        importedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        progress: 10,
      });

      const entries = fs.readdirSync(claudeDir, { withFileTypes: true });
      const totalDirs = entries.filter((e) => e.isDirectory()).length;

      this.updateProgress({
        state: "scanning",
        statusMessage: `Found ${totalDirs} project directories, scanning...`,
        projectIndex: 0,
        totalProjects: totalDirs,
        importedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        progress: 20,
      });

      let scannedDirs = 0;
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        scannedDirs++;
        const projectPath = path.join(claudeDir, entry.name);
        const projectName = this.denormalizePath(entry.name);

        // Update progress every few projects
        if (scannedDirs % 3 === 0 || scannedDirs === totalDirs) {
          this.updateProgress({
            state: "scanning",
            statusMessage: `Scanning project ${scannedDirs}/${totalDirs}...`,
            currentProject: projectName,
            projectIndex: scannedDirs,
            totalProjects: totalDirs,
            importedCount: projects.length,
            skippedCount: 0,
            failedCount: 0,
            progress: 20 + Math.floor((scannedDirs / totalDirs) * 70),
          });
        }

        const files = this.findJsonlFiles(projectPath);

        if (files.length === 0) continue;

        // Get file stats for date range
        let oldestDate = new Date();
        let newestDate = new Date(0);
        let estimatedPrompts = 0;

        for (const file of files) {
          const stats = fs.statSync(file);
          if (stats.mtime < oldestDate) oldestDate = stats.mtime;
          if (stats.mtime > newestDate) newestDate = stats.mtime;

          // Estimate prompts (rough: ~2KB per prompt on average)
          estimatedPrompts += Math.ceil(stats.size / 2048);
        }

        projects.push({
          path: projectName,
          normalizedPath: entry.name,
          sessionCount: files.length,
          estimatedPrompts,
          oldestSession: oldestDate,
          newestSession: newestDate,
        });
      }

      const totalPrompts = projects.reduce((sum, p) => sum + p.estimatedPrompts, 0);
      this.updateProgress({
        state: "scanning",
        statusMessage: `Found ${projects.length} projects with ~${totalPrompts} prompts`,
        projectIndex: totalDirs,
        totalProjects: totalDirs,
        importedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        progress: 100,
      });

      this.log(`Discovered ${projects.length} projects with ~${totalPrompts} estimated prompts`);
      return projects;
    } catch (error) {
      this.logError("Failed to discover projects", error);
      this.updateProgress({
        state: "error",
        statusMessage: "Failed to scan projects",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        projectIndex: 0,
        totalProjects: 0,
        importedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        progress: 0,
      });
      return [];
    }
  }

  /** Inactivity timeout in milliseconds (2 minutes without progress triggers timeout) */
  private static readonly INACTIVITY_TIMEOUT = 2 * 60 * 1000;

  /**
   * Start import for selected projects.
   * Uses inactivity-based timeout - only times out if no progress for 2 minutes.
   */
  async startImport(projects: DiscoveredProject[]): Promise<ImportProgress> {
    this.isCancelled = false;
    let lastActivityTime = Date.now();

    const progress: ImportProgress = {
      state: "importing",
      statusMessage: "Preparing import...",
      projectIndex: 0,
      totalProjects: projects.length,
      importedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      progress: 0,
    };

    this.updateProgress(progress);

    try {
      // Get auth info with retry
      progress.statusMessage = "Verifying authentication...";
      this.updateProgress(progress);

      const isAuth = await this.authService.isAuthenticated();
      if (!isAuth) {
        throw new Error("Not authenticated. Please sign in first.");
      }

      // Get user with retry (profile may not be immediately available)
      let user = await this.authService.getUser();
      if (!user) {
        this.log("User profile not immediately available, retrying...");
        // Wait a bit and retry
        await new Promise((resolve) => setTimeout(resolve, 1000));
        user = await this.authService.getUser();
      }
      if (!user) {
        throw new Error("Could not get user info. Please try signing out and back in.");
      }

      const accessToken = await this.authService.getAccessToken();
      if (!accessToken) {
        throw new Error("Could not get access token. Please try signing out and back in.");
      }

      const apiEndpoint = this.settingsService.apiEndpoint;

      // Fetch user's team
      progress.statusMessage = "Fetching team information...";
      this.updateProgress(progress);

      const teamId = await this.fetchUserTeamId(accessToken, apiEndpoint);
      if (!teamId) {
        throw new Error("Could not find your team. Please ensure you're a member of a team in Contextor.");
      }
      this.log(`Using team ID: ${teamId}`);
      const totalEstimatedPrompts = projects.reduce((sum, p) => sum + p.estimatedPrompts, 0);

      // Process each project
      for (let i = 0; i < projects.length; i++) {
        // Check inactivity timeout (only timeout if no progress for 2 minutes)
        if (Date.now() - lastActivityTime > ImportService.INACTIVITY_TIMEOUT) {
          progress.state = "error";
          progress.statusMessage = "Import timed out due to inactivity";
          progress.errorMessage = "No progress for 2 minutes. Check your network connection and try again.";
          this.updateProgress(progress);
          this.log("Import timed out due to inactivity");
          return progress;
        }

        if (this.isCancelled) {
          progress.state = "cancelled";
          progress.statusMessage = "Import cancelled";
          this.updateProgress(progress);
          return progress;
        }

        const project = projects[i];
        const shortName = project.path.split("/").pop() || project.path;

        progress.currentProject = shortName;
        progress.projectIndex = i;
        progress.statusMessage = `Importing ${shortName} (${i + 1}/${projects.length})...`;
        progress.progress = Math.floor((i / projects.length) * 100);
        this.updateProgress(progress);

        try {
          const result = await this.importProject(
            project,
            user.id,
            teamId,
            accessToken,
            apiEndpoint,
            (fileProgress) => {
              // Update progress during file processing
              progress.statusMessage = `Importing ${shortName}: ${fileProgress}`;
              this.updateProgress(progress);
            }
          );
          progress.importedCount += result.imported;
          progress.skippedCount += result.skipped;

          // Update activity time - progress is being made
          lastActivityTime = Date.now();

          progress.statusMessage = `Completed ${shortName}: ${result.imported} imported, ${result.skipped} skipped`;
          this.updateProgress(progress);
        } catch (error) {
          progress.failedCount += project.estimatedPrompts;
          progress.statusMessage = `Failed: ${shortName}`;
          this.logError(`Failed to import project: ${project.path}`, error);
        }
      }

      progress.state = "complete";
      progress.projectIndex = projects.length;
      progress.progress = 100;
      progress.statusMessage = `Done! ${progress.importedCount} imported, ${progress.skippedCount} duplicates skipped`;
      this.updateProgress(progress);

      this.log(
        `Import complete: ${progress.importedCount} imported, ${progress.skippedCount} skipped, ${progress.failedCount} failed`
      );

      return progress;
    } catch (error) {
      progress.state = "error";
      progress.statusMessage = "Import failed";
      progress.errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.updateProgress(progress);
      this.logError("Import failed", error);
      return progress;
    }
  }

  /**
   * Import a single project.
   */
  private async importProject(
    project: DiscoveredProject,
    userId: string,
    teamId: string,
    accessToken: string,
    apiEndpoint: string,
    onProgress?: (message: string) => void
  ): Promise<{ imported: number; skipped: number }> {
    const claudeDir = path.join(os.homedir(), ".claude", "projects");
    const projectPath = path.join(claudeDir, project.normalizedPath);
    const files = this.findJsonlFiles(projectPath);

    let imported = 0;
    let skipped = 0;
    let processedFiles = 0;

    onProgress?.(`found ${files.length} session files`);

    for (const file of files) {
      if (this.isCancelled) break;

      processedFiles++;
      const fileName = path.basename(file);

      try {
        onProgress?.(`reading file ${processedFiles}/${files.length}`);
        const prompts = await this.extractPromptsFromFile(file, userId);
        if (prompts.length === 0) continue;

        // Upload in batches of 50
        const batchSize = 50;
        const totalBatches = Math.ceil(prompts.length / batchSize);

        for (let i = 0; i < prompts.length; i += batchSize) {
          if (this.isCancelled) break;

          const batchNum = Math.floor(i / batchSize) + 1;
          onProgress?.(`uploading batch ${batchNum}/${totalBatches} (${imported} imported)`);

          const batch = prompts.slice(i, i + batchSize);
          const result = await this.uploadBatch(
            batch,
            userId,
            teamId,
            accessToken,
            apiEndpoint,
            project.path
          );
          imported += result.imported;
          skipped += result.skipped;
        }
      } catch (error) {
        this.logError(`Failed to process file: ${file}`, error);
      }
    }

    return { imported, skipped };
  }

  /**
   * Extract prompts from a JSONL file.
   */
  private async extractPromptsFromFile(
    filePath: string,
    userId: string
  ): Promise<PromptWithFingerprint[]> {
    const prompts: PromptWithFingerprint[] = [];

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n").filter((line) => line.trim());

      for (const line of lines) {
        try {
          const message = JSON.parse(line);

          // Look for user messages
          if (message.type === "user" && message.message?.content) {
            const text = this.extractTextContent(message.message.content);
            if (text && text.length > 0) {
              const timestamp =
                message.timestamp || new Date().toISOString();
              prompts.push({
                prompt: { text, timestamp },
                fingerprint: this.generateFingerprint(userId, timestamp, text),
              });
            }
          }
        } catch {
          // Skip malformed lines
        }
      }
    } catch (error) {
      this.logError(`Failed to read file: ${filePath}`, error);
    }

    return prompts;
  }

  /**
   * Extract text content from message content blocks.
   */
  private extractTextContent(content: unknown): string {
    if (typeof content === "string") {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((block) => {
          if (typeof block === "string") return block;
          if (block?.type === "text" && typeof block.text === "string") {
            return block.text;
          }
          return "";
        })
        .filter(Boolean)
        .join("\n");
    }

    return "";
  }

  /**
   * Generate fingerprint for deduplication.
   */
  private generateFingerprint(
    userId: string,
    timestamp: string,
    text: string
  ): string {
    // Use first 200 chars and minute-level timestamp
    const truncatedText = text.substring(0, 200);
    const minuteTimestamp = timestamp.substring(0, 16); // YYYY-MM-DDTHH:MM

    const input = `${userId}:${minuteTimestamp}:${truncatedText}`;
    return crypto.createHash("md5").update(input).digest("hex").substring(0, 12);
  }

  /**
   * Upload a batch of prompts to the API.
   */
  private async uploadBatch(
    prompts: PromptWithFingerprint[],
    userId: string,
    teamId: string,
    accessToken: string,
    apiEndpoint: string,
    projectPath: string
  ): Promise<{ imported: number; skipped: number }> {
    try {
      const response = await fetch(`${apiEndpoint}/import/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          pairs: prompts,
          importId: `vscode-${Date.now()}`,
          teamId,
          userId,
          projectPath,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result = (await response.json()) as {
        imported?: number;
        skipped?: number;
      };
      return {
        imported: result.imported || 0,
        skipped: result.skipped || 0,
      };
    } catch (error) {
      this.logError("Batch upload failed", error);
      throw error;
    }
  }

  /**
   * Find all JSONL files in a directory recursively.
   */
  private findJsonlFiles(dir: string): string[] {
    const files: string[] = [];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          files.push(...this.findJsonlFiles(fullPath));
        } else if (entry.name.endsWith(".jsonl")) {
          files.push(fullPath);
        }
      }
    } catch {
      // Ignore unreadable directories
    }

    return files;
  }

  /**
   * Convert normalized path back to human-readable format.
   */
  private denormalizePath(normalizedPath: string): string {
    if (!normalizedPath.startsWith("-")) {
      return normalizedPath;
    }

    // Convert -Users-edgars-My-projects to /Users/edgars/My-projects
    const parts = normalizedPath.slice(1).split("-");

    // Try to intelligently reconstruct the path
    // Check if it starts with Users (macOS) or home (Linux)
    if (parts[0] === "Users" || parts[0] === "home") {
      return "/" + parts.join("/");
    }

    return parts.join("/");
  }

  /**
   * Update progress callback.
   */
  private updateProgress(progress: ImportProgress): void {
    if (this.onProgressCallback) {
      this.onProgressCallback(progress);
    }
  }

  /**
   * Fetch the user's first team ID from the API.
   */
  private async fetchUserTeamId(
    accessToken: string,
    apiEndpoint: string
  ): Promise<string | null> {
    try {
      const response = await fetch(`${apiEndpoint}/teams`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        this.log(`Failed to fetch teams: ${response.status}`);
        return null;
      }

      const data = (await response.json()) as {
        data?: { teams?: Array<{ id: string; name: string }> };
        teams?: Array<{ id: string; name: string }>;
      };

      // Handle both { data: { teams } } and { teams } formats
      const teams = data.data?.teams || data.teams;

      if (!teams || teams.length === 0) {
        this.log("No teams found for user");
        return null;
      }

      // Return the first team's ID
      this.log(`Found ${teams.length} team(s), using: ${teams[0].name}`);
      return teams[0].id;
    } catch (error) {
      this.logError("Failed to fetch user teams", error);
      return null;
    }
  }

  /**
   * Log a message.
   */
  private log(message: string): void {
    if (this.outputChannel) {
      const timestamp = new Date().toISOString();
      this.outputChannel.appendLine(`[${timestamp}] [ImportService] ${message}`);
    }
  }

  /**
   * Log an error.
   */
  private logError(message: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.log(`ERROR: ${message}: ${errorMessage}`);
  }
}
