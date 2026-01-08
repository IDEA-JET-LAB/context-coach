/**
 * Cloud Import Upload API Endpoint
 *
 * POST /api/import/upload
 *
 * Receives JSONL transcript files from VS Code extension as JSON payload.
 * Processes files server-side for faster import experience.
 *
 * Flow:
 * 1. Accept JSON with files array containing JSONL content
 * 2. Parse JSONL files
 * 3. Process prompts and store in database
 * 4. Return import statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createScopedLogger } from '@/lib/utils/logger';
import { calculateWordCount } from '@/lib/capture/word-count';
import { classifyPrompt } from '@/lib/capture/classify-prompt';
import { isGarbagePrompt } from '@/lib/capture/store-prompt';
import { findOrCreateSession, linkPromptToSession } from '@/lib/sessions';
import { generateApiKey, hashApiKey, getApiKeyPrefix } from '@/lib/utils/api-key';
import * as crypto from 'crypto';

const logger = createScopedLogger('IMPORT-UPLOAD');

/**
 * Request body interface for JSON upload
 */
interface ImportUploadRequest {
  teamId: string;
  files: Array<{
    projectPath: string;
    fileName: string;
    content: string;
  }>;
}

interface ParsedMessage {
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  tokens?: { input: number; output: number };
  tools?: ExtractedToolUse[];
  thinking?: {
    text: string;
    wordCount: number;
    summary: string;
  };
  toolResults?: ExtractedToolResult[];
}

interface ExtractedToolResult {
  toolUseId: string;
  isError: boolean;
  outputSummary: string;
}

interface ExtractedToolUse {
  toolId: string;
  toolName: string;
  inputSummary: string;
  inputFull?: Record<string, unknown>;
}

interface PromptWithResponse {
  prompt: {
    text: string;
    timestamp: string;
  };
  response?: {
    text: string;
    timestamp: string;
    model?: string;
    tokens?: { input: number; output: number };
    tools?: ExtractedToolUse[];
    thinking?: {
      text: string;
      wordCount: number;
      summary: string;
    };
    toolResults?: ExtractedToolResult[];
  };
  fingerprint: string;
}

interface ProjectFile {
  projectPath: string;
  fileName: string;
  content: string;
}

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

/**
 * Generate fingerprint for deduplication.
 */
function generateFingerprint(userId: string, timestamp: string, text: string): string {
  const truncatedText = text.substring(0, 200);
  const minuteTimestamp = timestamp.substring(0, 16); // YYYY-MM-DDTHH:MM
  const input = `${userId}:${minuteTimestamp}:${truncatedText}`;
  return crypto.createHash('md5').update(input).digest('hex').substring(0, 12);
}

/**
 * Extract text content from message content blocks.
 */
function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === 'string') return block;
        if (block?.type === 'text' && typeof block.text === 'string') {
          return block.text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  return '';
}

/**
 * Extract text from assistant message (filter out tool_use blocks).
 */
function extractAssistantContent(content: unknown): string {
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .filter(
        (block): block is { type: string; text: string } =>
          typeof block === 'object' &&
          block !== null &&
          block.type === 'text' &&
          typeof block.text === 'string'
      )
      .map((block) => block.text)
      .join('\n');
  }

  return '';
}

/**
 * Summarize tool input for display.
 */
function summarizeToolInput(toolName: string, input: Record<string, unknown>): string {
  const MAX_LENGTH = 200;

  switch (toolName) {
    case 'Read':
      return `Read: ${input.file_path || 'unknown file'}`;
    case 'Write':
      return `Write: ${input.file_path || 'unknown file'}`;
    case 'Edit':
      return `Edit: ${input.file_path || 'unknown file'}`;
    case 'Bash': {
      const cmd = String(input.command || '').substring(0, 100);
      return `Bash: ${cmd}${cmd.length >= 100 ? '...' : ''}`;
    }
    case 'Glob':
      return `Glob: ${input.pattern || 'unknown pattern'}`;
    case 'Grep':
      return `Grep: ${input.pattern || 'unknown pattern'}`;
    default: {
      try {
        const str = JSON.stringify(input);
        if (str.length <= MAX_LENGTH) return str;
        return str.substring(0, MAX_LENGTH - 3) + '...';
      } catch {
        return `${toolName} invocation`;
      }
    }
  }
}

