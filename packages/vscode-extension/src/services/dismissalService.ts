/**
 * Dismissal Service - Story 18-4
 *
 * Tracks dismissed session notifications to prevent re-notification.
 * Sessions are automatically re-eligible for notification after 7 days.
 *
 * Features:
 * - Persists dismissed sessions in VS Code globalState
 * - 7-day expiration for dismissals
 * - Cleanup of expired dismissals on startup
 * - Bulk dismiss for multiple sessions
 */

import type * as vscode from "vscode";

/**
 * A dismissed session record.
 */
export interface DismissedSession {
  /** Session ID that was dismissed */
  sessionId: string;
  /** Timestamp when the session was dismissed */
  dismissedAt: number;
  /** When this dismissal expires (7 days from dismissedAt) */
  expiresAt: number;
}

/**
 * Storage format for dismissed sessions.
 */
export interface DismissedSessionsStorage {
  /** Map of sessionId to dismissal record */
  sessions: Record<string, DismissedSession>;
  /** Last cleanup timestamp */
  lastCleanup: number;
}

/**
 * Configuration for the dismissal service.
 */
export interface DismissalServiceConfig {
  /** Days until a dismissal expires */
  expiryDays?: number;
  /** Storage key for dismissed sessions */
  storageKey?: string;
}

/**
 * Default dismissal service configuration.
 */
export const DEFAULT_DISMISSAL_CONFIG: Required<DismissalServiceConfig> = {
  expiryDays: 7,
  storageKey: "contextor.dismissedSessions",
};

/**
 * DismissalService tracks which sessions have been dismissed
 * to prevent repeated notifications.
 */
export class DismissalService implements vscode.Disposable {
  private readonly context: vscode.ExtensionContext;
  private readonly config: Required<DismissalServiceConfig>;
  private outputChannel: vscode.OutputChannel | null = null;
  private cache: DismissedSessionsStorage | null = null;

  constructor(
    context: vscode.ExtensionContext,
    config?: DismissalServiceConfig
  ) {
    this.context = context;
    this.config = {
      ...DEFAULT_DISMISSAL_CONFIG,
      ...config,
    };
  }

  /**
   * Sets the output channel for logging.
   */
  initialize(outputChannel: vscode.OutputChannel): void {
    this.outputChannel = outputChannel;
    this.log("DismissalService initialized");
  }

  /**
   * Disposes of resources.
   */
  dispose(): void {
    this.cache = null;
  }

  /**
   * Dismisses a session, preventing re-notification for 7 days.
   *
   * @param sessionId - The session ID to dismiss
   */
  async dismissSession(sessionId: string): Promise<void> {
    const storage = await this.getStorage();
    const now = Date.now();
    const expiryMs = this.config.expiryDays * 24 * 60 * 60 * 1000;

    storage.sessions[sessionId] = {
      sessionId,
      dismissedAt: now,
      expiresAt: now + expiryMs,
    };

    await this.saveStorage(storage);
    this.log(`Dismissed session: ${sessionId}`);
  }

  /**
   * Dismisses multiple sessions at once.
   *
   * @param sessionIds - The session IDs to dismiss
   */
  async dismissSessions(sessionIds: string[]): Promise<void> {
    if (sessionIds.length === 0) return;

    const storage = await this.getStorage();
    const now = Date.now();
    const expiryMs = this.config.expiryDays * 24 * 60 * 60 * 1000;

    for (const sessionId of sessionIds) {
      storage.sessions[sessionId] = {
        sessionId,
        dismissedAt: now,
        expiresAt: now + expiryMs,
      };
    }

    await this.saveStorage(storage);
    this.log(`Dismissed ${sessionIds.length} session(s)`);
  }

  /**
   * Checks if a session is currently dismissed.
   *
   * @param sessionId - The session ID to check
   * @returns Whether the session is dismissed
   */
  isDismissed(sessionId: string): boolean {
    const storage = this.getCachedStorage();
    if (!storage) return false;

    const dismissal = storage.sessions[sessionId];
    if (!dismissal) return false;

    // Check if dismissal has expired
    if (Date.now() > dismissal.expiresAt) {
      return false;
    }

    return true;
  }

