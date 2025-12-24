/**
 * Session Recovery Service - Story 18-1 (Simplified)
 *
 * Lists recent Claude Code sessions for recovery.
 * Scans ~/.claude/projects/ for JSONL session files and returns the most recent ones.
 *
 * Features:
 * - Streaming JSONL parsing (memory efficient)
 * - Configurable session limit and max age
 * - Extracts slug, last prompt, cwd, and git branch
 * - Event emission for detected sessions
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as readline from "readline";
import type {
  InterruptedSession,
  CrashDetectorOptions,
  CrashDetectionResult,
  SessionScanResult,
  SessionAnalysis,
  TranscriptMessage,
} from "../types/interruptedSession";
import { DEFAULT_CRASH_DETECTION_CONFIG } from "../types/interruptedSession";

/** Default directory name for Claude projects */
const CLAUDE_PROJECTS_DIR = ".claude/projects";

/** Maximum length for truncated prompts */
const MAX_PROMPT_LENGTH = 100;

/**
 * CrashDetector provides functionality to list recent Claude Code sessions.
 * Uses singleton pattern for global access throughout the extension.
 */
export class CrashDetector implements vscode.Disposable {
  private static instance: CrashDetector | null = null;
  private readonly disposables: vscode.Disposable[] = [];
  private outputChannel: vscode.OutputChannel | null = null;

  /** Event emitter for when sessions are detected */
  private readonly _onSessionsDetected =
    new vscode.EventEmitter<InterruptedSession[]>();

  /** Event that fires when sessions are detected */
  readonly onSessionsDetected = this._onSessionsDetected.event;

  /** Cache of last scan results */
  private lastScanResult: CrashDetectionResult | null = null;

  /** Flag to prevent concurrent scans */
  private scanInProgress = false;

  private constructor() {
    this.disposables.push(this._onSessionsDetected);
  }

  /**
   * Gets the singleton instance of CrashDetector.
   */
  static getInstance(): CrashDetector {
    if (!CrashDetector.instance) {
      CrashDetector.instance = new CrashDetector();
    }
    return CrashDetector.instance;
  }

  /**
   * Resets the singleton instance (for testing).
   */
  static resetInstance(): void {
    if (CrashDetector.instance) {
      CrashDetector.instance.dispose();
      CrashDetector.instance = null;
    }
  }

  /**
   * Initializes the service with an output channel for logging.
   */
  initialize(outputChannel: vscode.OutputChannel): void {
    this.outputChannel = outputChannel;
    this.log("CrashDetector initialized");
  }

