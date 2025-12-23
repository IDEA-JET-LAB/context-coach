# Story 15.5: Prompt-Response Pairing

Status: ✅ COMPLETED (2025-12-23)

## PRD Alignment Note

This story is numbered 15-5 in the implementation but corresponds to **Story 15.3 (Prompt-Response Pairing)** in the PRD. The numbering differs because:

- Stories 15-3 (User Message Extraction) and 15-4 (Assistant Response Extraction) were added as separate implementation stories for better modularity
- The PRD's 15.3 (Prompt-Response Pairing) became 15-5 in implementation
- This provides clearer separation of concerns and enables parallel development

**Correlation ID Implementation:** The PRD specifies a "correlation ID approach" for pairing. In the Claude Code transcript format, this is implemented via the `parentUuid` field:
- Each message has a `uuid` identifier
- Responses reference their parent prompt via `parentUuid`
- This native Claude Code field serves as the correlation mechanism described in the PRD

## Dependencies

- **Story 15-3: User Message Extraction** - Provides `ExtractedPrompt` interface and `extractPrompts()` function
- **Story 15-4: Assistant Response Extraction** - Provides `ExtractedResponse` interface and `extractResponses()` function
- **Story 15-2: JSONL Parser Implementation** - Provides `TranscriptMessage` interface and `parseTranscript()` function

## Story
**As a** Contextor capture system,
**I want** to match user prompts with their corresponding Claude responses,
**So that** I can analyze complete prompt-response pairs for better insights.

## Acceptance Criteria
1. **Given** extracted prompts and responses
   **When** pairing is performed
   **Then** each prompt is matched with its immediate response
   **And** the match uses `parentUuid` linking (response.parentUuid = prompt.uuid)

2. **Given** a prompt without a response
   **When** pairing completes
   **Then** the prompt is marked as "orphaned"
   **And** orphaned prompts are still included in results with null response

3. **Given** a multi-turn conversation
   **When** pairing
   **Then** the conversation chain is preserved via parentUuid links
   **And** a conversation tree can be reconstructed

4. **Given** a paired prompt-response
   **When** creating the pair object
   **Then** both prompt and response data are combined
   **And** derived metrics are calculated (response time, token efficiency)

5. **Given** tool results followed by assistant responses
   **When** pairing
   **Then** the original user prompt is linked to the final response
   **And** intermediate tool result messages are tracked separately

