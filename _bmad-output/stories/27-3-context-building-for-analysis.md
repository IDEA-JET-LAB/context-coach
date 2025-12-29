# Story 27-3: Context Building for Analysis

Status: Complete

## Story

**As a** system,
**I want** to build conversation context from the database,
**So that** the AI analyzer can understand the prompt in context.

## Dependencies

- **Epic 24**: Schema Extensions (sessions and prompts tables extended)
- **Epic 25, Story 25-4**: Conversation Context Endpoint (optional - can call directly)
- **Epic 26**: Enhanced Capture Pipeline (responses stored in database)
- **Epic 26, Story 26-4**: Response Extraction Logic - responses must be stored in database before context can include them

## Background

Context-aware analysis requires knowing what happened before the current prompt. This includes:
- Previous prompts in the session
- Previous AI responses
- Whether the AI asked a question
- Whether the AI presented options to choose from
- The current stage of the conversation (architecture, development, debugging)

This context is retrieved from the database and formatted for the LLM analyzer.

## Acceptance Criteria

1. **Context Retrieval from Database**
   - **Given** a prompt ID to analyze
   - **When** `buildConversationContext(promptId)` is called
   - **Then** the session ID is retrieved from the prompt
   - **And** preceding prompts are queried in sequence order
   - **And** associated responses are included
   - **And** log format: `[CONTEXT] Built context for prompt {id}: {messageCount} messages, {tokenCount} tokens`

2. **Token Budget Enforcement**
   - **Given** a token budget (default: 10,000 tokens)
   - **When** context is built
   - **Then** messages are included from most recent backwards
   - **And** older messages are truncated or omitted when budget exceeded
   - **And** `totalTokens` in result never exceeds `tokenBudget`

3. **Response Summary Extraction**
   - **Given** a previous AI response
   - **When** it's included in context
   - **Then** the text is summarized if too long (> 500 chars)
   - **And** `askedQuestion` is set to true if response ends with "?"
   - **And** `presentedOptions` contains extracted option labels/text

4. **Message Index Tracking**
   - **Given** a prompt in the conversation
   - **When** context is built
   - **Then** `messageIndex` reflects the 0-based position
   - **And** first prompt has `messageIndex: 0`
   - **And** this is used by heuristic classification (27-2)

5. **Empty Context Handling**
   - **Given** the first prompt in a session (no prior context)
   - **When** context is built
   - **Then** `messages` is an empty array
   - **And** `messageIndex` is 0
   - **And** `lastResponse` is undefined
   - **And** the result is still valid for classification

## Technical Context

### File Locations

| File | Purpose |
|------|---------|
| `lib/analysis/conversationContext.ts` | Main context building logic |
| `lib/analysis/tokenEstimator.ts` | Token count estimation |
| `lib/analysis/responseSummarizer.ts` | Response text summarization |
| `lib/analysis/optionExtractor.ts` | Extract options from response (from 27-2) |

### TypeScript Interfaces

```typescript
// lib/types/classification.ts (extended from 27-1)

export interface ContextOptions {
  maxMessages?: number;       // Default: 50
  tokenBudget?: number;       // Default: 10000
  includeResponses?: boolean; // Default: true
  summaryLength?: number;     // Default: 500 chars for response summaries
}

export interface ConversationContext {
  sessionId: string;
  messageIndex: number;  // 0-based position of current prompt
  messages: ConversationMessage[];
  lastResponse?: ResponseSummary;
  lastResponseOptions?: string[];
  tokenBudget: number;
  totalTokens: number;
  sessionMetadata?: SessionMetadata;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  promptType?: PromptType;  // For user messages
  truncated: boolean;
  tokenCount: number;
  timestamp?: string;
}

export interface ResponseSummary {
  text: string;          // Summarized or truncated text
  fullLength: number;    // Original character count
  askedQuestion: boolean;
  presentedOptions: string[];
  toolsUsed: string[];
}

export interface SessionMetadata {
  primaryStage?: 'architecture' | 'development' | 'debugging';
  hasDebuggingLoop: boolean;
  promptCount: number;
}
```

### Context Building Implementation

