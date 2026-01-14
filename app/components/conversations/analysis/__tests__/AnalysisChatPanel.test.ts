import { describe, it, expect } from 'vitest';

/**
 * Tests for Analysis Chat Panel Helper Functions - Story 30-7
 *
 * These tests validate the pure helper functions and logic used by
 * the conversation analysis chat interface components.
 */

// ============================================================================
// PastAnalysesList helpers
// ============================================================================

/**
 * Formats a timestamp to relative time (e.g., "2h ago", "3d ago")
 */
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
}

describe('PastAnalysesList helpers - Story 30-7', () => {
  describe('formatRelativeTime', () => {
    it('should return "just now" for times less than 60 seconds ago', () => {
      const now = new Date();
      const tenSecondsAgo = new Date(now.getTime() - 10 * 1000).toISOString();
      const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000).toISOString();

      expect(formatRelativeTime(tenSecondsAgo)).toBe('just now');
      expect(formatRelativeTime(thirtySecondsAgo)).toBe('just now');
    });

    it('should return minutes for times 1-59 minutes ago', () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000).toISOString();
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

      expect(formatRelativeTime(oneMinuteAgo)).toBe('1m ago');
      expect(formatRelativeTime(thirtyMinutesAgo)).toBe('30m ago');
    });

    it('should return hours for times 1-23 hours ago', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();

      expect(formatRelativeTime(oneHourAgo)).toBe('1h ago');
      expect(formatRelativeTime(twelveHoursAgo)).toBe('12h ago');
    });

    it('should return days for times 1-6 days ago', () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

      expect(formatRelativeTime(oneDayAgo)).toBe('1d ago');
      expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago');
    });

    it('should return formatted date for times 7+ days ago', () => {
      const now = new Date();
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(twoWeeksAgo.toISOString());

      // Result should be formatted like "Dec 25" or "Jan 1"
      expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    });
  });
});

// ============================================================================
// ModelSelector helpers
// ============================================================================

type AnthropicModel = 'haiku' | 'sonnet' | 'opus';

interface ModelOption {
  id: AnthropicModel;
  label: string;
  description: string;
}

const MODEL_OPTIONS: ModelOption[] = [
  { id: 'haiku', label: 'Haiku', description: 'Fast & cheap' },
  { id: 'sonnet', label: 'Sonnet', description: 'Balanced' },
  { id: 'opus', label: 'Opus', description: 'Most capable' },
];

describe('ModelSelector configuration - Story 30-7', () => {
  it('should have all three model options', () => {
    expect(MODEL_OPTIONS).toHaveLength(3);
    expect(MODEL_OPTIONS.map((m) => m.id)).toEqual(['haiku', 'sonnet', 'opus']);
  });

  it('should have labels for all models', () => {
    MODEL_OPTIONS.forEach((option) => {
      expect(option.label).toBeTruthy();
      expect(option.description).toBeTruthy();
    });
  });

  it('should have appropriate descriptions', () => {
    const haiku = MODEL_OPTIONS.find((m) => m.id === 'haiku');
    const sonnet = MODEL_OPTIONS.find((m) => m.id === 'sonnet');
    const opus = MODEL_OPTIONS.find((m) => m.id === 'opus');

    expect(haiku?.description.toLowerCase()).toContain('fast');
    expect(sonnet?.description.toLowerCase()).toContain('balanced');
    expect(opus?.description.toLowerCase()).toContain('capable');
  });
});

// ============================================================================
// ContentSelector helpers
// ============================================================================

interface ContentOptions {
  includePrompts: boolean;
  includeResponses: boolean;
  includeThinking: boolean;
  includeTools: boolean;
}

interface TokenCounts {
  prompts: number;
  responses: number;
  thinking: number;
  tools: number;
  systemPrompt: number;
  total: number;
}

/**
 * Calculates the total selected tokens based on content options
 */
function calculateSelectedTokens(
  tokenCounts: TokenCounts,
  options: ContentOptions
): number {
  let total = tokenCounts.systemPrompt;

  if (options.includePrompts) {
    total += tokenCounts.prompts;
  }
  if (options.includeResponses) {
    total += tokenCounts.responses;
  }
  if (options.includeThinking) {
    total += tokenCounts.thinking;
  }
  if (options.includeTools) {
    total += tokenCounts.tools;
  }

  return total;
}

