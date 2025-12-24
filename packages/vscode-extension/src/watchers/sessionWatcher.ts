/**
 * Session Watcher - Story 18-4
 *
 * Monitors ~/.claude/projects/ for changes to session files.
 * Notifies when sessions become stale (inactive for 15+ minutes).
 *
 * Features:
 * - File system watcher for JSONL session files
 * - Debounced change notifications (10 second cooldown)
 * - Tracks active sessions to detect when they become stale
 * - Configurable stale threshold
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * Session watcher configuration.
 */
export interface SessionWatcherConfig {
  /** Cooldown period between notifications in milliseconds */
  debounceCooldownMs?: number;
  /** Threshold in minutes before a session is considered stale */
  staleThresholdMinutes?: number;
  /** Base directory to watch (default: ~/.claude/projects) */
  baseDir?: string;
}

/**
 * Default session watcher configuration.
 */
export const DEFAULT_WATCHER_CONFIG: Required<SessionWatcherConfig> = {
  debounceCooldownMs: 10000, // 10 seconds
  staleThresholdMinutes: 15,
  baseDir: path.join(os.homedir(), ".claude", "projects"),
};

/**
 * Information about an active session being tracked.
 */
interface TrackedSession {
  /** Path to the session file */
  sessionPath: string;
  /** Session ID (filename without extension) */
  sessionId: string;
  /** Last modification time */
  lastModified: Date;
  /** Timer for checking stale status */
  staleTimer?: ReturnType<typeof setTimeout>;
}

/**
 * SessionWatcher monitors for new and stale Claude Code sessions.
 */
export class SessionWatcher implements vscode.Disposable {
  private readonly config: Required<SessionWatcherConfig>;
  private outputChannel: vscode.OutputChannel | null = null;
  private readonly disposables: vscode.Disposable[] = [];

  /** File system watcher */
  private watcher: vscode.FileSystemWatcher | null = null;

  /** Map of tracked sessions by path */
  private readonly trackedSessions = new Map<string, TrackedSession>();

  /** Last time we fired a change notification */
  private lastChangeTime = 0;

  /** Timer for debounced change notification */
  private debounceTimer?: ReturnType<typeof setTimeout>;

  /** Callback for when session changes are detected */
  private onChangeCallback: (() => void) | null = null;

  /** Callback for when a session becomes stale */
  private onStaleCallback: ((sessionPath: string) => void) | null = null;

  constructor(config?: SessionWatcherConfig) {
    this.config = {
      ...DEFAULT_WATCHER_CONFIG,
      ...config,
    };
  }

  /**
   * Sets the output channel for logging.
   */
  initialize(outputChannel: vscode.OutputChannel): void {
    this.outputChannel = outputChannel;
    this.log("SessionWatcher initialized");
  }

  /**
   * Starts watching for session file changes.
   */
  start(): void {
    if (this.watcher) {
      this.log("Watcher already started");
      return;
    }

    // Check if the base directory exists
    if (!fs.existsSync(this.config.baseDir)) {
      this.log(`Base directory does not exist: ${this.config.baseDir}`);
      return;
    }

    // Create file system watcher for JSONL files in the projects directory
    const pattern = new vscode.RelativePattern(
      this.config.baseDir,
      "**/*.jsonl"
    );

    this.watcher = vscode.workspace.createFileSystemWatcher(
      pattern,
      false, // create events
      false, // change events
      false  // delete events
    );

    // Handle file creation (new sessions)
    this.watcher.onDidCreate((uri) => {
      this.handleSessionChange(uri.fsPath, "created");
    });

    // Handle file changes (session activity)
    this.watcher.onDidChange((uri) => {
      this.handleSessionChange(uri.fsPath, "changed");
    });

    // Handle file deletion (session cleanup)
    this.watcher.onDidDelete((uri) => {
      this.handleSessionDelete(uri.fsPath);
    });

    this.disposables.push(this.watcher);

    // Initial scan of existing sessions
    this.scanExistingSessions();

    this.log(`Started watching: ${this.config.baseDir}`);
  }

  /**
   * Stops watching for session file changes.
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.dispose();
      this.watcher = null;
    }

    // Clear all stale timers
    for (const session of this.trackedSessions.values()) {
      if (session.staleTimer) {
        clearTimeout(session.staleTimer);
      }
    }
    this.trackedSessions.clear();

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }

    this.log("Stopped watching");
  }

  /**
   * Disposes of resources.
   */
  dispose(): void {
    this.stop();
    this.disposables.forEach((d) => d.dispose());
    this.disposables.length = 0;
    this.onChangeCallback = null;
    this.onStaleCallback = null;
  }

  /**
   * Registers a callback for when session changes are detected.
   * This is debounced to prevent spam.
   */
  onSessionChange(callback: () => void): void {
    this.onChangeCallback = callback;
  }

  /**
   * Registers a callback for when a session becomes stale.
   */
  onSessionStale(callback: (sessionPath: string) => void): void {
    this.onStaleCallback = callback;
  }

