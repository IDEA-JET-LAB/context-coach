/**
 * Tool Result Extraction
 * Story 15-7: Tool Execution Capture
 *
 * Extracts tool results from user messages and matches them with tool_use blocks.
 * Tool results appear in user messages as array content containing tool_result blocks.
 */

import {
  TranscriptMessage,
  ContentBlock,
  ToolResultBlock,
} from './parser';

// ============================================================================
// Types
// ============================================================================

/**
 * Extracted tool result with error detection
 */
export interface ToolResult {
  /** The tool_use_id this result corresponds to */
  toolUseId: string;
  /** The result content (stringified if array) */
  content: string;
  /** Whether this result indicates an error */
  isError: boolean;
  /** Length of the content in characters */
  contentLength: number;
}

/**
 * Options for tool result extraction
 */
export interface ToolResultExtractionOptions {
  /** Maximum length for content summaries (default: 500) */
  maxSummaryLength?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default maximum length for content summaries */
const DEFAULT_MAX_SUMMARY_LENGTH = 500;

/**
 * Patterns that indicate an error in tool result content.
 * Case-insensitive matching is used for string patterns.
 */
const ERROR_PATTERNS = [
  // Explicit error indicators (also match CamelCase like NullPointerException, SyntaxError)
  /Error\b/i,
  /Exception\b/i,
  /\bfailed\b/i,
  /\bdenied\b/i,
  /\bpermission denied\b/i,

  // File/path errors
  /\bno such file\b/i,
  /\bfile not found\b/i,
  /\bdirectory not found\b/i,
  /\bpath not found\b/i,
  /\bdoes not exist\b/i,
  /\bcannot find\b/i,

  // Command errors
  /\bcommand not found\b/i,
  /\bnot recognized\b/i,
  /\bunknown command\b/i,

  // Exit codes (non-zero)
  /exit code [1-9]\d*/i,
  /exited with [1-9]\d*/i,
  /returned [1-9]\d*/i,

  // Network/connection errors
  /\bconnection refused\b/i,
  /\btimeout\b/i,
  /\bnetwork error\b/i,

  // Permission/access errors
  /\baccess denied\b/i,
  /\bunauthorized\b/i,
  /\bforbidden\b/i,

  // Syntax/parse errors
  /\bsyntax error\b/i,
  /\bparse error\b/i,
  /\binvalid\b.*\bsyntax\b/i,

  // Generic failures
  /\bfailure\b/i,
  /\baborted\b/i,
  /\bcrashed\b/i,
];

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a content block is a tool_result block
 */
function isToolResultBlock(block: ContentBlock): block is ToolResultBlock {
  return block.type === 'tool_result';
}

/**
 * Check if a message is a user message with potential tool results
 */
function isUserMessageWithContent(message: TranscriptMessage): boolean {
  return (
    message.type === 'user' &&
    message.message?.role === 'user' &&
    Array.isArray(message.message?.content)
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get content blocks from a message.
 */
function getContentBlocks(message: TranscriptMessage): ContentBlock[] {
  if (!message.message?.content) {
    return [];
  }

  const content = message.message.content;

  if (Array.isArray(content)) {
    return content as ContentBlock[];
  }

  return [];
}

/**
 * Stringify tool result content.
 * Handles both string content and array content (nested blocks).
 */
function stringifyToolResultContent(content: string | ContentBlock[]): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    // Concatenate text from nested blocks
    return content
      .map((block) => {
        if (typeof block === 'string') {
          return block;
        }
        if (block.type === 'text' && 'text' in block) {
          return block.text;
        }
        // For other block types, stringify
        try {
          return JSON.stringify(block);
        } catch {
          return '[complex content]';
        }
      })
      .join('\n');
  }

  return '';
}

/**
 * Detect if tool result content indicates an error.
 *
 * Uses multiple strategies:
 * 1. Check explicit is_error field
 * 2. Pattern match for common error strings
 *
 * @param content - The tool result content string
 * @param block - The original tool_result block (may have is_error field)
 * @returns true if the result indicates an error
 */
export function detectToolError(
  content: string,
  block?: ToolResultBlock & { is_error?: boolean }
): boolean {
  // Check explicit is_error field from Claude API
  if (block && 'is_error' in block && block.is_error === true) {
    return true;
  }

  // Pattern match for error indicators
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test(content)) {
      return true;
    }
  }

  return false;
}

/**
 * Summarize tool result content for storage.
 * Truncates long content with ellipsis.
 */
