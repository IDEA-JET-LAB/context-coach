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
 * Tool execution from assistant response
 */
interface ExtractedToolUse {
  toolId: string;
  toolName: string;
  inputSummary: string;
  inputFull?: Record<string, unknown>;
}

/**
 * Prompt-response pair with fingerprint
 */
interface PromptWithFingerprint {
  prompt: {
    text: string;
    timestamp: string;
  };
  response?: {
    text: string;
    timestamp: string;
    model?: string;
    tokens?: {
      input: number;
      output: number;
    };
    tools?: ExtractedToolUse[];
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

  /**
   * Start cloud-based import for selected projects.
   * Uploads JSONL files directly to the server for fast processing.
   * @param projects - Projects to import
   * @param selectedTeamId - Optional team ID to import to (uses first team if not specified)
   * @param projectMappings - Optional mapping of local paths to existing project IDs (null = create new)
   * @param projectCustomNames - Optional custom names for new projects (path -> name)
   * @param projectTeamIds - Optional team IDs for new projects (path -> teamId)
   */
  async startImport(
    projects: DiscoveredProject[],
    selectedTeamId?: string,
    projectMappings?: Record<string, string | null>,
    projectCustomNames?: Record<string, string>,
    projectTeamIds?: Record<string, string>
  ): Promise<ImportProgress> {
    this.isCancelled = false;

    const progress: ImportProgress = {
      state: "importing",
      statusMessage: "Preparing upload...",
      projectIndex: 0,
      totalProjects: projects.length,
      importedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      progress: 0,
    };

    this.updateProgress(progress);

    try {
      // Get auth info
      progress.statusMessage = "Verifying authentication...";
      this.updateProgress(progress);

      const isAuth = await this.authService.isAuthenticated();
      if (!isAuth) {
        throw new Error("Not authenticated. Please sign in first.");
      }

      const accessToken = await this.authService.getAccessToken();
      if (!accessToken) {
        throw new Error("Could not get access token. Please try signing out and back in.");
      }

      const apiEndpoint = this.settingsService.apiEndpoint;

      // Use provided teamId or fetch from API
      let teamId = selectedTeamId;
      if (!teamId) {
        progress.statusMessage = "Fetching team information...";
        this.updateProgress(progress);

        teamId = await this.fetchUserTeamId(accessToken, apiEndpoint);
        if (!teamId) {
          throw new Error("Could not find your team. Please ensure you're a member of a team in Contextor.");
        }
      }
      this.log(`Using team ID: ${teamId}`);

      // Collect all JSONL files from selected projects
      progress.statusMessage = "Collecting files...";
      progress.progress = 10;
      this.updateProgress(progress);

      const claudeDir = path.join(os.homedir(), ".claude", "projects");
      const allFiles: { projectPath: string; filePath: string; fileName: string }[] = [];

      for (const project of projects) {
        if (this.isCancelled) {
          progress.state = "cancelled";
          progress.statusMessage = "Import cancelled";
          this.updateProgress(progress);
          return progress;
        }

        const projectDir = path.join(claudeDir, project.normalizedPath);
        const jsonlFiles = this.findJsonlFiles(projectDir);

        for (const filePath of jsonlFiles) {
          allFiles.push({
            projectPath: project.path,
            filePath,
            fileName: path.basename(filePath),
          });
        }
      }

      this.log(`Collected ${allFiles.length} files from ${projects.length} projects`);

      // Debug log: list all collected files
      for (const file of allFiles) {
        this.log(`  File: ${file.fileName} from ${file.projectPath}`);
      }

      if (allFiles.length === 0) {
        progress.state = "complete";
        progress.statusMessage = "No files to import";
        progress.progress = 100;
        this.updateProgress(progress);
        return progress;
      }

      // Build JSON payload with all files
      progress.statusMessage = `Preparing ${allFiles.length} files...`;
      progress.progress = 20;
      this.updateProgress(progress);

      const filesPayload: Array<{ projectPath: string; fileName: string; content: string }> = [];

      let fileIndex = 0;
      let totalContentSize = 0;
      for (const file of allFiles) {
        if (this.isCancelled) {
          progress.state = "cancelled";
          progress.statusMessage = "Import cancelled";
          this.updateProgress(progress);
          return progress;
        }

        try {
          let content = fs.readFileSync(file.filePath, "utf-8");

          // Sanitize content: remove control characters that break JSON
          // Keep only printable ASCII, newlines, tabs, and valid UTF-8
          content = content
            // Remove NULL bytes and other control chars except \n, \r, \t
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
            // Remove lone surrogates (invalid UTF-16)
            .replace(/[\uD800-\uDFFF]/g, "");

          // Validate content is not empty and is valid for JSON serialization
          if (content && content.length > 0) {
            // Test that the content can be serialized to JSON
            try {
              JSON.stringify(content);
            } catch (jsonError) {
              this.logError(`File ${file.fileName} contains invalid characters for JSON`, jsonError);
              // Skip this file
              continue;
            }
            filesPayload.push({
              projectPath: file.projectPath,
              fileName: file.fileName,
              content,
            });
            totalContentSize += content.length;
          } else {
            this.log(`Skipping empty file: ${file.fileName}`);
          }
        } catch (readError) {
          this.logError(`Failed to read file ${file.fileName}`, readError);
          // Skip this file but continue with others
        }
        fileIndex++;

        // Update progress
        if (fileIndex % 10 === 0) {
          progress.statusMessage = `Reading files (${fileIndex}/${allFiles.length})...`;
          progress.progress = 20 + Math.floor((fileIndex / allFiles.length) * 30);
          this.updateProgress(progress);
        }
      }

      this.log(`Total content size: ${(totalContentSize / 1024 / 1024).toFixed(2)} MB from ${filesPayload.length} files`);

      // Check if we have any files to upload
      if (filesPayload.length === 0) {
        progress.state = "error";
        progress.statusMessage = "No valid files found to import";
        progress.errorMessage = "All files were either empty or could not be read";
        this.updateProgress(progress);
        return progress;
      }

      // Split files into chunks to avoid payload size limits (max 4MB per chunk)
      const MAX_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB (conservative)
      const MAX_SINGLE_FILE_SIZE = 3 * 1024 * 1024; // 3MB max for a single file
      const chunks: Array<typeof filesPayload> = [];
      let currentChunk: typeof filesPayload = [];
      let currentChunkSize = 0;
      let skippedLargeFiles = 0;

      for (const file of filesPayload) {
        const fileJson = JSON.stringify(file);
        const fileSize = fileJson.length;

        // Skip files that are too large (they likely have issues)
        if (fileSize > MAX_SINGLE_FILE_SIZE) {
          this.log(`Skipping large file: ${file.fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
          skippedLargeFiles++;
          continue;
        }

        // If adding this file would exceed chunk size, start a new chunk
        if (currentChunkSize + fileSize > MAX_CHUNK_SIZE && currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = [];
          currentChunkSize = 0;
        }

        currentChunk.push(file);
        currentChunkSize += fileSize;
      }

      // Don't forget the last chunk
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }

      this.log(`Split ${filesPayload.length - skippedLargeFiles} files into ${chunks.length} chunks (skipped ${skippedLargeFiles} large files)`);

      // Upload chunks
      let totalImported = 0;
      let totalSkipped = 0;
      let totalUpdated = 0;

      for (let i = 0; i < chunks.length; i++) {
        if (this.isCancelled) {
          progress.state = "cancelled";
          progress.statusMessage = "Import cancelled";
          this.updateProgress(progress);
          return progress;
        }

        const chunk = chunks[i];
        progress.statusMessage = `Uploading batch ${i + 1}/${chunks.length}...`;
        progress.progress = 50 + Math.floor((i / chunks.length) * 45);
        this.updateProgress(progress);

        this.log(`Uploading chunk ${i + 1}/${chunks.length} with ${chunk.length} files`);

        // Debug: log file sizes in this chunk
        for (const fp of chunk) {
          this.log(`  Chunk ${i + 1}: ${fp.fileName} (${fp.content.length} bytes)`);
        }

        const payload = {
          teamId,
          files: chunk,
          ...(projectMappings && { projectMappings }),
          ...(projectCustomNames && { projectCustomNames }),
          ...(projectTeamIds && { projectTeamIds }),
        };
        const payloadString = JSON.stringify(payload);
        const payloadSizeMB = payloadString.length / 1024 / 1024;
        this.log(`Chunk ${i + 1} payload size: ${payloadSizeMB.toFixed(2)} MB`);

        // Safety check - if payload is still too large, skip this chunk
        if (payloadSizeMB > 5) {
          this.logError(`Chunk ${i + 1} is too large (${payloadSizeMB.toFixed(2)} MB), skipping`, null);
          progress.failedCount = (progress.failedCount || 0) + chunk.length;
          continue;
        }

        // Use AbortController for timeout
        // Backend maxDuration is 300s (5 min), so frontend needs longer timeout
        // Use 6 minutes (360s) to give backend time to complete + network latency
        const CHUNK_TIMEOUT_MS = 6 * 60 * 1000; // 6 minutes
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CHUNK_TIMEOUT_MS);

        // Update progress to show upload is in progress
        progress.statusMessage = `Uploading batch ${i + 1}/${chunks.length} (${payloadSizeMB.toFixed(1)} MB)...`;
        this.updateProgress(progress);

        let response: Response;
        try {
          this.log(`Sending chunk ${i + 1} to ${apiEndpoint}/import/upload`);
          response = await fetch(`${apiEndpoint}/import/upload`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: payloadString,
            signal: controller.signal,
          });
        } catch (fetchError) {
          clearTimeout(timeoutId);
          const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
          const errorName = fetchError instanceof Error ? fetchError.name : "Unknown";
          this.logError(`Fetch failed for chunk ${i + 1}`, fetchError);

          // Provide more specific error messages based on error type
          if (errorName === "AbortError") {
            throw new Error(
              `Upload timed out for batch ${i + 1}/${chunks.length} after 6 minutes. ` +
              `This may indicate a slow network connection or the server is under heavy load. ` +
              `Try importing fewer projects at once.`
            );
          } else if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("ENOTFOUND")) {
            throw new Error(
              `Cannot connect to server at ${apiEndpoint}. ` +
              `Please check your internet connection and ensure the API endpoint is correct in settings.`
            );
          } else if (errorMessage.includes("ETIMEDOUT") || errorMessage.includes("ENETUNREACH")) {
            throw new Error(
              `Network timeout while connecting to ${apiEndpoint}. ` +
              `Please check your internet connection and try again.`
            );
          } else {
            throw new Error(
              `Network error during upload (batch ${i + 1}/${chunks.length}): ${errorName} - ${errorMessage}. ` +
              `Please check your internet connection and try again.`
            );
          }
        }
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          // Provide more helpful error messages for common HTTP errors
          if (response.status === 401) {
            throw new Error(
              `Authentication failed. Your session may have expired. ` +
              `Please sign out and sign back in to refresh your credentials.`
            );
          } else if (response.status === 403) {
            throw new Error(
              `Access denied. You may not have permission to import to this team. ` +
              `Please check your team membership.`
            );
          } else if (response.status === 413) {
            throw new Error(
              `Upload too large. The batch size exceeded server limits. ` +
              `This is unexpected - please report this issue.`
            );
          } else if (response.status === 502 || response.status === 503 || response.status === 504) {
            throw new Error(
              `Server temporarily unavailable (${response.status}). ` +
              `The import may still be processing. Please wait a few minutes and check if your prompts were imported.`
            );
          } else {
            throw new Error(`Upload failed (batch ${i + 1}): HTTP ${response.status} - ${errorText}`);
          }
        }

        // Show processing status while parsing response
        progress.statusMessage = `Processing batch ${i + 1}/${chunks.length} response...`;
        this.updateProgress(progress);

        const result = (await response.json()) as {
          success: boolean;
          imported?: number;
          skipped?: number;
          updated?: number;
          error?: string;
          duration?: number;
          filesProcessed?: number;
        };

        this.log(`Chunk ${i + 1} response: ${JSON.stringify(result)}`);

        if (!result.success) {
          throw new Error(result.error || `Server error processing batch ${i + 1}. Please try again.`);
        }

        totalImported += result.imported || 0;
        totalSkipped += result.skipped || 0;
        totalUpdated += result.updated || 0;
      }

      progress.state = "complete";
      progress.importedCount = totalImported;
      progress.skippedCount = totalSkipped;
      progress.progress = 100;
      progress.statusMessage = `Done! ${totalImported} imported, ${totalSkipped} skipped`;

      this.updateProgress(progress);
      this.log(
        `Cloud import complete: ${totalImported} imported, ${totalSkipped} skipped across ${chunks.length} chunks`
      );

      return progress;
    } catch (error) {
      progress.state = "error";
      progress.statusMessage = "Import failed";
      progress.errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.updateProgress(progress);
      this.logError("Cloud import failed", error);
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
   * Extract prompts with responses from a JSONL file.
   */
  private async extractPromptsFromFile(
    filePath: string,
    userId: string
  ): Promise<PromptWithFingerprint[]> {
    const pairs: PromptWithFingerprint[] = [];

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n").filter((line) => line.trim());

      // Parse all messages first
      interface ParsedMessage {
        type: string;
        content: string;
        timestamp: string;
        model?: string;
        tokens?: { input: number; output: number };
        tools?: ExtractedToolUse[];
      }
      const messages: ParsedMessage[] = [];

      for (const line of lines) {
        try {
          const message = JSON.parse(line);

          if (message.type === "user" && message.message?.content) {
            const text = this.extractTextContent(message.message.content);
            if (text && text.length > 0) {
              messages.push({
                type: "user",
                content: text,
                timestamp: message.timestamp || new Date().toISOString(),
              });
            }
          } else if (message.type === "assistant" && message.message) {
            const text = this.extractAssistantContent(message.message.content);
            const usage = message.message.usage;
            messages.push({
              type: "assistant",
              content: text,
              timestamp: message.timestamp || new Date().toISOString(),
              model: message.message.model,
              tokens: usage
                ? {
                    input: usage.input_tokens || 0,
                    output: usage.output_tokens || 0,
                  }
                : undefined,
              tools: this.extractToolUsage(message.message.content),
            });
          }
        } catch {
          // Skip malformed lines
        }
      }

      // Pair user messages with subsequent assistant responses
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (msg.type === "user") {
          const nextMsg = messages[i + 1];
          const response =
            nextMsg?.type === "assistant" ? nextMsg : undefined;

          pairs.push({
            prompt: {
              text: msg.content,
              timestamp: msg.timestamp,
            },
            response: response
              ? {
                  text: response.content,
                  timestamp: response.timestamp,
                  model: response.model,
                  tokens: response.tokens,
                  tools: response.tools,
                }
              : undefined,
            fingerprint: this.generateFingerprint(
              userId,
              msg.timestamp,
              msg.content
            ),
          });
        }
      }
    } catch (error) {
      this.logError(`Failed to read file: ${filePath}`, error);
    }

    return pairs;
  }

  /**
   * Extract text content from assistant message (filters out tool_use blocks).
   */
  private extractAssistantContent(content: unknown): string {
    if (typeof content === "string") {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .filter(
          (block): block is { type: string; text: string } =>
            typeof block === "object" &&
            block !== null &&
            block.type === "text" &&
            typeof block.text === "string"
        )
        .map((block) => block.text)
        .join("\n");
    }

    return "";
  }

  /**
   * Extract tool usage from assistant message content.
   */
  private extractToolUsage(content: unknown): ExtractedToolUse[] | undefined {
    if (!Array.isArray(content)) return undefined;

    const tools: ExtractedToolUse[] = [];

    for (const block of content) {
      if (
        typeof block === "object" &&
        block !== null &&
        (block as Record<string, unknown>).type === "tool_use"
      ) {
        const toolBlock = block as Record<string, unknown>;
        const toolId = toolBlock.id as string;
        const toolName = toolBlock.name as string;
        const input = toolBlock.input as Record<string, unknown> | undefined;

        if (toolId && toolName) {
          tools.push({
            toolId,
            toolName,
            inputSummary: input
              ? this.summarizeToolInput(toolName, input)
              : toolName,
            inputFull: input,
          });
        }
      }
    }

    return tools.length > 0 ? tools : undefined;
  }

  /**
   * Summarize tool input for display.
   */
  private summarizeToolInput(
    toolName: string,
    input: Record<string, unknown>
  ): string {
    const MAX_LENGTH = 200;

    switch (toolName) {
      case "Read":
        return `Read: ${input.file_path || "unknown file"}`;
      case "Write":
        return `Write: ${input.file_path || "unknown file"}`;
      case "Edit":
        return `Edit: ${input.file_path || "unknown file"}`;
      case "Bash": {
        const cmd = String(input.command || "").substring(0, 100);
        return `Bash: ${cmd}${cmd.length >= 100 ? "..." : ""}`;
      }
      case "Glob":
        return `Glob: ${input.pattern || "unknown pattern"}`;
      case "Grep":
        return `Grep: ${input.pattern || "unknown pattern"}`;
      case "Task":
        return `Task: ${input.description || String(input.prompt || "").substring(0, 50) || "subtask"}`;
      case "TodoWrite":
        return "TodoWrite: updating task list";
      case "WebFetch":
        return `WebFetch: ${input.url || "unknown url"}`;
      case "WebSearch":
        return `WebSearch: ${input.query || "unknown query"}`;
      default: {
        try {
          const str = JSON.stringify(input);
          if (str.length <= MAX_LENGTH) return str;
          return str.substring(0, MAX_LENGTH - 3) + "...";
        } catch {
          return `${toolName} invocation`;
        }
      }
    }
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
   * Claude Code normalizes paths by replacing / with - and prefixing with -.
   * This is NOT reversible when folder names contain dashes, so we try to
   * find the actual path on the filesystem.
   */
  private denormalizePath(normalizedPath: string): string {
    if (!normalizedPath.startsWith("-")) {
      return normalizedPath;
    }

    // Remove leading dash
    const pathWithoutPrefix = normalizedPath.slice(1);

    // Try to find the actual path by checking filesystem
    // Start with root and try to match each segment
    const segments = pathWithoutPrefix.split("-");

    // Check if it starts with Users (macOS) or home (Linux)
    if (segments[0] !== "Users" && segments[0] !== "home") {
      // Unknown format, return as-is with slashes
      return "/" + segments.join("/");
    }

    // Try to reconstruct the path by checking what exists on filesystem
    let currentPath = "/" + segments[0]; // /Users or /home
    let segmentIndex = 1;

    while (segmentIndex < segments.length) {
      // Try to find a matching directory by combining segments
      let found = false;

      // Try combining progressively more segments with dashes
      for (let endIndex = segmentIndex; endIndex < segments.length; endIndex++) {
        const candidateSegment = segments.slice(segmentIndex, endIndex + 1).join("-");
        const candidatePath = currentPath + "/" + candidateSegment;

        try {
          if (fs.existsSync(candidatePath)) {
            currentPath = candidatePath;
            segmentIndex = endIndex + 1;
            found = true;
            break;
          }
        } catch {
          // Ignore access errors
        }
      }

      if (!found) {
        // No match found, use single segment
        currentPath = currentPath + "/" + segments[segmentIndex];
        segmentIndex++;
      }
    }

    return currentPath;
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
    const teams = await this.fetchUserTeams(accessToken, apiEndpoint);
    if (!teams || teams.length === 0) {
      return null;
    }
    return teams[0].id;
  }

  /**
   * Fetch all teams the user belongs to.
   * Returns array of teams with id and name.
   */
  async fetchUserTeams(
    accessToken?: string,
    apiEndpoint?: string
  ): Promise<Array<{ id: string; name: string }> | null> {
    try {
      // Get auth info if not provided
      if (!accessToken) {
        const isAuth = await this.authService.isAuthenticated();
        if (!isAuth) {
          this.log("Not authenticated - cannot fetch teams");
          return null;
        }
        accessToken = (await this.authService.getAccessToken()) || undefined;
        if (!accessToken) {
          this.log("Could not get access token");
          return null;
        }
      }

      if (!apiEndpoint) {
        apiEndpoint = this.settingsService.apiEndpoint;
      }

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

      this.log(`Found ${teams.length} team(s)`);
      return teams;
    } catch (error) {
      this.logError("Failed to fetch user teams", error);
      return null;
    }
  }

  /**
   * Fetch all projects for all teams the user is a member of.
   * Returns teams with their projects for grouped display.
   */
  async fetchAllTeamProjects(
    accessToken?: string,
    apiEndpoint?: string
  ): Promise<Array<{
    id: string;
    name: string;
    projects: Array<{ id: string; name: string }>;
  }> | null> {
    try {
      // Get auth info if not provided
      if (!accessToken) {
        const isAuth = await this.authService.isAuthenticated();
        if (!isAuth) {
          this.log("Not authenticated - cannot fetch projects");
          return null;
        }
        accessToken = (await this.authService.getAccessToken()) || undefined;
        if (!accessToken) {
          this.log("Could not get access token");
          return null;
        }
      }

      if (!apiEndpoint) {
        apiEndpoint = this.settingsService.apiEndpoint;
      }

      // Use extension-specific endpoint that accepts VS Code tokens
      const response = await fetch(`${apiEndpoint}/extension/team-projects`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        this.log(`Failed to fetch projects: ${response.status}`);
        return null;
      }

      const data = (await response.json()) as {
        success?: boolean;
        teams?: Array<{
          id: string;
          name: string;
          projects: Array<{ id: string; name: string }>;
        }>;
      };

      const teams = data.teams;

      if (!teams) {
        this.log("No teams found");
        return [];
      }

      const totalProjects = teams.reduce((sum, t) => sum + t.projects.length, 0);
      this.log(`Found ${teams.length} team(s) with ${totalProjects} project(s) total`);
      return teams;
    } catch (error) {
      this.logError("Failed to fetch team projects", error);
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