## Tasks / Subtasks
- [ ] **Task 1: Create pairing module** (AC: #1, #4)
  - [ ] Create `lib/transcript/pairing.ts` file
  - [ ] Define `PromptResponsePair` interface
  - [ ] Define `PairingResult` interface with stats
  - [ ] Import types from extract modules

- [ ] **Task 2: Implement direct pairing** (AC: #1)
  - [ ] Build lookup map of responses by parentUuid
  - [ ] For each prompt, find response where `response.parentUuid === prompt.uuid`
  - [ ] Handle one-to-one pairing (most common case)
  - [ ] Handle one-to-many (response followed by tool results and more responses)

- [ ] **Task 3: Handle orphaned prompts** (AC: #2)
  - [ ] Identify prompts without matching responses
  - [ ] Create OrphanedPrompt type with reason field
  - [ ] Track orphan count in stats
  - [ ] Include orphans in result for visibility

- [ ] **Task 4: Build conversation chains** (AC: #3)
  - [ ] Create recursive function to trace parentUuid links
  - [ ] Build conversation tree structure
  - [ ] Identify conversation roots (parentUuid = null)
  - [ ] Calculate conversation depth/length

- [ ] **Task 5: Calculate derived metrics** (AC: #4)
  - [ ] Calculate response time (response.timestamp - prompt.timestamp)
  - [ ] Calculate token efficiency (output_tokens / input_tokens)
  - [ ] Calculate tool usage rate (tools per response)
  - [ ] Detect if thinking was used

- [ ] **Task 6: Handle complex flows** (AC: #5)
  - [ ] Detect tool result messages between prompt and final response
  - [ ] Track the full chain: prompt -> response -> tool_result -> response
  - [ ] Link original prompt to final synthesized response
  - [ ] Preserve intermediate responses for detailed analysis

## Dev Notes

### Pairing Logic

The primary pairing mechanism uses `parentUuid`:

```
User Prompt (uuid: "p1", parentUuid: null)
    ↓
Assistant Response (uuid: "r1", parentUuid: "p1")
    ↓
Tool Result (uuid: "tr1", parentUuid: "r1", type: "user", content: [tool_result])
    ↓
Assistant Response (uuid: "r2", parentUuid: "tr1")
```

For pairing, we want: `Prompt p1 <-> Final Response r2`

### Implementation

```typescript
// lib/transcript/pairing.ts
import { ExtractedPrompt } from './extract-prompts';
import { ExtractedResponse } from './extract-responses';
import { TranscriptMessage } from './parser';

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

export interface OrphanedPrompt {
  prompt: ExtractedPrompt;
  reason: 'no_response' | 'session_ended' | 'interrupted';
}

export interface PairingResult {
  pairs: PromptResponsePair[];
  orphans: OrphanedPrompt[];
  stats: {
    totalPrompts: number;
    pairedPrompts: number;
    orphanedPrompts: number;
    averageResponseTimeMs: number;
    averageTokenEfficiency: number;
    conversationCount: number;
    averageConversationLength: number;
  };
}

/**
 * Pair prompts with their responses.
 */
export function pairPromptsWithResponses(
  prompts: ExtractedPrompt[],
  responses: ExtractedResponse[],
  allMessages: TranscriptMessage[]
): PairingResult {
  const pairs: PromptResponsePair[] = [];
  const orphans: OrphanedPrompt[] = [];

  // Build response lookup by parentUuid
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

  // Track conversations
  const conversationRoots = new Map<string, string>(); // uuid -> root uuid

  for (const prompt of prompts) {
    // Find the root of this conversation
    const rootUuid = findConversationRoot(prompt.uuid, messageByUuid);
    conversationRoots.set(prompt.uuid, rootUuid);

    // Find response - may need to trace through tool results
    const response = findFinalResponse(prompt.uuid, responseByParent, messageByUuid);

    if (response) {
      // Count intermediate messages
      const intermediateCount = countIntermediateMessages(
        prompt.uuid,
        response.uuid,
        allMessages
      );

      const pair: PromptResponsePair = {
        prompt,
        response,

        conversationId: rootUuid,
        conversationDepth: calculateConversationDepth(prompt.uuid, messageByUuid),
        isConversationStart: prompt.parentUuid === null,

        responseTimeMs: response.timestamp.getTime() - prompt.timestamp.getTime(),
        tokenEfficiency: response.tokens.input > 0
          ? response.tokens.output / response.tokens.input
          : null,
        toolsPerResponse: response.toolCount,
        usedThinking: response.hasThinking,

        intermediateMessages: intermediateCount,
      };

      pairs.push(pair);
    } else {
      orphans.push({
        prompt,
        reason: determineOrphanReason(prompt, allMessages),
      });
    }
  }

  // Calculate stats
  const stats = calculatePairingStats(pairs, orphans);

  return { pairs, orphans, stats };
}

/**
 * Find the response for a prompt, tracing through tool results if needed.
 */
function findFinalResponse(
  promptUuid: string,
  responseByParent: Map<string, ExtractedResponse>,
  messageByUuid: Map<string, TranscriptMessage>
): ExtractedResponse | null {
  // Direct response
  let response = responseByParent.get(promptUuid);
  if (response) return response;

  // Trace through chain (tool results, etc.)
  let currentUuid = promptUuid;
  const visited = new Set<string>();

  while (currentUuid && !visited.has(currentUuid)) {
    visited.add(currentUuid);

    // Find any message that has this as parent
    for (const [uuid, msg] of messageByUuid) {
      if (msg.parentUuid === currentUuid) {
        // Check if this leads to a response
        const potentialResponse = responseByParent.get(uuid);
        if (potentialResponse) {
          return potentialResponse;
        }
        // Continue chain
        currentUuid = uuid;
        break;
      }
    }
  }

  return null;
}

/**
 * Find the root of a conversation by tracing parentUuid to null.
 */
function findConversationRoot(
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

  return uuid; // Fallback
}

/**
 * Calculate conversation depth (1 = root).
 */
function calculateConversationDepth(
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
 * Count messages between prompt and response.
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
 */
function determineOrphanReason(
  prompt: ExtractedPrompt,
  messages: TranscriptMessage[]
): OrphanedPrompt['reason'] {
  // Check if this is near the end of the session
  const promptIndex = messages.findIndex(m => m.uuid === prompt.uuid);
  const remainingMessages = messages.slice(promptIndex + 1);

  if (remainingMessages.length === 0) {
    return 'session_ended';
  }

  // Check for summary message (indicates clear/end)
  if (remainingMessages.some(m => m.type === 'summary')) {
    return 'interrupted';
  }

  return 'no_response';
}

/**
 * Calculate aggregate statistics.
 */
function calculatePairingStats(
  pairs: PromptResponsePair[],
  orphans: OrphanedPrompt[]
): PairingResult['stats'] {
  const responseTimes = pairs
    .filter(p => p.responseTimeMs !== null)
    .map(p => p.responseTimeMs!);

  const tokenEfficiencies = pairs
    .filter(p => p.tokenEfficiency !== null)
    .map(p => p.tokenEfficiency!);

  const conversations = new Set(pairs.map(p => p.conversationId));

  return {
    totalPrompts: pairs.length + orphans.length,
    pairedPrompts: pairs.length,
    orphanedPrompts: orphans.length,
    averageResponseTimeMs: responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0,
    averageTokenEfficiency: tokenEfficiencies.length > 0
      ? tokenEfficiencies.reduce((a, b) => a + b, 0) / tokenEfficiencies.length
      : 0,
    conversationCount: conversations.size,
    averageConversationLength: pairs.length / Math.max(1, conversations.size),
  };
}

/**
 * Extract all prompt-response pairs from a transcript file.
 * Convenience function combining all extraction and pairing.
 */
export async function extractPairsFromTranscript(
  filePath: string
): Promise<PairingResult> {
  const { parseTranscript } = await import('./parser');
  const { extractPrompts } = await import('./extract-prompts');
  const { extractResponses } = await import('./extract-responses');

  const { messages } = await parseTranscript(filePath);
  const { prompts } = extractPrompts(messages);
  const { responses } = extractResponses(messages);

  return pairPromptsWithResponses(prompts, responses, messages);
}
```

### Pairing Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     TRANSCRIPT MESSAGES                       │
└──────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
     ┌────────────────┐ ┌──────────┐ ┌────────────────┐
     │ Extract Prompts│ │ Parse All│ │Extract Responses│
     └───────┬────────┘ └────┬─────┘ └───────┬────────┘
             │               │               │
             └───────────────┼───────────────┘
                             ▼
              ┌──────────────────────────────┐
              │   Build parentUuid Lookup    │
              └──────────────┬───────────────┘
                             ▼
              ┌──────────────────────────────┐
              │   Match Prompts to Responses │
              │   via parentUuid Links       │
              └──────────────┬───────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
      ┌────────────┐  ┌───────────┐  ┌───────────┐
      │   Pairs    │  │  Orphans  │  │   Stats   │
      └────────────┘  └───────────┘  └───────────┘
```

### Derived Metrics

| Metric | Calculation | Purpose |
|--------|-------------|---------|
| Response Time | `response.timestamp - prompt.timestamp` | Measure Claude latency |
| Token Efficiency | `output_tokens / input_tokens` | Ratio of generated to consumed |
| Tools Per Response | `response.toolCount` | Tool usage intensity |
| Conversation Depth | Count of parent links to root | Position in multi-turn |

### File Structure

| File | Path |
|------|------|
| Pairing Module | `app/lib/transcript/pairing.ts` |
| Tests | `app/lib/transcript/__tests__/pairing.test.ts` |

### Verification Checklist
- [ ] Direct prompt-response pairs are correctly matched
- [ ] Chains through tool results are traced correctly
- [ ] Orphaned prompts are identified with reasons
- [ ] Conversation roots are correctly determined
- [ ] Conversation depth is accurately calculated
- [ ] Response time is correctly computed
- [ ] Token efficiency ratio is accurate
- [ ] Stats are mathematically correct
- [ ] Convenience function works end-to-end

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

| Date | Change | Author |
|------|--------|--------|

### File List

*To be filled by dev agent - list all files created/modified*
