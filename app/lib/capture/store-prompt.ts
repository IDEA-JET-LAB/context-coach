/**
 * Prompt Storage Module for Contextor Capture Pipeline
 *
 * Stores validated, redacted prompts in the database.
 * This module is called AFTER validation and redaction.
 *
 * Uses Supabase admin client (service role) to bypass RLS for insert.
 * The service role client is server-only - never import in client components.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { calculateWordCount } from "./word-count";
import { classifyPrompt, PromptType } from "./classify-prompt";
import { createScopedLogger } from "@/lib/utils/logger";
import { MAX_ANALYZED_TEXT_LENGTH } from "./constants";

// Create a scoped logger for storage operations
const logger = createScopedLogger("STORE");

/**
 * Patterns that indicate system/garbage data that should NOT be stored.
 * These are Claude Code internal messages, not user prompts.
 *
 * Two pattern sets:
 * 1. START_ONLY_PATTERNS: Must appear at the start (common case)
 * 2. ANYWHERE_PATTERNS: Can appear anywhere in the text (rarer, more specific)
 *
 * The anywhere patterns are intentionally specific to avoid false positives.
 * For example, "<function_results>" is unlikely to appear in user prompts.
 */
const START_ONLY_PATTERNS = [
  /^<bash-notification>/,           // Shell notification messages
  /^<system-reminder>/,             // System reminders
  /^<output-file>/,                 // File output tags
  /^<shell-id>/,                    // Shell ID tags
  /^</,                       // Anthropic internal tags
] as const;

/**
 * Patterns that indicate system data when found anywhere in the text.
 * These are very specific to avoid filtering legitimate user prompts.
 */
const ANYWHERE_PATTERNS = [
  /<function_results>/,             // Function result tags (can appear after user prefix)
  /<bash-notification>/,            // Shell notifications sometimes embedded
] as const;

/**
 * Checks if a prompt is garbage/system data that should be filtered.
 *
 * Uses two-tier pattern matching:
 * 1. Start-only patterns: Match at the beginning of trimmed text (most system messages)
 * 2. Anywhere patterns: Match anywhere in the text (for embedded system data)
 */
export function isGarbagePrompt(text: string): boolean {
  const trimmed = text.trim();

  // Check start-only patterns (most common case)
  if (START_ONLY_PATTERNS.some(pattern => pattern.test(trimmed))) {
    return true;
  }

  // Check anywhere patterns (more specific, for embedded system data)
  return ANYWHERE_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Error thrown when prompt is filtered (garbage data).
 */
export class FilteredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FilteredError";
  }
}

/**
 * Input for storing a prompt.
 */
export interface StorePromptInput {
  /** The team that owns this prompt */
  team_id: string;
  /** The project this prompt was captured from */
  project_id: string;
  /** The user who submitted the prompt (from CLI) */
  user_id: string;
  /** The prompt text (should be redacted before storage) */
  text: string;
  /** Optional metadata from the CLI hook */
  metadata?: Record<string, unknown>;
}

/**
 * Result of successfully storing a prompt.
 */
export interface StorePromptResult {
  /** The unique ID of the stored prompt */
  id: string;
  /** The analysis status ('pending' for analyzable, 'skipped' for commands) */
  analysis_status: string;
  /** The prompt type classification */
  prompt_type: PromptType;
}

/**
 * Error thrown when prompt storage fails.
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: string = "STORAGE_FAILED"
  ) {
    super(message);
    this.name = "StorageError";
  }
}

/**
 * Stores a prompt in the database.
 *
 * Calculates char_count and word_count before insert.
 * Uses Supabase admin client to bypass RLS.
 *
 * @param input - The prompt data to store
 * @returns The stored prompt ID and analysis status
 * @throws StorageError if the database insert fails
 *
 * @example
 * ```ts
 * const result = await storePrompt({
 *   team_id: 'uuid',
 *   project_id: 'uuid',
 *   user_id: 'user@example.com',
 *   text: 'How do I create a React component?',
 *   metadata: { source: 'claude-code-hook' },
 * });
 * // result = { id: 'uuid', analysis_status: 'pending' }
 * ```
 */
export async function storePrompt(
  input: StorePromptInput
): Promise<StorePromptResult> {
  // Filter out garbage/system prompts BEFORE any processing
  if (isGarbagePrompt(input.text)) {
    throw new FilteredError("System message filtered - not a user prompt");
  }

  const supabase = createAdminClient();

  // Classify the prompt
  const classification = classifyPrompt(input.text);

  // Calculate counts (use promptPart for command_with_prompt, otherwise full text)
  const textForCounts = classification.promptPart ?? input.text;
  const charCount = input.text.length;
  const wordCount = calculateWordCount(textForCounts);

  // Build insert data
  //
  // Note on text vs analyzed_text:
  // - `text`: Full original prompt (for display, audit, and full-text search)
  // - `analyzed_text`: Extracted portion for AI analysis (command_with_prompt only)
  //
  // Example for "/build Fix the login bug":
  // - text = "/build Fix the login bug" (what user typed)
  // - analyzed_text = "Fix the login bug" (what gets analyzed)
  //
  // This is NOT redundant storage - they serve different purposes.
  const insertData: Record<string, unknown> = {
    team_id: input.team_id,
    project_id: input.project_id,
    user_id: input.user_id,
    text: input.text,
    char_count: charCount,
    word_count: wordCount,
    metadata: input.metadata ?? null,
    prompt_type: classification.type,
    analysis_status: classification.analysisStatus,
  };

  // For command_with_prompt, store the extracted text that will be analyzed
  // separately from the full text. This allows UI to show full prompt while
  // analysis operates only on the relevant portion.
  // Truncate analyzed_text to MAX_ANALYZED_TEXT_LENGTH to prevent excessive storage.
  if (classification.type === "command_with_prompt" && classification.promptPart) {
    insertData.analyzed_text = classification.promptPart.slice(0, MAX_ANALYZED_TEXT_LENGTH);
  }

  // Insert prompt
  const { data, error } = await supabase
    .from("prompts")
    .insert(insertData)
    .select("id, analysis_status, prompt_type")
    .single();

  if (error) {
    // Log error details for debugging (without sensitive data)
    logger.error("Database insert failed", error, {
      code: error.code,
      hint: error.hint,
    });

    throw new StorageError(`Failed to store prompt: ${error.message}`);
  }

  // Log classification result for non-standard prompts (useful for debugging)
  if (classification.type !== "prompt") {
    logger.debug("Prompt classified", {
      type: classification.type,
      shouldAnalyze: classification.shouldAnalyze,
      hasPromptPart: !!classification.promptPart,
    });
  }

  return {
    id: data.id,
    analysis_status: data.analysis_status,
    prompt_type: data.prompt_type,
  };
}
