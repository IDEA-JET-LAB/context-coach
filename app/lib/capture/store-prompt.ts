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
  const supabase = createAdminClient();

  // Classify the prompt
  const classification = classifyPrompt(input.text);

  // Calculate counts (use promptPart for command_with_prompt, otherwise full text)
  const textForCounts = classification.promptPart ?? input.text;
  const charCount = input.text.length;
  const wordCount = calculateWordCount(textForCounts);

  // Build insert data
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
  if (classification.type === "command_with_prompt" && classification.promptPart) {
    insertData.analyzed_text = classification.promptPart;
  }

  // Insert prompt
  const { data, error } = await supabase
    .from("prompts")
    .insert(insertData)
    .select("id, analysis_status, prompt_type")
    .single();

  if (error) {
    // Log error details for debugging (without sensitive data)
    console.error("[CAPTURE] store: database error", {
      code: error.code,
      message: error.message,
      hint: error.hint,
    });

    throw new StorageError(`Failed to store prompt: ${error.message}`);
  }

  // Log classification result
  if (classification.type !== "prompt") {
    console.log("[CAPTURE] store: classified as", classification.type, {
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
