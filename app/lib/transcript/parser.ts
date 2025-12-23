/**
 * JSONL Parser for Claude Code Transcripts
 * Story 15-2: JSONL Parser Implementation
 *
 * Parses Claude Code transcript files line-by-line with streaming support
 * for memory-efficient processing of large files.
 */

import * as readline from 'readline';
import * as fs from 'fs';

// ============================================================================
// Types
// ============================================================================

/**
 * Token usage statistics from Claude API responses
 */
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

/**
 * All 8 message types found in Claude Code transcripts
 */
export type MessageType =
  | 'user'
  | 'assistant'
  | 'file-history-snapshot'
  | 'summary'
  | 'queue-operation'
  | 'tool_use'
  | 'tool_result'
  | 'thinking';

/**
 * Text content block
 */
export interface TextBlock {
  type: 'text';
  text: string;
}

/**
 * Tool invocation block
 */
export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Tool output block
 */
export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | ContentBlock[];
}

/**
 * Extended thinking block
 */
export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
  signature: string;
}

/**
 * Union of all content block types
 */
export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | ThinkingBlock;

/**
 * Message structure within a transcript entry
 */
export interface TranscriptMessageContent {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
  model?: string;
  id?: string;
  usage?: TokenUsage;
}

/**
 * A single parsed transcript message
 */
export interface TranscriptMessage {
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  timestamp: string;
  type: MessageType;
  message?: TranscriptMessageContent;
  cwd?: string;
  gitBranch?: string;
  version?: string;
  slug?: string;
  requestId?: string;
}

/**
 * Statistics from parsing a transcript file
 */
export interface ParseStats {
  totalLines: number;
  parsedLines: number;
  skippedLines: number;
  emptyLines: number;
  duration: number;
}

/**
 * Result from batch parsing
 */
export interface ParseResult {
  messages: TranscriptMessage[];
  stats: ParseStats;
}

/**
 * Options for batch parsing
 */
