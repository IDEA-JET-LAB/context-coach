// AI Client Module for analyze-prompt Edge Function
// Story 5.2: 5-Dimension Scoring

/**
 * OpenAI API response types
 */
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIChoice {
  index: number;
  message: OpenAIMessage;
  finish_reason: string;
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIError {
  error: {
    message: string;
    type: string;
    code: string | null;
  };
}

/**
 * Custom error for AI API failures
 */
export class AIClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly errorType?: string,
    public readonly errorCode?: string | null
  ) {
    super(message);
    this.name = 'AIClientError';
  }
}

/**
 * Default configuration
 */
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Gets the configured OpenAI timeout from environment or uses default
 * @returns Timeout in milliseconds
 */
function getConfiguredTimeout(): number {
  const envTimeout = Deno.env.get('OPENAI_TIMEOUT_MS');
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_TIMEOUT_MS;
}

/**
 * Gets the OpenAI API key from environment
 * @throws AIClientError if key is not configured
 */
function getAPIKey(): string {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new AIClientError(
      'OPENAI_API_KEY environment variable is not configured',
      500,
      'configuration_error'
    );
  }
  return apiKey;
}

/**
 * Calls the OpenAI API with the given prompts
 * @param systemPrompt The system prompt for the AI
 * @param userPrompt The user prompt to analyze
 * @param model The model to use (defaults to gpt-4o-mini)
 * @param timeoutMs Timeout in milliseconds (defaults to configured timeout or 30000ms)
 * @returns The AI response content string
 * @throws AIClientError on API errors or timeout
 */
export async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  model: string = DEFAULT_MODEL,
  timeoutMs?: number
): Promise<string> {
  const apiKey = getAPIKey();
  const effectiveTimeout = timeoutMs ?? getConfiguredTimeout();

  const messages: OpenAIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const requestBody = {
    model,
    messages,
    temperature: 0.3, // Lower temperature for more consistent scoring
    max_tokens: 1000, // Enough for detailed reasoning
    response_format: { type: 'json_object' }, // Request JSON mode
  };

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle non-OK responses
    if (!response.ok) {
      let errorMessage = `OpenAI API error: ${response.status} ${response.statusText}`;
      let errorType: string | undefined;
      let errorCode: string | null = null;

      try {
        const errorBody = (await response.json()) as OpenAIError;
        if (errorBody.error) {
          errorMessage = errorBody.error.message;
          errorType = errorBody.error.type;
          errorCode = errorBody.error.code;
        }
      } catch {
        // Ignore JSON parse errors for error response
      }

      throw new AIClientError(errorMessage, response.status, errorType, errorCode);
    }

    // Parse successful response
    const data = (await response.json()) as OpenAIResponse;

    // Enhanced validation for edge cases
    if (!data.choices || data.choices.length === 0) {
      throw new AIClientError(
        'OpenAI API returned empty choices array',
        500,
        'invalid_response'
      );
    }

    const firstChoice = data.choices[0];
    if (!firstChoice) {
      throw new AIClientError(
        'OpenAI API returned undefined first choice',
        500,
        'invalid_response'
      );
    }

    const content = firstChoice.message?.content;
    if (!content || typeof content !== 'string') {
      throw new AIClientError(
        'OpenAI API returned invalid or empty content',
        500,
        'invalid_response'
      );
    }

    if (content.trim().length === 0) {
      throw new AIClientError(
        'OpenAI API returned empty content after trimming',
        500,
        'invalid_response'
      );
    }

    return content;
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle abort (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AIClientError(
        `OpenAI API call timed out after ${effectiveTimeout}ms`,
        504,
        'timeout'
      );
    }

    // Re-throw AIClientError as-is
    if (error instanceof AIClientError) {
      throw error;
    }

    // Wrap other errors
    throw new AIClientError(
      `OpenAI API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'network_error'
    );
  }
}

/**
 * Checks if OpenAI API is configured
 * @returns true if OPENAI_API_KEY is set
 */
export function isOpenAIConfigured(): boolean {
  return !!Deno.env.get('OPENAI_API_KEY');
}
