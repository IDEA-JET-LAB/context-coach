/**
 * Snapshot Store Service - Story 18-2
 *
 * Manages persistence of session state snapshots in VS Code's globalState.
 * Handles serialization/deserialization, expiration, and cleanup.
 *
 * Features:
 * - Stores snapshots in VS Code globalState
 * - Automatic expiration after 7 days
 * - Serialization of Date objects to ISO strings
 * - Manual and automatic cleanup of expired snapshots
 * - List and retrieve snapshots by session ID
 */

import type * as vscode from "vscode";
import type {
  SessionStateSnapshot,
  SerializedSnapshot,
} from "../types/sessionState";
import { SNAPSHOT_CONSTANTS } from "../types/sessionState";

/**
 * SnapshotStore manages the persistence of session state snapshots.
 * Uses VS Code's globalState for storage across sessions.
 */
export class SnapshotStore {
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
    this.log("SnapshotStore initialized");
  }

  /**
   * Saves a snapshot to storage.
   */
  async saveSnapshot(snapshot: SessionStateSnapshot): Promise<void> {
    const key = this.getStorageKey(snapshot.sessionId);
    const serialized = this.serializeSnapshot(snapshot);

    await this.context.globalState.update(key, serialized);
    this.log(`Saved snapshot for session: ${snapshot.sessionId}`);
  }

  /**
   * Retrieves a snapshot by session ID.
   * Returns null if not found or expired.
   */
  getSnapshot(sessionId: string): SessionStateSnapshot | null {
    const key = this.getStorageKey(sessionId);
    const serialized = this.context.globalState.get<SerializedSnapshot>(key);

    if (!serialized) {
      return null;
    }

    const snapshot = this.deserializeSnapshot(serialized);

    // Check if expired
    if (snapshot.expiresAt < new Date()) {
      this.log(`Snapshot for session ${sessionId} has expired`);
      return null;
    }

    return snapshot;
  }

  /**
   * Lists all stored snapshot session IDs.
   */
  listSnapshots(): string[] {
    const allKeys = this.context.globalState.keys();
    const snapshotKeys = allKeys.filter((key) =>
      key.startsWith(SNAPSHOT_CONSTANTS.STORAGE_PREFIX)
    );

    return snapshotKeys.map((key) =>
      key.substring(SNAPSHOT_CONSTANTS.STORAGE_PREFIX.length)
    );
  }

  /**
   * Lists all non-expired snapshots with their metadata.
   */
  listValidSnapshots(): Array<{
    sessionId: string;
    capturedAt: Date;
    expiresAt: Date;
  }> {
    const sessionIds = this.listSnapshots();
    const now = new Date();
    const validSnapshots: Array<{
      sessionId: string;
      capturedAt: Date;
      expiresAt: Date;
    }> = [];

    for (const sessionId of sessionIds) {
      const snapshot = this.getSnapshot(sessionId);
      if (snapshot && snapshot.expiresAt > now) {
        validSnapshots.push({
          sessionId: snapshot.sessionId,
          capturedAt: snapshot.capturedAt,
          expiresAt: snapshot.expiresAt,
        });
      }
    }

    return validSnapshots.sort(
      (a, b) => b.capturedAt.getTime() - a.capturedAt.getTime()
    );
  }

  /**
   * Removes a snapshot by session ID.
   */
  async deleteSnapshot(sessionId: string): Promise<boolean> {
    const key = this.getStorageKey(sessionId);
    const exists = this.context.globalState.get<SerializedSnapshot>(key);

    if (!exists) {
      return false;
    }

    await this.context.globalState.update(key, undefined);
    this.log(`Deleted snapshot for session: ${sessionId}`);
    return true;
  }

  /**
   * Cleans up expired snapshots.
   * Returns the number of cleaned up snapshots.
   */
  async cleanExpiredSnapshots(): Promise<number> {
    const sessionIds = this.listSnapshots();
    let cleaned = 0;
    const now = new Date();

    for (const sessionId of sessionIds) {
      const key = this.getStorageKey(sessionId);
      const serialized = this.context.globalState.get<SerializedSnapshot>(key);

      if (serialized) {
        const expiresAt = new Date(serialized.expiresAt);
        if (expiresAt < now) {
          await this.context.globalState.update(key, undefined);
          cleaned++;
        }
      }
    }

    if (cleaned > 0) {
      this.log(`Cleaned up ${cleaned} expired snapshot(s)`);
    }

    return cleaned;
  }

  /**
   * Clears all stored snapshots.
   * Returns the number of cleared snapshots.
   */
  async clearAllSnapshots(): Promise<number> {
    const sessionIds = this.listSnapshots();

    for (const sessionId of sessionIds) {
      const key = this.getStorageKey(sessionId);
      await this.context.globalState.update(key, undefined);
    }

    if (sessionIds.length > 0) {
      this.log(`Cleared ${sessionIds.length} snapshot(s)`);
    }

    return sessionIds.length;
  }

  /**
   * Checks if a snapshot exists for a session.
   */
  hasSnapshot(sessionId: string): boolean {
    const key = this.getStorageKey(sessionId);
    return this.context.globalState.get<SerializedSnapshot>(key) !== undefined;
  }

  /**
   * Gets storage statistics.
   */
  getStorageStats(): {
    totalSnapshots: number;
    validSnapshots: number;
    expiredSnapshots: number;
  } {
    const sessionIds = this.listSnapshots();
    const now = new Date();
    let valid = 0;
    let expired = 0;

    for (const sessionId of sessionIds) {
      const key = this.getStorageKey(sessionId);
      const serialized = this.context.globalState.get<SerializedSnapshot>(key);

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
      totalSnapshots: sessionIds.length,
      validSnapshots: valid,
      expiredSnapshots: expired,
    };
  }

  /**
   * Gets the storage key for a session ID.
   */
  private getStorageKey(sessionId: string): string {
    return `${SNAPSHOT_CONSTANTS.STORAGE_PREFIX}${sessionId}`;
  }

  /**
   * Serializes a snapshot for storage.
   * Converts Date objects to ISO strings.
   */
  private serializeSnapshot(snapshot: SessionStateSnapshot): SerializedSnapshot {
    return {
      sessionId: snapshot.sessionId,
      capturedAt: snapshot.capturedAt.toISOString(),
      recentMessages: snapshot.recentMessages.map((msg) => ({
        uuid: msg.uuid,
        type: msg.type,
        content: msg.content,
        timestamp: msg.timestamp?.toISOString(),
      })),
      filesAffected: snapshot.filesAffected.map((file) => ({
        path: file.path,
        operation: file.operation,
        lastAccessed: file.lastAccessed.toISOString(),
      })),
      toolsUsed: snapshot.toolsUsed.map((tool) => ({
        name: tool.name,
        count: tool.count,
        lastArgs: tool.lastArgs,
        lastInvokedAt: tool.lastInvokedAt.toISOString(),
      })),
      pendingOperations: snapshot.pendingOperations.map((op) => ({
        toolName: op.toolName,
        args: op.args,
        startedAt: op.startedAt.toISOString(),
      })),
      conversationContext: snapshot.conversationContext,
      gitContext: snapshot.gitContext,
      expiresAt: snapshot.expiresAt.toISOString(),
    };
  }

  /**
   * Deserializes a snapshot from storage.
   * Converts ISO strings back to Date objects.
   */
  private deserializeSnapshot(
    serialized: SerializedSnapshot
  ): SessionStateSnapshot {
    return {
      sessionId: serialized.sessionId,
      capturedAt: new Date(serialized.capturedAt),
      recentMessages: serialized.recentMessages.map((msg) => ({
        uuid: msg.uuid,
        type: msg.type,
        content: msg.content,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined,
      })),
      filesAffected: serialized.filesAffected.map((file) => ({
        path: file.path,
        operation: file.operation,
        lastAccessed: new Date(file.lastAccessed),
      })),
      toolsUsed: serialized.toolsUsed.map((tool) => ({
        name: tool.name,
        count: tool.count,
        lastArgs: tool.lastArgs,
        lastInvokedAt: new Date(tool.lastInvokedAt),
      })),
      pendingOperations: serialized.pendingOperations.map((op) => ({
        toolName: op.toolName,
        args: op.args,
        startedAt: new Date(op.startedAt),
      })),
      conversationContext: serialized.conversationContext,
      gitContext: serialized.gitContext,
      expiresAt: new Date(serialized.expiresAt),
    };
  }

  /**
   * Logs a message to the output channel.
   */
  private log(message: string): void {
    if (this.outputChannel) {
      const timestamp = new Date().toISOString();
      this.outputChannel.appendLine(
        `[${timestamp}] [SnapshotStore] ${message}`
      );
    }
  }
}

/**
 * Creates a SnapshotStore instance.
 */
export function createSnapshotStore(
  context: vscode.ExtensionContext
): SnapshotStore {
  return new SnapshotStore(context);
}
