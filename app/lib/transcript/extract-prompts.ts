/**
 * User Message Extraction Module
 * Story 15-3: User Message Extraction
 *
 * Extracts user prompts with metadata from parsed Claude Code transcripts.
 * Distinguishes between actual user prompts (string content) and tool results
 * (array content), and calculates statistics for each prompt.
 */

import type { TranscriptMessage } from './parser';

// ============================================================================
// Types
// ============================================================================

/**
 * A single extracted user prompt with all metadata.
 */
export interface ExtractedPrompt {
  /** Original message UUID for pairing with responses */
  uuid: string;
  /** Parent message UUID for conversation threading */
  parentUuid: string | null;
  /** Session identifier for session grouping */
  sessionId: string;
  /** Prompt timestamp as Date object */
  timestamp: Date;
  /** Sequence number within session (1-indexed) */
  sequenceNumber: number;

  /** Prompt text content */
  text: string;
  /** Character count of the prompt text */
  charCount: number;
  /** Word count of the prompt text */
  wordCount: number;
  /** Whether the prompt contains code blocks (``` markers) */
  hasCodeBlocks: boolean;
  /** Whether the prompt is a question (ends with ?) */
  isQuestion: boolean;

  /** Current working directory when prompt was submitted */
  cwd: string | null;
  /** Git branch name when prompt was submitted */
  gitBranch: string | null;
  /** Claude Code version (e.g., "2.0.75") */
  claudeCodeVersion: string | null;
  /** Conversation slug/name for human-readable identification */
  slug: string | null;
}

/**
 * Statistics from the extraction process.
 */
export interface ExtractionStats {
  /** Total number of messages processed */
  totalMessages: number;
  /** Number of messages with type='user' */
  userMessages: number;
  /** Number of tool result messages (user messages with array content) */
  toolResultMessages: number;
  /** Number of successfully extracted prompts */
  extractedPrompts: number;
  /** Number of unique sessions found */
  sessionsFound: number;
}

/**
 * Result from extractPrompts function.
 */
export interface ExtractionResult {
  /** Extracted prompts ordered chronologically with per-session sequence numbers */
  prompts: ExtractedPrompt[];
  /** Extraction statistics */
  stats: ExtractionStats;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Count words in text by splitting on whitespace.
 * Empty or whitespace-only strings return 0.
 */
function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Check if text contains code blocks (triple backtick markers).
 */
function hasCodeBlocks(text: string): boolean {
  return text.includes('```');
}

/**
 * Check if text is a question (ends with question mark after trimming).
 */
function isQuestion(text: string): boolean {
  return text.trim().endsWith('?');
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a message is a user prompt (not a tool result).
 *
 * A user prompt is identified by:
 * 1. type === 'user'
 * 2. message.role === 'user'
 * 3. message.content is a string (not an array)
 *
 * Messages with array content are tool results, not user prompts.
 */
export function isUserPrompt(message: TranscriptMessage): boolean {
  return (
    message.type === 'user' &&
    message.message?.role === 'user' &&
    typeof message.message.content === 'string'
  );
}

/**
 * Check if a message is a tool result.
 *
 * Tool results are identified by:
 * 1. type === 'user'
 * 2. message.role === 'user'
 * 3. message.content is an array (containing tool_result blocks)
 */
export function isToolResult(message: TranscriptMessage): boolean {
  return (
    message.type === 'user' &&
    message.message?.role === 'user' &&
    Array.isArray(message.message.content)
  );
}

// ============================================================================
// Main Extraction Function
// ============================================================================

/**
 * Extract user prompts from parsed transcript messages.
 *
 * This function:
 * 1. Filters to only user messages with string content (excludes tool results)
 * 2. Extracts metadata (cwd, gitBranch, version, slug)
 * 3. Parses timestamps to Date objects
 * 4. Orders prompts chronologically
 * 5. Assigns sequence numbers per session (1-indexed)
 * 6. Calculates text statistics (char count, word count, code blocks, questions)
 *
 * @param messages - Parsed transcript messages from parseTranscript()
 * @returns ExtractionResult with prompts array and stats
 *
 * @example
 * ```typescript
 * const { messages } = await parseTranscript('/path/to/transcript.jsonl');
 * const { prompts, stats } = extractPrompts(messages);
 * console.log(`Extracted ${stats.extractedPrompts} prompts from ${stats.sessionsFound} sessions`);
 * ```
 */
export function extractPrompts(messages: TranscriptMessage[]): ExtractionResult {
  // Track statistics
  const sessionsFound = new Set<string>();
  let userMessages = 0;
  let toolResultMessages = 0;

  // Filter to user prompts only (exclude tool results)
  const userPrompts = messages.filter((msg) => {
    if (msg.type === 'user') {
      userMessages++;
      if (isToolResult(msg)) {
        toolResultMessages++;
        return false;
      }
      if (isUserPrompt(msg)) {
        return true;
      }
    }
    return false;
  });

  // Sort by timestamp chronologically
  userPrompts.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Track sequence numbers per session
  const sessionSequence = new Map<string, number>();

  // Transform to ExtractedPrompt
  const prompts: ExtractedPrompt[] = userPrompts.map((msg) => {
    const sessionId = msg.sessionId;
    sessionsFound.add(sessionId);

    // Increment sequence for this session
    const seq = (sessionSequence.get(sessionId) || 0) + 1;
    sessionSequence.set(sessionId, seq);

    // Extract text content (guaranteed to be string by isUserPrompt filter)
    const text = msg.message!.content as string;

    return {
      uuid: msg.uuid,
      parentUuid: msg.parentUuid,
      sessionId,
      timestamp: new Date(msg.timestamp),
      sequenceNumber: seq,

      text,
      charCount: text.length,
      wordCount: countWords(text),
      hasCodeBlocks: hasCodeBlocks(text),
      isQuestion: isQuestion(text),

      cwd: msg.cwd ?? null,
      gitBranch: msg.gitBranch ?? null,
      claudeCodeVersion: msg.version ?? null,
      slug: msg.slug ?? null,
    };
  });

  return {
    prompts,
    stats: {
      totalMessages: messages.length,
      userMessages,
      toolResultMessages,
      extractedPrompts: prompts.length,
      sessionsFound: sessionsFound.size,
    },
  };
}

/**
 * Extract prompts from a single session.
 *
 * Convenience function that filters messages to a specific session
 * before extraction.
 *
 * @param messages - All parsed transcript messages
 * @param sessionId - Session ID to filter by
 * @returns Array of ExtractedPrompt for the specified session
 *
 * @example
 * ```typescript
 * const sessionPrompts = extractPromptsFromSession(messages, 'session-123');
 * console.log(`Session has ${sessionPrompts.length} prompts`);
 * ```
 */
export function extractPromptsFromSession(
  messages: TranscriptMessage[],
  sessionId: string
): ExtractedPrompt[] {
  const sessionMessages = messages.filter((m) => m.sessionId === sessionId);
  return extractPrompts(sessionMessages).prompts;
}
