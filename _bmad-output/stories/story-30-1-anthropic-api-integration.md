# Story 30-1: Anthropic API Integration

## Story Info
- **Epic:** 30 - Conversation Analysis
- **Priority:** P0 (Foundation)
- **Points:** 3
- **Status:** Done
- **Completed:** 2026-01-10

## Description

Create a reusable Anthropic client service for conversation analysis with support for all three Claude models (Haiku, Sonnet, Opus). This is the foundation for all LLM-powered analysis features.

## Acceptance Criteria

- [x] Create `lib/analysis/anthropic-client.ts` with typed client
- [x] Support model selection: Haiku, Sonnet, Opus
- [x] Implement streaming support for better UX on long responses
- [x] Handle rate limits with exponential backoff
- [x] Timeout handling (30s default, configurable)
- [x] Error handling with user-friendly messages
- [x] Add `ANTHROPIC_API_KEY` to environment configuration

## Technical Details

### File Structure

```
app/lib/analysis/
├── anthropic-client.ts      # Main client
├── anthropic-client.test.ts # Unit tests
└── types.ts                 # Shared types (if needed)
```

### Types

```typescript
// lib/analysis/anthropic-client.ts

export type AnthropicModel = 'haiku' | 'sonnet' | 'opus';

export interface AnthropicConfig {
  model: AnthropicModel;
  maxTokens?: number;      // Default: 4096
  temperature?: number;    // Default: 0 (deterministic)
  stream?: boolean;        // Default: false
  timeout?: number;        // Default: 30000ms
}

export interface AnalysisRequest {
  systemPrompt: string;
  userPrompt: string;
  config: AnthropicConfig;
}

export interface AnalysisResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
}

// For streaming
export interface StreamChunk {
  type: 'text' | 'done' | 'error';
  content?: string;
  error?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}
```

### Model Mapping

| UI Name | API Model ID | Input $/1M | Output $/1M |
|---------|--------------|------------|-------------|
| Haiku | claude-3-haiku-20240307 | $0.25 | $1.25 |
| Sonnet | claude-3-sonnet-20240229 | $3.00 | $15.00 |
| Opus | claude-3-opus-20240229 | $15.00 | $75.00 |

```typescript
const MODEL_IDS: Record<AnthropicModel, string> = {
  haiku: 'claude-3-haiku-20240307',
  sonnet: 'claude-3-sonnet-20240229',
  opus: 'claude-3-opus-20240229',
};
```

### Implementation Pattern

Follow existing pattern from `lib/analysis/llmClassifier.ts`:
- Direct fetch to API endpoint
- System + user prompts
- Timeout with AbortController
- Error handling with typed errors

### Environment Variables

Add to `app/.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-api03-REDACTED
```

Add to GCP Secret Manager for production:
```bash
echo -n "sk-ant-api03-..." | gcloud secrets create ANTHROPIC_API_KEY --data-file=-
```

### Rate Limit Handling

Implement exponential backoff:
```typescript
const RETRY_DELAYS = [1000, 2000, 4000]; // ms

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i <= RETRY_DELAYS.length; i++) {
    try {
      return await fn();
    } catch (error) {
      if (isRateLimitError(error) && i < RETRY_DELAYS.length) {
        await sleep(RETRY_DELAYS[i]);
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

## Tests

### Unit Tests

```typescript
describe('AnthropicClient', () => {
  describe('analyzeConversation', () => {
    it('should call Anthropic API with correct parameters');
    it('should handle Haiku model selection');
    it('should handle Sonnet model selection');
    it('should handle Opus model selection');
    it('should return typed response with token counts');
  });

  describe('streaming', () => {
    it('should yield text chunks during streaming');
    it('should yield done event with usage at end');
    it('should yield error event on failure');
  });

  describe('error handling', () => {
    it('should throw on missing API key');
    it('should throw on timeout');
    it('should retry on rate limit (429)');
    it('should throw after max retries');
    it('should handle invalid API key (401)');
    it('should handle server errors (500)');
  });
});
```

### Mocking

Use `msw` or manual fetch mocking for API responses.

## Dependencies

- None (foundation story)

## Out of Scope

- UI components (Story 30-7)
- Database storage (Story 30-3)
- Token estimation (Story 30-4)

## Definition of Done

- [x] Code implemented with TypeScript types
- [x] Unit tests passing (>90% coverage)
- [x] Environment variable documented
- [x] Works locally with real API key
- [x] Error messages are user-friendly