  /**
   * Filters sessions to only include those that are not dismissed.
   *
   * @param sessions - Sessions to filter
   * @returns Sessions that are not currently dismissed
   */
  filterDismissed<T extends { sessionId: string }>(sessions: T[]): T[] {
    return sessions.filter((session) => !this.isDismissed(session.sessionId));
  }

  /**
   * Gets all currently dismissed session IDs.
   *
   * @returns Array of dismissed session IDs
   */
  getDismissedSessionIds(): string[] {
    const storage = this.getCachedStorage();
    if (!storage) return [];

    const now = Date.now();
    return Object.values(storage.sessions)
      .filter((d) => d.expiresAt > now)
      .map((d) => d.sessionId);
  }

  /**
   * Undismisses a session (for testing or manual override).
   *
   * @param sessionId - The session ID to undismiss
   */
  async undismissSession(sessionId: string): Promise<boolean> {
    const storage = await this.getStorage();

    if (!storage.sessions[sessionId]) {
      return false;
    }

    delete storage.sessions[sessionId];
    await this.saveStorage(storage);
    this.log(`Undismissed session: ${sessionId}`);
    return true;
  }

  /**
   * Cleans up expired dismissals.
   * Called automatically on startup.
   *
   * @returns Number of expired dismissals removed
   */
  async cleanExpired(): Promise<number> {
    const storage = await this.getStorage();
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, dismissal] of Object.entries(storage.sessions)) {
      if (dismissal.expiresAt < now) {
        delete storage.sessions[sessionId];
        cleaned++;
      }
    }

    if (cleaned > 0) {
      storage.lastCleanup = now;
      await this.saveStorage(storage);
      this.log(`Cleaned ${cleaned} expired dismissal(s)`);
    }

    return cleaned;
  }

  /**
   * Clears all dismissals (for testing).
   *
   * @returns Number of dismissals cleared
   */
  async clearAll(): Promise<number> {
    const storage = await this.getStorage();
    const count = Object.keys(storage.sessions).length;

    await this.saveStorage({
      sessions: {},
      lastCleanup: Date.now(),
    });

    this.log(`Cleared all ${count} dismissal(s)`);
    return count;
  }

  /**
   * Gets storage statistics.
   */
  getStats(): {
    totalDismissed: number;
    expiredCount: number;
    activeCount: number;
  } {
    const storage = this.getCachedStorage();
    if (!storage) {
      return { totalDismissed: 0, expiredCount: 0, activeCount: 0 };
    }

    const now = Date.now();
    let expired = 0;
    let active = 0;

    for (const dismissal of Object.values(storage.sessions)) {
      if (dismissal.expiresAt < now) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      totalDismissed: Object.keys(storage.sessions).length,
      expiredCount: expired,
      activeCount: active,
    };
  }

  /**
   * Gets storage from globalState.
   */
  private async getStorage(): Promise<DismissedSessionsStorage> {
    const stored = this.context.globalState.get<DismissedSessionsStorage>(
      this.config.storageKey
    );

    if (stored) {
      this.cache = stored;
      return stored;
    }

    const empty: DismissedSessionsStorage = {
      sessions: {},
      lastCleanup: Date.now(),
    };
    this.cache = empty;
    return empty;
  }

  /**
   * Gets cached storage synchronously (may be stale).
   */
  private getCachedStorage(): DismissedSessionsStorage | null {
    if (this.cache) {
      return this.cache;
    }

    // Try to load synchronously from globalState
    const stored = this.context.globalState.get<DismissedSessionsStorage>(
      this.config.storageKey
    );

    if (stored) {
      this.cache = stored;
      return stored;
    }

    return null;
  }

  /**
   * Saves storage to globalState.
   */
  private async saveStorage(storage: DismissedSessionsStorage): Promise<void> {
    this.cache = storage;
    await this.context.globalState.update(this.config.storageKey, storage);
  }

  /**
   * Logs a message to the output channel.
   */
  private log(message: string): void {
    if (this.outputChannel) {
      const timestamp = new Date().toISOString();
      this.outputChannel.appendLine(
        `[${timestamp}] [DismissalService] ${message}`
      );
    }
  }
}

/**
 * Creates a DismissalService instance.
 */
export function createDismissalService(
  context: vscode.ExtensionContext,
  config?: DismissalServiceConfig
): DismissalService {
  return new DismissalService(context, config);
}
