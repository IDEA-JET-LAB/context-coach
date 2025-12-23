/**
 * Prompt-Response Pairing Module
 * Story 15-5: Prompt-Response Pairing
 *
 * Matches user prompts with their corresponding Claude responses using
 * parentUuid linking. Handles conversation chains, orphaned prompts,
 * and calculates derived metrics.
 */

import type { TranscriptMessage } from './parser';
import type { ExtractedPrompt } from './extract-prompts';
import type { ExtractedResponse } from './extract-responses';

// ============================================================================
// Types
// ============================================================================

/**
 * A paired prompt-response with conversation context and derived metrics.
 */
export interface PromptResponsePair {
  /** The user prompt */
  prompt: ExtractedPrompt;
  /** The assistant response (null if orphaned) */
  response: ExtractedResponse | null;

  /** Conversation context */
  conversationId: string;       // Root prompt UUID
  conversationDepth: number;    // Position in conversation (1 = first)
  isConversationStart: boolean; // Is this the root prompt?

  /** Derived metrics */
  responseTimeMs: number | null;      // Time between prompt and response
  tokenEfficiency: number | null;     // output/input ratio
  toolsPerResponse: number;           // Tools used in response
  usedThinking: boolean;              // Response included thinking

  /** Intermediate messages (tool results, etc.) */
  intermediateMessages: number;       // Count of messages between prompt and response
}

/**
 * A prompt without a matching response.
 */
export interface OrphanedPrompt {
  prompt: ExtractedPrompt;
  reason: 'no_response' | 'session_ended' | 'interrupted';
}

/**
 * Result from pairing prompts with responses.
 */
export interface PairingResult {
  pairs: PromptResponsePair[];
  orphans: OrphanedPrompt[];
  stats: PairingStats;
}

/**
 * Statistics from the pairing process.
 */
