/**
 * Assistant Response Extraction
 * Story 15-4: Assistant Response Extraction
 *
 * Extracts Claude's responses with tool usage, thinking blocks, and token statistics
 * from parsed transcript messages.
 */

import {
  TranscriptMessage,
  ContentBlock,
  ToolUseBlock,
  ThinkingBlock,
  TextBlock,
  TokenUsage,
} from './parser';

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a single tool execution within an assistant response
 */
export interface ToolExecution {
  /** Tool use ID for matching with results (e.g., 'toolu_01...') */
  toolId: string;
  /** Tool name (e.g., 'Read', 'Write', 'Bash') */
  name: string;
  /** Summarized/truncated input for display */
  inputSummary: string;
  /** Full input object */
  input: Record<string, unknown>;
  /** Order of invocation (1-indexed) */
  order: number;
}

/**
 * Extracted and structured assistant response
 */
export interface ExtractedResponse {
  /** Original message UUID */
  uuid: string;
  /** Parent message UUID (links to user prompt) */
  parentUuid: string | null;
  /** Session identifier */
  sessionId: string;
  /** Response timestamp */
  timestamp: Date;
  /** API request ID for tracking */
  requestId: string | null;

  /** Response text (concatenated text blocks) */
  text: string;
  /** Character count */
  charCount: number;
  /** Word count */
  wordCount: number;

  /** Model name/version */
  model: string;
  /** API message ID */
  messageId: string | null;

  /** Token usage statistics */
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheCreation: number;
    total: number;
  };

  /** Tools used in this response */
  toolsUsed: ToolExecution[];
  /** Number of tools invoked */
  toolCount: number;

  /** Has thinking blocks */
  hasThinking: boolean;
  /** Number of thinking blocks */
  thinkingBlockCount: number;
  /** Thinking content (only if privacy allows) */
  thinkingContent: string | null;
}

/**
 * Result from extracting responses from a transcript
 */
export interface ResponseExtractionResult {
  responses: ExtractedResponse[];
  stats: {
    totalMessages: number;
    assistantMessages: number;
    extractedResponses: number;
    totalToolCalls: number;
    responsesWithThinking: number;
    totalInputTokens: number;
    totalOutputTokens: number;
  };
}

/**
 * Options for response extraction
 */