/**
 * Extract thinking content from assistant message.
 */
function extractThinking(content: unknown): { text: string; wordCount: number; summary: string } | undefined {
  if (!Array.isArray(content)) return undefined;

  for (const block of content) {
    if (
      typeof block === 'object' &&
      block !== null &&
      (block as Record<string, unknown>).type === 'thinking'
    ) {
      const thinkingBlock = block as Record<string, unknown>;
      const text = thinkingBlock.thinking as string;

      if (text && text.length > 0) {
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        // Create summary: truncate at 500 chars, try to end at sentence boundary
        let summary = text;
        if (summary.length > 500) {
          summary = summary.substring(0, 500);
          // Try to end at a sentence boundary
          const lastPeriod = summary.lastIndexOf('.');
          const lastQuestion = summary.lastIndexOf('?');
          const lastExclaim = summary.lastIndexOf('!');
          const lastSentence = Math.max(lastPeriod, lastQuestion, lastExclaim);
          if (lastSentence > 300) {
            summary = summary.substring(0, lastSentence + 1);
          } else {
            summary = summary + '...';
          }
        }

        return { text, wordCount, summary };
      }
    }
  }

  return undefined;
}

/**
 * Extract tool results from user message content.
 */
function extractToolResults(content: unknown): ExtractedToolResult[] | undefined {
  if (!Array.isArray(content)) return undefined;

  const results: ExtractedToolResult[] = [];

  for (const block of content) {
    if (
      typeof block === 'object' &&
      block !== null &&
      (block as Record<string, unknown>).type === 'tool_result'
    ) {
      const resultBlock = block as Record<string, unknown>;
      const toolUseId = resultBlock.tool_use_id as string;
      const isError = Boolean(resultBlock.is_error);
      const resultContent = resultBlock.content;

      // Summarize the result content
      let outputSummary = '';
      if (typeof resultContent === 'string') {
        outputSummary = resultContent.substring(0, 500);
        if (resultContent.length > 500) outputSummary += '...';
      } else if (Array.isArray(resultContent)) {
        const text = resultContent
          .filter((b): b is { type: string; text: string } =>
            typeof b === 'object' && b !== null && b.type === 'text'
          )
          .map((b) => b.text)
          .join('\n');
        outputSummary = text.substring(0, 500);
        if (text.length > 500) outputSummary += '...';
      }

      if (toolUseId) {
        results.push({
          toolUseId,
          isError,
          outputSummary: outputSummary || (isError ? 'Error' : 'Success'),
        });
      }
    }
  }

  return results.length > 0 ? results : undefined;
}

/**
 * Extract tool usage from assistant message content.
 */
function extractToolUsage(content: unknown): ExtractedToolUse[] | undefined {
  if (!Array.isArray(content)) return undefined;

  const tools: ExtractedToolUse[] = [];

  for (const block of content) {
    if (
      typeof block === 'object' &&
      block !== null &&
      (block as Record<string, unknown>).type === 'tool_use'
    ) {
      const toolBlock = block as Record<string, unknown>;
      const toolId = toolBlock.id as string;
      const toolName = toolBlock.name as string;
      const input = toolBlock.input as Record<string, unknown> | undefined;

      if (toolId && toolName) {
        tools.push({
          toolId,
          toolName,
          inputSummary: input ? summarizeToolInput(toolName, input) : toolName,
          inputFull: input,
        });
      }
    }
  }

  return tools.length > 0 ? tools : undefined;
}

/**
 * Parse a JSONL file content into prompt-response pairs.
 */
