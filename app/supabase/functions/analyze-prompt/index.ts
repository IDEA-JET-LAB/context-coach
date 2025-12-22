// Edge Function: analyze-prompt
// Story 5.1: Analysis Edge Function
// Story 5.2: 5-Dimension Scoring
// Story 5.3: Improvement Suggestions
// Processes prompts for AI analysis

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Import scoring modules
import { parseAIResponse, mapToScoringResult, AIResponseParseError, ScoringResult, DimensionScore } from './lib/scoring.ts';
import { buildScoringPrompt, extractDimensionWeights, validateDimensionWeights, validatePromptLength, AnalysisDimension as PromptDimension } from './lib/prompts.ts';
import { callOpenAI, AIClientError, isOpenAIConfigured } from './lib/ai-client.ts';
// Import suggestion modules
import { formatSuggestions, buildStoredSuggestions, DimensionScoreWithSuggestion, StoredSuggestions } from './lib/suggestion-formatter.ts';
// Import retry logic modules (Story 5.5)
import { classifyError, TransientError, PermanentError } from './lib/error-classifier.ts';
import { MAX_RETRIES, canRetry, getRetryDelay } from './lib/retry-scheduler.ts';

// Rate Limiter for AI calls (H6 fix)
// Simple sliding window rate limiter - limits concurrent AI calls
const RATE_LIMIT_MAX_CONCURRENT = 5; // Max concurrent AI calls across all invocations
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute window
const RATE_LIMIT_MAX_PER_WINDOW = 30; // Max calls per minute

interface RateLimitState {
  activeCalls: number;
  callTimestamps: number[];
}

// In-memory rate limit state (shared across invocations within same isolate)
const rateLimitState: RateLimitState = {
  activeCalls: 0,
  callTimestamps: [],
};

/**
 * Check if we can make an AI call based on rate limits
 * @returns true if within limits, false if should be rate limited
 */
function checkRateLimit(): { allowed: boolean; reason?: string } {
  const now = Date.now();

  // Clean up old timestamps outside the window
  rateLimitState.callTimestamps = rateLimitState.callTimestamps.filter(
    ts => now - ts < RATE_LIMIT_WINDOW_MS
  );

  // Check concurrent calls limit
  if (rateLimitState.activeCalls >= RATE_LIMIT_MAX_CONCURRENT) {
    return {
      allowed: false,
      reason: `Too many concurrent AI calls (${rateLimitState.activeCalls}/${RATE_LIMIT_MAX_CONCURRENT})`
    };
  }

  // Check calls per window limit
  if (rateLimitState.callTimestamps.length >= RATE_LIMIT_MAX_PER_WINDOW) {
    return {
      allowed: false,
      reason: `Rate limit exceeded (${rateLimitState.callTimestamps.length}/${RATE_LIMIT_MAX_PER_WINDOW} calls per minute)`
    };
  }

  return { allowed: true };
}

/**
 * Record the start of an AI call
 */
function recordAICallStart(): void {
  rateLimitState.activeCalls++;
  rateLimitState.callTimestamps.push(Date.now());
}

/**
 * Record the end of an AI call
 */
function recordAICallEnd(): void {
  rateLimitState.activeCalls = Math.max(0, rateLimitState.activeCalls - 1);
}

// Types
interface AnalyzeRequest {
  prompt_id: string;
}

interface Prompt {
  id: string;
  text: string;
  analyzed_text: string | null;
  prompt_type: 'prompt' | 'command' | 'command_with_prompt';
  analysis_status: string;
  analysis_attempts: number;
}

interface AnalysisDimension {
  id: string;
  config_id: string;
  name: string;
  description: string;
  weight: number;
  prompt_template: string;
  scoring_criteria: string;
  enabled: boolean;
  sort_order: number;
}

interface AnalysisConfig {
  id: string;
  version: number;
  name: string;
  system_prompt: string;
  model: string;
  is_active: boolean;
  analysis_dimensions: AnalysisDimension[];
}

/**
 * Validates analysis config version format
 * @param config The analysis config to validate
 * @throws Error if version is invalid
 */