  /**
   * Gets the list of currently tracked session paths.
   */
  getTrackedSessions(): string[] {
    return Array.from(this.trackedSessions.keys());
  }

  /**
   * Handles a session file creation or change.
   */
  private handleSessionChange(sessionPath: string, event: "created" | "changed"): void {
    const sessionId = this.extractSessionId(sessionPath);

    // Update or create tracked session
    const existing = this.trackedSessions.get(sessionPath);

    if (existing?.staleTimer) {
      clearTimeout(existing.staleTimer);
    }

    const session: TrackedSession = {
      sessionPath,
      sessionId,
      lastModified: new Date(),
    };

    // Set up stale timer
    session.staleTimer = setTimeout(() => {
      this.handleSessionStale(sessionPath);
    }, this.config.staleThresholdMinutes * 60 * 1000);

    this.trackedSessions.set(sessionPath, session);

    this.log(`Session ${event}: ${sessionId}`);

    // Trigger debounced change notification
    this.triggerChangeNotification();
  }

  /**
   * Handles a session file deletion.
   */
  private handleSessionDelete(sessionPath: string): void {
    const session = this.trackedSessions.get(sessionPath);

    if (session) {
      if (session.staleTimer) {
        clearTimeout(session.staleTimer);
      }
      this.trackedSessions.delete(sessionPath);
      this.log(`Session deleted: ${session.sessionId}`);
    }

    // Trigger debounced change notification
    this.triggerChangeNotification();
  }

  /**
   * Handles when a session becomes stale.
   */
  private handleSessionStale(sessionPath: string): void {
    const session = this.trackedSessions.get(sessionPath);

    if (!session) return;

    this.log(`Session became stale: ${session.sessionId}`);

    // Clear the timer
    if (session.staleTimer) {
      clearTimeout(session.staleTimer);
      session.staleTimer = undefined;
    }

    // Notify callback
    this.onStaleCallback?.(sessionPath);
  }

  /**
   * Triggers a debounced change notification.
   */
  private triggerChangeNotification(): void {
    const now = Date.now();

    // Check cooldown
    if (now - this.lastChangeTime < this.config.debounceCooldownMs) {
      // Schedule a notification after cooldown
      if (!this.debounceTimer) {
        const remaining = this.config.debounceCooldownMs - (now - this.lastChangeTime);
        this.debounceTimer = setTimeout(() => {
          this.debounceTimer = undefined;
          this.fireChangeNotification();
        }, remaining);
      }
      return;
    }

    this.fireChangeNotification();
  }

  /**
   * Fires the change notification callback.
   */
  private fireChangeNotification(): void {
    this.lastChangeTime = Date.now();
    this.onChangeCallback?.();
  }

  /**
   * Scans existing sessions on startup.
   */
  private scanExistingSessions(): void {
    try {
      const entries = fs.readdirSync(this.config.baseDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith(".") && !entry.name.startsWith("-")) continue;

        const projectDir = path.join(this.config.baseDir, entry.name);

        try {
          const projectEntries = fs.readdirSync(projectDir, { withFileTypes: true });

          for (const projectEntry of projectEntries) {
            if (projectEntry.isFile() && projectEntry.name.endsWith(".jsonl")) {
              const sessionPath = path.join(projectDir, projectEntry.name);
              this.initializeTrackedSession(sessionPath);
            }
          }
        } catch {
          // Skip directories we can't read
        }
      }

      this.log(`Scanned ${this.trackedSessions.size} existing session(s)`);
    } catch (error) {
      this.log(
        `Error scanning existing sessions: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Initializes tracking for an existing session.
   */
  private initializeTrackedSession(sessionPath: string): void {
    try {
      const stat = fs.statSync(sessionPath);
      const sessionId = this.extractSessionId(sessionPath);
      const age = Date.now() - stat.mtime.getTime();
      const staleThresholdMs = this.config.staleThresholdMinutes * 60 * 1000;

      // Only track sessions that are still within the stale threshold
      if (age < staleThresholdMs) {
        const session: TrackedSession = {
          sessionPath,
          sessionId,
          lastModified: stat.mtime,
        };

        // Set up stale timer for remaining time
        const remainingTime = staleThresholdMs - age;
        session.staleTimer = setTimeout(() => {
          this.handleSessionStale(sessionPath);
        }, remainingTime);

        this.trackedSessions.set(sessionPath, session);
      }
    } catch {
      // Skip sessions we can't stat
    }
  }

  /**
   * Extracts session ID from a file path.
   */
  private extractSessionId(sessionPath: string): string {
    const basename = path.basename(sessionPath);
    return basename.replace(/\.jsonl$/, "");
  }

  /**
   * Logs a message to the output channel.
   */
  private log(message: string): void {
    if (this.outputChannel) {
      const timestamp = new Date().toISOString();
      this.outputChannel.appendLine(
        `[${timestamp}] [SessionWatcher] ${message}`
      );
    }
  }
}

/**
 * Creates a SessionWatcher instance.
 */
export function createSessionWatcher(
  config?: SessionWatcherConfig
): SessionWatcher {
  return new SessionWatcher(config);
}
