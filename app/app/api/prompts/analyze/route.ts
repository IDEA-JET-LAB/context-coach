/**
 * POST /api/prompts/analyze
 * Story 27-5: Update Analysis Pipeline
 *
 * Triggers context-aware analysis for a prompt.
 * This endpoint integrates Phase 3 classification and scoring.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runAnalysisPipeline, type PipelineResult } from '@/lib/analysis/analysisPipeline';
import { createScopedLogger } from '@/lib/utils/logger';

const logger = createScopedLogger('API_ANALYZE');

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AnalyzeRequest {
  prompt_id: string;
  force_score?: boolean;
}

interface AnalyzeResponse {
  success: boolean;
  prompt_id: string;
  result?: PipelineResult;
  error?: string;
}

/**
 * POST /api/prompts/analyze
 *
 * Triggers analysis for a single prompt using the Phase 3 pipeline.
 *
 * Request body:
 * {
 *   "prompt_id": "uuid",
 *   "force_score": false // optional, force scoring even for skip types
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "prompt_id": "uuid",
 *   "result": { ... PipelineResult ... }
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse<AnalyzeResponse>> {
  const startTime = Date.now();

  try {
    // Parse request body
    const body = (await request.json()) as AnalyzeRequest;
    const { prompt_id, force_score = false } = body;

    // Validate prompt_id
    if (!prompt_id) {
      return NextResponse.json(
        { success: false, prompt_id: '', error: 'prompt_id is required' },
        { status: 400 }
      );
    }

    if (!UUID_REGEX.test(prompt_id)) {
      return NextResponse.json(
        { success: false, prompt_id, error: 'prompt_id must be a valid UUID' },
        { status: 400 }
      );
    }

    logger.log('Analysis request received', { prompt_id, force_score });

    // Create Supabase client with service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      logger.error('Missing Supabase configuration');
      return NextResponse.json(
        { success: false, prompt_id, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Run the analysis pipeline
    const result = await runAnalysisPipeline(supabase, prompt_id, {
      forceScore: force_score,
    });

    const elapsed = Date.now() - startTime;
    logger.log('Analysis completed', {
      prompt_id,
      skipped: result.skipped,
      score: result.scores?.weightedOverall,
      elapsed,
    });

    return NextResponse.json({
      success: true,
      prompt_id,
      result,
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Analysis failed', { error: errorMessage, elapsed });

    return NextResponse.json(
      {
        success: false,
        prompt_id: '',
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
