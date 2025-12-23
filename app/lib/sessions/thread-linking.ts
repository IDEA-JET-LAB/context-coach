/**
 * Thread Linking - Story 16-4: Conversation Threading
 *
 * Resolves Claude's parentUuid to our internal prompt IDs.
 * Claude Code transcripts use UUIDs to link parent-child messages,
 * which we need to resolve to our database prompt IDs.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createScopedLogger } from "@/lib/utils/logger";
import { isValidUuid } from "@/lib/utils/uuid";

const logger = createScopedLogger("THREAD");

/**
 * In-memory cache for UUID mappings within a session import.
 * Maps claude_uuid -> prompt database ID.
 *
 * This cache is cleared between session imports to prevent stale mappings.
 */
const uuidCache = new Map<string, string>();

/**
 * Result of a parent resolution attempt
 */
export interface ParentResolutionResult {
  /** Our database prompt ID if found */
  promptId: string | null;
  /** Whether the resolution was from cache */
  fromCache: boolean;
}

/**
 * Resolve Claude's parentUuid to our internal prompt ID.
 *
 * The parentUuid is stored in prompt metadata during import.
 * This function looks up the parent by matching the claude_uuid
 * stored in our prompts table.
 *
 * @param claudeUuid - The Claude message UUID from the parent reference
 * @param sessionUuid - The session database UUID (for scoped lookup)
 * @returns The database prompt ID if found, null otherwise
 *
 * @example
 * // Given a prompt with parent reference in transcript:
 * // { "parentUuid": "abc-123", "text": "Reply to parent" }
 *
 * const parentId = await resolveParentPrompt("abc-123", sessionId);
 * // Returns: "db-prompt-id-xxx" or null
 */