const THINKING_WARNING_THRESHOLD = 20000;

describe('ContentSelector helpers - Story 30-7', () => {
  const sampleTokenCounts: TokenCounts = {
    prompts: 1000,
    responses: 3000,
    thinking: 25000,
    tools: 500,
    systemPrompt: 200,
    total: 29700,
  };

  describe('calculateSelectedTokens', () => {
    it('should include system prompt in all calculations', () => {
      const options: ContentOptions = {
        includePrompts: false,
        includeResponses: false,
        includeThinking: false,
        includeTools: false,
      };

      const result = calculateSelectedTokens(sampleTokenCounts, options);
      expect(result).toBe(200); // Only system prompt
    });

    it('should add prompts when enabled', () => {
      const options: ContentOptions = {
        includePrompts: true,
        includeResponses: false,
        includeThinking: false,
        includeTools: false,
      };

      const result = calculateSelectedTokens(sampleTokenCounts, options);
      expect(result).toBe(200 + 1000);
    });

    it('should add responses when enabled', () => {
      const options: ContentOptions = {
        includePrompts: true,
        includeResponses: true,
        includeThinking: false,
        includeTools: false,
      };

      const result = calculateSelectedTokens(sampleTokenCounts, options);
      expect(result).toBe(200 + 1000 + 3000);
    });

    it('should add thinking when enabled', () => {
      const options: ContentOptions = {
        includePrompts: true,
        includeResponses: true,
        includeThinking: true,
        includeTools: false,
      };

      const result = calculateSelectedTokens(sampleTokenCounts, options);
      expect(result).toBe(200 + 1000 + 3000 + 25000);
    });

    it('should add tools when enabled', () => {
      const options: ContentOptions = {
        includePrompts: true,
        includeResponses: true,
        includeThinking: true,
        includeTools: true,
      };

      const result = calculateSelectedTokens(sampleTokenCounts, options);
      expect(result).toBe(200 + 1000 + 3000 + 25000 + 500);
    });

    it('should calculate default options correctly', () => {
      // Default: prompts=true, responses=true, thinking=false, tools=true
      const defaultOptions: ContentOptions = {
        includePrompts: true,
        includeResponses: true,
        includeThinking: false,
        includeTools: true,
      };

      const result = calculateSelectedTokens(sampleTokenCounts, defaultOptions);
      expect(result).toBe(200 + 1000 + 3000 + 500);
    });
  });

  describe('THINKING_WARNING_THRESHOLD', () => {
    it('should be 20000 tokens', () => {
      expect(THINKING_WARNING_THRESHOLD).toBe(20000);
    });

    it('should trigger warning when thinking tokens exceed threshold', () => {
      const exceedsThreshold = sampleTokenCounts.thinking > THINKING_WARNING_THRESHOLD;
      expect(exceedsThreshold).toBe(true);
    });

    it('should not trigger warning when thinking tokens are below threshold', () => {
      const lowThinkingCounts: TokenCounts = {
        ...sampleTokenCounts,
        thinking: 15000,
      };
      const exceedsThreshold = lowThinkingCounts.thinking > THINKING_WARNING_THRESHOLD;
      expect(exceedsThreshold).toBe(false);
    });
  });
});

// ============================================================================
// CostEstimate helpers
// ============================================================================

const MODEL_PRICING = {
  haiku: { input: 0.25, output: 1.25 },
  sonnet: { input: 3.0, output: 15.0 },
  opus: { input: 15.0, output: 75.0 },
} as const;

interface CostBreakdown {
  inputCents: number;
  outputCents: number;
  totalCents: number;
}

/**
 * Calculates cost breakdown for a specific model.
 */
function calculateModelCost(
  inputTokens: number,
  outputTokens: number,
  model: keyof typeof MODEL_PRICING
): CostBreakdown {
  const pricing = MODEL_PRICING[model];

  // Convert from $/1M tokens to cents
  const inputCents = (inputTokens / 1_000_000) * pricing.input * 100;
  const outputCents = (outputTokens / 1_000_000) * pricing.output * 100;
  const totalCents = inputCents + outputCents;

  return {
    inputCents,
    outputCents,
    totalCents,
  };
}