function parseJsonlContent(content: string, userId: string, fileName?: string): PromptWithResponse[] {
  const pairs: PromptWithResponse[] = [];
  const lines = content.split('\n').filter((line) => line.trim());

  const messages: ParsedMessage[] = [];
  let userMessageCount = 0;
  let assistantMessageCount = 0;
  let otherTypeCount = 0;
  let parseErrorCount = 0;

  for (const line of lines) {
    try {
      const message = JSON.parse(line);

      if (message.type === 'user' && message.message?.content) {
        const text = extractTextContent(message.message.content);
        const toolResults = extractToolResults(message.message.content);

        if (text && text.length > 0) {
          userMessageCount++;
          messages.push({
            type: 'user',
            content: text,
            timestamp: message.timestamp || new Date().toISOString(),
            toolResults,
          });
        } else if (toolResults && toolResults.length > 0) {
          // User message with only tool results (no text)
          // Attach results to previous assistant message's tools
          const lastMsg = messages[messages.length - 1];
          if (lastMsg?.type === 'assistant' && lastMsg.tools) {
            // Merge tool results
            lastMsg.toolResults = [...(lastMsg.toolResults || []), ...toolResults];
          }
        }
      } else if (message.type === 'assistant' && message.message) {
        assistantMessageCount++;
        const text = extractAssistantContent(message.message.content);
        const usage = message.message.usage;
        const tools = extractToolUsage(message.message.content);
        const thinking = extractThinking(message.message.content);

        // Only include assistant messages that have actual text content
        // Skip thinking-only or tool-use-only blocks
        if (text && text.length > 0) {
          messages.push({
            type: 'assistant',
            content: text,
            timestamp: message.timestamp || new Date().toISOString(),
            model: message.message.model,
            tokens: usage
              ? {
                  input: usage.input_tokens || 0,
                  output: usage.output_tokens || 0,
                }
              : undefined,
            tools,
            thinking,
          });
        } else if (tools && tools.length > 0) {
          // If there's tool usage but no text, still capture the tools
          // but merge with previous assistant message if exists
          const lastMsg = messages[messages.length - 1];
          if (lastMsg?.type === 'assistant') {
            // Merge tools into previous assistant message
            lastMsg.tools = [...(lastMsg.tools || []), ...tools];
            // Also merge thinking if present
            if (thinking && !lastMsg.thinking) {
              lastMsg.thinking = thinking;
            }
          }
        } else if (thinking) {
          // Thinking-only block - attach to previous assistant message if exists
          const lastMsg = messages[messages.length - 1];
          if (lastMsg?.type === 'assistant' && !lastMsg.thinking) {
            lastMsg.thinking = thinking;
          }
        }
      } else {
        otherTypeCount++;
      }
    } catch {
      parseErrorCount++;
      // Skip malformed lines
    }
  }

  // Log parsing stats
  logger.log('JSONL parsing stats', {
    fileName,
    totalLines: lines.length,
    userMessages: userMessageCount,
    assistantMessages: assistantMessageCount,
    otherTypes: otherTypeCount,
    parseErrors: parseErrorCount,
    finalPairs: messages.filter(m => m.type === 'user').length,
  });

  // Pair user messages with subsequent assistant responses
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg) continue;
    if (msg.type === 'user') {
      const nextMsg = messages[i + 1];
      const response = nextMsg?.type === 'assistant' ? nextMsg : undefined;

      // Also check if following user message has tool results to attach
      let toolResults = response?.toolResults;
      const msgAfterResponse = messages[i + 2];
      if (response && msgAfterResponse?.type === 'user' && msgAfterResponse.toolResults) {
        // User message after assistant has tool results - attach them
        toolResults = [...(toolResults || []), ...msgAfterResponse.toolResults];
      }

      pairs.push({
        prompt: {
          text: msg.content,
          timestamp: msg.timestamp,
        },
        response: response
          ? {
              text: response.content,
              timestamp: response.timestamp,
              model: response.model,
              tokens: response.tokens,
              tools: response.tools,
              thinking: response.thinking,
              toolResults,
            }
          : undefined,
        fingerprint: generateFingerprint(userId, msg.timestamp, msg.content),
      });
    }
  }

  return pairs;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const adminClient = createAdminClient();
    let userId: string | null = null;

    // Check for VS Code access token
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const accessToken = authHeader.slice(7);
      userId = await verifyVSCodeToken(accessToken, adminClient);
      if (userId) {
        logger.log('VS Code token auth successful', { userId });
      }
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse JSON body
    let body: ImportUploadRequest;
    try {
      body = await request.json() as ImportUploadRequest;
    } catch (parseError) {
      logger.error('Failed to parse request body', { error: String(parseError) });
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { teamId, files } = body;

    if (!teamId) {
      return NextResponse.json(
        { success: false, error: 'Missing teamId' },
        { status: 400 }
      );
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing or empty files array' },
        { status: 400 }
      );
    }

    logger.log('Received import request', { teamId, fileCount: files.length });

    // Debug: list all received files
    for (const file of files) {
      logger.log('Received file', {
        fileName: file.fileName,
        projectPath: file.projectPath,
        contentLength: file.content?.length || 0,
      });
    }

    // Verify team membership
    const { data: membership } = await adminClient
      .from('team_members')
      .select('team_id, role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: not a team member' },
        { status: 403 }
      );
    }

    // Convert files from JSON payload to projectFiles format
    const projectFiles: ProjectFile[] = files.map((f) => ({
      projectPath: f.projectPath,
      fileName: f.fileName,
      content: f.content,
    }));

    // Get unique project paths being imported
    const uniqueProjectPaths = [...new Set(projectFiles.map((f) => f.projectPath))];
    logger.log('Unique projects in import', { projects: uniqueProjectPaths });

    // Create or find Contextor projects for each unique local project path
    const projectPathToId = new Map<string, string>();

    for (const localPath of uniqueProjectPaths) {
      // Extract project name from path (last folder name)
      const projectName = localPath.split('/').filter(Boolean).pop() || 'Imported Project';

      // Check if we already have a project with this import_source_path
      const { data: existingProject } = await adminClient
        .from('projects')
        .select('id')
        .eq('team_id', teamId)
        .eq('is_archived', false)
        .contains('metadata', { import_source_path: localPath })
        .limit(1)
        .single();

      if (existingProject) {
        projectPathToId.set(localPath, existingProject.id);
        logger.log('Found existing Contextor project for import path', {
          localPath,
          projectId: existingProject.id,
        });
      } else {
        // Create a new Contextor project for this import source
        // Generate API key for the new project (required field)
        const apiKey = generateApiKey();
        const apiKeyHash = hashApiKey(apiKey);
        const apiKeyPrefix = getApiKeyPrefix(apiKey);

        const { data: newProject, error: createError } = await adminClient
          .from('projects')
          .insert({
            team_id: teamId,
            name: `${projectName} (Imported)`,
            description: `Imported from: ${localPath}`,
            is_archived: false,
            api_key_hash: apiKeyHash,
            api_key_prefix: apiKeyPrefix,
            metadata: {
              import_source_path: localPath,
              imported_at: new Date().toISOString(),
            },
          })
          .select('id')
          .single();

        if (createError) {
          logger.error('Failed to create project for import', {
            localPath,
            error: createError,
          });
          // Fall back to default project
          const { data: defaultProject } = await adminClient
            .from('projects')
            .select('id')
            .eq('team_id', teamId)
            .eq('is_archived', false)
            .limit(1)
            .single();

          if (defaultProject) {
            projectPathToId.set(localPath, defaultProject.id);
          }
        } else if (newProject) {
          projectPathToId.set(localPath, newProject.id);
          logger.log('Created new Contextor project for import', {
            localPath,
            projectId: newProject.id,
            projectName: `${projectName} (Imported)`,
          });
        }
      }
    }

    // Ensure we have at least one project mapping
    if (projectPathToId.size === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to create projects for import' },
        { status: 500 }
      );
    }

    // Process all files and collect prompt-response pairs
    // Include sessionId extracted from filename (JSONL filename IS the Claude Code session ID)
    const allPairs: (PromptWithResponse & { projectPath: string; sessionId: string | null })[] = [];

    for (const file of projectFiles) {
      // Extract session ID from filename (e.g., "2e82c131-34bd-4c2e-a536-533abae59a83.jsonl" → "2e82c131-34bd-4c2e-a536-533abae59a83")
      const sessionId = file.fileName.replace(/\.jsonl$/i, '') || null;

      const pairs = parseJsonlContent(file.content, userId, file.fileName);

      // Debug: log prompts extracted from each file
      logger.log('Parsed file', {
        fileName: file.fileName,
        promptsFound: pairs.length,
        firstPromptPreview: pairs[0]?.prompt.text.substring(0, 50) || 'none',
      });

      pairs.forEach((pair) => {
        allPairs.push({ ...pair, projectPath: file.projectPath, sessionId });
      });
    }

    // Debug: log detailed parsing info
    const debugInfo = {
      totalFiles: projectFiles.length,
      totalPairs: allPairs.length,
      fileBreakdown: projectFiles.map((f, idx) => {
        const pairs = parseJsonlContent(f.content, userId, f.fileName);
        return {
          fileName: f.fileName,
          contentLength: f.content.length,
          promptsFound: pairs.length
        };
      })
    };

    logger.log('Parsed prompts from files', debugInfo);
    console.log('DEBUG PARSE INFO:', JSON.stringify(debugInfo, null, 2));

    // Check for existing fingerprints
    const fingerprints = allPairs.map((p) => p.fingerprint);
    const { data: existingPrompts } = await adminClient
      .from('prompts')
      .select('id, fingerprint')
      .in('fingerprint', fingerprints);

    const existingFingerprintMap = new Map<string, string>();
    existingPrompts?.forEach((row) => existingFingerprintMap.set(row.fingerprint, row.id));

    // Check which existing prompts have responses
    const existingPromptIds = Array.from(existingFingerprintMap.values());
    const { data: promptsWithResponses } = await adminClient
      .from('prompt_responses')
      .select('prompt_id')
      .in('prompt_id', existingPromptIds);

    const hasResponseSet = new Set(promptsWithResponses?.map((r) => r.prompt_id) ?? []);

    // Separate new vs existing
    const newPairs: (PromptWithResponse & { projectPath: string; sessionId: string | null })[] = [];
    const existingNeedingResponses: { promptId: string; pair: PromptWithResponse & { projectPath: string; sessionId: string | null } }[] = [];
    let skippedCount = 0;
    let skippedGarbage = 0;
    let skippedDuplicate = 0;
    let skippedBatchDuplicate = 0;

    // Track fingerprints seen in this batch to avoid duplicates within the import
    const seenFingerprintsInBatch = new Set<string>();

    for (const pair of allPairs) {
      if (isGarbagePrompt(pair.prompt.text)) {
        skippedCount++;
        skippedGarbage++;
        continue;
      }

      // Check for duplicates within the current import batch
      if (seenFingerprintsInBatch.has(pair.fingerprint)) {
        skippedCount++;
        skippedBatchDuplicate++;
        continue;
      }

      const existingPromptId = existingFingerprintMap.get(pair.fingerprint);
      if (existingPromptId) {
        if (!hasResponseSet.has(existingPromptId) && pair.response) {
          existingNeedingResponses.push({ promptId: existingPromptId, pair });
        } else {
          skippedCount++;
          skippedDuplicate++;
        }
      } else {
        newPairs.push(pair);
        seenFingerprintsInBatch.add(pair.fingerprint);
      }
    }

    logger.log('Prompt categorization complete', {
      total: allPairs.length,
      new: newPairs.length,
      skippedGarbage,
      skippedDuplicate,
      existingNeedingResponses: existingNeedingResponses.length,
    });

    // Batch insert new prompts
    const BATCH_SIZE = 100;
    let importedCount = 0;
    let responsesInsertedCount = 0;
    const insertErrors: string[] = [];

    for (let i = 0; i < newPairs.length; i += BATCH_SIZE) {
      const batch = newPairs.slice(i, i + BATCH_SIZE);

      const promptsToInsert = batch.map((pair) => {
        const classification = classifyPrompt(pair.prompt.text);
        const charCount = pair.prompt.text.length;
        const wordCount = calculateWordCount(pair.prompt.text);

        // Get the Contextor project ID for this local project path
        const contextorProjectId = projectPathToId.get(pair.projectPath);
        if (!contextorProjectId) {
          logger.warn('No Contextor project found for path', { path: pair.projectPath });
        }

        return {
          team_id: teamId,
          project_id: contextorProjectId || Array.from(projectPathToId.values())[0],
          user_id: userId,
          text: pair.prompt.text,
          char_count: charCount,
          word_count: wordCount,
          created_at: pair.prompt.timestamp,
          fingerprint: pair.fingerprint,
          prompt_type: classification.type,
          analysis_status: classification.analysisStatus,
          metadata: {
            source: 'cloud_import',
            project_path: pair.projectPath,
            session_id: pair.sessionId, // Include session ID from JSONL filename
          },
        };
      });

      const { data: insertedPrompts, error: insertError } = await adminClient
        .from('prompts')
        .insert(promptsToInsert)
        .select('id, analysis_status');

      if (insertError) {
        logger.error('Batch insert failed', { error: insertError, batchIndex: i });
        insertErrors.push(`Batch ${i}: ${insertError.message}`);
        continue;
      }

      importedCount += insertedPrompts?.length ?? 0;

      // Link prompts to sessions (non-blocking, best effort)
      for (let j = 0; j < batch.length; j++) {
        const pair = batch[j];
        const insertedPrompt = insertedPrompts?.[j];

        if (!pair?.sessionId || !insertedPrompt) continue;

        try {
          const contextorProjectId = projectPathToId.get(pair.projectPath);
          // Pass the prompt timestamp as session start time for proper historical data
          const { id: sessionDbId } = await findOrCreateSession(
            pair.sessionId,
            {
              user_id: userId,
              team_id: teamId,
              project_id: contextorProjectId || undefined,
              is_imported: true,
            },
            new Date(pair.prompt.timestamp)
          );

          await linkPromptToSession(insertedPrompt.id, sessionDbId);
        } catch (err) {
          // Session linking is non-critical, log but don't fail
          logger.warn('Session linking failed for imported prompt', {
            promptId: insertedPrompt.id,
            sessionId: pair.sessionId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // Insert responses for new prompts
      for (let j = 0; j < batch.length; j++) {
        const pair = batch[j];
        const insertedPrompt = insertedPrompts?.[j];

        if (!pair?.response || !insertedPrompt) continue;

        const tools = pair.response.tools || [];
        const toolNames = tools.map((t) => t.toolName);
        const thinking = pair.response.thinking;
        const toolResults = pair.response.toolResults || [];

        try {
          const { data: responseId, error: rpcError } = await adminClient.rpc('insert_encrypted_response', {
            p_prompt_id: insertedPrompt.id,
            p_response_text: pair.response.text || null,
            p_tool_count: tools.length,
            p_tools_used: toolNames,
            p_model: pair.response.model || 'unknown',
            p_tokens_in: pair.response.tokens?.input || 0,
            p_tokens_out: pair.response.tokens?.output || 0,
            p_has_thinking: Boolean(thinking),
            p_thinking_summary: thinking?.summary || null,
            p_thinking_word_count: thinking?.wordCount || null,
            p_thinking_text: thinking?.text || null,
            p_created_at: pair.response.timestamp,
          });

          if (!rpcError && responseId) {
            responsesInsertedCount++;

            // Insert tool executions
            if (tools.length > 0) {
              const toolExecutions = tools.map((tool, idx) => {
                // Find matching tool result
                const result = toolResults.find((r) => r.toolUseId === tool.toolId);

                return {
                  response_id: responseId,
                  tool_name: tool.toolName,
                  tool_id: tool.toolId,
                  input_summary: tool.inputSummary,
                  input_full: tool.inputFull || null,
                  output_summary: result?.outputSummary || null,
                  result_matched: Boolean(result),
                  success: result ? !result.isError : null,
                  execution_order: idx + 1,
                };
              });

              const { error: toolError } = await adminClient
                .from('tool_executions')
                .insert(toolExecutions);

              if (toolError) {
                logger.warn('Tool executions insert failed', {
                  promptId: insertedPrompt.id,
                  error: toolError.message,
                });
              }
            }
          }
        } catch (err) {
          logger.warn('Response insert failed', {
            promptId: insertedPrompt.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    // Insert responses for existing prompts that need them
    let existingUpdatedCount = 0;
    for (const { promptId, pair } of existingNeedingResponses) {
      if (!pair.response) continue;

      const tools = pair.response.tools || [];
      const toolNames = tools.map((t) => t.toolName);
      const thinking = pair.response.thinking;
      const toolResults = pair.response.toolResults || [];

      try {
        const { data: responseId, error: rpcError } = await adminClient.rpc('insert_encrypted_response', {
          p_prompt_id: promptId,
          p_response_text: pair.response.text || null,
          p_tool_count: tools.length,
          p_tools_used: toolNames,
          p_model: pair.response.model || 'unknown',
          p_tokens_in: pair.response.tokens?.input || 0,
          p_tokens_out: pair.response.tokens?.output || 0,
          p_has_thinking: Boolean(thinking),
          p_thinking_summary: thinking?.summary || null,
          p_thinking_word_count: thinking?.wordCount || null,
          p_thinking_text: thinking?.text || null,
          p_created_at: pair.response.timestamp,
        });

        if (!rpcError && responseId) {
          existingUpdatedCount++;

          // Insert tool executions for existing prompts too
          if (tools.length > 0) {
            const toolExecutions = tools.map((tool, idx) => {
              const result = toolResults.find((r) => r.toolUseId === tool.toolId);
              return {
                response_id: responseId,
                tool_name: tool.toolName,
                tool_id: tool.toolId,
                input_summary: tool.inputSummary,
                input_full: tool.inputFull || null,
                output_summary: result?.outputSummary || null,
                result_matched: Boolean(result),
                success: result ? !result.isError : null,
                execution_order: idx + 1,
              };
            });

            await adminClient
              .from('tool_executions')
              .insert(toolExecutions);
          }
        }
      } catch {
        // Ignore errors for existing prompt updates
      }
    }

    const duration = Date.now() - startTime;

    logger.log('Cloud import completed', {
      duration: `${duration}ms`,
      files: projectFiles.length,
      totalPairs: allPairs.length,
      imported: importedCount,
      skipped: skippedCount,
      responses: responsesInsertedCount,
      existingUpdated: existingUpdatedCount,
    });

    // Include debug info for troubleshooting
    const debugParseInfo = projectFiles.map((f) => ({
      fileName: f.fileName,
      contentLength: f.content.length,
      lines: f.content.split('\n').filter(l => l.trim()).length,
    }));

    return NextResponse.json({
      success: true,
      imported: importedCount,
      skipped: skippedCount,
      updated: existingUpdatedCount,
      responses: responsesInsertedCount,
      duration,
      filesProcessed: projectFiles.length,
      debug: {
        totalPairsFound: allPairs.length,
        newPairsCount: newPairs.length,
        existingNeedingResponses: existingNeedingResponses.length,
        skippedGarbage,
        skippedDuplicate,
        skippedBatchDuplicate,
        existingFingerprints: existingFingerprintMap.size,
        insertErrors,
      },
    });
  } catch (error) {
    let errorMessage = 'Unknown error';
    let errorStack = '';

    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack || '';
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else {
      try {
        errorMessage = JSON.stringify(error);
      } catch {
        errorMessage = String(error);
      }
    }

    logger.error('Cloud import error', {
      errorMessage,
      errorStack,
      errorType: typeof error,
    });

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
