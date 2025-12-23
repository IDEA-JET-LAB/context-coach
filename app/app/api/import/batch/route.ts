/**
 * Batch Import API Endpoint - Story 17-3: Batch Import Processing
 *
 * POST /api/import/batch
 *
 * Receives batches of prompt-response pairs from the import process
 * and stores them in the database.
 *
 * Features:
 * - Validates batch payload
 * - Uses fingerprints for deduplication (skips duplicates)
 * - Inserts prompts with preserved timestamps
 * - Queues analysis jobs asynchronously
 * - Returns success/skipped/failed counts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createScopedLogger } from '@/lib/utils/logger';
import type {
  BatchUploadRequest,
  BatchUploadResponse,
  PromptWithFingerprint,
} from '@/lib/import/types';
import { calculateWordCount } from '@/lib/capture/word-count';
import { classifyPrompt } from '@/lib/capture/classify-prompt';
import { isGarbagePrompt } from '@/lib/capture/store-prompt';

const logger = createScopedLogger('IMPORT');

/**
 * Validate the batch upload request payload.
 */
function validateBatchPayload(body: unknown): body is BatchUploadRequest {
  if (!body || typeof body !== 'object') return false;

  const payload = body as Record<string, unknown>;

  if (!Array.isArray(payload.pairs)) return false;
  if (typeof payload.importId !== 'string') return false;
  if (typeof payload.teamId !== 'string') return false;
  if (typeof payload.userId !== 'string') return false;

  // Validate each pair has required fields
  for (const pair of payload.pairs) {
    if (!pair || typeof pair !== 'object') return false;
    const p = pair as Record<string, unknown>;

    if (!p.prompt || typeof p.prompt !== 'object') return false;
    if (!p.fingerprint || typeof p.fingerprint !== 'string') return false;

    const prompt = p.prompt as Record<string, unknown>;
    if (typeof prompt.text !== 'string') return false;
    if (typeof prompt.timestamp !== 'string') return false;
  }

  return true;
}

/**
 * Check which fingerprints already exist in the database.
 */
async function getExistingFingerprints(
  fingerprints: string[],
  supabase: ReturnType<typeof createAdminClient>
): Promise<Set<string>> {
  if (fingerprints.length === 0) return new Set();

  const { data, error } = await supabase
    .from('prompts')
    .select('fingerprint')
    .in('fingerprint', fingerprints);

  if (error) {
    logger.error('Failed to check existing fingerprints', error);
    throw new Error(`Database error: ${error.message}`);
  }

  return new Set(data?.map((row) => row.fingerprint) ?? []);
}

/**
 * Trigger analysis for a batch of prompts.
 * This is fire-and-forget - we don't wait for analysis to complete.
 */