```typescript
// lib/analysis/conversationContext.ts

import { createAdminClient } from '@/lib/supabase/admin';
import { estimateTokens } from './tokenEstimator';
import { summarizeResponse, detectQuestion, extractToolsUsed } from './responseSummarizer';
import { extractOptionsFromResponse } from './optionExtractor';
import { ConversationContext, ContextOptions, ConversationMessage } from '@/lib/types/classification';

const DEFAULT_OPTIONS: Required<ContextOptions> = {
  maxMessages: 50,
  tokenBudget: 10000,
  includeResponses: true,
  summaryLength: 500,
};

export async function buildConversationContext(
  promptId: string,
  options: ContextOptions = {}
): Promise<ConversationContext> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const supabase = createAdminClient();

  // 1. Get the prompt and its session
  const { data: prompt, error: promptError } = await supabase
    .from('prompts')
    .select(`
      id,
      session_uuid,
      content,
      sequence_number,
      created_at
    `)
    .eq('id', promptId)
    .single();

  if (promptError || !prompt) {
    console.error(`[CONTEXT] Failed to fetch prompt ${promptId}:`, promptError);
    throw new Error(`Prompt not found: ${promptId}`);
  }

  const sessionId = prompt.session_uuid;

  // 2. Handle first message case (no prior context)
  if (prompt.sequence_number === 1) {
    console.log(`[CONTEXT] First message in session, no prior context`);
    return {
      sessionId,
      messageIndex: 0,
      messages: [],
      lastResponse: undefined,
      lastResponseOptions: undefined,
      tokenBudget: opts.tokenBudget,
      totalTokens: 0,
    };
  }

  // 3. Get preceding prompts with responses
  const { data: precedingData, error: precedingError } = await supabase
    .from('prompts')
    .select(`
      id,
      content,
      prompt_type,
      sequence_number,
      created_at,
      prompt_responses (
        id,
        response_text,
        thinking_summary,
        tools_used
      )
    `)
    .eq('session_uuid', sessionId)
    .lt('sequence_number', prompt.sequence_number)
    .order('sequence_number', { ascending: true })
    .limit(opts.maxMessages);

  if (precedingError) {
    console.error(`[CONTEXT] Failed to fetch preceding prompts:`, precedingError);
    throw new Error(`Failed to fetch context: ${precedingError.message}`);
  }

  const precedingPrompts = precedingData || [];

  // 4. Build messages with token budget
  const messages: ConversationMessage[] = [];
  let totalTokens = 0;

  // Process from most recent to oldest (for token budget)
  const reversed = [...precedingPrompts].reverse();

  for (const p of reversed) {
    // User message
    const userContent = p.content;
    const userTokens = estimateTokens(userContent);

    if (totalTokens + userTokens > opts.tokenBudget) {
      // Truncate and stop
      const truncated = truncateToFit(userContent, opts.tokenBudget - totalTokens);
      messages.unshift({
        role: 'user',
        content: truncated,
        promptType: p.prompt_type,
        truncated: true,
        tokenCount: opts.tokenBudget - totalTokens,
      });
      totalTokens = opts.tokenBudget;
      break;
    }

    messages.unshift({
      role: 'user',
      content: userContent,
      promptType: p.prompt_type,
      truncated: false,
      tokenCount: userTokens,
      timestamp: p.created_at,
    });
    totalTokens += userTokens;

    // Assistant message (if responses enabled and exists)
    if (opts.includeResponses && p.prompt_responses?.length > 0) {
      const response = p.prompt_responses[0];
      const responseText = response.response_text || '';
      const summarized = summarizeResponse(responseText, opts.summaryLength);
      const responseTokens = estimateTokens(summarized);

      if (totalTokens + responseTokens > opts.tokenBudget) {
        // Skip this response to stay in budget
        continue;
      }

      messages.unshift({
        role: 'assistant',
        content: summarized,
        truncated: responseText.length > opts.summaryLength,
        tokenCount: responseTokens,
      });
      totalTokens += responseTokens;
    }
  }

  // Restore chronological order
  messages.reverse();

  // 5. Build last response summary
  const lastPromptWithResponse = precedingPrompts
    .filter(p => p.prompt_responses?.length > 0)
    .at(-1);

  let lastResponse: ResponseSummary | undefined;
  let lastResponseOptions: string[] | undefined;

  if (lastPromptWithResponse?.prompt_responses?.[0]) {
    const resp = lastPromptWithResponse.prompt_responses[0];
    const responseText = resp.response_text || '';

    lastResponse = {
      text: summarizeResponse(responseText, opts.summaryLength),
      fullLength: responseText.length,
      askedQuestion: detectQuestion(responseText),
      presentedOptions: extractOptionsFromResponse(responseText),
      toolsUsed: resp.tools_used || [],
    };

    lastResponseOptions = lastResponse.presentedOptions;
  }

  // 6. Get session metadata
  const { data: session } = await supabase
    .from('sessions')
    .select('primary_stage, has_debugging_loop, user_message_count')
    .eq('id', sessionId)
    .single();

  console.log(`[CONTEXT] Built context for prompt ${promptId}: ${messages.length} messages, ${totalTokens} tokens`);

  return {
    sessionId,
    messageIndex: prompt.sequence_number - 1,  // 0-based
    messages,
    lastResponse,
    lastResponseOptions,
    tokenBudget: opts.tokenBudget,
    totalTokens,
    sessionMetadata: session ? {
      primaryStage: session.primary_stage,
      hasDebuggingLoop: session.has_debugging_loop,
      promptCount: session.user_message_count,
    } : undefined,
  };
}

function truncateToFit(text: string, maxTokens: number): string {
  // Rough estimate: 4 chars per token
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;

  // Find sentence boundary near limit
  const truncated = text.slice(0, maxChars);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  const breakPoint = Math.max(lastPeriod, lastNewline);

  if (breakPoint > maxChars * 0.7) {
    return truncated.slice(0, breakPoint + 1) + '...';
  }

  return truncated + '...';
}
```

