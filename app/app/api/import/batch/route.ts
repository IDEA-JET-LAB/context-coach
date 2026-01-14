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
 * Response metadata for richness comparison.
 */
interface ExistingResponseMeta {
  promptId: string;
  hasThinking: boolean;
  toolCount: number;
  model: string | null;
}

/**
 * Get existing responses with metadata for richness comparison.
 */
async function getExistingResponsesWithMeta(
  promptIds: string[],
  supabase: ReturnType<typeof createAdminClient>
): Promise<Map<string, ExistingResponseMeta>> {
  if (promptIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('prompt_responses')
    .select('prompt_id, has_thinking, tool_count, model')
    .in('prompt_id', promptIds);

  if (error) {
    logger.error('Failed to check existing responses', error);
    return new Map();
  }

  const map = new Map<string, ExistingResponseMeta>();
  data?.forEach((row) => {
    map.set(row.prompt_id, {
      promptId: row.prompt_id,
      hasThinking: row.has_thinking ?? false,
      toolCount: row.tool_count ?? 0,
      model: row.model ?? null,
    });
  });
  return map;
}

/**
 * Details about why import is richer than existing response.
 */
interface EnrichmentReason {
  isRicher: boolean;
  reasons: string[];
  comparison: {
    existing: { hasThinking: boolean; toolCount: number; model: string | null };
    import: { hasThinking: boolean; toolCount: number; model: string | null };
  };
}

/**
 * Check if import data is "richer" than existing response.
 * Richer means: import has thinking when existing doesn't,
 * OR import has more tools, OR import has model when existing doesn't.
 * Returns detailed reasons for logging.
 */
function checkEnrichmentEligibility(
  importPair: PromptWithFingerprint,
  existing: ExistingResponseMeta
): EnrichmentReason {
  const reasons: string[] = [];
  const importHasThinking = Boolean(importPair.response?.thinking);
  const importToolCount = importPair.response?.tools?.length ?? 0;
  const importModel = importPair.response?.model ?? null;

  const comparison = {
    existing: {
      hasThinking: existing.hasThinking,
      toolCount: existing.toolCount,
      model: existing.model,
    },
    import: {
      hasThinking: importHasThinking,
      toolCount: importToolCount,
      model: importModel,
    },
  };

  if (!importPair.response) {
    return { isRicher: false, reasons: ['no import response'], comparison };
  }

  // Import has thinking, existing doesn't
  if (importHasThinking && !existing.hasThinking) {
    reasons.push(`thinking: import has thinking, existing doesn't`);
  }

  // Import has more tools
  if (importToolCount > existing.toolCount) {
    reasons.push(`tools: import has ${importToolCount}, existing has ${existing.toolCount}`);
  }

  // Import has model, existing doesn't
  if (importModel && !existing.model) {
    reasons.push(`model: import has "${importModel}", existing has none`);
  }

  return {
    isRicher: reasons.length > 0,
    reasons,
    comparison,
  };
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

    // Get existing responses with metadata for richness comparison
    const existingPromptIds = Array.from(existingPrompts.values());
    const existingResponses = await getExistingResponsesWithMeta(existingPromptIds, adminClient);

    // Separate into categories:
    // - newPairs: new prompts to insert
    // - existingPairsNeedingResponses: existing prompts without responses, import has response
    // - existingPairsToEnrich: existing prompts with responses, but import has richer data
    const newPairs: PromptWithFingerprint[] = [];
    const existingPairsNeedingResponses: { promptId: string; pair: PromptWithFingerprint }[] = [];
    const existingPairsToEnrich: { promptId: string; pair: PromptWithFingerprint }[] = [];
    let skippedCount = 0;

    for (const pair of pairs) {
      if (isGarbagePrompt(pair.prompt.text)) {
        skippedCount++;
        continue;
      }

      const existingPromptId = existingPrompts.get(pair.fingerprint);
      if (existingPromptId) {
        // Prompt exists - check what action to take
        const existingResponse = existingResponses.get(existingPromptId);

        if (!existingResponse && pair.response) {
          // No response exists, import has one - add response
          existingPairsNeedingResponses.push({ promptId: existingPromptId, pair });
        } else if (existingResponse && pair.response) {
          // Check if import is richer
          const enrichmentCheck = checkEnrichmentEligibility(pair, existingResponse);
          if (enrichmentCheck.isRicher) {
            // Response exists but import is richer - enrich
            logger.log('[ENRICHMENT] Prompt eligible for enrichment', {
              promptId: existingPromptId,
              promptPreview: pair.prompt.text.substring(0, 80) + '...',
              reasons: enrichmentCheck.reasons,
              comparison: enrichmentCheck.comparison,
            });
            existingPairsToEnrich.push({ promptId: existingPromptId, pair });
          } else {
            skippedCount++;
          }
        } else {
          // No import response
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
      existingToEnrich: existingPairsToEnrich.length,
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
      const hasThinking = Boolean(pair.response.thinking);

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
          p_has_thinking: hasThinking,
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
      const hasThinking = Boolean(pair.response.thinking);

      try {
        const { data: responseId, error: rpcError } = await adminClient.rpc('insert_encrypted_response', {
          p_prompt_id: promptId,
          p_response_text: pair.response.text || null,
          p_tool_count: tools.length,
          p_tools_used: toolNames,
          p_model: pair.response.model || 'unknown',
          p_tokens_in: pair.response.tokens?.input || 0,
          p_tokens_out: pair.response.tokens?.output || 0,
          p_has_thinking: hasThinking,
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

    // Enrich existing prompts that have responses but import has richer data
    // Strategy: DELETE existing response (cascade deletes tool_executions), INSERT new one
    let enrichedCount = 0;
    let enrichedToolExecutionsCount = 0;

    logger.log('[ENRICHMENT] Starting enrichment process', {
      promptsToEnrich: existingPairsToEnrich.length,
    });

    for (const { promptId, pair } of existingPairsToEnrich) {
      if (!pair.response) continue;

      const tools = pair.response.tools || [];
      const toolNames = tools.map(t => t.toolName);
      const hasThinking = Boolean(pair.response.thinking);

      logger.log('[ENRICHMENT] Processing prompt', {
        promptId,
        promptPreview: pair.prompt.text.substring(0, 60),
        newData: {
          model: pair.response.model,
          hasThinking,
          toolCount: tools.length,
          tokensIn: pair.response.tokens?.input,
          tokensOut: pair.response.tokens?.output,
        },
      });

      try {
        // Delete existing response (tool_executions will cascade delete)
        const { error: deleteError } = await adminClient
          .from('prompt_responses')
          .delete()
          .eq('prompt_id', promptId);

        if (deleteError) {
          logger.warn('[ENRICHMENT] Failed to delete existing response', {
            promptId,
            message: deleteError.message
          });
          continue;
        }

        logger.log('[ENRICHMENT] Deleted old response, inserting new one', { promptId });

        const { data: responseId, error: rpcError } = await adminClient.rpc('insert_encrypted_response', {
          p_prompt_id: promptId,
          p_response_text: pair.response.text || null,
          p_tool_count: tools.length,
          p_tools_used: toolNames,
          p_model: pair.response.model || 'unknown',
          p_tokens_in: pair.response.tokens?.input || 0,
          p_tokens_out: pair.response.tokens?.output || 0,
          p_has_thinking: hasThinking,
        });

        if (rpcError) {
          logger.warn('Response insert failed during enrichment', {
            promptId,
            message: rpcError.message
          });
          continue;
        }

        enrichedCount++;

        logger.log('[ENRICHMENT] Successfully enriched prompt', {
          promptId,
          responseId,
          model: pair.response.model,
          hasThinking,
          toolCount: tools.length,
        });

        // Update prompt metadata (model, tokens, has_thinking)
        const promptUpdate: Record<string, unknown> = {};
        if (pair.response.model) promptUpdate.model = pair.response.model;
        if (pair.response.tokens?.input) promptUpdate.input_tokens = pair.response.tokens.input;
        if (pair.response.tokens?.output) promptUpdate.output_tokens = pair.response.tokens.output;
        if (hasThinking) promptUpdate.has_thinking = true;

        if (Object.keys(promptUpdate).length > 0) {
          const { error: updateError } = await adminClient
            .from('prompts')
            .update(promptUpdate)
            .eq('id', promptId);

          if (updateError) {
            logger.warn('Failed to update prompt metadata during enrichment', {
              promptId,
              message: updateError.message
            });
          }
        }

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
            logger.warn('Tool executions insert failed during enrichment', {
              promptId,
              responseId,
              message: toolError.message
            });
          } else {
            enrichedToolExecutionsCount += tools.length;
          }
        }
      } catch (err) {
        logger.warn('[ENRICHMENT] Exception during enrichment', {
          promptId,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }

    if (existingPairsToEnrich.length > 0) {
      logger.log('[ENRICHMENT] Enrichment process complete', {
        attempted: existingPairsToEnrich.length,
        succeeded: enrichedCount,
        failed: existingPairsToEnrich.length - enrichedCount,
        toolExecutionsAdded: enrichedToolExecutionsCount,
      });
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
      enrichedCount,
      enrichedToolExecutionsCount,
      analysisQueued: promptsNeedingAnalysis.length,
    });

    return NextResponse.json<BatchUploadResponse>({
      success: true,
      imported: importedCount,
      skipped: skippedCount,
      updated: existingResponsesCount, // Number of existing prompts that got responses added
      enriched: enrichedCount, // Number of existing prompts that got richer responses
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
