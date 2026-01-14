/**
 * Anthropic API Client
 * Story 30-1: Anthropic API Integration
 *
 * Provides non-streaming and streaming conversation analysis
 * using Anthropic's Claude models (Haiku, Sonnet, Opus).
 */

// ============================================================================
// Constants
// ============================================================================

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0;
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Retry delays for exponential backoff on rate limits (429).
 */
const RETRY_DELAYS_MS = [1000, 2000, 4000];

// ============================================================================
// Types
// ============================================================================

/**
 * Available Anthropic model tiers.
 */
export type AnthropicModel = 'haiku' | 'sonnet' | 'opus';

/**
 * Configuration for Anthropic API calls.
 */
export interface AnthropicConfig {
  model: AnthropicModel;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  timeout?: number;
}

/**
 * Request payload for analysis.
 */
export interface AnalysisRequest {
  systemPrompt: string;
  userPrompt: string;
  config: AnthropicConfig;
}

/**
 * Response from non-streaming analysis.
 */
export interface AnalysisResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
}

/**
 * Chunk from streaming analysis.
 */
export interface StreamChunk {
  type: 'text' | 'done' | 'error';
  content?: string;
  error?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ============================================================================
// Model Mapping
// ============================================================================

/**
 * Maps model tier names to Anthropic model IDs.
 * Updated January 2026 to use current model versions.
 */
const MODEL_IDS: Record<AnthropicModel, string> = {
  haiku: 'claude-3-5-haiku-20241022',
  sonnet: 'claude-sonnet-4-20250514',
  opus: 'claude-opus-4-5-20251101',
};

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Raw Anthropic API response structure.
 */
interface AnthropicAPIResponse {
  id?: string;
  type?: string;
  role?: string;
  content?: Array<{
    type: string;
    text?: string;
  }>;
  model?: string;
  stop_reason?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Anthropic API error response structure.
 */
interface AnthropicErrorResponse {
  error?: {
    type?: string;
    message?: string;
  };
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown when Anthropic API key is missing.
 */
export class MissingAPIKeyError extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY environment variable is not configured');
    this.name = 'MissingAPIKeyError';
  }
}

/**
 * Error thrown when API call times out.
 */
export class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Anthropic API call timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Error thrown when rate limited (429) and retries exhausted.
 */
export class RateLimitError extends Error {
  constructor() {
    super('Anthropic API rate limit exceeded after all retries');
    this.name = 'RateLimitError';
  }
}

/**
 * Error thrown for authentication failures (401).
 */
export class AuthenticationError extends Error {
  constructor(message?: string) {
    super(message || 'Anthropic API authentication failed');
    this.name = 'AuthenticationError';
  }
}

/**
 * Error thrown for server errors (500).
 */
export class ServerError extends Error {
  public readonly status: number;