  /**
   * Cleans up resources when the service is disposed.
   */
  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables.length = 0;
    this.lastScanResult = null;
    CrashDetector.instance = null;
  }

  /**
   * Gets configuration values from VS Code settings.
   */
  private getConfig(): Required<CrashDetectorOptions> {
    const config = vscode.workspace.getConfiguration("contextor");
    return {
      recentSessionsLimit: config.get<number>(
        "crashDetection.recentSessionsLimit",
        DEFAULT_CRASH_DETECTION_CONFIG.recentSessionsLimit
      ),
      maxAge: config.get<number>(
        "crashDetection.maxAge",
        DEFAULT_CRASH_DETECTION_CONFIG.maxAge
      ),
      baseDir: getClaudeProjectsDir(),
      fileTimeout: DEFAULT_CRASH_DETECTION_CONFIG.fileTimeout,
      concurrency: DEFAULT_CRASH_DETECTION_CONFIG.concurrency,
    };
  }

  /**
   * Gets recent sessions for recovery.
   *
   * @param options - Optional override for default configuration
   * @returns Detection result with recent sessions
   */
  async detectInterruptedSessions(
    options?: CrashDetectorOptions
  ): Promise<CrashDetectionResult> {
    // Prevent concurrent scans
    if (this.scanInProgress) {
      this.log("Scan already in progress, returning cached result");
      return (
        this.lastScanResult || {
          interruptedSessions: [],
          totalFilesScanned: 0,
          failedFiles: 0,
          skippedFiles: 0,
          durationMs: 0,
          scannedAt: new Date(),
          errors: ["Scan already in progress"],
        }
      );
    }

    this.scanInProgress = true;
    const startTime = Date.now();

    const config = {
      ...this.getConfig(),
      ...options,
    };

    this.log(
      `Starting session scan (limit: ${config.recentSessionsLimit}, maxAge: ${config.maxAge}min)`
    );

    const result: CrashDetectionResult = {
      interruptedSessions: [],
      totalFilesScanned: 0,
      failedFiles: 0,
      skippedFiles: 0,
      durationMs: 0,
      scannedAt: new Date(),
      errors: [],
    };

    try {
      // Check if Claude projects directory exists
      const claudeDir = config.baseDir || getClaudeProjectsDir();

      if (!directoryExistsSync(claudeDir)) {
        this.log(`Claude projects directory not found: ${claudeDir}`);
        result.durationMs = Date.now() - startTime;
        this.lastScanResult = result;
        this.scanInProgress = false;
        return result;
      }

      // Collect all JSONL files with their modification times
      const jsonlFiles = await this.collectJsonlFilesWithStats(claudeDir);
      this.log(`Found ${jsonlFiles.length} JSONL files`);

      // Calculate max age boundary
      const now = Date.now();
      const maxAgeMs = config.maxAge * 60 * 1000;

      // Filter by age and sort by most recent first
      const recentFiles = jsonlFiles
        .filter((f) => now - f.mtime.getTime() <= maxAgeMs)
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
        .slice(0, config.recentSessionsLimit);

      result.skippedFiles = jsonlFiles.length - recentFiles.length;
      result.totalFilesScanned = recentFiles.length;

      this.log(`Scanning ${recentFiles.length} most recent files`);

      // Scan the selected files
      const scanResults = await Promise.all(
        recentFiles.map((file) =>
          this.scanSingleFile(file.path, file.mtime, config.fileTimeout)
        )
      );

      // Process scan results
      for (const scanResult of scanResults) {
        if (scanResult.success && scanResult.session) {
          result.interruptedSessions.push(scanResult.session);
        } else if (scanResult.error) {
          result.failedFiles++;
          result.errors.push(scanResult.error);
        }
      }

      // Already sorted by mtime (most recent first)
      result.durationMs = Date.now() - startTime;
      this.lastScanResult = result;

      this.log(
        `Scan complete: found ${result.interruptedSessions.length} sessions in ${result.durationMs}ms`
      );

      // Emit event if we found sessions
      if (result.interruptedSessions.length > 0) {
        this._onSessionsDetected.fire(result.interruptedSessions);
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logError("Session scan failed", error);
      result.errors.push(`Scan failed: ${errorMessage}`);
      result.durationMs = Date.now() - startTime;
      this.lastScanResult = result;
      return result;
    } finally {
      this.scanInProgress = false;
    }
  }

  /**
   * Gets the cached last scan result.
   */
  getLastScanResult(): CrashDetectionResult | null {
    return this.lastScanResult;
  }

  /**
   * Checks if a scan is currently in progress.
   */
  isScanInProgress(): boolean {
    return this.scanInProgress;
  }

  /**
   * Collects all JSONL files from the Claude projects directory with stats.
   */
  private async collectJsonlFilesWithStats(
    baseDir: string
  ): Promise<Array<{ path: string; mtime: Date }>> {
    const jsonlFiles: Array<{ path: string; mtime: Date }> = [];

    try {
      const entries = await fs.promises.readdir(baseDir, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        // Skip hidden directories (except normalized paths which start with -)
        if (entry.name.startsWith(".") && !entry.name.startsWith("-")) continue;

        const projectDir = path.join(baseDir, entry.name);

        try {
          const projectEntries = await fs.promises.readdir(projectDir, {
            withFileTypes: true,
          });

          for (const projectEntry of projectEntries) {
            if (projectEntry.isFile() && projectEntry.name.endsWith(".jsonl")) {
              const filePath = path.join(projectDir, projectEntry.name);
              try {
                const stat = await fs.promises.stat(filePath);
                jsonlFiles.push({ path: filePath, mtime: stat.mtime });
              } catch {
                // Skip files we can't stat
              }
            }
          }
        } catch (error) {
          // Skip directories we can't read
          this.log(
            `Skipping project directory ${projectDir}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    } catch (error) {
      this.logError(`Failed to read base directory ${baseDir}`, error);
    }

    return jsonlFiles;
  }

  /**
   * Scans a single session file to extract metadata.
   */
  private async scanSingleFile(
    filePath: string,
    mtime: Date,
    timeout: number
  ): Promise<SessionScanResult> {
    try {
      // Use timeout wrapper
      const analysis = await Promise.race([
        this.analyzeSession(filePath),
        new Promise<SessionAnalysis>((_, reject) =>
          setTimeout(() => reject(new Error("File parsing timeout")), timeout)
        ),
      ]);

      if (!analysis.parseSuccess) {
        return {
          success: false,
          error: `Parse error in ${filePath}: ${analysis.parseError}`,
        };
      }

      // Skip sessions with no messages
      if (analysis.messageCount === 0) {
        return {
          success: false,
          error: "No messages in session",
        };
      }

      const sessionId = extractSessionId(filePath);

      return {
        success: true,
        session: {
          sessionPath: filePath,
          sessionId,
          slug: analysis.slug || sessionId,
          lastActivity: mtime,
          lastPrompt: analysis.lastPrompt,
          lastToolUsed: analysis.lastToolUsed,
          messageCount: analysis.messageCount,
          cwd: analysis.cwd,
          gitBranch: analysis.gitBranch,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Error scanning ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Analyzes a session file using streaming.
   * Extracts: slug, cwd, gitBranch (from first lines), lastPrompt (from end).
   */
  private async analyzeSession(filePath: string): Promise<SessionAnalysis> {
    return new Promise((resolve) => {
      let messageCount = 0;
      let lastPrompt = "";
      let lastToolUsed: string | null = null;
      let slug = "";
      let cwd: string | undefined;
      let gitBranch: string | undefined;
      let parseSuccess = true;
      let parseError: string | undefined;
      let metadataExtracted = false;

      const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity,
      });

      const cleanup = () => {
        rl.close();
        stream.destroy();
      };

      rl.on("line", (line) => {
        // Skip empty lines
        if (!line.trim()) return;

        try {
          const msg = JSON.parse(line) as TranscriptMessage & {
            slug?: string;
            cwd?: string;
            gitBranch?: string;
          };
          messageCount++;

          // Extract metadata from first messages (slug, cwd, gitBranch)
          if (!metadataExtracted) {
            if (msg.slug) slug = msg.slug;
            if (msg.cwd) cwd = msg.cwd;
            if (msg.gitBranch) gitBranch = msg.gitBranch;
            // After finding all metadata, stop looking
            if (slug && cwd) metadataExtracted = true;
          }

          // Track last user prompt
          if (msg.type === "user") {
            const content = extractUserContent(msg);
            if (content) {
              lastPrompt = truncateText(content, MAX_PROMPT_LENGTH);
            }
          } else if (msg.type === "tool_use" && msg.toolName) {
            lastToolUsed = msg.toolName;
          }
        } catch {
          // Skip malformed lines
        }
      });

      rl.on("close", () => {
        cleanup();
        resolve({
          messageCount,
          lastPrompt,
          lastToolUsed,
          slug,
          cwd,
          gitBranch,
          parseSuccess,
          parseError,
        });
      });

      rl.on("error", (err) => {
        cleanup();
        parseSuccess = false;
        parseError = err.message;
        resolve({
          messageCount: 0,
          lastPrompt: "",
          lastToolUsed: null,
          slug: "",
          parseSuccess: false,
          parseError: err.message,
        });
      });

      stream.on("error", (err) => {
        cleanup();
        parseSuccess = false;
        parseError = err.message;
        resolve({
          messageCount: 0,
          lastPrompt: "",
          lastToolUsed: null,
          slug: "",
          parseSuccess: false,
          parseError: err.message,
        });
      });
    });
  }

  /**
   * Logs a message to the output channel.
   */
  private log(message: string): void {
    if (this.outputChannel) {
      const timestamp = new Date().toISOString();
      this.outputChannel.appendLine(
        `[${timestamp}] [CrashDetector] ${message}`
      );
    }
  }

  /**
   * Logs an error to the output channel.
   */
  private logError(message: string, error: unknown): void {
    if (this.outputChannel) {
      const timestamp = new Date().toISOString();
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[${timestamp}] [CrashDetector] ERROR: ${message}: ${errorMessage}`
      );
    }
  }
}

/**
 * Gets the Claude projects directory path.
 */
export function getClaudeProjectsDir(baseDir?: string): string {
  if (baseDir) {
    return baseDir;
  }
  return path.join(os.homedir(), CLAUDE_PROJECTS_DIR);
}

/**
 * Extracts the session ID from a file path.
 * Typically the filename without extension.
 */
export function extractSessionId(filePath: string): string {
  const basename = path.basename(filePath);
  return basename.replace(/\.jsonl$/, "");
}

/**
 * Synchronously checks if a directory exists.
 */
export function directoryExistsSync(dirPath: string): boolean {
  try {
    const stat = fs.statSync(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Truncates text to a maximum length, adding ellipsis if needed.
 */
export function truncateText(text: string, maxLength: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return cleaned.slice(0, maxLength - 3) + "...";
}

/**
 * Extracts text content from a user message.
 * Handles both string content and array content formats.
 */
export function extractUserContent(msg: TranscriptMessage): string {
  const content = msg.content;

  if (typeof content === "string") {
    return content;
  }

  // Handle message wrapper format
  if (
    typeof content === "object" &&
    content !== null &&
    "message" in (content as Record<string, unknown>)
  ) {
    const message = (content as Record<string, unknown>)
      .message as Record<string, unknown>;
    const messageContent = message?.content;

    if (typeof messageContent === "string") {
      return messageContent;
    }

    if (Array.isArray(messageContent)) {
      return messageContent
        .filter(
          (c): c is { type: string; text: string } =>
            typeof c === "object" &&
            c !== null &&
            (c as Record<string, unknown>).type === "text"
        )
        .map((c) => c.text)
        .join("\n");
    }
  }

  if (Array.isArray(content)) {
    return content
      .filter(
        (c): c is { type: string; text: string } =>
          typeof c === "object" &&
          c !== null &&
          (c as Record<string, unknown>).type === "text"
      )
      .map((c) => c.text)
      .join("\n");
  }

  return "";
}

/**
 * Singleton export for convenience.
 */
export const crashDetector = CrashDetector.getInstance();