export interface ResponseExtractionOptions {
  /** Include thinking content in output (default: false for privacy) */
  includeThinkingContent?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum length for input summaries */
const MAX_SUMMARY_LENGTH = 100;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a message is an assistant response.
 * Messages must have type 'assistant' and role 'assistant'.
 */
export function isAssistantResponse(message: TranscriptMessage): boolean {
  return (
    message.type === 'assistant' &&
    message.message?.role === 'assistant'
  );
}

/**
 * Check if a content block is a valid text block
 */
function isTextBlock(block: ContentBlock): block is TextBlock {
  return block.type === 'text' && typeof (block as TextBlock).text === 'string';
}

/**
 * Check if a content block is a valid tool_use block with required fields
 */
function isValidToolUseBlock(block: ContentBlock): block is ToolUseBlock {
  if (block.type !== 'tool_use') {
    return false;
  }
  const toolBlock = block as Partial<ToolUseBlock>;
  return (
    typeof toolBlock.id === 'string' &&
    toolBlock.id.length > 0 &&
    typeof toolBlock.name === 'string' &&
    toolBlock.name.length > 0 &&
    toolBlock.input !== undefined &&
    typeof toolBlock.input === 'object' &&
    toolBlock.input !== null
  );
}

/**
 * Check if a content block is a valid thinking block
 */
function isThinkingBlock(block: ContentBlock): block is ThinkingBlock {
  return (
    block.type === 'thinking' &&
    typeof (block as ThinkingBlock).thinking === 'string'
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Count words in text.
 * Handles empty strings and multiple whitespace.
 */
function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  return trimmed.split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Summarize tool input for display (truncate large inputs).
 * Uses common patterns for well-known tools.
 */
export function summarizeToolInput(input: Record<string, unknown>): string {
  // Handle null/undefined input
  if (!input || typeof input !== 'object') {
    return '{}';
  }

  // Edit tool (check before file_path since Edit also has file_path)
  if ('old_string' in input && 'new_string' in input) {
    if ('file_path' in input && typeof input.file_path === 'string') {
      return `edit: ${input.file_path}`;
    }
    return 'edit operation';
  }

  // Read/Write tool - just file path
  if ('file_path' in input && typeof input.file_path === 'string') {
    return `file: ${input.file_path}`;
  }

  // Bash tool - command with truncation
  if ('command' in input && typeof input.command === 'string') {
    const cmd = input.command;
    const prefix = 'cmd: ';
    const maxCmdLength = MAX_SUMMARY_LENGTH - prefix.length;
    if (cmd.length <= maxCmdLength) {
      return `${prefix}${cmd}`;
    }
    return `${prefix}${cmd.slice(0, maxCmdLength - 3)}...`;
  }

  if ('pattern' in input && typeof input.pattern === 'string') {
    return `pattern: ${input.pattern}`;
  }

  if ('query' in input && typeof input.query === 'string') {
    return `query: ${input.query}`;
  }

  if ('url' in input && typeof input.url === 'string') {
    return `url: ${input.url}`;
  }

  // Generic: stringify and truncate
  try {
    const json = JSON.stringify(input);
    if (json.length <= MAX_SUMMARY_LENGTH) {
      return json;
    }
    return json.slice(0, MAX_SUMMARY_LENGTH - 3) + '...';
  } catch {
    return '[complex input]';
  }
}

/**
 * Extract content blocks from a message, handling both string and array content.
 * Returns empty array for messages without content.
 */
function getContentBlocks(message: TranscriptMessage): ContentBlock[] {
  if (!message.message?.content) {
    return [];
  }

  const content = message.message.content;

  // String content becomes a single text block
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  // Array content is returned as-is
  if (Array.isArray(content)) {
    return content as ContentBlock[];
  }

  return [];
}

/**
 * Extract token usage from message, with defaults for missing fields.
 */
function extractTokenUsage(message: TranscriptMessage): {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
  total: number;
} {
  const usage = message.message?.usage as TokenUsage | undefined;

  const input = usage?.input_tokens || 0;
  const output = usage?.output_tokens || 0;
  const cacheRead = usage?.cache_read_input_tokens || 0;
  const cacheCreation = usage?.cache_creation_input_tokens || 0;

  return {
    input,
    output,
    cacheRead,
    cacheCreation,
    total: input + output,
  };
}

/**
 * Extract a single assistant response from a message.
 * Assumes message has already been validated as an assistant response.
 */
function extractSingleResponse(
  message: TranscriptMessage,
  options: ResponseExtractionOptions,
  warnings: string[]
): ExtractedResponse {
  const contentBlocks = getContentBlocks(message);

  // Extract text blocks
  const textBlocks = contentBlocks.filter(isTextBlock);
  const text = textBlocks.map(b => b.text).join('\n');

  // Extract tool_use blocks with validation
  const toolsUsed: ToolExecution[] = [];
  let toolOrder = 0;

  for (const block of contentBlocks) {
    if (block.type === 'tool_use') {
      if (isValidToolUseBlock(block)) {
        toolOrder++;
        toolsUsed.push({
          toolId: block.id,
          name: block.name,
          inputSummary: summarizeToolInput(block.input),
          input: block.input,
          order: toolOrder,
        });
      } else {
        // Log warning for malformed tool_use block
        const blockPreview = JSON.stringify(block).slice(0, 200);
        warnings.push(
          `[extract-responses] Malformed tool_use block in message ${message.uuid}: ${blockPreview}`
        );
      }
    }
  }

  // Extract thinking blocks
  const thinkingBlocks = contentBlocks.filter(isThinkingBlock);
  const hasThinking = thinkingBlocks.length > 0;
  const thinkingContent = options.includeThinkingContent && hasThinking
    ? thinkingBlocks.map(b => b.thinking).join('\n---\n')
    : null;

  // Extract token usage
  const tokens = extractTokenUsage(message);

  // Extract model and message ID
  const model = message.message?.model || 'unknown';
  const messageId = (message.message as Record<string, unknown> | undefined)?.id as string | null || null;

  return {
    uuid: message.uuid,
    parentUuid: message.parentUuid,
    sessionId: message.sessionId,
    timestamp: new Date(message.timestamp),
    requestId: message.requestId || null,

    text,
    charCount: text.length,
    wordCount: countWords(text),

    model,
    messageId,

    tokens,

    toolsUsed,
    toolCount: toolsUsed.length,

    hasThinking,
    thinkingBlockCount: thinkingBlocks.length,
    thinkingContent,
  };
}

// ============================================================================
// Main Extraction Functions
// ============================================================================

/**
 * Extract responses from parsed transcript messages.
 *
 * @param messages - Array of parsed transcript messages
 * @param options - Extraction options (e.g., includeThinkingContent)
 * @returns Extracted responses with statistics
 *
 * @example
 * ```typescript
 * const { messages } = await parseTranscript('/path/to/transcript.jsonl');
 * const { responses, stats } = extractResponses(messages);
 *
 * console.log(`Extracted ${stats.extractedResponses} responses`);
 * console.log(`Total tool calls: ${stats.totalToolCalls}`);
 * ```
 */
export function extractResponses(
  messages: TranscriptMessage[],
  options: ResponseExtractionOptions = {}
): ResponseExtractionResult {
  const warnings: string[] = [];

  const stats = {
    totalMessages: messages.length,
    assistantMessages: 0,
    extractedResponses: 0,
    totalToolCalls: 0,
    responsesWithThinking: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
  };

  // Filter to assistant messages
  const assistantMessages = messages.filter(msg => {
    if (isAssistantResponse(msg)) {
      stats.assistantMessages++;
      return true;
    }
    return false;
  });

  // Extract each response
  const responses: ExtractedResponse[] = [];

  for (const msg of assistantMessages) {
    const response = extractSingleResponse(msg, options, warnings);
    responses.push(response);

    // Update stats
    stats.totalToolCalls += response.toolCount;
    if (response.hasThinking) {
      stats.responsesWithThinking++;
    }
    stats.totalInputTokens += response.tokens.input;
    stats.totalOutputTokens += response.tokens.output;
  }

  stats.extractedResponses = responses.length;

  // Log warnings
  for (const warning of warnings) {
    console.warn(warning);
  }

  return { responses, stats };
}

/**
 * Get list of unique tool names from extracted responses.
 * Useful for understanding what tools were used in a session.
 *
 * @param responses - Array of extracted responses
 * @returns Sorted array of unique tool names
 *
 * @example
 * ```typescript
 * const { responses } = extractResponses(messages);
 * const tools = getUniqueToolNames(responses);
 * // ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Write']
 * ```
 */
export function getUniqueToolNames(responses: ExtractedResponse[]): string[] {
  const names = new Set<string>();

  for (const response of responses) {
    for (const tool of response.toolsUsed) {
      names.add(tool.name);
    }
  }

  return Array.from(names).sort();
}