export function summarizeToolResult(
  content: string,
  maxLength: number = DEFAULT_MAX_SUMMARY_LENGTH
): string {
  if (!content) {
    return '';
  }

  // Normalize whitespace
  const normalized = content.replace(/\s+/g, ' ').trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return normalized.slice(0, maxLength - 3) + '...';
}

// ============================================================================
// Main Extraction Functions
// ============================================================================

/**
 * Extract tool results from parsed transcript messages.
 *
 * Tool results are found in user messages where content is an array
 * containing tool_result blocks. Each tool_result has a tool_use_id
 * that matches a tool_use block's id field from an assistant message.
 *
 * @param messages - Array of parsed transcript messages
 * @param options - Extraction options
 * @returns Map of tool_use_id to ToolResult
 *
 * @example
 * ```typescript
 * const { messages } = await parseTranscript('/path/to/transcript.jsonl');
 * const toolResults = extractToolResults(messages);
 *
 * // Get result for a specific tool_use
 * const result = toolResults.get('toolu_01ABC');
 * if (result) {
 *   console.log(`Tool succeeded: ${!result.isError}`);
 *   console.log(`Output: ${result.content}`);
 * }
 * ```
 */
export function extractToolResults(
  messages: TranscriptMessage[],
  options: ToolResultExtractionOptions = {}
): Map<string, ToolResult> {
  const results = new Map<string, ToolResult>();
  const { maxSummaryLength = DEFAULT_MAX_SUMMARY_LENGTH } = options;

  for (const message of messages) {
    // Only process user messages with array content
    if (!isUserMessageWithContent(message)) {
      continue;
    }

    const blocks = getContentBlocks(message);

    for (const block of blocks) {
      if (!isToolResultBlock(block)) {
        continue;
      }

      // Extract and validate tool_use_id
      const toolUseId = block.tool_use_id;
      if (!toolUseId || typeof toolUseId !== 'string') {
        console.warn(
          `[extract-tool-results] Skipping tool_result without valid tool_use_id in message ${message.uuid}`
        );
        continue;
      }

      // Stringify the content
      const contentString = stringifyToolResultContent(block.content);

      // Detect if this is an error
      const isError = detectToolError(
        contentString,
        block as ToolResultBlock & { is_error?: boolean }
      );

      // Store the result
      results.set(toolUseId, {
        toolUseId,
        content: summarizeToolResult(contentString, maxSummaryLength),
        isError,
        contentLength: contentString.length,
      });
    }
  }

  return results;
}

/**
 * Extract tool results as an array (alternative to Map return).
 * Useful when you need to iterate without Map overhead.
 *
 * @param messages - Array of parsed transcript messages
 * @param options - Extraction options
 * @returns Array of ToolResult objects
 */
export function extractToolResultsArray(
  messages: TranscriptMessage[],
  options: ToolResultExtractionOptions = {}
): ToolResult[] {
  const resultsMap = extractToolResults(messages, options);
  return Array.from(resultsMap.values());
}

/**
 * Get tool result by tool_use_id from a pre-extracted map.
 * Convenience function for looking up results.
 *
 * @param results - Map of tool_use_id to ToolResult
 * @param toolUseId - The tool_use_id to look up
 * @returns The ToolResult or undefined if not found
 */
export function getToolResultById(
  results: Map<string, ToolResult>,
  toolUseId: string
): ToolResult | undefined {
  return results.get(toolUseId);
}

/**
 * Check if a tool execution has a matching result.
 *
 * @param results - Map of tool_use_id to ToolResult
 * @param toolUseId - The tool_use_id to check
 * @returns true if a result exists for this tool_use_id
 */
export function hasToolResult(
  results: Map<string, ToolResult>,
  toolUseId: string
): boolean {
  return results.has(toolUseId);
}

/**
 * Get statistics about extracted tool results.
 *
 * @param results - Map of tool_use_id to ToolResult
 * @returns Statistics object
 */
export function getToolResultStats(results: Map<string, ToolResult>): {
  totalResults: number;
  successCount: number;
  errorCount: number;
  totalContentLength: number;
  averageContentLength: number;
} {
  let successCount = 0;
  let errorCount = 0;
  let totalContentLength = 0;

  // Use Array.from to avoid downlevel iteration issues
  const resultsList = Array.from(results.values());
  for (const result of resultsList) {
    if (result.isError) {
      errorCount++;
    } else {
      successCount++;
    }
    totalContentLength += result.contentLength;
  }

  const totalResults = results.size;
  const averageContentLength = totalResults > 0
    ? Math.round(totalContentLength / totalResults)
    : 0;

  return {
    totalResults,
    successCount,
    errorCount,
    totalContentLength,
    averageContentLength,
  };
}