async function triggerAnalysis(promptIds: string[]): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey || promptIds.length === 0) {
    return;
  }

  // Queue each prompt for analysis
  // Note: In production, we'd use a batch endpoint or queue
  for (const promptId of promptIds) {
    try {
      await fetch(`${supabaseUrl}/functions/v1/analyze-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ prompt_id: promptId }),
      });
    } catch {
      // Don't fail import if analysis trigger fails
      logger.warn('Failed to trigger analysis for prompt', { promptId });
    }
  }
}

/**
 * POST /api/import/batch
 *
 * Receives a batch of prompt-response pairs for import.
 *
 * Request body (BatchUploadRequest):
 * - pairs: Array of PromptWithFingerprint
 * - importId: Unique import operation ID
 * - teamId: Team ID for the import
 * - userId: User ID for the import
 * - projectPath: Optional project path for context
 *
 * Response (BatchUploadResponse):
 * - success: Whether batch was processed
 * - imported: Number of prompts imported
 * - skipped: Number of duplicates skipped
 * - error: Error message if failed
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();

    if (!user) {
      return NextResponse.json<BatchUploadResponse>(
        { success: false, imported: 0, skipped: 0, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json<BatchUploadResponse>(
        { success: false, imported: 0, skipped: 0, error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    if (!validateBatchPayload(body)) {
      return NextResponse.json<BatchUploadResponse>(
        { success: false, imported: 0, skipped: 0, error: 'Invalid batch format' },
        { status: 400 }
      );
    }

    const { pairs, importId, teamId, userId, projectPath } = body;

    // Verify user has access to the team
    const { data: membership } = await userClient
      .from('team_members')
      .select('team_id, role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json<BatchUploadResponse>(
        { success: false, imported: 0, skipped: 0, error: 'Unauthorized: not a team member' },
        { status: 403 }
      );
    }

    // Get the default project for the team
    const { data: project } = await userClient
      .from('projects')
      .select('id')
      .eq('team_id', teamId)
      .eq('is_archived', false)
      .limit(1)
      .single();

    if (!project) {
      return NextResponse.json<BatchUploadResponse>(
        { success: false, imported: 0, skipped: 0, error: 'No active project found for team' },
        { status: 400 }
      );
    }

    // Use admin client for insert operations
    const adminClient = createAdminClient();

    // Get existing fingerprints to skip duplicates
    const fingerprints = pairs.map((p) => p.fingerprint);
    const existingFingerprints = await getExistingFingerprints(fingerprints, adminClient);

    // Filter out duplicates and garbage prompts
    const newPairs: PromptWithFingerprint[] = [];
    let skippedCount = 0;

    for (const pair of pairs) {
      if (existingFingerprints.has(pair.fingerprint)) {
        skippedCount++;
        continue;
      }

      if (isGarbagePrompt(pair.prompt.text)) {
        skippedCount++;
        continue;
      }

      newPairs.push(pair);
    }

    if (newPairs.length === 0) {
      return NextResponse.json<BatchUploadResponse>({
        success: true,
        imported: 0,
        skipped: skippedCount,
      });
    }

    // Prepare prompts for insert
    const promptsToInsert = newPairs.map((pair) => {
      const classification = classifyPrompt(pair.prompt.text);
      const charCount = pair.prompt.text.length;
      const wordCount = calculateWordCount(pair.prompt.text);

      return {
        team_id: teamId,
        project_id: project.id,
        user_id: userId,
        text: pair.prompt.text,
        char_count: charCount,
        word_count: wordCount,
        created_at: pair.prompt.timestamp,
        fingerprint: pair.fingerprint,
        prompt_type: classification.type,
        analysis_status: classification.analysisStatus,
        metadata: {
          source: 'historical_import',
          import_id: importId,
          project_path: projectPath,
        },
      };
    });

    // Insert prompts in batch
    const { data: insertedPrompts, error: insertError } = await adminClient
      .from('prompts')
      .insert(promptsToInsert)
      .select('id, analysis_status');

    if (insertError) {
      logger.error('Batch insert failed', insertError);
      return NextResponse.json<BatchUploadResponse>(
        { success: false, imported: 0, skipped: skippedCount, error: insertError.message },
        { status: 500 }
      );
    }

    const importedCount = insertedPrompts?.length ?? 0;

    // Insert responses for prompts that have them
    const responsesToInsert = newPairs
      .map((pair, index) => {
        if (!pair.response || !insertedPrompts?.[index]) return null;
        return {
          prompt_id: insertedPrompts[index].id,
          // Note: We don't encrypt responses during import for performance
          // Responses from historical import are stored as-is
          tool_count: 0,
          tools_used: [],
          model: pair.response.model || 'unknown',
          tokens_in: pair.response.tokens?.input || 0,
          tokens_out: pair.response.tokens?.output || 0,
          has_thinking: false,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (responsesToInsert.length > 0) {
      const { error: responseError } = await adminClient
        .from('prompt_responses')
        .insert(responsesToInsert);

      if (responseError) {
        logger.warn('Response insert failed (non-fatal)', { message: responseError.message });
        // Continue - responses are non-critical
      }
    }

    // Queue analysis jobs asynchronously for prompts that need it
    const promptsNeedingAnalysis = insertedPrompts
      ?.filter((p) => p.analysis_status === 'pending')
      .map((p) => p.id) ?? [];

    if (promptsNeedingAnalysis.length > 0) {
      // Fire and forget - don't block the response
      void triggerAnalysis(promptsNeedingAnalysis);
    }

    logger.log('Batch import completed', {
      importId,
      imported: importedCount,
      skipped: skippedCount,
      responsesInserted: responsesToInsert.length,
      analysisQueued: promptsNeedingAnalysis.length,
    });

    return NextResponse.json<BatchUploadResponse>({
      success: true,
      imported: importedCount,
      skipped: skippedCount,
    });
  } catch (error) {
    const err = error as Error;
    logger.error('Batch import error', err);
    return NextResponse.json<BatchUploadResponse>(
      { success: false, imported: 0, skipped: 0, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
