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
import { classifyPrompt, PromptType, type ClassifyOptions } from "./classify-prompt";
import { createScopedLogger } from "@/lib/utils/logger";
import { MAX_ANALYZED_TEXT_LENGTH } from "./constants";
import { analyzeComplexity, classifyWorkStyle, analyzeSentiment, toSentimentScoresJson } from "@/lib/analysis";
import { generatePromptFingerprint } from "@/lib/import/fingerprint";
import { getCaptureConfigForPipeline } from "@/lib/services/capture-config-pipeline";

// Create a scoped logger for storage operations
const logger = createScopedLogger("STORE");

/**
 * Default patterns for fallback when config unavailable.
 * These patterns filter Claude Code internal messages, not user prompts.
 */
const DEFAULT_GARBAGE_PATTERNS = [
  "^<bash-notification>",
  "^<system-reminder>",
  "^<output-file>",
  "^<shell-id>",
  "^<",
];

/**
 * Additional patterns that must be checked anywhere in text (not just start).
 * These are very specific to avoid filtering legitimate user prompts.
 */
const ANYWHERE_PATTERNS = [
  /<function_results>/,             // Function result tags (can appear after user prefix)
  /<bash-notification>/,            // Shell notifications sometimes embedded
] as const;

/**
 * Cache for compiled regex patterns from config.
 * Avoids recompiling patterns on every prompt.
 */
let compiledPatternCache: {
  patterns: RegExp[];
  configTimestamp: number;
} | null = null;

/**
 * Compiles string patterns from config into RegExp objects.
 * Filters out invalid regex patterns with warning log.
 */
function compilePatterns(patternStrings: string[]): RegExp[] {
  const compiled: RegExp[] = [];
  for (const pattern of patternStrings) {
    try {
      compiled.push(new RegExp(pattern));
    } catch {
      logger.warn("Invalid regex pattern in config, skipping", { pattern });
    }
  }
  return compiled;
}

/**
 * Gets compiled garbage patterns from config with caching.
 * Falls back to defaults if config fetch fails.
 */
async function getCompiledGarbagePatterns(): Promise<RegExp[]> {
  try {
    const config = await getCaptureConfigForPipeline();

    // Check if we need to recompile (config may have been updated)
    // The config has its own cache, so we compare timestamps
    const configTimestamp = new Date(config.updated_at).getTime();

    if (compiledPatternCache && compiledPatternCache.configTimestamp === configTimestamp) {
      return compiledPatternCache.patterns;
    }

    // Compile patterns from config
    const patterns = compilePatterns(config.garbage_patterns);
    compiledPatternCache = { patterns, configTimestamp };

    return patterns;
  } catch (error) {
    logger.warn("Failed to load capture config, using defaults", { error });
    // Use cached patterns if available, otherwise compile defaults
    if (compiledPatternCache) {
      return compiledPatternCache.patterns;
    }
    return compilePatterns(DEFAULT_GARBAGE_PATTERNS);
  }
}

/**
 * Checks if a prompt is garbage/system data that should be filtered.
 * Uses dynamic patterns from admin-configured capture_config table.
 *
 * Two-tier pattern matching:
 * 1. Start-only patterns: From config (matched at beginning of trimmed text)
 * 2. Anywhere patterns: Hardcoded specific patterns (matched anywhere)
 */
