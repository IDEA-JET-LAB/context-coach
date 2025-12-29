/**
 * Response Extraction Logic
 * Story 26-4: Response Extraction Logic
 *
 * TypeScript extraction logic for parsing Claude Code assistant messages.
 * Provides server-side validation and extraction for the response capture endpoint.
 *
 * This module handles raw Claude transcript data (as received from the Stop hook)
 * and extracts all relevant data for storage and analysis.
 */

import { compressThinking } from './thinkingCompressor';

// ============================================================================
// Types - Input (Claude Transcript Format)
// ============================================================================

/**
 * Content block types in Claude assistant messages
 */
export interface TextContentBlock {
  type: 'text';
  text: string;
}

export interface ThinkingContentBlock {
  type: 'thinking';
  thinking: string;
  signature?: string;
}

export interface ToolUseContentBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown; // We intentionally do NOT store this for privacy
}

export interface ToolResultContentBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: unknown;
}

export type ContentBlock =
  | TextContentBlock
  | ThinkingContentBlock
  | ToolUseContentBlock
  | ToolResultContentBlock;

/**
 * Token usage from Claude API
 */
export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/**
 * Inner message structure within assistant message
 */
export interface AssistantMessageInner {
  id: string;
  type?: 'message';
  role?: 'assistant';
  model: string;
  content: ContentBlock[];
  stop_reason: string;
  usage: Usage;
}

/**
 * Raw assistant message from Claude Code transcript
 */
export interface RawAssistantMessage {
  uuid: string;
  type: 'assistant';
  message: AssistantMessageInner;
  timestamp: string;
}

// ============================================================================
// Types - Output (Extracted Data)
// ============================================================================

/**
 * Tool use metadata (privacy-safe - no input)
 */
export interface ToolUse {
  name: string;
  id: string;
}

/**
 * Extracted thinking content with compression
 */
export interface ThinkingResult {
  /** Compressed summary */
  summary: string;
  /** Original word count */
  wordCount: number;
  /** Full thinking text (may be stored separately or discarded) */
  fullText: string;
}

/**
 * Cache usage statistics
 */
export interface CacheStats {
  /** Tokens created in cache */
  creation: number;
  /** Tokens read from cache */
  read: number;
}

/**
 * Fully extracted response data
 */
export interface ExtractedResponse {
  /** Original message UUID for threading */
  messageUuid: string;
  /** Concatenated text content */
  responseText: string;
  /** Thinking content with compression, or null if no thinking */
  thinking: ThinkingResult | null;
  /** Tools used (name and id only, no input for privacy) */
  toolsUsed: ToolUse[];
  /** Model name/version */
  model: string;
  /** Token usage */
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Cache statistics, or null if not available */
  cacheStats: CacheStats | null;
  /** Stop reason (end_turn, tool_use, etc.) */
  stopReason: string;
  /** Message timestamp */
  timestamp: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to validate raw assistant message structure.
 * Returns true if the value has the required structure.
 */
export function isRawAssistantMessage(value: unknown): value is RawAssistantMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Required: type must be 'assistant'
  if (obj.type !== 'assistant') {
    return false;
  }

  // Required: uuid must be a non-empty string
  if (typeof obj.uuid !== 'string' || obj.uuid.trim() === '') {
    return false;
  }

  // Required: message must be an object
  if (typeof obj.message !== 'object' || obj.message === null) {
    return false;
  }

  return true;
}

/**
 * Type guard for text content blocks
 */
function isTextBlock(block: ContentBlock): block is TextContentBlock {
  return block.type === 'text' && typeof (block as TextContentBlock).text === 'string';
}

/**
 * Type guard for thinking content blocks
 */
function isThinkingBlock(block: ContentBlock): block is ThinkingContentBlock {
  return (
    block.type === 'thinking' &&
    typeof (block as ThinkingContentBlock).thinking === 'string'
  );
}

/**
 * Type guard for tool_use content blocks with required fields
 */
function isToolUseBlock(block: ContentBlock): block is ToolUseContentBlock {
  if (block.type !== 'tool_use') {
    return false;
  }
  const toolBlock = block as Partial<ToolUseContentBlock>;
  return (
    typeof toolBlock.id === 'string' &&
    toolBlock.id.length > 0 &&
    typeof toolBlock.name === 'string' &&
    toolBlock.name.length > 0
  );
}

// ============================================================================
// Extraction Functions
// ============================================================================

/**
 * Extract text content from message content blocks.
 * Concatenates all text blocks with newlines.
 *
 * @param content - Array of content blocks
 * @returns Concatenated text content
 */