export async function resolveParentPrompt(
  claudeUuid: string,
  sessionUuid: string
): Promise<string | null> {
  // Validate inputs
  if (!claudeUuid || typeof claudeUuid !== "string") {
    return null;
  }

  if (!isValidUuid(sessionUuid)) {
    logger.warn("Invalid session UUID for parent resolution", { sessionUuid });
    return null;
  }

  // Create cache key scoped to session
  const cacheKey = `${sessionUuid}:${claudeUuid}`;

  // Check cache first
  if (uuidCache.has(cacheKey)) {
    const cached = uuidCache.get(cacheKey)!;
    logger.debug("Parent UUID resolved from cache", {
      claudeUuid,
      promptId: cached,
    });
    return cached;
  }

  const supabase = createAdminClient();

  try {
    // Look up prompt by claude_uuid in metadata
    // The claude_uuid should be stored in the metadata JSONB field
    const { data: prompt, error } = await supabase
      .from("prompts")
      .select("id")
      .eq("session_uuid", sessionUuid)
      .contains("metadata", { claude_uuid: claudeUuid })
      .single();

    if (error || !prompt) {
      logger.debug("Parent prompt not found", {
        claudeUuid,
        sessionUuid,
        error: error?.message,
      });
      return null;
    }

    // Cache the result
    uuidCache.set(cacheKey, prompt.id);

    logger.debug("Parent UUID resolved from database", {
      claudeUuid,
      promptId: prompt.id,
    });

    return prompt.id;
  } catch (err) {
    logger.warn("Error resolving parent UUID", {
      claudeUuid,
      sessionUuid,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Mapping entry for batch parent resolution
 */
export interface UuidMapping {
  /** The Claude message UUID */
  claudeUuid: string;
  /** The session database UUID */
  sessionUuid: string;
}

/**
 * Batch resolve multiple parent UUIDs to prompt IDs.
 *
 * More efficient than multiple single calls when processing
 * a batch of prompts during import.
 *
 * @param mappings - Array of claude_uuid and session_uuid pairs
 * @returns Map of claudeUuid -> promptId for found parents
 *
 * @example
 * const parentMap = await batchResolveParents([
 *   { claudeUuid: "abc-123", sessionUuid: "session-db-id" },
 *   { claudeUuid: "def-456", sessionUuid: "session-db-id" },
 * ]);
 * // Returns: Map { "abc-123" => "prompt-id-1", "def-456" => "prompt-id-2" }
 */
export async function batchResolveParents(
  mappings: UuidMapping[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  if (mappings.length === 0) {
    return results;
  }

  // Group mappings by session for efficient queries
  const bySession = new Map<string, string[]>();
  const uncached: UuidMapping[] = [];

  for (const { claudeUuid, sessionUuid } of mappings) {
    if (!isValidUuid(sessionUuid)) {
      continue;
    }

    const cacheKey = `${sessionUuid}:${claudeUuid}`;

    // Check cache first
    if (uuidCache.has(cacheKey)) {
      results.set(claudeUuid, uuidCache.get(cacheKey)!);
    } else {
      uncached.push({ claudeUuid, sessionUuid });
      const existing = bySession.get(sessionUuid) || [];
      existing.push(claudeUuid);
      bySession.set(sessionUuid, existing);
    }
  }

  // If all were cached, return early
  if (uncached.length === 0) {
    logger.debug("All parent UUIDs resolved from cache", {
      count: results.size,
    });
    return results;
  }

  const supabase = createAdminClient();

  // Query each session's prompts
  for (const [sessionUuid, claudeUuids] of bySession) {
    try {
      // Build OR conditions for each claude_uuid
      // We need to query prompts that have any of the claude_uuids in their metadata
      const { data: prompts, error } = await supabase
        .from("prompts")
        .select("id, metadata")
        .eq("session_uuid", sessionUuid)
        .not("metadata", "is", null);

      if (error) {
        logger.warn("Error in batch parent resolution", {
          sessionUuid,
          error: error.message,
        });
        continue;
      }

      if (!prompts) {
        continue;
      }

      // Match found prompts to their claude_uuids
      for (const prompt of prompts) {
        const metadata = prompt.metadata as Record<string, unknown> | null;
        const promptClaudeUuid = metadata?.claude_uuid as string | undefined;

        if (promptClaudeUuid && claudeUuids.includes(promptClaudeUuid)) {
          results.set(promptClaudeUuid, prompt.id);
          // Cache the result
          const cacheKey = `${sessionUuid}:${promptClaudeUuid}`;
          uuidCache.set(cacheKey, prompt.id);
        }
      }
    } catch (err) {
      logger.warn("Error in batch parent resolution for session", {
        sessionUuid,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.debug("Batch parent resolution complete", {
    requested: mappings.length,
    resolved: results.size,
    fromCache: mappings.length - uncached.length,
  });

  return results;
}

/**
 * Clear the UUID cache.
 *
 * Call this between session imports to prevent stale mappings
 * from affecting subsequent imports.
 *
 * @example
 * // Before starting a new session import
 * clearUuidCache();
 *
 * // Process session transcripts...
 */
export function clearUuidCache(): void {
  const size = uuidCache.size;
  uuidCache.clear();
  logger.debug("UUID cache cleared", { previousSize: size });
}

/**
 * Store a claude_uuid -> prompt_id mapping in the cache.
 *
 * Called during prompt creation to enable parent resolution
 * for child prompts imported later in the same batch.
 *
 * @param claudeUuid - The Claude message UUID
 * @param sessionUuid - The session database UUID
 * @param promptId - Our database prompt ID
 *
 * @example
 * // After storing a prompt during import
 * cacheUuidMapping("abc-123", sessionId, newPromptId);
 */
export function cacheUuidMapping(
  claudeUuid: string,
  sessionUuid: string,
  promptId: string
): void {
  if (!claudeUuid || !isValidUuid(sessionUuid) || !isValidUuid(promptId)) {
    return;
  }

  const cacheKey = `${sessionUuid}:${claudeUuid}`;
  uuidCache.set(cacheKey, promptId);
}

/**
 * Get the current cache size (for testing/debugging)
 */
export function getUuidCacheSize(): number {
  return uuidCache.size;
}
