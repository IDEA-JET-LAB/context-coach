/**
 * Recovery Prompt Cache Service - Story 18-3
 *
 * Caches generated recovery prompts to avoid redundant API calls.
 * Uses VS Code's globalState for persistence with 1-hour expiration.
 *
 * Features:
 * - Cache by sessionId + snapshot hash
 * - Automatic expiration after 1 hour
 * - Regenerates if snapshot changes
 * - Cleanup of expired entries
 */

import * as crypto from "crypto";
import type * as vscode from "vscode";
import type { SessionStateSnapshot } from "../types/sessionState";
import {
  RecoveryPrompt,
  SerializedRecoveryPromptCacheEntry,
  RECOVERY_CONSTANTS,
} from "../types/recovery";

/**
 * RecoveryPromptCache manages caching of generated recovery prompts.
 */
export class RecoveryPromptCache {
  private readonly context: vscode.ExtensionContext;
  private outputChannel: vscode.OutputChannel | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Sets the output channel for logging.
   */
  initialize(outputChannel: vscode.OutputChannel): void {
    this.outputChannel = outputChannel;
    this.log("RecoveryPromptCache initialized");
  }

  /**
   * Gets a cached recovery prompt for a session.
   * Returns null if not cached, expired, or snapshot has changed.
   *
   * @param sessionId - The session ID to get the cached prompt for
   * @param currentSnapshot - The current snapshot to compare hash against
   * @returns The cached recovery prompt or null
   */
  get(
    sessionId: string,
    currentSnapshot: SessionStateSnapshot
  ): RecoveryPrompt | null {
    const key = this.getStorageKey(sessionId);
    const serialized =
      this.context.globalState.get<SerializedRecoveryPromptCacheEntry>(key);

    if (!serialized) {
      return null;
    }

    // Check if expired
    const expiresAt = new Date(serialized.expiresAt);
    if (expiresAt < new Date()) {
      this.log(`Cache entry expired for session: ${sessionId}`);
      return null;
    }

    // Check if snapshot has changed
    const currentHash = this.computeSnapshotHash(currentSnapshot);
    if (currentHash !== serialized.snapshotHash) {
      this.log(`Snapshot changed for session: ${sessionId}, cache invalidated`);
      return null;
    }

    // Deserialize and return
    return {
      sessionId: serialized.prompt.sessionId,
      prompt: serialized.prompt.prompt,
      generatedAt: new Date(serialized.prompt.generatedAt),
      isAIGenerated: serialized.prompt.isAIGenerated,
    };
  }

  /**
   * Caches a recovery prompt for a session.
   *
   * @param prompt - The recovery prompt to cache
   * @param snapshot - The snapshot used to generate this prompt
   */
  async set(
    prompt: RecoveryPrompt,
    snapshot: SessionStateSnapshot
  ): Promise<void> {
    const key = this.getStorageKey(prompt.sessionId);
    const snapshotHash = this.computeSnapshotHash(snapshot);
    const expiresAt = new Date(Date.now() + RECOVERY_CONSTANTS.CACHE_EXPIRY_MS);

    const entry: SerializedRecoveryPromptCacheEntry = {
      prompt: {
        sessionId: prompt.sessionId,
        prompt: prompt.prompt,
        generatedAt: prompt.generatedAt.toISOString(),
        isAIGenerated: prompt.isAIGenerated,
      },
      snapshotHash,
      expiresAt: expiresAt.toISOString(),
    };

    await this.context.globalState.update(key, entry);
    this.log(`Cached recovery prompt for session: ${prompt.sessionId}`);
  }

  /**
   * Deletes a cached recovery prompt.
   *
   * @param sessionId - The session ID to delete the cache for
   * @returns true if an entry was deleted, false otherwise
   */
  async delete(sessionId: string): Promise<boolean> {
    const key = this.getStorageKey(sessionId);
    const exists =
      this.context.globalState.get<SerializedRecoveryPromptCacheEntry>(key);

    if (!exists) {
      return false;
    }

    await this.context.globalState.update(key, undefined);
    this.log(`Deleted cache entry for session: ${sessionId}`);
    return true;
  }

