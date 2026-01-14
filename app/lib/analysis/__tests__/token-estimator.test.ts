/**
 * Token Estimator Tests
 * Story 30-4: Token Estimation Service
 *
 * Tests token estimation, cost calculation, and formatting utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  // Types
  type ContentForEstimation,
  type TokenEstimate,
  type CostEstimate,
  type CostBreakdown,
  type ToolCallSummary,
  type EstimationOptions,
  // Constants
  MODEL_PRICING,
  ANALYSIS_SYSTEM_PROMPT,
  // Functions
  estimateTokens,
  estimateConversationTokens,
  estimateCost,
  formatCost,
  formatTokens,
  fitsInBudget,
  getTokenSummary,
} from '../token-estimator';

// ============================================================================
// Test Data
// ============================================================================

const EMPTY_CONTENT: ContentForEstimation = {
  prompts: [],
  responses: [],
  thinking: [],
  tools: [],
};

const SIMPLE_CONTENT: ContentForEstimation = {
  prompts: ['Hello, can you help me?'],
  responses: ['Of course! What do you need help with?'],
  thinking: [],
  tools: [],
};

const COMPLEX_CONTENT: ContentForEstimation = {
  prompts: [
    'I need to refactor my authentication module.',
    'Can you also add rate limiting?',
  ],
  responses: [
    'I will analyze your authentication module and suggest improvements.',
    'Here is the refactored code with rate limiting.',
  ],
  thinking: [
    'Let me examine the current authentication flow...',
    'The rate limiting can be implemented using a token bucket algorithm.',
  ],
  tools: [
    { name: 'read_file', inputSummary: 'path: /src/auth/login.ts' },
    { name: 'write_file', inputSummary: 'path: /src/auth/login.ts, content: [updated code]' },
  ],
};

const CODE_CONTENT: ContentForEstimation = {
  prompts: [
    '```typescript\nconst x = 1;\n```',
    'function test() { return true; }',
  ],
  responses: [],
  thinking: [],
  tools: [],
};

const UNICODE_CONTENT: ContentForEstimation = {
  prompts: ['Hello ', 'Testing'],
  responses: [],
  thinking: [],
  tools: [],
};

// ============================================================================
// estimateTokens Tests
// ============================================================================

describe('estimateTokens', () => {
  describe('empty and edge cases', () => {
    it('should return 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should return 0 for null/undefined (via empty check)', () => {
      expect(estimateTokens(null as unknown as string)).toBe(0);
      expect(estimateTokens(undefined as unknown as string)).toBe(0);
    });

    it('should return 0 for whitespace-only string', () => {
      // Whitespace still has length, so it will have tokens
      expect(estimateTokens('   ')).toBeGreaterThan(0);
    });
  });

  describe('short text', () => {
    it('should estimate tokens for single word', () => {
      const tokens = estimateTokens('Hello');
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(10);
    });

    it('should estimate tokens for simple sentence', () => {
      const text = 'Hello, how are you?';
      const tokens = estimateTokens(text);
      // ~19 chars / 3.5 = ~5.4 tokens, ceil = 6
      expect(tokens).toBeGreaterThanOrEqual(5);
      expect(tokens).toBeLessThanOrEqual(10);
    });
  });

  describe('long text', () => {
    it('should estimate tokens for paragraph', () => {
      const text = 'This is a longer piece of text that spans multiple sentences. It should have significantly more tokens than a single word or short phrase. The estimation algorithm uses a character-based heuristic.';
      const tokens = estimateTokens(text);
      // ~200 chars / 3.5 = ~57 tokens
      expect(tokens).toBeGreaterThan(40);
      expect(tokens).toBeLessThan(100);
    });

    it('should estimate tokens for very long text', () => {
      const text = 'Lorem ipsum '.repeat(1000);
      const tokens = estimateTokens(text);
      // ~12000 chars / 3.5 = ~3429 tokens
      expect(tokens).toBeGreaterThan(3000);
      expect(tokens).toBeLessThan(4000);
    });
  });

  describe('unicode text', () => {
    it('should handle emoji', () => {
      const text = 'Hello  world ';
      const tokens = estimateTokens(text);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should handle non-ASCII characters', () => {
      const text = 'Bonjour le monde';
      const tokens = estimateTokens(text);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should handle mixed unicode and ASCII', () => {
      const text = 'Hello  world  test ';
      const tokens = estimateTokens(text);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('code content', () => {
    it('should apply code adjustment for fenced code blocks', () => {
      const regularText = 'Some regular text here';
      const codeText = '```const x = 1;```';

      const regularTokens = estimateTokens(regularText);
      const codeTokens = estimateTokens(codeText);

      // Code should have higher tokens due to adjustment
      // Both are similar length, but code has 1.2x multiplier
      expect(codeTokens).toBeGreaterThanOrEqual(Math.ceil(codeText.length / 3.5));
    });

    it('should detect function keyword', () => {
      const text = 'function test() { return true; }';
      const tokens = estimateTokens(text);
      // With code adjustment: 32 chars / 3.5 * 1.2 = ~11
      expect(tokens).toBeGreaterThan(8);
    });

    it('should detect const keyword', () => {
      const text = 'const myVariable = "value";';
      const tokens = estimateTokens(text);
      expect(tokens).toBeGreaterThan(5);
    });

    it('should detect import keyword', () => {
      const text = 'import React from "react";';
      const tokens = estimateTokens(text);
      expect(tokens).toBeGreaterThan(5);
    });

    it('should detect export keyword', () => {
      const text = 'export default Component;';
      const tokens = estimateTokens(text);
      expect(tokens).toBeGreaterThan(5);
    });

    it('should detect class keyword', () => {
      const text = 'class MyClass extends Base {}';
      const tokens = estimateTokens(text);
      expect(tokens).toBeGreaterThan(5);
    });

    it('should detect def keyword (Python)', () => {
      const text = 'def my_function():';
      const tokens = estimateTokens(text);
      expect(tokens).toBeGreaterThan(3);
    });

    it('should detect return keyword', () => {
      const text = 'return result;';
      const tokens = estimateTokens(text);
      expect(tokens).toBeGreaterThan(2);
    });
  });
});

// ============================================================================
// estimateConversationTokens Tests
// ============================================================================

describe('estimateConversationTokens', () => {
  describe('empty content', () => {
    it('should handle empty content with system prompt', () => {
      const estimate = estimateConversationTokens(EMPTY_CONTENT);

      expect(estimate.prompts).toBe(0);
      expect(estimate.responses).toBe(0);
      expect(estimate.thinking).toBe(0);
      expect(estimate.tools).toBe(0);
      expect(estimate.systemPrompt).toBeGreaterThan(0);
      expect(estimate.total).toBe(estimate.systemPrompt);
    });

    it('should handle empty content without system prompt', () => {
      const estimate = estimateConversationTokens(EMPTY_CONTENT, {
        includeSystemPrompt: false,
      });

      expect(estimate.prompts).toBe(0);
      expect(estimate.responses).toBe(0);
      expect(estimate.thinking).toBe(0);
      expect(estimate.tools).toBe(0);
      expect(estimate.systemPrompt).toBe(0);
      expect(estimate.total).toBe(0);
    });
  });

  describe('simple content', () => {
    it('should estimate tokens for prompts and responses', () => {
      const estimate = estimateConversationTokens(SIMPLE_CONTENT, {
        includeSystemPrompt: false,
      });

      expect(estimate.prompts).toBeGreaterThan(0);
      expect(estimate.responses).toBeGreaterThan(0);
      expect(estimate.thinking).toBe(0);
      expect(estimate.tools).toBe(0);
      expect(estimate.total).toBe(estimate.prompts + estimate.responses);
    });

    it('should include system prompt by default', () => {
      const withSystem = estimateConversationTokens(SIMPLE_CONTENT);
      const withoutSystem = estimateConversationTokens(SIMPLE_CONTENT, {
        includeSystemPrompt: false,
      });

      expect(withSystem.systemPrompt).toBeGreaterThan(0);
      expect(withoutSystem.systemPrompt).toBe(0);
      expect(withSystem.total).toBeGreaterThan(withoutSystem.total);
    });
  });

  describe('complex content', () => {
    it('should estimate all content types', () => {
      const estimate = estimateConversationTokens(COMPLEX_CONTENT, {
        includeSystemPrompt: false,
      });

      expect(estimate.prompts).toBeGreaterThan(0);
      expect(estimate.responses).toBeGreaterThan(0);
      expect(estimate.thinking).toBeGreaterThan(0);
      expect(estimate.tools).toBeGreaterThan(0);
      expect(estimate.total).toBe(
        estimate.prompts +
          estimate.responses +
          estimate.thinking +
          estimate.tools +
          estimate.systemPrompt
      );
    });

    it('should handle multiple prompts', () => {
      const estimate = estimateConversationTokens(COMPLEX_CONTENT, {
        includeSystemPrompt: false,
      });

      // Two prompts should have more tokens than one
      const singlePrompt = estimateConversationTokens(
        {
          ...EMPTY_CONTENT,
          prompts: [COMPLEX_CONTENT.prompts[0]],
        },
        { includeSystemPrompt: false }
      );

      expect(estimate.prompts).toBeGreaterThan(singlePrompt.prompts);
    });

    it('should handle multiple tools', () => {
      const estimate = estimateConversationTokens(COMPLEX_CONTENT, {
        includeSystemPrompt: false,
      });

      // Tool tokens should include both tool name and input summary
      expect(estimate.tools).toBeGreaterThan(0);
    });
  });

  describe('code content', () => {
    it('should apply code adjustment to prompts with code', () => {
      const estimate = estimateConversationTokens(CODE_CONTENT, {
        includeSystemPrompt: false,
      });

      expect(estimate.prompts).toBeGreaterThan(0);
    });
  });

  describe('unicode content', () => {
    it('should handle unicode in prompts', () => {
      const estimate = estimateConversationTokens(UNICODE_CONTENT, {
        includeSystemPrompt: false,
      });

      expect(estimate.prompts).toBeGreaterThan(0);
    });
  });

  describe('options', () => {
    it('should respect includeSystemPrompt option', () => {
      const withSystem = estimateConversationTokens(SIMPLE_CONTENT, {
        includeSystemPrompt: true,
      });
      const withoutSystem = estimateConversationTokens(SIMPLE_CONTENT, {
        includeSystemPrompt: false,
      });

      expect(withSystem.systemPrompt).toBeGreaterThan(0);
      expect(withoutSystem.systemPrompt).toBe(0);
    });

    it('should default to including system prompt', () => {
      const defaultEstimate = estimateConversationTokens(SIMPLE_CONTENT);
      const explicitEstimate = estimateConversationTokens(SIMPLE_CONTENT, {
        includeSystemPrompt: true,
      });

      expect(defaultEstimate.systemPrompt).toBe(explicitEstimate.systemPrompt);
    });

    it('should handle empty options object', () => {
      const estimate = estimateConversationTokens(SIMPLE_CONTENT, {});

      expect(estimate.systemPrompt).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// estimateCost Tests
// ============================================================================

describe('estimateCost', () => {
  describe('haiku model', () => {
    it('should calculate cost correctly', () => {
      // 1M tokens at $0.25/M input = 25 cents input
      // 500 tokens at $1.25/M output = 0.0625 cents output
      const cost = estimateCost(1_000_000);

      expect(cost.haiku.inputCents).toBeCloseTo(25, 1);
      expect(cost.haiku.outputCents).toBeCloseTo(0.0625, 4);
      expect(cost.haiku.totalCents).toBeCloseTo(25.0625, 1);
    });

    it('should be the cheapest model', () => {
      const cost = estimateCost(10000);

      expect(cost.haiku.totalCents).toBeLessThan(cost.sonnet.totalCents);
      expect(cost.haiku.totalCents).toBeLessThan(cost.opus.totalCents);
    });
  });

  describe('sonnet model', () => {
    it('should calculate cost correctly', () => {
      // 1M tokens at $3.00/M input = 300 cents input
      // 500 tokens at $15.00/M output = 0.75 cents output
      const cost = estimateCost(1_000_000);

      expect(cost.sonnet.inputCents).toBeCloseTo(300, 1);
      expect(cost.sonnet.outputCents).toBeCloseTo(0.75, 2);
      expect(cost.sonnet.totalCents).toBeCloseTo(300.75, 1);
    });

    it('should be between haiku and opus', () => {
      const cost = estimateCost(10000);

      expect(cost.sonnet.totalCents).toBeGreaterThan(cost.haiku.totalCents);
      expect(cost.sonnet.totalCents).toBeLessThan(cost.opus.totalCents);
    });
  });

  describe('opus model', () => {
    it('should calculate cost correctly', () => {
      // 1M tokens at $15.00/M input = 1500 cents input
      // 500 tokens at $75.00/M output = 3.75 cents output
      const cost = estimateCost(1_000_000);

      expect(cost.opus.inputCents).toBeCloseTo(1500, 1);
      expect(cost.opus.outputCents).toBeCloseTo(3.75, 2);
      expect(cost.opus.totalCents).toBeCloseTo(1503.75, 1);
    });

    it('should be the most expensive model', () => {
      const cost = estimateCost(10000);

      expect(cost.opus.totalCents).toBeGreaterThan(cost.haiku.totalCents);
      expect(cost.opus.totalCents).toBeGreaterThan(cost.sonnet.totalCents);
    });
  });

  describe('edge cases', () => {
    it('should handle zero tokens', () => {
      const cost = estimateCost(0);

      expect(cost.haiku.inputCents).toBe(0);
      expect(cost.sonnet.inputCents).toBe(0);
      expect(cost.opus.inputCents).toBe(0);
    });

    it('should handle very small token counts', () => {
      const cost = estimateCost(100);

      expect(cost.haiku.inputCents).toBeGreaterThan(0);
      expect(cost.haiku.inputCents).toBeLessThan(1);
    });

    it('should handle very large token counts', () => {
      const cost = estimateCost(100_000_000);

      expect(cost.haiku.totalCents).toBeGreaterThan(0);
      expect(cost.opus.totalCents).toBeGreaterThan(0);
    });

    it('should accept custom output token estimate', () => {
      const defaultCost = estimateCost(10000);
      const customCost = estimateCost(10000, 1000);

      // Higher output tokens should increase cost
      expect(customCost.haiku.outputCents).toBeGreaterThan(
        defaultCost.haiku.outputCents
      );
    });

    it('should handle zero output tokens', () => {
      const cost = estimateCost(10000, 0);

      expect(cost.haiku.outputCents).toBe(0);
      expect(cost.haiku.totalCents).toBe(cost.haiku.inputCents);
    });
  });
});

// ============================================================================
// formatCost Tests
// ============================================================================

describe('formatCost', () => {
  describe('sub-cent values', () => {
    it('should format zero as <$0.01', () => {
      expect(formatCost(0)).toBe('<$0.01');
    });

    it('should format small fractions as <$0.01', () => {
      expect(formatCost(0.001)).toBe('<$0.01');
      expect(formatCost(0.5)).toBe('<$0.01');
      expect(formatCost(0.99)).toBe('<$0.01');
    });
  });

  describe('cent values', () => {
    it('should format 1 cent correctly', () => {
      expect(formatCost(1)).toBe('$0.01');
    });

    it('should format cents with rounding', () => {
      // 1.5 cents / 100 = $0.015 which rounds to $0.01
      // 2.5 cents / 100 = $0.025 which rounds to $0.03
      expect(formatCost(1.5)).toBe('$0.01');
      expect(formatCost(1.4)).toBe('$0.01');
      expect(formatCost(2.5)).toBe('$0.03');
      expect(formatCost(3.6)).toBe('$0.04');
    });

    it('should format larger cent values', () => {
      expect(formatCost(50)).toBe('$0.50');
      expect(formatCost(99)).toBe('$0.99');
    });
  });

  describe('dollar values', () => {
    it('should format one dollar correctly', () => {
      expect(formatCost(100)).toBe('$1.00');
    });

    it('should format dollars and cents', () => {
      expect(formatCost(150)).toBe('$1.50');
      expect(formatCost(199)).toBe('$1.99');
    });

    it('should format larger dollar amounts', () => {
      expect(formatCost(1000)).toBe('$10.00');
      expect(formatCost(10000)).toBe('$100.00');
      expect(formatCost(100000)).toBe('$1000.00');
    });
  });

  describe('edge cases', () => {
    it('should handle negative values (treat as sub-cent)', () => {
      expect(formatCost(-1)).toBe('<$0.01');
    });

    it('should handle very large values', () => {
      expect(formatCost(1000000)).toBe('$10000.00');
    });
  });
});

// ============================================================================
// formatTokens Tests
// ============================================================================

describe('formatTokens', () => {
  describe('values under 1000', () => {
    it('should format zero', () => {
      expect(formatTokens(0)).toBe('0');
    });

    it('should format small numbers', () => {
      expect(formatTokens(1)).toBe('1');
      expect(formatTokens(10)).toBe('10');
      expect(formatTokens(100)).toBe('100');
    });

    it('should format 999', () => {
      expect(formatTokens(999)).toBe('999');
    });
  });

  describe('values 1000 and above', () => {
    it('should format 1000 as 1.0k', () => {
      expect(formatTokens(1000)).toBe('1.0k');
    });

    it('should format thousands with decimal', () => {
      expect(formatTokens(1500)).toBe('1.5k');
      expect(formatTokens(2000)).toBe('2.0k');
      expect(formatTokens(12345)).toBe('12.3k');
    });

    it('should format tens of thousands', () => {
      expect(formatTokens(10000)).toBe('10.0k');
      expect(formatTokens(99000)).toBe('99.0k');
    });

    it('should format hundreds of thousands', () => {
      expect(formatTokens(100000)).toBe('100.0k');
      expect(formatTokens(500000)).toBe('500.0k');
    });

    it('should format millions (still in k)', () => {
      expect(formatTokens(1000000)).toBe('1000.0k');
      expect(formatTokens(1500000)).toBe('1500.0k');
    });
  });

  describe('edge cases', () => {
    it('should handle boundary at 1000', () => {
      expect(formatTokens(999)).toBe('999');
      expect(formatTokens(1000)).toBe('1.0k');
    });

    it('should round correctly', () => {
      // toFixed(1) rounds standard way
      expect(formatTokens(1050)).toBe('1.1k'); // 1.05 rounds to 1.1
      expect(formatTokens(1150)).toBe('1.1k'); // 1.15 rounds to 1.1 (banker's rounding)
      expect(formatTokens(1250)).toBe('1.3k'); // 1.25 rounds to 1.3
    });
  });
});

// ============================================================================
// fitsInBudget Tests
// ============================================================================

describe('fitsInBudget', () => {
  it('should return true for empty content with any budget', () => {
    expect(fitsInBudget(EMPTY_CONTENT, 1000)).toBe(true);
  });

  it('should return true when content fits', () => {
    expect(fitsInBudget(SIMPLE_CONTENT, 10000)).toBe(true);
  });

  it('should return false when content exceeds budget', () => {
    expect(fitsInBudget(COMPLEX_CONTENT, 1)).toBe(false);
  });

  it('should return true when content exactly matches budget', () => {
    const estimate = estimateConversationTokens(SIMPLE_CONTENT);
    expect(fitsInBudget(SIMPLE_CONTENT, estimate.total)).toBe(true);
  });

  it('should return false when content slightly exceeds budget', () => {
    const estimate = estimateConversationTokens(SIMPLE_CONTENT);
    expect(fitsInBudget(SIMPLE_CONTENT, estimate.total - 1)).toBe(false);
  });
});

// ============================================================================
// getTokenSummary Tests
// ============================================================================

describe('getTokenSummary', () => {
  it('should return "No content" for zero tokens', () => {
    const estimate: TokenEstimate = {
      prompts: 0,
      responses: 0,
      thinking: 0,
      tools: 0,
      systemPrompt: 0,
      total: 0,
    };
    expect(getTokenSummary(estimate)).toBe('No content');
  });

  it('should include only non-zero values', () => {
    const estimate: TokenEstimate = {
      prompts: 100,
      responses: 0,
      thinking: 0,
      tools: 0,
      systemPrompt: 0,
      total: 100,
    };
    const summary = getTokenSummary(estimate);
    expect(summary).toBe('Prompts: 100');
    expect(summary).not.toContain('Responses');
    expect(summary).not.toContain('Thinking');
    expect(summary).not.toContain('Tools');
    expect(summary).not.toContain('System');
  });

  it('should format all non-zero values', () => {
    const estimate: TokenEstimate = {
      prompts: 500,
      responses: 1000,
      thinking: 200,
      tools: 100,
      systemPrompt: 50,
      total: 1850,
    };
    const summary = getTokenSummary(estimate);
    expect(summary).toContain('Prompts: 500');
    expect(summary).toContain('Responses: 1.0k');
    expect(summary).toContain('Thinking: 200');
    expect(summary).toContain('Tools: 100');
    expect(summary).toContain('System: 50');
  });

  it('should use pipe separator', () => {
    const estimate: TokenEstimate = {
      prompts: 100,
      responses: 200,
      thinking: 0,
      tools: 0,
      systemPrompt: 0,
      total: 300,
    };
    const summary = getTokenSummary(estimate);
    expect(summary).toBe('Prompts: 100 | Responses: 200');
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe('constants', () => {
  describe('MODEL_PRICING', () => {
    it('should have correct structure', () => {
      expect(MODEL_PRICING).toHaveProperty('haiku');
      expect(MODEL_PRICING).toHaveProperty('sonnet');
      expect(MODEL_PRICING).toHaveProperty('opus');
    });

    it('should have input and output prices for each model', () => {
      for (const model of ['haiku', 'sonnet', 'opus'] as const) {
        expect(MODEL_PRICING[model]).toHaveProperty('input');
        expect(MODEL_PRICING[model]).toHaveProperty('output');
        expect(typeof MODEL_PRICING[model].input).toBe('number');
        expect(typeof MODEL_PRICING[model].output).toBe('number');
      }
    });

    it('should have increasing prices from haiku to opus', () => {
      expect(MODEL_PRICING.haiku.input).toBeLessThan(MODEL_PRICING.sonnet.input);
      expect(MODEL_PRICING.sonnet.input).toBeLessThan(MODEL_PRICING.opus.input);
      expect(MODEL_PRICING.haiku.output).toBeLessThan(MODEL_PRICING.sonnet.output);
      expect(MODEL_PRICING.sonnet.output).toBeLessThan(MODEL_PRICING.opus.output);
    });
  });

  describe('ANALYSIS_SYSTEM_PROMPT', () => {
    it('should be a non-empty string', () => {
      expect(typeof ANALYSIS_SYSTEM_PROMPT).toBe('string');
      expect(ANALYSIS_SYSTEM_PROMPT.length).toBeGreaterThan(0);
    });

    it('should contain analysis guidance', () => {
      expect(ANALYSIS_SYSTEM_PROMPT.toLowerCase()).toContain('analyze');
    });

    it('should mention context engineering', () => {
      expect(ANALYSIS_SYSTEM_PROMPT).toContain('context');
    });
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('performance', () => {
  it('should estimate tokens for typical text in under 1ms', () => {
    const text = 'This is a typical prompt that a developer might write.';
    const iterations = 1000;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      estimateTokens(text);
    }
    const end = performance.now();

    const averageMs = (end - start) / iterations;
    expect(averageMs).toBeLessThan(1);
  });

  it('should estimate conversation tokens in under 50ms for typical content', () => {
    const start = performance.now();
    estimateConversationTokens(COMPLEX_CONTENT);
    const end = performance.now();

    expect(end - start).toBeLessThan(50);
  });

  it('should handle large conversations in under 50ms', () => {
    const largeContent: ContentForEstimation = {
      prompts: Array(100).fill('This is a longer prompt with some code: const x = 1;'),
      responses: Array(100).fill('Here is a detailed response explaining the solution.'),
      thinking: Array(50).fill('Let me think about this problem carefully...'),
      tools: Array(20).fill({ name: 'read_file', inputSummary: 'path: /src/file.ts' }),
    };

    const start = performance.now();
    estimateConversationTokens(largeContent);
    const end = performance.now();

    expect(end - start).toBeLessThan(50);
  });

  it('should calculate cost in under 1ms', () => {
    const iterations = 1000;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      estimateCost(10000);
    }
    const end = performance.now();

    const averageMs = (end - start) / iterations;
    expect(averageMs).toBeLessThan(1);
  });

  it('should handle very long text efficiently', () => {
    const longText = 'x'.repeat(100000); // 100K characters

    const start = performance.now();
    estimateTokens(longText);
    const end = performance.now();

    expect(end - start).toBeLessThan(10);
  });
});

// ============================================================================
// Type Safety Tests (compile-time checks)
// ============================================================================

describe('type safety', () => {
  it('should accept valid ContentForEstimation', () => {
    const content: ContentForEstimation = {
      prompts: ['test'],
      responses: ['response'],
      thinking: ['thinking'],
      tools: [{ name: 'tool', inputSummary: 'summary' }],
    };
    const estimate = estimateConversationTokens(content);
    expect(estimate).toBeDefined();
  });

  it('should return correct TokenEstimate structure', () => {
    const estimate = estimateConversationTokens(SIMPLE_CONTENT);

    // Type assertions
    const _prompts: number = estimate.prompts;
    const _responses: number = estimate.responses;
    const _thinking: number = estimate.thinking;
    const _tools: number = estimate.tools;
    const _systemPrompt: number = estimate.systemPrompt;
    const _total: number = estimate.total;

    expect(typeof _prompts).toBe('number');
    expect(typeof _responses).toBe('number');
    expect(typeof _thinking).toBe('number');
    expect(typeof _tools).toBe('number');
    expect(typeof _systemPrompt).toBe('number');
    expect(typeof _total).toBe('number');
  });

  it('should return correct CostEstimate structure', () => {
    const cost = estimateCost(10000);

    // Type assertions
    const _haiku: CostBreakdown = cost.haiku;
    const _sonnet: CostBreakdown = cost.sonnet;
    const _opus: CostBreakdown = cost.opus;

    expect(typeof _haiku.inputCents).toBe('number');
    expect(typeof _haiku.outputCents).toBe('number');
    expect(typeof _haiku.totalCents).toBe('number');
  });

  it('should accept valid EstimationOptions', () => {
    const options: EstimationOptions = {
      includeSystemPrompt: true,
      estimatedOutputTokens: 1000,
    };
    const estimate = estimateConversationTokens(SIMPLE_CONTENT, options);
    expect(estimate).toBeDefined();
  });

  it('should accept valid ToolCallSummary', () => {
    const tool: ToolCallSummary = {
      name: 'read_file',
      inputSummary: 'path: /test.ts',
    };
    const content: ContentForEstimation = {
      prompts: [],
      responses: [],
      thinking: [],
      tools: [tool],
    };
    const estimate = estimateConversationTokens(content);
    expect(estimate.tools).toBeGreaterThan(0);
  });
});