export interface ParseOptions {
  /** Maximum number of messages to parse */
  limit?: number;
  /** Whether to sort results by timestamp (default: true) */
  sort?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const VALID_TYPES: MessageType[] = [
  'user',
  'assistant',
  'file-history-snapshot',
  'summary',
  'queue-operation',
  'tool_use',
  'tool_result',
  'thinking',
];

// ============================================================================
// Validation and Normalization
// ============================================================================

/**
 * Check if a string is a valid MessageType
 */
function isValidMessageType(type: unknown): type is MessageType {
  return typeof type === 'string' && VALID_TYPES.includes(type as MessageType);
}

/**
 * Normalize a timestamp to ISO format
 */
function normalizeTimestamp(timestamp: unknown): string {
  if (typeof timestamp === 'string') {
    // Try to parse and re-format
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    // Return as-is if it looks like a timestamp
    return timestamp;
  }
  if (typeof timestamp === 'number') {
    return new Date(timestamp).toISOString();
  }
  // Default to current time if no valid timestamp
  return new Date().toISOString();
}

/**
 * Validate and normalize a parsed message.
 * Returns null if message is invalid, with warning logged.
 */
function validateAndNormalize(
  raw: unknown,
  lineNumber: number,
  warnings: string[]
): TranscriptMessage | null {
  if (!raw || typeof raw !== 'object') {
    warnings.push(`Line ${lineNumber}: Not an object`);
    return null;
  }

  const obj = raw as Record<string, unknown>;

  // Required field: uuid
  if (typeof obj.uuid !== 'string' || !obj.uuid.trim()) {
    warnings.push(`Line ${lineNumber}: Missing or invalid uuid`);
    return null;
  }

  // Required field: type (must be one of 8 valid types)
  if (!isValidMessageType(obj.type)) {
    warnings.push(`Line ${lineNumber}: Invalid type '${String(obj.type)}'`);
    return null;
  }

  // Normalize timestamp
  const timestamp = normalizeTimestamp(obj.timestamp);

  // Build the normalized message
  const message: TranscriptMessage = {
    uuid: obj.uuid,
    parentUuid: typeof obj.parentUuid === 'string' ? obj.parentUuid : null,
    sessionId: typeof obj.sessionId === 'string' ? obj.sessionId : '',
    timestamp,
    type: obj.type,
  };

  // Optional message content
  if (obj.message && typeof obj.message === 'object') {
    message.message = obj.message as TranscriptMessageContent;
  }

  // Optional string fields
  if (typeof obj.cwd === 'string') {
    message.cwd = obj.cwd;
  }
  if (typeof obj.gitBranch === 'string') {
    message.gitBranch = obj.gitBranch;
  }
  if (typeof obj.version === 'string') {
    message.version = obj.version;
  }
  if (typeof obj.slug === 'string') {
    message.slug = obj.slug;
  }
  if (typeof obj.requestId === 'string') {
    message.requestId = obj.requestId;
  }

  return message;
}

// ============================================================================
// Streaming Parser
// ============================================================================

/**
 * Stream-parse a transcript file, yielding messages one at a time.
 * Memory-efficient for large files - only holds one message at a time.
 *
 * @example
 * ```typescript
 * for await (const message of streamParseTranscript('/path/to/transcript.jsonl')) {
 *   console.log(message.type, message.uuid);
 * }
 * ```
 */
export async function* streamParseTranscript(
  filePath: string
): AsyncGenerator<TranscriptMessage, ParseStats, undefined> {
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineNumber = 0;
  let parsedLines = 0;
  let skippedLines = 0;
  let emptyLines = 0;
  const startTime = Date.now();
  const warnings: string[] = [];

  try {
    for await (const line of rl) {
      lineNumber++;

      // Skip empty lines silently
      if (!line.trim()) {
        emptyLines++;
        continue;
      }

      try {
        const parsed = JSON.parse(line);
        const message = validateAndNormalize(parsed, lineNumber, warnings);
        if (message) {
          parsedLines++;
          yield message;
        } else {
          skippedLines++;
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        warnings.push(`Line ${lineNumber}: Malformed JSON - ${errorMsg}`);
        skippedLines++;
      }
    }
  } finally {
    rl.close();
    fileStream.destroy();

    // Log warnings after processing
    for (const warning of warnings) {
      console.warn(`[parser] ${warning}`);
    }
  }

  return {
    totalLines: lineNumber,
    parsedLines,
    skippedLines,
    emptyLines,
    duration: Date.now() - startTime,
  };
}

// ============================================================================
// Batch Parser
// ============================================================================

/**
 * Parse entire transcript file into memory.
 * Use for smaller files or when random access is needed.
 *
 * @example
 * ```typescript
 * const { messages, stats } = await parseTranscript('/path/to/transcript.jsonl');
 * console.log(`Parsed ${stats.parsedLines} messages`);
 * ```
 */
export async function parseTranscript(
  filePath: string,
  options: ParseOptions = {}
): Promise<ParseResult> {
  const { limit, sort = true } = options;
  const startTime = Date.now();
  const messages: TranscriptMessage[] = [];
  let stats: ParseStats | null = null;
  let limitReached = false;

  const generator = streamParseTranscript(filePath);

  // Consume the generator
  let result = await generator.next();
  while (!result.done) {
    messages.push(result.value);

    // Check limit
    if (limit && messages.length >= limit) {
      limitReached = true;
      // Close generator early - stats won't be accurate when early terminated
      await generator.return({
        totalLines: 0,
        parsedLines: 0,
        skippedLines: 0,
        emptyLines: 0,
        duration: 0,
      });
      break;
    }

    result = await generator.next();
  }

  // Get final stats from generator if it completed normally
  if (result.done && result.value) {
    stats = result.value;
  }

  // Sort by timestamp for consistent ordering
  if (sort && messages.length > 0) {
    messages.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  // If limit was reached, we don't have accurate stats from generator
  // Use message count as parsed lines in that case
  const finalStats: ParseStats = stats ?? {
    totalLines: messages.length,
    parsedLines: messages.length,
    skippedLines: 0,
    emptyLines: 0,
    duration: Date.now() - startTime,
  };

  // When limit is reached, override parsed lines with actual message count
  if (limitReached) {
    finalStats.parsedLines = messages.length;
  }

  // Always use our own duration calculation
  finalStats.duration = Date.now() - startTime;

  return {
    messages,
    stats: finalStats,
  };
}

// ============================================================================
// Content Block Extraction
// ============================================================================

/**
 * Extract content blocks from an assistant message.
 * Returns an array of ContentBlock objects, converting string content to TextBlock.
 * Only processes assistant-type messages (returns empty array for other types).
 *
 * @example
 * ```typescript
 * const blocks = extractContentBlocks(assistantMessage);
 * for (const block of blocks) {
 *   if (block.type === 'tool_use') {
 *     console.log(`Tool: ${block.name}`);
 *   }
 * }
 * ```
 */
export function extractContentBlocks(message: TranscriptMessage): ContentBlock[] {
  // Only extract content blocks from assistant messages
  if (message.type !== 'assistant' || !message.message?.content) {
    return [];
  }

  // String content becomes a single TextBlock
  if (typeof message.message.content === 'string') {
    return [{ type: 'text', text: message.message.content }];
  }

  // Array content is already ContentBlock[]
  if (Array.isArray(message.message.content)) {
    return message.message.content as ContentBlock[];
  }

  return [];
}

/**
 * Extract plain text content from any message.
 * Concatenates all text blocks with newlines.
 *
 * @example
 * ```typescript
 * const text = extractTextContent(message);
 * console.log(`Message text: ${text}`);
 * ```
 */
export function extractTextContent(message: TranscriptMessage): string {
  if (!message.message?.content) {
    return '';
  }

  // String content is returned as-is
  if (typeof message.message.content === 'string') {
    return message.message.content;
  }

  // Array content: extract text from TextBlocks only
  if (Array.isArray(message.message.content)) {
    const blocks = message.message.content as ContentBlock[];
    return blocks
      .filter((block): block is TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
  }

  return '';
}

/**
 * Get all content blocks from any message, regardless of type.
 * Used internally by extraction helpers that need to work on any message type.
 */
function getAllContentBlocks(message: TranscriptMessage): ContentBlock[] {
  if (!message.message?.content) {
    return [];
  }

  if (typeof message.message.content === 'string') {
    return [{ type: 'text', text: message.message.content }];
  }

  if (Array.isArray(message.message.content)) {
    return message.message.content as ContentBlock[];
  }

  return [];
}

/**
 * Get all tool use blocks from a message (typically from assistant messages)
 */
export function extractToolUseBlocks(message: TranscriptMessage): ToolUseBlock[] {
  const blocks = getAllContentBlocks(message);
  return blocks.filter((block): block is ToolUseBlock => block.type === 'tool_use');
}

/**
 * Get all tool result blocks from a message (typically from user messages)
 */
export function extractToolResultBlocks(message: TranscriptMessage): ToolResultBlock[] {
  const blocks = getAllContentBlocks(message);
  return blocks.filter(
    (block): block is ToolResultBlock => block.type === 'tool_result'
  );
}

/**
 * Get all thinking blocks from a message (typically from assistant messages)
 */
export function extractThinkingBlocks(message: TranscriptMessage): ThinkingBlock[] {
  const blocks = getAllContentBlocks(message);
  return blocks.filter((block): block is ThinkingBlock => block.type === 'thinking');
}