describe('CostEstimate helpers - Story 30-7', () => {
  describe('MODEL_PRICING', () => {
    it('should have pricing for all models', () => {
      expect(MODEL_PRICING.haiku).toBeDefined();
      expect(MODEL_PRICING.sonnet).toBeDefined();
      expect(MODEL_PRICING.opus).toBeDefined();
    });

    it('should have haiku as cheapest', () => {
      expect(MODEL_PRICING.haiku.input).toBeLessThan(MODEL_PRICING.sonnet.input);
      expect(MODEL_PRICING.sonnet.input).toBeLessThan(MODEL_PRICING.opus.input);
    });
  });

  describe('calculateModelCost', () => {
    const inputTokens = 10000;
    const outputTokens = 500;

    it('should calculate haiku cost correctly', () => {
      const cost = calculateModelCost(inputTokens, outputTokens, 'haiku');

      // 10000 tokens * $0.25/1M = $0.0025 = 0.25 cents
      expect(cost.inputCents).toBeCloseTo(0.25, 4);
      // 500 tokens * $1.25/1M = $0.000625 = 0.0625 cents
      expect(cost.outputCents).toBeCloseTo(0.0625, 4);
      expect(cost.totalCents).toBeCloseTo(0.3125, 4);
    });

    it('should calculate sonnet cost correctly', () => {
      const cost = calculateModelCost(inputTokens, outputTokens, 'sonnet');

      // 10000 tokens * $3/1M = $0.03 = 3 cents
      expect(cost.inputCents).toBeCloseTo(3, 4);
      // 500 tokens * $15/1M = $0.0075 = 0.75 cents
      expect(cost.outputCents).toBeCloseTo(0.75, 4);
      expect(cost.totalCents).toBeCloseTo(3.75, 4);
    });

    it('should calculate opus cost correctly', () => {
      const cost = calculateModelCost(inputTokens, outputTokens, 'opus');

      // 10000 tokens * $15/1M = $0.15 = 15 cents
      expect(cost.inputCents).toBeCloseTo(15, 4);
      // 500 tokens * $75/1M = $0.0375 = 3.75 cents
      expect(cost.outputCents).toBeCloseTo(3.75, 4);
      expect(cost.totalCents).toBeCloseTo(18.75, 4);
    });

    it('should return 0 for 0 tokens', () => {
      const cost = calculateModelCost(0, 0, 'sonnet');

      expect(cost.inputCents).toBe(0);
      expect(cost.outputCents).toBe(0);
      expect(cost.totalCents).toBe(0);
    });
  });
});

// ============================================================================
// AnalysisInput validation
// ============================================================================

/**
 * Validates if the submit button should be enabled
 */
function canSubmit(
  question: string,
  isLoading: boolean,
  disabled: boolean
): boolean {
  return question.trim().length > 0 && !isLoading && !disabled;
}

describe('AnalysisInput helpers - Story 30-7', () => {
  describe('canSubmit', () => {
    it('should return true when question has content and not loading', () => {
      expect(canSubmit('What is the summary?', false, false)).toBe(true);
    });

    it('should return false when question is empty', () => {
      expect(canSubmit('', false, false)).toBe(false);
    });

    it('should return false when question is only whitespace', () => {
      expect(canSubmit('   ', false, false)).toBe(false);
      expect(canSubmit('\n\t', false, false)).toBe(false);
    });

    it('should return false when loading', () => {
      expect(canSubmit('Valid question', true, false)).toBe(false);
    });

    it('should return false when disabled', () => {
      expect(canSubmit('Valid question', false, true)).toBe(false);
    });

    it('should trim whitespace before checking', () => {
      expect(canSubmit('  question  ', false, false)).toBe(true);
    });
  });
});

// ============================================================================
// API Request validation
// ============================================================================

type QuestionType =
  | 'custom'
  | 'summarize'
  | 'find_issues'
  | 'suggestions'
  | 'deep_dive';

