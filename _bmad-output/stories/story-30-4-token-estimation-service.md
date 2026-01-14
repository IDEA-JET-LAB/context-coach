# Story 30-4: Token Estimation Service

## Story Info
- **Epic:** 30 - Conversation Analysis
- **Priority:** P1
- **Points:** 2
- **Status:** Done
- **Completed:** 2026-01-10

## Description

Create a service that estimates token counts for conversation content before sending to the LLM. This enables users to see cost estimates and make informed decisions about what content to include.

## Acceptance Criteria

- [x] Create `lib/analysis/token-estimator.ts`
- [x] Estimate tokens for each content type independently
- [x] Calculate cost based on selected model
- [x] Accuracy within 15% of actual token count
- [x] Fast enough for real-time UI updates (<50ms)

## Technical Details

### Token Estimation Approach

Claude tokenization averages ~4 characters per token for English text. We add a small buffer for safety:

```typescript
// lib/analysis/token-estimator.ts

/**
 * Estimates token count for text using character-based approximation.
 * Claude averages ~4 characters per token for English.
 * We use 3.5 to slightly overestimate for safety.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.5);
}
```

### Types

```typescript
export interface ContentForEstimation {
  prompts: string[];           // User prompt texts
  responses: string[];         // AI response texts
  thinking: string[];          // Thinking block texts
  tools: ToolCallSummary[];    // Summarized tool calls
}

export interface ToolCallSummary {
  name: string;
  inputSummary: string;  // First 100 chars of input
}

export interface TokenEstimate {
  prompts: number;
  responses: number;
  thinking: number;
  tools: number;
  systemPrompt: number;  // Fixed overhead for analysis prompt
  total: number;
}

export interface CostEstimate {
  haiku: CostBreakdown;
  sonnet: CostBreakdown;
  opus: CostBreakdown;
}

export interface CostBreakdown {
  inputCents: number;
  outputCents: number;  // Estimated based on typical response length
  totalCents: number;
}
```

### Pricing Constants

```typescript
// Pricing per million tokens (as of Jan 2025)
export const MODEL_PRICING = {
  haiku: {
    input: 0.25,   // $0.25 per 1M input tokens
    output: 1.25,  // $1.25 per 1M output tokens
  },
  sonnet: {
    input: 3.00,
    output: 15.00,
  },
  opus: {
    input: 15.00,
    output: 75.00,
  },
} as const;

// Typical output length for analysis responses
const ESTIMATED_OUTPUT_TOKENS = 500;
```

### Main Functions

```typescript
/**
 * Estimates tokens for conversation content.
 */
export function estimateConversationTokens(
  content: ContentForEstimation,
  options: {
    includePrompts: boolean;
    includeResponses: boolean;
    includeThinking: boolean;
    includeTools: boolean;
  }
): TokenEstimate {
  const systemPromptTokens = estimateTokens(ANALYSIS_SYSTEM_PROMPT);

  let promptTokens = 0;
  let responseTokens = 0;
  let thinkingTokens = 0;
  let toolTokens = 0;

  if (options.includePrompts) {
    promptTokens = content.prompts.reduce(
      (sum, p) => sum + estimateTokens(p),
      0
    );
  }

  if (options.includeResponses) {
    responseTokens = content.responses.reduce(
      (sum, r) => sum + estimateTokens(r),
      0
    );
  }

  if (options.includeThinking) {
    thinkingTokens = content.thinking.reduce(
      (sum, t) => sum + estimateTokens(t),
      0
    );
  }

  if (options.includeTools) {
    toolTokens = content.tools.reduce(
      (sum, t) => sum + estimateTokens(`${t.name}: ${t.inputSummary}`),
      0
    );
  }

  return {
    prompts: promptTokens,
    responses: responseTokens,
    thinking: thinkingTokens,
    tools: toolTokens,
    systemPrompt: systemPromptTokens,
    total: systemPromptTokens + promptTokens + responseTokens + thinkingTokens + toolTokens,
  };
}

/**
 * Calculates cost estimates for all models.
 */
export function estimateCost(inputTokens: number): CostEstimate {
  const estimate = (model: keyof typeof MODEL_PRICING): CostBreakdown => {
    const pricing = MODEL_PRICING[model];
    const inputCents = (inputTokens / 1_000_000) * pricing.input * 100;
    const outputCents = (ESTIMATED_OUTPUT_TOKENS / 1_000_000) * pricing.output * 100;
    return {
      inputCents,
      outputCents,
      totalCents: inputCents + outputCents,
    };
  };

  return {
    haiku: estimate('haiku'),
    sonnet: estimate('sonnet'),
    opus: estimate('opus'),
  };
}

/**
 * Formats cost for display.
 */
export function formatCost(cents: number): string {
  if (cents < 1) {
    return `<$0.01`;
  }
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Formats token count for display.
 */
export function formatTokens(tokens: number): string {
  if (tokens < 1000) {
    return tokens.toString();
  }
  return `${(tokens / 1000).toFixed(1)}k`;
}
```

### Analysis System Prompt

```typescript
const ANALYSIS_SYSTEM_PROMPT = `You are an expert at analyzing developer-AI conversations to provide feedback on context engineering effectiveness.

Analyze the provided conversation and answer the user's question. Focus on:
- How well the user communicated their intent
- Whether sufficient context was provided upfront
- Efficiency of the interaction (unnecessary back-and-forth)
- Opportunities for improvement

Be specific and actionable in your feedback.`;
```

## Tests

### Unit Tests

```typescript
describe('TokenEstimator', () => {
  describe('estimateTokens', () => {
    it('should return 0 for empty string');
    it('should estimate ~4 chars per token');
    it('should handle unicode characters');
    it('should handle code blocks');
  });

  describe('estimateConversationTokens', () => {
    it('should sum tokens for selected content types');
    it('should include system prompt overhead');
    it('should exclude unselected content types');
    it('should handle empty arrays');
  });

  describe('estimateCost', () => {
    it('should calculate correct cost for Haiku');
    it('should calculate correct cost for Sonnet');
    it('should calculate correct cost for Opus');
    it('should include estimated output cost');
  });

  describe('formatCost', () => {
    it('should format sub-cent costs as <$0.01');
    it('should format costs with 2 decimal places');
  });

  describe('formatTokens', () => {
    it('should format small numbers without suffix');
    it('should format thousands with k suffix');
  });
});
```

### Accuracy Tests

```typescript
describe('Token estimation accuracy', () => {
  // Compare estimates to actual token counts from Anthropic API
  it('should be within 15% of actual for English text');
  it('should be within 20% of actual for code');
  it('should be within 15% of actual for mixed content');
});
```

## Dependencies

- None (can be developed in parallel with other stories)

## Out of Scope

- Actual API calls (Story 30-1)
- UI display (Story 30-7)
- Exact tokenization (would require Anthropic tokenizer)

## Definition of Done

- [ ] Service implemented with TypeScript types
- [ ] Unit tests passing
- [ ] Accuracy validated against real API responses
- [ ] Performance requirement met (<50ms)
- [ ] Cost calculation verified against Anthropic pricing