### Token Estimation

```typescript
// lib/analysis/tokenEstimator.ts

/**
 * Estimates token count for text.
 * Uses simple heuristic: ~4 characters per token for English text.
 * More accurate than nothing, cheaper than calling tiktoken.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // Base estimate: 4 chars per token
  const baseEstimate = Math.ceil(text.length / 4);

  // Adjust for code content (more tokens due to special chars)
  const codeIndicators = ['```', 'function', 'const ', 'import ', 'export '];
  const hasCode = codeIndicators.some(ind => text.includes(ind));

  if (hasCode) {
    return Math.ceil(baseEstimate * 1.3);  // 30% more tokens for code
  }

  return baseEstimate;
}

/**
 * Check if content fits within token budget.
 */
export function fitsInBudget(text: string, budget: number): boolean {
  return estimateTokens(text) <= budget;
}
```

### Response Summarization

```typescript
// lib/analysis/responseSummarizer.ts

/**
 * Summarizes a response to fit within character limit.
 * Tries to break at sentence boundaries.
 */
export function summarizeResponse(text: string, maxLength: number = 500): string {
  if (!text || text.length <= maxLength) {
    return text;
  }

  // Find sentence boundary near limit
  const truncated = text.slice(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('. ');
  const lastQuestion = truncated.lastIndexOf('? ');
  const lastExclaim = truncated.lastIndexOf('! ');
  const lastNewline = truncated.lastIndexOf('\n');

  const breakPoints = [lastPeriod, lastQuestion, lastExclaim, lastNewline]
    .filter(p => p > maxLength * 0.6);  // At least 60% of content

  if (breakPoints.length > 0) {
    const breakPoint = Math.max(...breakPoints);
    return truncated.slice(0, breakPoint + 1).trim() + '...';
  }

  return truncated.trim() + '...';
}

/**
 * Detects if response ends with a question to the user.
 */
export function detectQuestion(text: string): boolean {
  if (!text) return false;

  // Check last 200 characters for question patterns
  const tail = text.slice(-200).trim();

  // Direct question at end
  if (tail.endsWith('?')) {
    return true;
  }

  // Common question patterns
  const questionPatterns = [
    /would you like me to/i,
    /should I proceed/i,
    /do you want me to/i,
    /let me know if/i,
    /which option/i,
    /what would you prefer/i,
  ];

  return questionPatterns.some(p => p.test(tail));
}

/**
 * Extracts tool names from tools_used JSONB.
 */
export function extractToolsUsed(toolsUsed: unknown): string[] {
  if (!toolsUsed) return [];

  if (Array.isArray(toolsUsed)) {
    return toolsUsed.map(t => {
      if (typeof t === 'string') return t;
      if (typeof t === 'object' && t !== null && 'name' in t) {
        return (t as { name: string }).name;
      }
      return String(t);
    });
  }

  return [];
}
```

## Tasks / Subtasks

- [x] **Task 1: Create Token Estimator** (AC: #2)
  - [x] Create `lib/analysis/tokenEstimator.ts`
  - [x] Implement `estimateTokens(text)` function
  - [x] Add code content adjustment (30% increase)
  - [x] Add `fitsInBudget()` helper

- [x] **Task 2: Create Response Summarizer** (AC: #3)
  - [x] Create `lib/analysis/responseSummarizer.ts`
  - [x] Implement `summarizeResponse(text, maxLength)` function
  - [x] Implement `detectQuestion(text)` function
  - [x] Implement `extractToolsUsed(toolsUsed)` function
  - [x] Handle edge cases (empty text, no punctuation)

- [x] **Task 3: Create Main Context Builder** (AC: #1, #2, #4, #5)
  - [x] Create `lib/analysis/buildAnalysisContext.ts`
  - [x] Implement `buildAnalysisContext(promptId, options)` function
  - [x] Query prompt with session information
  - [x] Query preceding prompts with responses
  - [x] Handle first message case (empty context)
  - [x] Implement token budget enforcement
  - [x] Build message array in chronological order
  - [x] Extract last response summary
  - [x] Add structured logging with `[CONTEXT]` prefix

- [x] **Task 4: Add Context Caching** (Performance optimization)
  - [x] Create in-memory cache for session contexts
  - [x] Cache key: `context:${promptId}`
  - [x] Cache TTL: 5 minutes
  - [x] `clearContextCache()` function for testing

- [x] **Task 5: Write Unit Tests**
  - [x] Test context building with multiple prompts
  - [x] Test token budget enforcement (messages truncated)
  - [x] Test first message returns empty messages array
  - [x] Test response summarization at sentence boundaries
  - [x] Test question detection patterns
  - [x] Test option extraction integration
  - [x] Test message index calculation

## Dev Notes

### Token Budget Strategy

Messages are included from most recent to oldest. This prioritizes recent context which is most relevant for understanding the current prompt.

```
Token Budget: 10,000
Prompt 1 (500 tokens): Included
Prompt 2 (800 tokens): Included
Response 2 (1,500 tokens): Included
Prompt 3 (600 tokens): Included
Response 3 (2,000 tokens): Included
Prompt 4 (700 tokens): Included
Response 4 (3,000 tokens): Included
Prompt 5 (1,200 tokens): TRUNCATED (budget exceeded)
--> Total: 10,000 tokens
```

### Query Optimization

The context query joins prompts with responses in a single query to minimize database round trips:

```sql
SELECT p.*, pr.response_text, pr.thinking_summary, pr.tools_used
FROM prompts p
LEFT JOIN prompt_responses pr ON pr.prompt_id = p.id
WHERE p.session_uuid = $1
  AND p.sequence_number < $2
ORDER BY p.sequence_number ASC
LIMIT 50
```

### Caching Considerations

Context for a session changes only when new prompts arrive. Cache can be invalidated:
1. After TTL (5 minutes)
2. When session receives new prompt (webhook trigger)
3. On explicit cache clear

### Error Handling

| Error | Handling |
|-------|----------|
| Prompt not found | Throw error (caller must handle) |
| Session query fails | Log error, return partial context |
| Response missing | Continue without response data |
| Token estimation fails | Use conservative estimate |

## Testing Checklist

- [x] Context includes all preceding prompts in chronological order
- [x] Token budget is respected (totalTokens <= tokenBudget)
- [x] First message returns messageIndex: 0 and empty messages
- [x] Response summaries are <= summaryLength characters
- [x] Question detection finds "?" at end of response
- [x] Question detection finds "Would you like me to..."
- [x] Options extracted from numbered lists in response
- [x] Session metadata included when available
- [x] Logging follows `[CONTEXT]` prefix convention
- [x] Database errors are logged and handled gracefully

## Design System Requirements

This story is backend-only. No UI components required.
