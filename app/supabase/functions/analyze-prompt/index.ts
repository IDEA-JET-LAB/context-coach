// Edge Function: analyze-prompt
// Story 5.1: Analysis Edge Function
// Story 5.2: 5-Dimension Scoring
// Story 5.3: Improvement Suggestions
// Processes prompts for AI analysis

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Import scoring modules
import { parseAIResponse, mapToScoringResult, AIResponseParseError, ScoringResult, DimensionScore } from './lib/scoring.ts';
import { buildScoringPrompt, extractDimensionWeights, validateDimensionWeights, AnalysisDimension as PromptDimension } from './lib/prompts.ts';
import { callOpenAI, AIClientError, isOpenAIConfigured } from './lib/ai-client.ts';
// Import suggestion modules
import { formatSuggestions, buildStoredSuggestions, DimensionScoreWithSuggestion, StoredSuggestions } from './lib/suggestion-formatter.ts';

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

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Response helpers
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(code: string, message: string, status: number): Response {
  return jsonResponse({ error: { code, message } }, status);
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Parse request body
    const body = await req.json() as AnalyzeRequest;
    const { prompt_id } = body;

    // Validate prompt_id is present
    if (!prompt_id) {
      console.error('[analyze-prompt] error: missing prompt_id');
      return errorResponse('MISSING_PROMPT_ID', 'prompt_id is required', 400);
    }

    // Validate prompt_id format
    if (!isValidUUID(prompt_id)) {
      console.error('[analyze-prompt] error: invalid prompt_id format');
      return errorResponse('INVALID_PROMPT_ID', 'prompt_id must be a valid UUID', 400);
    }

    console.log(`[analyze-prompt] start: processing ${prompt_id}`);

    // Initialize Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[analyze-prompt] error: missing environment variables');
      return errorResponse('CONFIGURATION_ERROR', 'Missing Supabase configuration', 500);
    }

    const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Task 2: Fetch prompt and verify it exists (including text for analysis)
    const { data: prompt, error: fetchError } = await supabase
      .from('prompts')
      .select('id, text, analyzed_text, prompt_type, analysis_status')
      .eq('id', prompt_id)
      .single();

    if (fetchError || !prompt) {
      console.error(`[analyze-prompt] error: prompt not found ${prompt_id}`);
      return errorResponse('PROMPT_NOT_FOUND', 'Prompt does not exist', 404);
    }

    const typedPrompt = prompt as Prompt;

    // For command_with_prompt, analyze the extracted text portion; otherwise use full text
    const textToAnalyze = typedPrompt.analyzed_text || typedPrompt.text;

    // Check if status is 'pending' - skip if already processing/complete
    if (typedPrompt.analysis_status !== 'pending') {
      console.log(`[analyze-prompt] skip: prompt ${prompt_id} status is ${typedPrompt.analysis_status}`);
      return jsonResponse({
        success: true,
        prompt_id,
        skipped: true,
        reason: `Prompt status is already '${typedPrompt.analysis_status}'`,
      });
    }

    // Atomically update status to 'processing' with WHERE clause for idempotency
    const { error: updateError, count } = await supabase
      .from('prompts')
      .update({ analysis_status: 'processing' })
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
      });
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
      return errorResponse('NO_ACTIVE_CONFIG', 'No active analysis configuration found', 500);
    }

    const typedConfig = config as AnalysisConfig;

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
      return errorResponse('NO_ENABLED_DIMENSIONS', 'Analysis config has no enabled dimensions', 500);
    }

    // Check if OpenAI is configured
    if (!isOpenAIConfigured()) {
      console.error('[analyze-prompt] error: OPENAI_API_KEY not configured');
      // Reset status to pending for retry
      await supabase
        .from('prompts')
        .update({ analysis_status: 'pending' })
        .eq('id', prompt_id);
      return errorResponse('AI_NOT_CONFIGURED', 'OpenAI API key is not configured', 500);
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
        500
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

    console.log(`[analyze-prompt] calling AI: prompt ${prompt_id}, model ${model}`);

    let scoringResult: ScoringResult;

    try {
      // Call OpenAI API
      const rawResponse = await callOpenAI(systemPrompt, aiUserPrompt, model);

      // Parse the AI response
      const parsedResponse = parseAIResponse(rawResponse);

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
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[analyze-prompt] error:', errorMessage);

    // Note: Status remains 'processing' for retry handling in Story 5.5
    // The retry mechanism will check for stale 'processing' prompts

    return errorResponse('ANALYSIS_FAILED', errorMessage, 500);
  }
});
