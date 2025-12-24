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
 * Returns a map of fingerprint -> prompt_id for existing prompts.
 */
async function getExistingPromptsByFingerprint(
  fingerprints: string[],
  supabase: ReturnType<typeof createAdminClient>
): Promise<Map<string, string>> {
  if (fingerprints.length === 0) return new Map();

  const { data, error } = await supabase
    .from('prompts')
    .select('id, fingerprint')
    .in('fingerprint', fingerprints);

  if (error) {
    logger.error('Failed to check existing fingerprints', error);
    throw new Error(`Database error: ${error.message}`);
  }

  const map = new Map<string, string>();
  data?.forEach((row) => map.set(row.fingerprint, row.id));
  return map;
}

/**
 * Check which prompts already have responses.
 */
async function getPromptsWithResponses(
  promptIds: string[],
  supabase: ReturnType<typeof createAdminClient>
): Promise<Set<string>> {
  if (promptIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from('prompt_responses')
    .select('prompt_id')
    .in('prompt_id', promptIds);

  if (error) {
    logger.error('Failed to check existing responses', error);
    return new Set();
  }

  return new Set(data?.map((row) => row.prompt_id) ?? []);
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
/**
 * Verify VS Code access token and get user ID.
 */
async function verifyVSCodeToken(
  accessToken: string,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  const { data: tokenRecord, error } = await adminClient
    .from('vscode_tokens')
    .select('user_id, access_token_expires_at, revoked_at')
    .eq('access_token', accessToken)
    .single();

  if (error || !tokenRecord) return null;
  if (tokenRecord.revoked_at) return null;
  if (new Date(tokenRecord.access_token_expires_at) < new Date()) return null;

  return tokenRecord.user_id;
}

export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient();
    let userId: string | null = null;
    let userClient: Awaited<ReturnType<typeof createClient>> | null = null;

    // Check for VS Code access token in Authorization header
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const accessToken = authHeader.slice(7);
      userId = await verifyVSCodeToken(accessToken, adminClient);
      if (userId) {
        logger.log('VS Code token auth successful', { userId });
      }
    }

    // If no VS Code token, try Supabase session auth
    if (!userId) {
      userClient = await createClient();
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        userId = user.id;
      }
    }

    if (!userId) {
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

    const { pairs, importId, teamId, projectPath } = body;
    // Note: userId comes from auth check above, not from body

    // Verify user has access to the team using admin client (works for both auth methods)
    const { data: membership } = await adminClient
      .from('team_members')
      .select('team_id, role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return NextResponse.json<BatchUploadResponse>(
        { success: false, imported: 0, skipped: 0, error: 'Unauthorized: not a team member' },
        { status: 403 }
      );
    }

    // Get the default project for the team
    const { data: project } = await adminClient
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

    // Get existing prompts by fingerprint
    const fingerprints = pairs.map((p) => p.fingerprint);
    const existingPrompts = await getExistingPromptsByFingerprint(fingerprints, adminClient);

    // Check which existing prompts already have responses
    const existingPromptIds = Array.from(existingPrompts.values());
    const promptsWithResponses = await getPromptsWithResponses(existingPromptIds, adminClient);

    // Separate into new prompts and existing prompts that need responses
    const newPairs: PromptWithFingerprint[] = [];
    const existingPairsNeedingResponses: { promptId: string; pair: PromptWithFingerprint }[] = [];
    let skippedCount = 0;

    for (const pair of pairs) {
      if (isGarbagePrompt(pair.prompt.text)) {
        skippedCount++;
        continue;
      }

      const existingPromptId = existingPrompts.get(pair.fingerprint);
      if (existingPromptId) {
        // Prompt exists - check if it needs a response
        if (!promptsWithResponses.has(existingPromptId) && pair.response) {
          existingPairsNeedingResponses.push({ promptId: existingPromptId, pair });
        } else {
          skippedCount++;
        }
      } else {
        newPairs.push(pair);
      }
    }

    logger.log('Import batch analysis', {
      total: pairs.length,
      newPrompts: newPairs.length,
      existingNeedingResponses: existingPairsNeedingResponses.length,
      skipped: skippedCount,
    });

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
    // Uses insert_encrypted_response RPC to properly encrypt response text
    let responsesInsertedCount = 0;
    let toolExecutionsInsertedCount = 0;

    for (let i = 0; i < newPairs.length; i++) {
      const pair = newPairs[i];
      const insertedPrompt = insertedPrompts?.[i];

      if (!pair?.response || !insertedPrompt) continue;

      const tools = pair.response.tools || [];
      const toolNames = tools.map(t => t.toolName);

      try {
        // Insert response with encrypted text and get response ID
        const { data: responseId, error: rpcError } = await adminClient.rpc('insert_encrypted_response', {
          p_prompt_id: insertedPrompt.id,
          p_response_text: pair.response.text || null,
          p_tool_count: tools.length,
          p_tools_used: toolNames,
          p_model: pair.response.model || 'unknown',
          p_tokens_in: pair.response.tokens?.input || 0,
          p_tokens_out: pair.response.tokens?.output || 0,
          p_has_thinking: false,
        });

        if (rpcError) {
          logger.warn('Response insert failed for prompt', {
            promptId: insertedPrompt.id,
            message: rpcError.message
          });
          continue;
        }

        responsesInsertedCount++;

        // Insert tool executions if we have tools and got a response ID
        if (tools.length > 0 && responseId) {
          const toolExecutions = tools.map((tool, order) => ({
            response_id: responseId,
            tool_name: tool.toolName,
            tool_id: tool.toolId,
            input_summary: tool.inputSummary,
            input_full: tool.inputFull || null,
            output_summary: null, // We don't have results during import
            result_matched: false,
            success: null,
            execution_order: order + 1,
          }));

          const { error: toolError } = await adminClient
            .from('tool_executions')
            .insert(toolExecutions);

          if (toolError) {
            logger.warn('Tool executions insert failed', {
              responseId,
              message: toolError.message
            });
          } else {
            toolExecutionsInsertedCount += tools.length;
          }
        }
      } catch (err) {
        logger.warn('Response insert exception', {
          promptId: insertedPrompt.id,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }

    // Insert responses for EXISTING prompts that are missing them
    let existingResponsesCount = 0;
    let existingToolExecutionsCount = 0;

    for (const { promptId, pair } of existingPairsNeedingResponses) {
      if (!pair.response) continue;

      const tools = pair.response.tools || [];
      const toolNames = tools.map(t => t.toolName);

      try {
        const { data: responseId, error: rpcError } = await adminClient.rpc('insert_encrypted_response', {
          p_prompt_id: promptId,
          p_response_text: pair.response.text || null,
          p_tool_count: tools.length,
          p_tools_used: toolNames,
          p_model: pair.response.model || 'unknown',
          p_tokens_in: pair.response.tokens?.input || 0,
          p_tokens_out: pair.response.tokens?.output || 0,
          p_has_thinking: false,
        });

        if (rpcError) {
          logger.warn('Response insert failed for existing prompt', {
            promptId,
            message: rpcError.message
          });
          continue;
        }

        existingResponsesCount++;

        // Insert tool executions
        if (tools.length > 0 && responseId) {
          const toolExecutions = tools.map((tool, order) => ({
            response_id: responseId,
            tool_name: tool.toolName,
            tool_id: tool.toolId,
            input_summary: tool.inputSummary,
            input_full: tool.inputFull || null,
            output_summary: null,
            result_matched: false,
            success: null,
            execution_order: order + 1,
          }));

          const { error: toolError } = await adminClient
            .from('tool_executions')
            .insert(toolExecutions);

          if (toolError) {
            logger.warn('Tool executions insert failed for existing prompt', {
              promptId,
              responseId,
              message: toolError.message
            });
          } else {
            existingToolExecutionsCount += tools.length;
          }
        }
      } catch (err) {
        logger.warn('Response insert exception for existing prompt', {
          promptId,
          error: err instanceof Error ? err.message : String(err)
        });
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
      responsesInserted: responsesInsertedCount,
      toolExecutionsInserted: toolExecutionsInsertedCount,
      existingPromptsUpdated: existingResponsesCount,
      existingToolExecutionsInserted: existingToolExecutionsCount,
      analysisQueued: promptsNeedingAnalysis.length,
    });

    return NextResponse.json<BatchUploadResponse>({
      success: true,
      imported: importedCount,
      skipped: skippedCount,
      updated: existingResponsesCount, // Number of existing prompts that got responses added
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