interface AnalyzeRequest {
  question: string;
  model: AnthropicModel;
  includePrompts: boolean;
  includeResponses: boolean;
  includeThinking: boolean;
  includeTools: boolean;
  questionType?: QuestionType;
}

/**
 * Validates the request body for the analyze API
 */
function validateRequest(
  body: unknown
): { valid: true; data: AnalyzeRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be an object' };
  }

  const {
    question,
    model,
    includePrompts,
    includeResponses,
    includeThinking,
    includeTools,
    questionType,
  } = body as Record<string, unknown>;

  if (typeof question !== 'string' || question.trim().length === 0) {
    return { valid: false, error: 'question is required and must be non-empty' };
  }

  if (question.length > 2000) {
    return { valid: false, error: 'question must not exceed 2000 characters' };
  }

  const validModels: AnthropicModel[] = ['haiku', 'sonnet', 'opus'];
  if (!validModels.includes(model as AnthropicModel)) {
    return {
      valid: false,
      error: `model must be one of: ${validModels.join(', ')}`,
    };
  }

  if (typeof includePrompts !== 'boolean') {
    return { valid: false, error: 'includePrompts must be a boolean' };
  }

  if (typeof includeResponses !== 'boolean') {
    return { valid: false, error: 'includeResponses must be a boolean' };
  }

  if (typeof includeThinking !== 'boolean') {
    return { valid: false, error: 'includeThinking must be a boolean' };
  }

  if (typeof includeTools !== 'boolean') {
    return { valid: false, error: 'includeTools must be a boolean' };
  }

  const validQuestionTypes: QuestionType[] = [
    'custom',
    'summarize',
    'find_issues',
    'suggestions',
    'deep_dive',
  ];
  if (
    questionType !== undefined &&
    !validQuestionTypes.includes(questionType as QuestionType)
  ) {
    return {
      valid: false,
      error: `questionType must be one of: ${validQuestionTypes.join(', ')}`,
    };
  }

  return {
    valid: true,
    data: {
      question: question.trim(),
      model: model as AnthropicModel,
      includePrompts,
      includeResponses,
      includeThinking,
      includeTools,
      questionType: questionType as QuestionType | undefined,
    },
  };
}

describe('API Request validation - Story 30-7', () => {
  const validRequest = {
    question: 'What is the summary?',
    model: 'sonnet',
    includePrompts: true,
    includeResponses: true,
    includeThinking: false,
    includeTools: true,
  };

  describe('validateRequest', () => {
    it('should accept valid request', () => {
      const result = validateRequest(validRequest);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.question).toBe('What is the summary?');
        expect(result.data.model).toBe('sonnet');
      }
    });

    it('should reject null body', () => {
      const result = validateRequest(null);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Request body must be an object');
      }
    });

    it('should reject empty question', () => {
      const result = validateRequest({ ...validRequest, question: '' });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('question');
      }
    });

    it('should reject question over 2000 characters', () => {
      const result = validateRequest({
        ...validRequest,
        question: 'a'.repeat(2001),
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('2000');
      }
    });

    it('should reject invalid model', () => {
      const result = validateRequest({ ...validRequest, model: 'gpt-4' });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('model');
      }
    });

    it('should accept all valid models', () => {
      ['haiku', 'sonnet', 'opus'].forEach((model) => {
        const result = validateRequest({ ...validRequest, model });
        expect(result.valid).toBe(true);
      });
    });

    it('should reject non-boolean includePrompts', () => {
      const result = validateRequest({ ...validRequest, includePrompts: 'true' });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('includePrompts');
      }
    });

    it('should accept valid questionType', () => {
      const result = validateRequest({
        ...validRequest,
        questionType: 'summarize',
      });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid questionType', () => {
      const result = validateRequest({
        ...validRequest,
        questionType: 'invalid_type',
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('questionType');
      }
    });

    it('should accept undefined questionType', () => {
      const result = validateRequest(validRequest);
      expect(result.valid).toBe(true);
    });

    it('should trim question whitespace', () => {
      const result = validateRequest({
        ...validRequest,
        question: '  What is this?  ',
      });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.question).toBe('What is this?');
      }
    });
  });
});
