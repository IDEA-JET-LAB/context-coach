/**
 * Recovery State Service - Story 18-5
 *
 * Tracks sessions that have been recovered to prevent
 * duplicate recovery attempts and manage the recovery panel UI.
 *
 * Features:
 * - Mark sessions as recovered
 * - Check if a session has been recovered
 * - Store recovery timestamps for analytics
 * - Persist state across VS Code sessions
 * - Clean up old recovered session records
 */

import type * as vscode from "vscode";

/**
 * Information about a recovered session.
 */
export interface RecoveredSession {
  /** Session ID that was recovered */
  sessionId: string;
  /** When the session was recovered (Unix timestamp) */
  recoveredAt: number;
  /** Method used for recovery */
  method: "clipboard" | "manual";
  /** Time from detection to recovery in milliseconds */
  timeToRecover?: number;
}

/**
 * Serialized recovered session for storage.
 */
interface SerializedRecoveredSession {
  sessionId: string;
  recoveredAt: number;
  method: "clipboard" | "manual";
  timeToRecover?: number;
}

/**
 * Storage prefix for recovered sessions.
 */
const STORAGE_PREFIX = "contextor.recovered.";

/**
 * How long to keep recovered session records (7 days in ms).
 */
const RETENTION_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * RecoveryState manages the state of recovered sessions.
 */
export class RecoveryState {
  private readonly context: vscode.ExtensionContext;
  private outputChannel: vscode.OutputChannel | null = null;

  /** In-memory cache of recovered sessions */
  private recoveredCache = new Map<string, RecoveredSession>();

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadFromStorage();
  }

  /**
   * Initializes the service with an output channel for logging.
   */
  initialize(outputChannel: vscode.OutputChannel): void {
    this.outputChannel = outputChannel;
    this.log("RecoveryState initialized");

    // Clean up old records on startup
    void this.cleanExpired();
  }

  /**
   * Marks a session as recovered.
   *
   * @param sessionId - The session ID to mark as recovered
   * @param method - The recovery method used
   * @param timeToRecover - Time from detection to recovery in ms
   */
  async markAsRecovered(
    sessionId: string,
    method: "clipboard" | "manual" = "clipboard",
    timeToRecover?: number
  ): Promise<void> {
    const recoveredSession: RecoveredSession = {
      sessionId,
      recoveredAt: Date.now(),
      method,
      timeToRecover,
    };

    // Update cache
    this.recoveredCache.set(sessionId, recoveredSession);

    // Persist to storage
    await this.saveToStorage(sessionId, recoveredSession);

    this.log(`Marked session as recovered: ${sessionId} (method: ${method})`);
  }

  /**
   * Checks if a session has been recovered.
   *
   * @param sessionId - The session ID to check
   * @returns True if the session has been recovered
   */
  isRecovered(sessionId: string): boolean {
    return this.recoveredCache.has(sessionId);
  }

  /**
   * Gets the recovery info for a session.
   *
   * @param sessionId - The session ID to get info for
   * @returns The recovery info or undefined if not recovered
   */
  getRecoveryInfo(sessionId: string): RecoveredSession | undefined {
    return this.recoveredCache.get(sessionId);
  }

  /**
   * Clears the recovered state for a session.
   *
   * @param sessionId - The session ID to clear
   */
  async clearRecoveredSession(sessionId: string): Promise<void> {
    this.recoveredCache.delete(sessionId);
    await this.removeFromStorage(sessionId);
    this.log(`Cleared recovered state for session: ${sessionId}`);
  }

  /**
   * Clears all recovered session records.
   *
   * @returns The number of records cleared
   */
  async clearAll(): Promise<number> {
    const count = this.recoveredCache.size;
    const sessionIds = Array.from(this.recoveredCache.keys());

    this.recoveredCache.clear();

    for (const sessionId of sessionIds) {
      await this.removeFromStorage(sessionId);
    }

    this.log(`Cleared ${count} recovered session record(s)`);
    return count;
  }

  /**
   * Gets all recovered sessions.
   *
   * @returns Array of recovered session records
   */
  getAllRecovered(): RecoveredSession[] {
    return Array.from(this.recoveredCache.values());
  }

  /**
   * Gets statistics about recovered sessions.
   */
  getStats(): {
    total: number;
    byMethod: Record<string, number>;
    averageTimeToRecover: number | null;
  } {
    const sessions = this.getAllRecovered();
    const byMethod: Record<string, number> = { clipboard: 0, manual: 0 };
    let totalTimeToRecover = 0;
    let countWithTime = 0;

    for (const session of sessions) {
      byMethod[session.method] = (byMethod[session.method] || 0) + 1;
      if (session.timeToRecover !== undefined) {
        totalTimeToRecover += session.timeToRecover;
        countWithTime++;
      }
    }

    return {
      total: sessions.length,
      byMethod,
      averageTimeToRecover:
        countWithTime > 0 ? totalTimeToRecover / countWithTime : null,
    };
  }

  /**
   * Cleans up expired recovered session records.
   *
   * @returns The number of expired records removed
   */
  async cleanExpired(): Promise<number> {
    const now = Date.now();
    const expiredIds: string[] = [];

    for (const [sessionId, session] of this.recoveredCache) {
      if (now - session.recoveredAt > RETENTION_PERIOD_MS) {
        expiredIds.push(sessionId);
      }
    }

    for (const sessionId of expiredIds) {
      this.recoveredCache.delete(sessionId);
      await this.removeFromStorage(sessionId);
    }

    if (expiredIds.length > 0) {
      this.log(`Cleaned up ${expiredIds.length} expired recovered session(s)`);
    }

    return expiredIds.length;
  }

  /**
   * Filters out recovered sessions from a list.
   *
   * @param sessions - Sessions to filter
   * @returns Sessions that have not been recovered
   */
  filterNotRecovered<T extends { sessionId: string }>(sessions: T[]): T[] {
    return sessions.filter((s) => !this.isRecovered(s.sessionId));
  }

  /**
   * Loads recovered sessions from storage into cache.
   */
  private loadFromStorage(): void {
    const keys = this.context.globalState.keys();

    for (const key of keys) {
      if (key.startsWith(STORAGE_PREFIX)) {
        const sessionId = key.substring(STORAGE_PREFIX.length);
        const data =
          this.context.globalState.get<SerializedRecoveredSession>(key);

        if (data) {
          this.recoveredCache.set(sessionId, data);
        }
      }
    }
  }

  /**
   * Saves a recovered session to storage.
   */
  private async saveToStorage(
    sessionId: string,
    session: RecoveredSession
  ): Promise<void> {
    const key = `${STORAGE_PREFIX}${sessionId}`;
    const serialized: SerializedRecoveredSession = {
      sessionId: session.sessionId,
      recoveredAt: session.recoveredAt,
      method: session.method,
      timeToRecover: session.timeToRecover,
    };

    await this.context.globalState.update(key, serialized);
  }

  /**
   * Removes a recovered session from storage.
   */
  private async removeFromStorage(sessionId: string): Promise<void> {
    const key = `${STORAGE_PREFIX}${sessionId}`;
    await this.context.globalState.update(key, undefined);
  }

  /**
   * Logs a message to the output channel.
   */
  private log(message: string): void {
    if (this.outputChannel) {
      const timestamp = new Date().toISOString();
      this.outputChannel.appendLine(
        `[${timestamp}] [RecoveryState] ${message}`
      );
    }
  }
}

/**
 * Creates a new RecoveryState instance.
 */
export function createRecoveryState(
  context: vscode.ExtensionContext
): RecoveryState {
  return new RecoveryState(context);
}