export function extractTextContent(content: ContentBlock[]): string {
  if (!Array.isArray(content)) {
    return '';
  }

  const textBlocks = content.filter(isTextBlock);
  const texts = textBlocks
    .map((block) => block.text)
    .filter((text) => text.trim().length > 0);

  return texts.join('\n');
}

/**
 * Extract thinking content from message content blocks.
 * Concatenates all thinking blocks and compresses the result.
 *
 * @param content - Array of content blocks
 * @returns ThinkingResult or null if no thinking blocks
 */
export function extractThinkingContent(content: ContentBlock[]): ThinkingResult | null {
  if (!Array.isArray(content)) {
    return null;
  }

  const thinkingBlocks = content.filter(isThinkingBlock);

  if (thinkingBlocks.length === 0) {
    return null;
  }

  // Concatenate all thinking blocks
  const fullText = thinkingBlocks.map((block) => block.thinking).join('\n');

  // Compress thinking content - compressor returns word count
  const { summary, originalWordCount } = compressThinking(fullText);

  return {
    summary,
    wordCount: originalWordCount,
    fullText,
  };
}

/**
 * Extract tool uses from message content blocks.
 * Captures name and id only - NOT input (for privacy).
 *
 * @param content - Array of content blocks
 * @returns Array of tool metadata
 */
export function extractToolUses(content: ContentBlock[]): ToolUse[] {
  if (!Array.isArray(content)) {
    return [];
  }

  return content.filter(isToolUseBlock).map((block) => ({
    name: block.name,
    id: block.id,
  }));
}

/**
 * Extract cache statistics from usage data.
 * Returns null if no cache data is present.
 *
 * @param usage - Token usage object
 * @returns CacheStats or null
 */
export function extractCacheStats(usage: Usage | undefined | null): CacheStats | null {
  if (!usage) {
    return null;
  }

  // Only return cache stats if at least one cache field is present
  if (
    typeof usage.cache_creation_input_tokens !== 'number' &&
    typeof usage.cache_read_input_tokens !== 'number'
  ) {
    return null;
  }

  return {
    creation: usage.cache_creation_input_tokens ?? 0,
    read: usage.cache_read_input_tokens ?? 0,
  };
}

// ============================================================================
// Main Extraction Function
// ============================================================================

/**
 * Extract response data from a raw assistant message.
 * This is the main entry point for server-side response extraction.
 *
 * Returns null for invalid or malformed messages (with warnings logged).
 *
 * @param message - Raw assistant message from Claude transcript
 * @returns ExtractedResponse or null if extraction fails
 *
 * @example
 * ```typescript
 * const raw = JSON.parse(transcriptLine);
 * const extracted = extractResponse(raw);
 * if (extracted) {
 *   // Store extracted.responseText, extracted.toolsUsed, etc.
 * }
 * ```
 */
export function extractResponse(message: unknown): ExtractedResponse | null {
  try {
    // Validate basic structure
    if (!isRawAssistantMessage(message)) {
      console.warn('[extractResponse] Invalid assistant message structure');
      return null;
    }

    const { uuid, message: msg, timestamp } = message;

    // Validate inner message has required fields
    if (!msg.content) {
      console.warn('[extractResponse] Message has no content');
      return null;
    }

    // Content must be an array
    if (!Array.isArray(msg.content)) {
      console.warn('[extractResponse] Message content is not an array');
      return null;
    }

    // Extract all data
    const responseText = extractTextContent(msg.content);
    const thinking = extractThinkingContent(msg.content);
    const toolsUsed = extractToolUses(msg.content);
    const cacheStats = extractCacheStats(msg.usage);

    // Build the extracted response
    return {
      messageUuid: uuid,
      responseText,
      thinking,
      toolsUsed,
      model: msg.model ?? 'unknown',
      usage: {
        inputTokens: msg.usage?.input_tokens ?? 0,
        outputTokens: msg.usage?.output_tokens ?? 0,
      },
      cacheStats,
      stopReason: msg.stop_reason ?? 'unknown',
      timestamp: timestamp ?? new Date().toISOString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn('[extractResponse] Extraction failed:', errorMessage);
    return null;
  }
}

/**
 * Batch extract responses from multiple raw messages.
 * Skips non-assistant messages and invalid messages.
 *
 * @param messages - Array of raw transcript messages
 * @returns Array of extracted responses (only valid ones)
 */
export function extractResponses(messages: unknown[]): ExtractedResponse[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  const results: ExtractedResponse[] = [];

  for (const message of messages) {
    // Skip non-assistant messages
    if (typeof message !== 'object' || message === null) {
      continue;
    }

    const obj = message as Record<string, unknown>;
    if (obj.type !== 'assistant') {
      continue;
    }

    const extracted = extractResponse(message);
    if (extracted) {
      results.push(extracted);
    }
  }

  return results;
}