function validateConfigVersion(config: AnalysisConfig): void {
  if (typeof config.version !== 'number') {
    throw new Error(
      `Invalid config version: expected number, got ${typeof config.version}`
    );
  }
  if (!Number.isInteger(config.version)) {
    throw new Error(
      `Invalid config version: must be an integer, got ${config.version}`
    );
  }
  if (config.version < 1) {
    throw new Error(
      `Invalid config version: must be >= 1, got ${config.version}`
    );
  }
}

// Allowed CORS origins for the API
// Configured for production, staging, and local development
const ALLOWED_ORIGINS = [
  'https://contextor.co',
  'https://www.contextor.co',
  'http://127.0.0.1:3050',
  'http://localhost:3050',
];

/**
 * Gets CORS headers for the given request origin.
 * Returns specific origin if allowed, otherwise returns the first allowed origin.
 * This prevents wildcard CORS while supporting legitimate clients.
 */
function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const origin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS[0]; // Default to production domain

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin', // Important for correct caching with dynamic CORS
  };
}

// Default CORS headers for error responses where request is not available
const corsHeaders = getCorsHeaders('https://contextor.co');

// Response helpers (with optional CORS headers override)
function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = corsHeaders): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

function errorResponse(code: string, message: string, status: number, headers: Record<string, string> = corsHeaders): Response {
  return jsonResponse({ error: { code, message } }, status, headers);
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

serve(async (req: Request): Promise<Response> => {
  // Get request origin for dynamic CORS
  const requestOrigin = req.headers.get('origin');
  const dynamicCorsHeaders = getCorsHeaders(requestOrigin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: dynamicCorsHeaders });
  }

  const startTime = Date.now();

  // H7 Fix: Track prompt_id and supabase client at function scope for cleanup on error
  let currentPromptId: string | null = null;
  let supabaseClient: SupabaseClient | null = null;
  let attemptNumber = 0; // Track attempt number for retry logic

  try {
    // Parse request body
    const body = await req.json() as AnalyzeRequest;
    const { prompt_id } = body;

    // Validate prompt_id is present
    if (!prompt_id) {
      console.error('[analyze-prompt] error: missing prompt_id');
      return errorResponse('MISSING_PROMPT_ID', 'prompt_id is required', 400, dynamicCorsHeaders);
    }

    // Validate prompt_id format
    if (!isValidUUID(prompt_id)) {
      console.error('[analyze-prompt] error: invalid prompt_id format');
      return errorResponse('INVALID_PROMPT_ID', 'prompt_id must be a valid UUID', 400, dynamicCorsHeaders);
    }

    // Track prompt_id for cleanup in catch block
    currentPromptId = prompt_id;

    console.log(`[analyze-prompt] start: processing ${prompt_id}`);

    // Initialize Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[analyze-prompt] error: missing environment variables');
      return errorResponse('CONFIGURATION_ERROR', 'Missing Supabase configuration', 500, dynamicCorsHeaders);
    }

    const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    // Track client for cleanup in catch block
    supabaseClient = supabase;

    // Task 2: Fetch prompt and verify it exists (including text for analysis)
    const { data: prompt, error: fetchError } = await supabase
      .from('prompts')
      .select('id, text, analyzed_text, prompt_type, analysis_status, analysis_attempts')
      .eq('id', prompt_id)
      .single();

    if (fetchError || !prompt) {
      console.error(`[analyze-prompt] error: prompt not found ${prompt_id}`);
      return errorResponse('PROMPT_NOT_FOUND', 'Prompt does not exist', 404, dynamicCorsHeaders);
    }

    const typedPrompt = prompt as Prompt;

    // For command_with_prompt, analyze the extracted text portion; otherwise use full text
    const textToAnalyze = typedPrompt.analyzed_text || typedPrompt.text;

    // Validate prompt length before processing
    try {
      validatePromptLength(textToAnalyze);
    } catch (validationError) {
      console.error(`[analyze-prompt] error: invalid prompt length for ${prompt_id}`, validationError);
      // Mark as failed - prompt is structurally invalid (permanent error)
      await supabase
        .from('prompts')
        .update({
          analysis_status: 'failed',
          last_analysis_error: validationError instanceof Error ? validationError.message : 'Invalid prompt length',
        })
        .eq('id', prompt_id);
      return errorResponse(
        'INVALID_PROMPT_LENGTH',
        validationError instanceof Error ? validationError.message : 'Invalid prompt length',
        400,
        dynamicCorsHeaders
      );
    }

    // Check if status is 'pending' - skip if already processing/complete
    if (typedPrompt.analysis_status !== 'pending') {
      console.log(`[analyze-prompt] skip: prompt ${prompt_id} status is ${typedPrompt.analysis_status}`);
      return jsonResponse({
        success: true,
        prompt_id,
        skipped: true,
        reason: `Prompt status is already '${typedPrompt.analysis_status}'`,
      }, 200, dynamicCorsHeaders);
    }

    // Track current attempt number for retry logic
    const currentAttempt = typedPrompt.analysis_attempts + 1;
    attemptNumber = currentAttempt; // Store at function scope for catch block

    // Atomically update status to 'processing' and increment attempt count
    const { error: updateError, count } = await supabase
      .from('prompts')
      .update({
        analysis_status: 'processing',
        analysis_attempts: currentAttempt,
        last_analysis_attempt_at: new Date().toISOString(),
      })
      .eq('id', prompt_id)
      .eq('analysis_status', 'pending');

    if (updateError) {
      console.error(`[analyze-prompt] error: status update failed`, updateError);
      throw updateError;
    }

    // Handle race conditions - if count is 0, another process started
    if (count === 0) {
      console.log(`[analyze-prompt] skip: prompt ${prompt_id} already being processed (race condition)`);
      return jsonResponse({
        success: true,
        prompt_id,
        skipped: true,
        reason: 'Prompt is already being processed by another instance',
      }, 200, dynamicCorsHeaders);
    }

    // Task 3: Load active analysis config with related dimensions
    const { data: config, error: configError } = await supabase
      .from('analysis_configs')
      .select(`
        *,
        analysis_dimensions(*)
      `)
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      console.error('[analyze-prompt] error: no active analysis config found');
      // Reset status to pending for retry
      await supabase
        .from('prompts')
        .update({ analysis_status: 'pending' })
        .eq('id', prompt_id);
      return errorResponse('NO_ACTIVE_CONFIG', 'No active analysis configuration found', 500, dynamicCorsHeaders);
    }

    const typedConfig = config as AnalysisConfig;

    // Validate config version format
    try {
      validateConfigVersion(typedConfig);
    } catch (versionError) {
      console.error('[analyze-prompt] error: invalid config version', versionError);
      // Reset status to pending for retry after config is fixed
      await supabase
        .from('prompts')
        .update({ analysis_status: 'pending' })
        .eq('id', prompt_id);
      return errorResponse(
        'INVALID_CONFIG_VERSION',
        versionError instanceof Error ? versionError.message : 'Invalid config version',
        500,
        dynamicCorsHeaders
      );
    }

    // Filter to only enabled dimensions
    const enabledDimensions = typedConfig.analysis_dimensions.filter(
      (d: AnalysisDimension) => d.enabled
    );

    // Validate at least one enabled dimension exists
    if (enabledDimensions.length === 0) {
      console.error('[analyze-prompt] error: no enabled dimensions in config');
      // Reset status to pending for retry
      await supabase
        .from('prompts')
        .update({ analysis_status: 'pending' })
        .eq('id', prompt_id);
      return errorResponse('NO_ENABLED_DIMENSIONS', 'Analysis config has no enabled dimensions', 500, dynamicCorsHeaders);
    }

    // Check if OpenAI is configured
    if (!isOpenAIConfigured()) {
      console.error('[analyze-prompt] error: OPENAI_API_KEY not configured');
      // Reset status to pending for retry
      await supabase
        .from('prompts')
        .update({ analysis_status: 'pending' })
        .eq('id', prompt_id);
      return errorResponse('AI_NOT_CONFIGURED', 'OpenAI API key is not configured', 500, dynamicCorsHeaders);
    }

    // Validate dimension weights sum to 100
    try {
      validateDimensionWeights(enabledDimensions as PromptDimension[]);
    } catch (weightError) {
      console.error('[analyze-prompt] error: invalid dimension weights', weightError);
      // Reset status to pending for retry
      await supabase
        .from('prompts')
        .update({ analysis_status: 'pending' })
        .eq('id', prompt_id);
      return errorResponse(
        'INVALID_WEIGHTS',
        weightError instanceof Error ? weightError.message : 'Invalid dimension weights',
        500,
        dynamicCorsHeaders
      );
    }

    // Build the scoring prompt (uses extracted text for command_with_prompt)
    const { systemPrompt, userPrompt: aiUserPrompt } = buildScoringPrompt(
      textToAnalyze,
      enabledDimensions as PromptDimension[],
      typedConfig.system_prompt
    );

    // Get model from config (default to gpt-4o-mini)
    const model = typedConfig.model || 'gpt-4o-mini';

    // H6 Fix: Check rate limit before making AI call
    const rateLimitCheck = checkRateLimit();
    if (!rateLimitCheck.allowed) {
      console.warn(`[analyze-prompt] rate-limited: prompt ${prompt_id} - ${rateLimitCheck.reason}`);
      // Reset status to pending for retry later
      await supabase
        .from('prompts')
        .update({ analysis_status: 'pending' })
        .eq('id', prompt_id);
      return errorResponse('RATE_LIMITED', rateLimitCheck.reason || 'Rate limit exceeded', 429, dynamicCorsHeaders);
    }

    console.log(`[analyze-prompt] calling AI: prompt ${prompt_id}, model ${model}`);

    let scoringResult: ScoringResult;

    // Track AI call for rate limiting
    recordAICallStart();
    try {
      // Call OpenAI API
      const rawResponse = await callOpenAI(systemPrompt, aiUserPrompt, model);

      // Extract dimension names from the enabled dimensions (database-driven)
      const dimensionNames = enabledDimensions.map((d: AnalysisDimension) => d.name.toLowerCase());

      // Parse the AI response with expected dimension names
      const parsedResponse = parseAIResponse(rawResponse, dimensionNames);

      // Extract dimension weights
      const dimensionWeights = extractDimensionWeights(enabledDimensions as PromptDimension[]);

      // Calculate overall score
      scoringResult = mapToScoringResult(parsedResponse, dimensionWeights, rawResponse);

      console.log(`[analyze-prompt] scored: prompt ${prompt_id}, overall: ${scoringResult.overallScore}`);

    } catch (aiError) {
      // Handle AI errors - log and throw for retry
      if (aiError instanceof AIClientError) {
        console.error(`[analyze-prompt] error: AI call failed for prompt ${prompt_id} - ${aiError.message}`);
        throw aiError;
      }
      if (aiError instanceof AIResponseParseError) {
        console.error(`[analyze-prompt] error: parse failed for prompt ${prompt_id} - ${aiError.message}`);
        throw aiError;
      }
      throw aiError;
    } finally {
      // Always decrement active call count
      recordAICallEnd();
    }

    // Process suggestions (Story 5.3)
    // Convert dimension scores to format expected by suggestion formatter
    const dimensionScoresWithSuggestions: DimensionScoreWithSuggestion[] = scoringResult.dimensionScores.map(
      (d: DimensionScore) => ({
        name: d.name,
        score: d.score,
        weight: d.weight,
        reasoning: d.reasoning,
        suggestion: d.suggestion,
        example: d.example,
      })
    );

    // Format suggestions with fallbacks and coaching-positive language
    const formattedSuggestions = formatSuggestions(dimensionScoresWithSuggestions);

    // Build stored suggestions structure for JSONB column
    const storedSuggestions: StoredSuggestions = buildStoredSuggestions(formattedSuggestions);

    console.log(`[analyze-prompt] suggestions: prompt ${prompt_id}, prioritized: [${storedSuggestions.prioritized.join(', ')}]`);

    // Build dimension scores for storage (JSONB format)
    const dimensionScoresJsonb = scoringResult.dimensionScores.reduce(
      (acc, d) => ({
        ...acc,
        [d.name]: {
          score: d.score,
          reasoning: d.reasoning,
        },
      }),
      {} as Record<string, { score: number; reasoning: string }>
    );

    // Store analysis result using atomic database function
    const { data: analysisResult, error: storageError } = await supabase.rpc(
      'store_analysis_result',
      {
        p_prompt_id: prompt_id,
        p_config_id: typedConfig.id,
        p_overall_score: scoringResult.overallScore,
        p_dimension_scores: dimensionScoresJsonb,
        p_suggestions: storedSuggestions,
      }
    );

    if (storageError) {
      console.error(`[analyze-prompt] error: storage failed for prompt ${prompt_id}`, storageError);
      throw new Error(`Failed to store analysis result: ${storageError.message}`);
    }

    const analysisId = analysisResult as string;
    console.log(`[analyze-prompt] stored: analysis ${analysisId} for prompt ${prompt_id}`);

    const elapsed = Date.now() - startTime;
    console.log(`[analyze-prompt] complete: prompt ${prompt_id}, ${elapsed}ms`);

    // Return success response with complete analysis data
    return jsonResponse({
      success: true,
      prompt_id,
      analysis_id: analysisId,
      config_id: typedConfig.id,
      dimensions_count: enabledDimensions.length,
      overall_score: scoringResult.overallScore,
      dimension_scores: dimensionScoresJsonb,
      suggestions: storedSuggestions,
      processing_time_ms: elapsed,
    }, 200, dynamicCorsHeaders);

  } catch (error: unknown) {
    // Classify error to determine if retryable (Story 5.5)
    const classifiedError = classifyError(error);
    const errorMessage = classifiedError.message;
    const isTransient = classifiedError instanceof TransientError;

    console.error('[analyze-prompt] error:', {
      message: errorMessage,
      isTransient,
      attempt: attemptNumber,
      maxRetries: MAX_RETRIES,
    });

    // Determine if we should retry or mark as failed
    if (currentPromptId && supabaseClient) {
      try {
        const shouldRetryAgain = isTransient && canRetry(attemptNumber);

        if (shouldRetryAgain) {
          // Transient error with retries remaining - reset to pending for retry
          const retryDelay = getRetryDelay(attemptNumber);
          console.log(`[analyze-prompt] retry: scheduling retry for ${currentPromptId}, attempt ${attemptNumber}, delay ${retryDelay}ms`);

          const { error: updateError, count } = await supabaseClient
            .from('prompts')
            .update({
              analysis_status: 'pending', // Reset to pending so it can be picked up again
              last_analysis_error: errorMessage.substring(0, 500),
            })
            .eq('id', currentPromptId)
            .eq('analysis_status', 'processing');

          if (updateError) {
            console.error(`[analyze-prompt] retry: failed to reset status to 'pending' for ${currentPromptId}`, updateError);
          } else if (count && count > 0) {
            console.log(`[analyze-prompt] retry: reset status to 'pending' for ${currentPromptId}`);
          }
        } else {
          // Permanent error or max retries exceeded - mark as failed
          const failReason = !isTransient
            ? 'permanent error'
            : `max retries (${MAX_RETRIES}) exceeded`;
          console.log(`[analyze-prompt] fail: marking ${currentPromptId} as failed (${failReason})`);

          // TODO: Dead Letter Queue (DLQ) implementation
          // For production-grade error handling, failed prompts should be sent to a DLQ for:
          // - Manual review and debugging
          // - Batch reprocessing after system fixes
          // - Metrics and alerting on failure patterns
          // Suggested implementation:
          // - Create a 'failed_analyses' table with prompt_id, error details, metadata
          // - Add cleanup job to archive old DLQ entries
          // - Build admin dashboard to view and retry DLQ items

          const { error: updateError, count } = await supabaseClient
            .from('prompts')
            .update({
              analysis_status: 'failed',
              last_analysis_error: errorMessage.substring(0, 500),
            })
            .eq('id', currentPromptId)
            .eq('analysis_status', 'processing');

          if (updateError) {
            console.error(`[analyze-prompt] cleanup: failed to update status to 'failed' for ${currentPromptId}`, updateError);
          } else if (count && count > 0) {
            console.log(`[analyze-prompt] cleanup: updated status to 'failed' for ${currentPromptId}`);
          }
        }
      } catch (cleanupError) {
        // Log but don't fail - the original error response is more important
        console.error('[analyze-prompt] cleanup: error during status update', cleanupError);
      }
    }

    return errorResponse('ANALYSIS_FAILED', errorMessage, 500, dynamicCorsHeaders);
  }
});