  /**
   * Checks if a valid (non-expired) cache entry exists for a session.
   *
   * @param sessionId - The session ID to check
   * @param currentSnapshot - The current snapshot to compare hash against
   * @returns true if a valid cache entry exists
   */
  has(sessionId: string, currentSnapshot: SessionStateSnapshot): boolean {
    return this.get(sessionId, currentSnapshot) !== null;
  }

  /**
   * Cleans up expired cache entries.
   * Returns the number of cleaned up entries.
   */
  async cleanExpiredEntries(): Promise<number> {
    const allKeys = this.context.globalState.keys();
    const cacheKeys = allKeys.filter((key) =>
      key.startsWith(RECOVERY_CONSTANTS.CACHE_STORAGE_PREFIX)
    );

    let cleaned = 0;
    const now = new Date();

    for (const key of cacheKeys) {
      const serialized =
        this.context.globalState.get<SerializedRecoveryPromptCacheEntry>(key);

      if (serialized) {
        const expiresAt = new Date(serialized.expiresAt);
        if (expiresAt < now) {
          await this.context.globalState.update(key, undefined);
          cleaned++;
        }
      }
    }

    if (cleaned > 0) {
      this.log(`Cleaned up ${cleaned} expired cache entries`);
    }

    return cleaned;
  }

  /**
   * Clears all cached recovery prompts.
   * Returns the number of cleared entries.
   */
  async clearAll(): Promise<number> {
    const allKeys = this.context.globalState.keys();
    const cacheKeys = allKeys.filter((key) =>
      key.startsWith(RECOVERY_CONSTANTS.CACHE_STORAGE_PREFIX)
    );

    for (const key of cacheKeys) {
      await this.context.globalState.update(key, undefined);
    }

    if (cacheKeys.length > 0) {
      this.log(`Cleared ${cacheKeys.length} cache entries`);
    }

    return cacheKeys.length;
  }

  /**
   * Gets cache statistics.
   */
  getStats(): {
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
  } {
    const allKeys = this.context.globalState.keys();
    const cacheKeys = allKeys.filter((key) =>
      key.startsWith(RECOVERY_CONSTANTS.CACHE_STORAGE_PREFIX)
    );

    let valid = 0;
    let expired = 0;
    const now = new Date();

    for (const key of cacheKeys) {
      const serialized =
        this.context.globalState.get<SerializedRecoveryPromptCacheEntry>(key);

      if (serialized) {
        const expiresAt = new Date(serialized.expiresAt);
        if (expiresAt > now) {
          valid++;
        } else {
          expired++;
        }
      }
    }

    return {
      totalEntries: cacheKeys.length,
      validEntries: valid,
      expiredEntries: expired,
    };
  }

  /**
   * Computes a hash of a snapshot for cache invalidation.
   * Uses key snapshot properties that would affect the recovery prompt.
   */
  private computeSnapshotHash(snapshot: SessionStateSnapshot): string {
    // Create a deterministic representation of the snapshot
    const hashInput = {
      sessionId: snapshot.sessionId,
      messageCount: snapshot.recentMessages.length,
      // Include first and last message content for change detection
      firstMessage: snapshot.recentMessages[0]?.content.slice(0, 200) || "",
      lastMessage:
        snapshot.recentMessages[snapshot.recentMessages.length - 1]?.content.slice(
          0,
          200
        ) || "",
      // Include file count and tool count
      filesCount: snapshot.filesAffected.length,
      toolsCount: snapshot.toolsUsed.length,
      // Include current task for context changes
      currentTask: snapshot.conversationContext.currentTask.slice(0, 200),
    };

    const jsonString = JSON.stringify(hashInput);
    return crypto.createHash("md5").update(jsonString).digest("hex").slice(0, 12);
  }

  /**
   * Gets the storage key for a session ID.
   */
  private getStorageKey(sessionId: string): string {
    return `${RECOVERY_CONSTANTS.CACHE_STORAGE_PREFIX}${sessionId}`;
  }

  /**
   * Logs a message to the output channel.
   */
  private log(message: string): void {
    if (this.outputChannel) {
      const timestamp = new Date().toISOString();
      this.outputChannel.appendLine(
        `[${timestamp}] [RecoveryPromptCache] ${message}`
      );
    }
  }
}

/**
 * Creates a RecoveryPromptCache instance.
 */
export function createRecoveryPromptCache(
  context: vscode.ExtensionContext
): RecoveryPromptCache {
  return new RecoveryPromptCache(context);
}