  constructor(status: number, message?: string) {
    super(message ? `Anthropic API server error (${status}): ${message}` : `Anthropic API server error: ${status}`);
    this.name = 'ServerError';
    this.status = status;
  }
}

// ============================================================================
// Non-Streaming Analysis
// ============================================================================

/**
 * Analyzes a conversation using the Anthropic API (non-streaming).
 *
 * @param request - The analysis request containing prompts and config
 * @returns Analysis response with content and usage stats
 * @throws MissingAPIKeyError if ANTHROPIC_API_KEY is not set
 * @throws TimeoutError if the request times out
 * @throws RateLimitError if rate limited after all retries
 * @throws AuthenticationError if API key is invalid
 * @throws ServerError for 5xx errors
 *
 * @example
 * ```ts
 * const response = await analyzeConversation({
 *   systemPrompt: 'You are a helpful assistant.',
 *   userPrompt: 'Analyze this conversation...',
 *   config: { model: 'haiku' }
 * });
 * ```
 */
export async function analyzeConversation(
  request: AnalysisRequest
): Promise<AnalysisResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new MissingAPIKeyError();
  }

  const { systemPrompt, userPrompt, config } = request;
  const modelId = MODEL_IDS[config.model];
  const maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  const temperature = config.temperature ?? DEFAULT_TEMPERATURE;
  const timeout = config.timeout ?? DEFAULT_TIMEOUT_MS;

  const body = {
    model: modelId,
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  };

  // Try with exponential backoff for rate limits
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle rate limiting with retry
      if (response.status === 429) {
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]!!);
          continue;
        }
        throw new RateLimitError();
      }

      // Handle authentication error
      if (response.status === 401) {
        const errorData = await tryParseError(response);
        throw new AuthenticationError(errorData?.error?.message);
      }

      // Handle server errors
      if (response.status >= 500) {
        const errorData = await tryParseError(response);
        throw new ServerError(response.status, errorData?.error?.message);
      }

      // Handle other errors
      if (!response.ok) {
        const errorData = await tryParseError(response);
        throw new Error(
          errorData?.error?.message ||
            `Anthropic API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as AnthropicAPIResponse;

      return parseResponse(data);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(timeout);
      }

      // Don't retry for non-retryable errors
      if (
        error instanceof MissingAPIKeyError ||
        error instanceof AuthenticationError ||
        error instanceof ServerError ||
        error instanceof RateLimitError
      ) {
        throw error;
      }

      lastError = error as Error;

      // Only retry on network errors, not on validation errors
      if (attempt < RETRY_DELAYS_MS.length && isRetryableError(error)) {
        await sleep(RETRY_DELAYS_MS[attempt]!!);
        continue;
      }

      throw error;
    }
  }

  throw lastError || new Error('Unknown error during Anthropic API call');
}

// ============================================================================
// Streaming Analysis
// ============================================================================

/**
 * Analyzes a conversation using the Anthropic API (streaming).
 *
 * @param request - The analysis request containing prompts and config
 * @yields StreamChunk objects containing text, done, or error events
 * @throws MissingAPIKeyError if ANTHROPIC_API_KEY is not set
 *
 * @example
 * ```ts
 * for await (const chunk of analyzeConversationStream(request)) {
 *   if (chunk.type === 'text') {
 *     process.stdout.write(chunk.content);
 *   } else if (chunk.type === 'done') {
 *     console.log('Usage:', chunk.usage);
 *   } else if (chunk.type === 'error') {
 *     console.error('Error:', chunk.error);
 *   }
 * }
 * ```
 */
export async function* analyzeConversationStream(
  request: AnalysisRequest
): AsyncGenerator<StreamChunk> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new MissingAPIKeyError();
  }

  const { systemPrompt, userPrompt, config } = request;
  const modelId = MODEL_IDS[config.model];
  const maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  const temperature = config.temperature ?? DEFAULT_TEMPERATURE;
  const timeout = config.timeout ?? DEFAULT_TIMEOUT_MS;

  const body = {
    model: modelId,
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    stream: true,
  };

  // Try with exponential backoff for rate limits
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle rate limiting with retry
      if (response.status === 429) {
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]!);
          continue;
        }
        yield { type: 'error', error: 'Rate limit exceeded after all retries' };
        return;
      }

      // Handle authentication error
      if (response.status === 401) {
        yield { type: 'error', error: 'Authentication failed' };
        return;
      }

      // Handle server errors
      if (response.status >= 500) {
        yield { type: 'error', error: `Server error: ${response.status}` };
        return;
      }

      // Handle other errors
      if (!response.ok) {
        const errorData = await tryParseError(response);
        yield {
          type: 'error',
          error: errorData?.error?.message || `API error: ${response.status}`,
        };
        return;
      }

      // Process the stream
      const reader = response.body?.getReader();
      if (!reader) {
        yield { type: 'error', error: 'No response body' };
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let inputTokens = 0;
      let outputTokens = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              continue;
            }

            try {
              const event = JSON.parse(data) as StreamEvent;

              if (event.type === 'content_block_delta') {
                const delta = event.delta as { type: string; text?: string };
                if (delta.type === 'text_delta' && delta.text) {
                  yield { type: 'text', content: delta.text };
                }
              } else if (event.type === 'message_start') {
                const message = event.message as { usage?: { input_tokens: number } };
                if (message?.usage?.input_tokens) {
                  inputTokens = message.usage.input_tokens;
                }
              } else if (event.type === 'message_delta') {
                const usage = event.usage as { output_tokens?: number };
                if (usage?.output_tokens) {
                  outputTokens = usage.output_tokens;
                }
              }
            } catch {
              // Ignore JSON parse errors for malformed events
            }
          }
        }
      }

      yield {
        type: 'done',
        usage: { inputTokens, outputTokens },
      };

      return;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        yield { type: 'error', error: `Request timed out after ${timeout}ms` };
        return;
      }

      // Retry on network errors
      if (attempt < RETRY_DELAYS_MS.length && isRetryableError(error)) {
        await sleep(RETRY_DELAYS_MS[attempt]!);
        continue;
      }

      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      return;
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Stream event structure from Anthropic API.
 */
interface StreamEvent {
  type: string;
  message?: unknown;
  delta?: unknown;
  usage?: unknown;
}

/**
 * Parses the API response into our standard format.
 */
function parseResponse(data: AnthropicAPIResponse): AnalysisResponse {
  const textContent = data.content?.find((c) => c.type === 'text');
  const content = textContent?.text || '';

  return {
    content,
    model: data.model || '',
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
    stopReason: data.stop_reason || 'unknown',
  };
}

/**
 * Attempts to parse error response from API.
 */
async function tryParseError(
  response: Response
): Promise<AnthropicErrorResponse | null> {
  try {
    return (await response.json()) as AnthropicErrorResponse;
  } catch {
    return null;
  }
}

/**
 * Checks if an error is retryable (network-related).
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  // Network errors
  if (
    error.message.includes('fetch') ||
    error.message.includes('network') ||
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('ECONNRESET')
  ) {
    return true;
  }

  return false;
}

/**
 * Sleep utility for retry delays.
 * Exposed for testing so we can mock delays.
 */
export let sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Allows tests to replace the sleep function.
 */
export function setSleepFn(fn: (ms: number) => Promise<void>): void {
  sleep = fn;
}

/**
 * Resets sleep to the default implementation.
 */
export function resetSleepFn(): void {
  sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };
}

// ============================================================================
// Exports for Testing
// ============================================================================

export { MODEL_IDS, RETRY_DELAYS_MS, parseResponse };