export interface PairingStats {
  totalPrompts: number;
  pairedPrompts: number;
  orphanedPrompts: number;
  averageResponseTimeMs: number;
  averageTokenEfficiency: number;
  conversationCount: number;
  averageConversationLength: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find the root of a conversation by tracing parentUuid to null.
 * Uses a visited set to prevent infinite loops from circular references.
 *
 * @param uuid - Starting message UUID
 * @param messageByUuid - Lookup map of messages by UUID
 * @returns Root UUID of the conversation
 */
export function findConversationRoot(
  uuid: string,
  messageByUuid: Map<string, TranscriptMessage>
): string {
  let current = uuid;
  const visited = new Set<string>();

  while (current && !visited.has(current)) {
    visited.add(current);
    const msg = messageByUuid.get(current);
    if (!msg || msg.parentUuid === null) {
      return current;
    }
    current = msg.parentUuid;
  }

  return uuid; // Fallback to original if cycle detected
}

/**
 * Calculate conversation depth (1 = root).
 * Counts the number of parent links from this message to the root.
 *
 * @param uuid - Message UUID to calculate depth for
 * @param messageByUuid - Lookup map of messages by UUID
 * @returns Depth value (1 = root, higher = deeper in conversation)
 */
export function calculateConversationDepth(
  uuid: string,
  messageByUuid: Map<string, TranscriptMessage>
): number {
  let depth = 1;
  let current = uuid;
  const visited = new Set<string>();

  while (current && !visited.has(current)) {
    visited.add(current);
    const msg = messageByUuid.get(current);
    if (!msg || msg.parentUuid === null) {
      break;
    }
    depth++;
    current = msg.parentUuid;
  }

  return depth;
}

/**
 * Find the response for a prompt, tracing through tool results if needed.
 * Handles chains like: Prompt -> Tool Result -> Response
 *
 * @param promptUuid - UUID of the user prompt
 * @param responseByParent - Map of responses keyed by their parentUuid
 * @param messageByUuid - Lookup map of all messages by UUID
 * @returns The final response or null if not found
 */
function findFinalResponse(
  promptUuid: string,
  responseByParent: Map<string, ExtractedResponse>,
  messageByUuid: Map<string, TranscriptMessage>
): ExtractedResponse | null {
  // Direct response - most common case
  const directResponse = responseByParent.get(promptUuid);
  if (directResponse) return directResponse;

  // Trace through chain (tool results, etc.)
  // We need to find messages that have promptUuid as parent
  // and follow the chain until we find a response
  let currentUuid = promptUuid;
  const visited = new Set<string>();

  while (currentUuid && !visited.has(currentUuid)) {
    visited.add(currentUuid);

    // Find any message that has currentUuid as parent
    let foundChild = false;
    for (const [uuid, msg] of messageByUuid) {
      if (msg.parentUuid === currentUuid) {
        // Check if there's a response with this uuid as parent
        const potentialResponse = responseByParent.get(uuid);
        if (potentialResponse) {
          return potentialResponse;
        }
        // Continue chain from this message
        currentUuid = uuid;
        foundChild = true;
        break;
      }
    }

    // No more children in chain
    if (!foundChild) break;
  }

  return null;
}

/**
 * Count messages between prompt and response in the message array.
 *
 * @param promptUuid - UUID of the prompt
 * @param responseUuid - UUID of the response
 * @param messages - Array of all transcript messages
 * @returns Count of intermediate messages (0 if adjacent or not found)
 */
function countIntermediateMessages(
  promptUuid: string,
  responseUuid: string,
  messages: TranscriptMessage[]
): number {
  const promptIndex = messages.findIndex(m => m.uuid === promptUuid);
  const responseIndex = messages.findIndex(m => m.uuid === responseUuid);

  if (promptIndex < 0 || responseIndex < 0) return 0;
  return Math.max(0, responseIndex - promptIndex - 1);
}

/**
 * Determine why a prompt has no response.
 *
 * @param prompt - The orphaned prompt
 * @param messages - All transcript messages
 * @returns Reason for the orphan status
 */
function determineOrphanReason(
  prompt: ExtractedPrompt,
  messages: TranscriptMessage[]
): OrphanedPrompt['reason'] {
  const promptIndex = messages.findIndex(m => m.uuid === prompt.uuid);

  // If prompt is the last message, session ended
  if (promptIndex < 0 || promptIndex === messages.length - 1) {
    return 'session_ended';
  }

  const remainingMessages = messages.slice(promptIndex + 1);

  // No remaining messages in the array
  if (remainingMessages.length === 0) {
    return 'session_ended';
  }

  // Check for summary message (indicates clear/context reset)
  const hasSummaryAfter = remainingMessages.some(m => m.type === 'summary');
  if (hasSummaryAfter) {
    return 'interrupted';
  }

  // Check if remaining messages are all from a different session
  const promptSession = prompt.sessionId;
  const allDifferentSession = remainingMessages.every(m => m.sessionId !== promptSession);
  if (allDifferentSession) {
    return 'session_ended';
  }

  return 'no_response';
}

/**
 * Calculate aggregate statistics from pairs and orphans.
 */
function calculatePairingStats(
  pairs: PromptResponsePair[],
  orphans: OrphanedPrompt[]
): PairingStats {
  // Response times (filter out nulls)
  const responseTimes = pairs
    .filter(p => p.responseTimeMs !== null)
    .map(p => p.responseTimeMs!);

  // Token efficiencies (filter out nulls)
  const tokenEfficiencies = pairs
    .filter(p => p.tokenEfficiency !== null)
    .map(p => p.tokenEfficiency!);

  // Unique conversations
  const conversations = new Set(pairs.map(p => p.conversationId));

  // Calculate averages
  const averageResponseTimeMs = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;

  const averageTokenEfficiency = tokenEfficiencies.length > 0
    ? tokenEfficiencies.reduce((a, b) => a + b, 0) / tokenEfficiencies.length
    : 0;

  const conversationCount = conversations.size;
  const averageConversationLength = pairs.length / Math.max(1, conversationCount);

  return {
    totalPrompts: pairs.length + orphans.length,
    pairedPrompts: pairs.length,
    orphanedPrompts: orphans.length,
    averageResponseTimeMs,
    averageTokenEfficiency,
    conversationCount,
    averageConversationLength,
  };
}

// ============================================================================
// Main Pairing Functions
// ============================================================================

/**
 * Pair prompts with their responses.
 *
 * This function:
 * 1. Builds lookup maps for efficient O(1) parentUuid lookups
 * 2. For each prompt, finds the corresponding response via parentUuid links
 * 3. Handles chains through tool results (prompt -> tool_result -> response)
 * 4. Calculates derived metrics (response time, token efficiency, etc.)
 * 5. Identifies orphaned prompts with reasons
 *
 * @param prompts - Extracted prompts from extractPrompts()
 * @param responses - Extracted responses from extractResponses()
 * @param allMessages - All parsed transcript messages for chain tracing
 * @returns PairingResult with pairs, orphans, and stats
 *
 * @example
 * ```typescript
 * const { messages } = await parseTranscript('/path/to/transcript.jsonl');
 * const { prompts } = extractPrompts(messages);
 * const { responses } = extractResponses(messages);
 * const { pairs, orphans, stats } = pairPromptsWithResponses(prompts, responses, messages);
 * console.log(`Paired ${stats.pairedPrompts} of ${stats.totalPrompts} prompts`);
 * ```
 */
export function pairPromptsWithResponses(
  prompts: ExtractedPrompt[],
  responses: ExtractedResponse[],
  allMessages: TranscriptMessage[]
): PairingResult {
  const pairs: PromptResponsePair[] = [];
  const orphans: OrphanedPrompt[] = [];

  // Build response lookup by parentUuid for O(1) lookups
  const responseByParent = new Map<string, ExtractedResponse>();
  for (const response of responses) {
    if (response.parentUuid) {
      responseByParent.set(response.parentUuid, response);
    }
  }

  // Build message lookup for chain tracing
  const messageByUuid = new Map<string, TranscriptMessage>();
  for (const msg of allMessages) {
    messageByUuid.set(msg.uuid, msg);
  }

  // Process each prompt
  for (const prompt of prompts) {
    // Find the root of this conversation
    const rootUuid = findConversationRoot(prompt.uuid, messageByUuid);

    // Find response - may need to trace through tool results
    const response = findFinalResponse(prompt.uuid, responseByParent, messageByUuid);

    if (response) {
      // Calculate intermediate message count
      const intermediateCount = countIntermediateMessages(
        prompt.uuid,
        response.uuid,
        allMessages
      );

      // Calculate response time in milliseconds
      const responseTimeMs = response.timestamp.getTime() - prompt.timestamp.getTime();

      // Calculate token efficiency (output/input ratio)
      const tokenEfficiency = response.tokens.input > 0
        ? response.tokens.output / response.tokens.input
        : null;

      const pair: PromptResponsePair = {
        prompt,
        response,

        conversationId: rootUuid,
        conversationDepth: calculateConversationDepth(prompt.uuid, messageByUuid),
        isConversationStart: prompt.parentUuid === null,

        responseTimeMs,
        tokenEfficiency,
        toolsPerResponse: response.toolCount,
        usedThinking: response.hasThinking,

        intermediateMessages: intermediateCount,
      };

      pairs.push(pair);
    } else {
      // Orphaned prompt
      orphans.push({
        prompt,
        reason: determineOrphanReason(prompt, allMessages),
      });
    }
  }

  // Calculate aggregate statistics
  const stats = calculatePairingStats(pairs, orphans);

  return { pairs, orphans, stats };
}

/**
 * Extract all prompt-response pairs from a transcript file.
 * Convenience function that combines parsing, extraction, and pairing.
 *
 * @param filePath - Path to the transcript JSONL file
 * @returns Promise resolving to PairingResult
 *
 * @example
 * ```typescript
 * const { pairs, orphans, stats } = await extractPairsFromTranscript('/path/to/transcript.jsonl');
 * console.log(`Found ${pairs.length} prompt-response pairs`);
 * ```
 */
export async function extractPairsFromTranscript(
  filePath: string
): Promise<PairingResult> {
  // Dynamic imports to avoid circular dependencies
  const { parseTranscript } = await import('./parser');
  const { extractPrompts } = await import('./extract-prompts');
  const { extractResponses } = await import('./extract-responses');

  const { messages } = await parseTranscript(filePath);
  const { prompts } = extractPrompts(messages);
  const { responses } = extractResponses(messages);

  return pairPromptsWithResponses(prompts, responses, messages);
}