export async function isGarbagePromptAsync(text: string): Promise<boolean> {
  const trimmed = text.trim();

  // Get dynamic patterns from config
  const configPatterns = await getCompiledGarbagePatterns();

  // Check config patterns (start-only, most common case)
  if (configPatterns.some(pattern => pattern.test(trimmed))) {
    return true;
  }

  // Check anywhere patterns (more specific, for embedded system data)
  return ANYWHERE_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Synchronous garbage check using cached or default patterns.
 * Used when async is not possible (e.g., in validation schemas).
 * @deprecated Use isGarbagePromptAsync for accurate dynamic filtering
 */
export function isGarbagePrompt(text: string): boolean {
  const trimmed = text.trim();

  // Use cached patterns if available, otherwise use defaults
  const patterns = compiledPatternCache?.patterns ?? compilePatterns(DEFAULT_GARBAGE_PATTERNS);

  // Check start-only patterns (most common case)
  if (patterns.some(pattern => pattern.test(trimmed))) {
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
  /**
   * Optional timestamp for when the prompt was created.
   * Used for historical imports to preserve original timestamps.
   * Defaults to now() if not provided.
   * Story 17-4: Required for consistent fingerprint generation
   */
  created_at?: Date | string;
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
  // Load dynamic config for filtering (cached)
  const config = await getCaptureConfigForPipeline();

  // Filter out garbage/system prompts BEFORE any processing (uses dynamic patterns)
  if (await isGarbagePromptAsync(input.text)) {
    throw new FilteredError("System message filtered - not a user prompt");
  }

  // Validate prompt length against dynamic config
  const textLength = input.text.length;
  if (textLength < config.min_prompt_length) {
    throw new FilteredError(`Prompt too short (${textLength} < ${config.min_prompt_length})`);
  }
  if (textLength > config.max_prompt_length) {
    throw new FilteredError(`Prompt too long (${textLength} > ${config.max_prompt_length})`);
  }

  const supabase = createAdminClient();

  // Classify the prompt with dynamic config options
  const classifyOptions: ClassifyOptions = {
    skipCommandOnly: config.skip_command_only,
    minCommandArgsLength: config.min_command_args_length,
  };
  const classification = classifyPrompt(input.text, classifyOptions);

  // Calculate counts (use promptPart for command_with_prompt, otherwise full text)
  const textForCounts = classification.promptPart ?? input.text;
  const charCount = input.text.length;
  const wordCount = calculateWordCount(textForCounts);

  // Analyze complexity metrics
  // Uses the full text for complexity analysis (not just promptPart)
  // This runs in parallel with classification and is <2ms per prompt
  const complexity = analyzeComplexity(input.text, charCount, wordCount);

  // Classify work style category (Story 21-2)
  // Uses the analyzed text for classification (promptPart for commands with prompts)
  const workStyle = classifyWorkStyle(textForCounts);

  // Analyze sentiment (Story 21-3)
  // Uses the analyzed text for sentiment classification
  // Runs in parallel with other classifiers and is <2ms per prompt
  const sentiment = analyzeSentiment(textForCounts);
  const sentimentScores = toSentimentScoresJson(sentiment);

  // Generate timestamp for fingerprint and created_at
  // Use provided timestamp (for historical import) or current time (for real-time capture)
  // Story 17-4: Consistent timestamp ensures identical fingerprints for deduplication
  const createdAt = input.created_at
    ? (typeof input.created_at === 'string' ? new Date(input.created_at) : input.created_at)
    : new Date();

  // Generate fingerprint for deduplication (Story 17-4)
  // The fingerprint is computed from: user_id + timestamp (minute precision) + text (first 200 chars)
  // This ensures the same prompt captured via hook and imported from transcript will match
  const fingerprint = generatePromptFingerprint(input.user_id, createdAt, input.text);

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
    created_at: createdAt.toISOString(),
    // Deduplication fingerprint (Story 17-4)
    fingerprint,
    // Complexity metrics (Story 21-4)
    sentence_count: complexity.sentenceCount,
    has_code: complexity.hasCode,
    has_file_refs: complexity.hasFileRefs,
    code_block_count: complexity.codeBlockCount,
    file_ref_count: complexity.fileRefCount,
    complexity_level: complexity.complexityLevel,
    complexity_score: complexity.complexityScore,
    // Work style classification (Story 21-2)
    work_style_category: workStyle.category,
    work_style_confidence: workStyle.confidence,
    // Sentiment analysis (Story 21-3)
    sentiment: sentiment.sentiment,
    sentiment_confidence: sentiment.confidence,
    sentiment_scores: sentimentScores,
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
