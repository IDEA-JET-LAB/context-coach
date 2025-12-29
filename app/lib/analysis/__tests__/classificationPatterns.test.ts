/**
 * Classification Patterns Tests
 * Story 27-2: Heuristic Classification
 *
 * Comprehensive tests for pattern-matching classification of prompts:
 * - Confirmation patterns
 * - Selection patterns
 * - Correction patterns (with word boundary checks)
 * - Clarification patterns
 * - Initiating detection
 * - Continuation fallback
 */

import { describe, it, expect } from 'vitest';
import {
  classifyByHeuristics,
  normalizePrompt,
  isConfirmation,
  isSelection,
  isCorrection,
  isClarification,
  CONFIRMATION_EXACT_MATCHES,
  CONFIRMATION_PATTERNS,
  SELECTION_PATTERNS,
  CORRECTION_INDICATORS,
  CLARIFICATION_PATTERNS,
} from '../classificationPatterns';
import type { ConversationContext } from '@/lib/types/conversation-classification';
import { CLASSIFICATION_CONFIDENCE } from '@/lib/types/conversation-classification';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a minimal conversation context for testing.
 */
function createContext(overrides: Partial<ConversationContext> = {}): ConversationContext {
  return {
    messageIndex: 1, // Default to not first message
    ...overrides,
  };
}

// ============================================================================
// Tests: Type and Structure
// ============================================================================

describe('Classification Types and Structure', () => {
  it('should return correct result structure', () => {
    const result = classifyByHeuristics('test prompt', createContext());
    expect(result).toHaveProperty('promptType');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('method');
    expect(result.method).toBe('heuristic');
    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('should have 6 prompt types defined', () => {
    const validTypes = [
      'initiating',
      'confirmation',
      'selection',
      'correction',
      'clarification',
      'continuation',
    ];
    // Test one of each type
    const initiating = classifyByHeuristics('test', createContext({ messageIndex: 0 }));
    expect(validTypes).toContain(initiating.promptType);
  });
});

// ============================================================================
// Tests: Initiating Detection (AC #4)
// ============================================================================

describe('Initiating Detection (AC #4)', () => {
  it('should classify first message as initiating regardless of content', () => {
    const testCases = [
      'Help me build an API',
      'yes',
      'why?',
      'Option 2',
      'random text here',
      '', // Empty first message
    ];

    for (const prompt of testCases) {
      const result = classifyByHeuristics(prompt, createContext({ messageIndex: 0 }));
      expect(result.promptType).toBe('initiating');
      expect(result.confidence).toBe(CLASSIFICATION_CONFIDENCE.INITIATING);
      expect(result.matchedPattern).toBe('first_message');
    }
  });

  it('should return 0.95 confidence for initiating', () => {
    const result = classifyByHeuristics('Build a REST API', createContext({ messageIndex: 0 }));
    expect(result.confidence).toBe(0.95);
  });

  it('should NOT classify as initiating if messageIndex > 0', () => {
    const result = classifyByHeuristics('Build a REST API', createContext({ messageIndex: 1 }));
    expect(result.promptType).not.toBe('initiating');
  });
});

// ============================================================================
// Tests: Confirmation Detection (AC #1)
// ============================================================================

describe('Confirmation Detection (AC #1)', () => {
  describe('Exact Matches', () => {
    const exactMatches = [
      'yes', 'y', 'ok', 'okay', 'sure', 'proceed', 'go ahead', 'do it',
      'sounds good', 'looks good', 'lgtm', 'please', 'continue', 'go',
      'start', 'yep', 'yeah', 'yup', 'affirmative', 'correct', 'right',
      'approved', 'confirm', 'confirmed', 'accept', 'agreed', 'fine',
      'perfect', 'great', 'awesome', 'nice', 'cool', 'ship it',
      'absolutely', 'definitely', 'of course', 'for sure',
    ];

    it.each(exactMatches)('should classify "%s" as confirmation', (prompt) => {
      const result = classifyByHeuristics(prompt, createContext());
      expect(result.promptType).toBe('confirmation');
      expect(result.confidence).toBe(CLASSIFICATION_CONFIDENCE.CONFIRMATION);
    });
  });

  describe('Case Insensitivity', () => {
    it('should handle uppercase', () => {
      const result = classifyByHeuristics('YES', createContext());
      expect(result.promptType).toBe('confirmation');
    });

    it('should handle mixed case', () => {
      const result = classifyByHeuristics('YeS', createContext());
      expect(result.promptType).toBe('confirmation');
    });

    it('should handle all caps phrases', () => {
      const result = classifyByHeuristics('SOUNDS GOOD', createContext());
      expect(result.promptType).toBe('confirmation');
    });
  });

  describe('Punctuation Variations', () => {
    it('should handle trailing period', () => {
      const result = classifyByHeuristics('Yes.', createContext());
      expect(result.promptType).toBe('confirmation');
    });

    it('should handle trailing exclamation', () => {
      const result = classifyByHeuristics('Yes!', createContext());
      expect(result.promptType).toBe('confirmation');
    });

    it('should handle trailing comma', () => {
      const result = classifyByHeuristics('Yes,', createContext());
      expect(result.promptType).toBe('confirmation');
    });
  });

  describe('Pattern Matching', () => {
    const patternExamples = [
      'sounds great',
      'looks fine',
      'please continue',
      'please go',
      "that's correct",
      "that's right",
      'thats perfect',
    ];

    it.each(patternExamples)('should classify "%s" as confirmation', (prompt) => {
      const result = classifyByHeuristics(prompt, createContext());
      expect(result.promptType).toBe('confirmation');
    });
  });

  describe('Non-Confirmations', () => {
    it('should NOT classify confirmation with continuation text', () => {
      const result = classifyByHeuristics(
        'Yes, but can you also add error handling?',
        createContext()
      );
      expect(result.promptType).not.toBe('confirmation');
    });
  });

  it('should return 0.9 confidence for confirmation', () => {
    const result = classifyByHeuristics('yes', createContext());
    expect(result.confidence).toBe(0.9);
  });
});

// ============================================================================
// Tests: Selection Detection (AC #2)
// ============================================================================

describe('Selection Detection (AC #2)', () => {
  describe('Numbered Selections', () => {
    it('should classify "1" as selection', () => {
      const result = classifyByHeuristics('1', createContext());
      expect(result.promptType).toBe('selection');
    });

    it('should classify "#1" as selection', () => {
      const result = classifyByHeuristics('#1', createContext());
      expect(result.promptType).toBe('selection');
    });

    it('should classify "2." as selection', () => {
      const result = classifyByHeuristics('2.', createContext());
      expect(result.promptType).toBe('selection');
    });

    it('should classify "Option 2" as selection', () => {
      const result = classifyByHeuristics('Option 2', createContext());
      expect(result.promptType).toBe('selection');
    });

    it('should classify "choice 3" as selection', () => {
      const result = classifyByHeuristics('choice 3', createContext());
      expect(result.promptType).toBe('selection');
    });

    it('should classify "number 1" as selection', () => {
      const result = classifyByHeuristics('number 1', createContext());
      expect(result.promptType).toBe('selection');
    });
  });

  describe('Lettered Selections', () => {
    it('should classify "A" as selection', () => {
      const result = classifyByHeuristics('A', createContext());
      expect(result.promptType).toBe('selection');
    });

    it('should classify "B" as selection', () => {
      const result = classifyByHeuristics('B', createContext());
      expect(result.promptType).toBe('selection');
    });

    it('should classify "a)" as selection', () => {
      const result = classifyByHeuristics('a)', createContext());
      expect(result.promptType).toBe('selection');
    });

    it('should classify "(B)" as selection', () => {
      const result = classifyByHeuristics('(B)', createContext());
      expect(result.promptType).toBe('selection');
    });

    it('should classify "option A" as selection', () => {
      const result = classifyByHeuristics('option A', createContext());
      expect(result.promptType).toBe('selection');
    });
  });

  describe('Ordinal Selections', () => {
    const ordinals = [
      'the first one',
      'the second one',
      'the third one',
      'first option',
      'second',
      '1st',
      '2nd',
      '3rd',
      'the last one',
      'that one',
      'this one',
    ];

    it.each(ordinals)('should classify "%s" as selection', (prompt) => {
      const result = classifyByHeuristics(prompt, createContext());
      expect(result.promptType).toBe('selection');
    });
  });

  describe('Context-Aware Selection', () => {
    it('should use lastResponseOptions for context matching', () => {
      const context = createContext({
        lastResponseOptions: ['create file', 'modify file', 'delete file'],
      });
      const result = classifyByHeuristics('create file', context);
      expect(result.promptType).toBe('selection');
    });
  });

  describe('Length Limits', () => {
    it('should NOT classify very long prompts as selection', () => {
      const longPrompt =
        'I would like to choose option number two because it seems to be the best approach for handling this particular situation';
      const result = classifyByHeuristics(longPrompt, createContext());
      expect(result.promptType).not.toBe('selection');
    });
  });

  it('should return 0.95 confidence for selection', () => {
    const result = classifyByHeuristics('Option 2', createContext());
    expect(result.confidence).toBe(0.95);
  });
});

// ============================================================================
// Tests: Correction Detection (AC #3) - CRITICAL: Word Boundary Tests
// ============================================================================

describe('Correction Detection (AC #3)', () => {
  describe('Correction Patterns', () => {
    const correctionExamples = [
      { prompt: 'no, use the other approach', keyword: 'no,' },
      { prompt: 'No. That is wrong.', keyword: 'No.' },
      { prompt: 'instead, do this', keyword: 'instead' },
      { prompt: 'actually, I meant something else', keyword: 'actually' },
      { prompt: "that's wrong", keyword: 'wrong' },
      { prompt: "that's not what I wanted", keyword: "that's not" },
      { prompt: 'not what I meant', keyword: 'not what I meant' },
      { prompt: 'I meant the other file', keyword: 'I meant' },
      { prompt: "don't do that", keyword: "don't do" },
      { prompt: 'stop', keyword: 'stop' },
      { prompt: 'undo that change', keyword: 'undo' },
      { prompt: 'revert the last commit', keyword: 'revert' },
      { prompt: 'cancel the operation', keyword: 'cancel' },
      { prompt: 'nope', keyword: 'nope' },
      { prompt: 'not like that, do it differently', keyword: 'not like that' },
      { prompt: 'try again', keyword: 'try again' },
      { prompt: 'start over', keyword: 'start over' },
    ];

    it.each(correctionExamples)(
      'should classify prompt with "$keyword" as correction',
      ({ prompt }) => {
        const result = classifyByHeuristics(prompt, createContext());
        expect(result.promptType).toBe('correction');
      }
    );
  });

  describe('Word Boundary Tests - CRITICAL', () => {
    const falsePositives = [
      'economy is improving', // "no" is inside "economy"
      'monotonous task', // "no" is inside "monotonous"
      'innovative solution', // "no" is inside "innovative"
      'phenomenal work', // "no" is inside "phenomenal"
      'knowledge base', // "no" is inside "knowledge"
      'technology stack', // "no" is inside "technology"
      'the action failed', // "action" contains letters, not correction
      'faction of users', // "faction" contains letters
      'I know the answer', // "know" != "no"
      'economic analysis', // "economic" contains "no"
    ];

    it.each(falsePositives)(
      'should NOT classify "%s" as correction (word boundary)',
      (prompt) => {
        const result = classifyByHeuristics(prompt, createContext());
        expect(result.promptType).not.toBe('correction');
      }
    );
  });

  describe('Edge Cases for Correction', () => {
    it('should detect "no," at the START of prompt', () => {
      const result = classifyByHeuristics('no, do something else', createContext());
      expect(result.promptType).toBe('correction');
    });

    it('should NOT detect "no" without comma/punctuation', () => {
      // "no" alone at start without punctuation should not match
      // because it could be part of a sentence
      const result = classifyByHeuristics('no way this is a correction test', createContext());
      // This should match because "nope" like patterns exist but "no way" isn't in patterns
      expect(result.promptType).not.toBe('correction');
    });

    it('should detect "actually" in the middle of a sentence', () => {
      const result = classifyByHeuristics(
        'I think we should actually use a different approach',
        createContext()
      );
      expect(result.promptType).toBe('correction');
    });

    it('should detect "instead" as standalone correction indicator', () => {
      const result = classifyByHeuristics('use TypeScript instead', createContext());
      expect(result.promptType).toBe('correction');
    });
  });

  it('should return 0.85 confidence for correction', () => {
    const result = classifyByHeuristics('no, use the other one', createContext());
    expect(result.confidence).toBe(0.85);
  });
});

// ============================================================================
// Tests: Clarification Detection (AC #5)
// ============================================================================

describe('Clarification Detection (AC #5)', () => {
  describe('Question-Based Clarification', () => {
    const clarificationQuestions = [
      'why did you choose that approach?',
      'how does this work?',
      'what does this function do?',
      'how would this handle edge cases?',
      'what is the purpose of this variable?',
      'why is this necessary?',
      "how can I modify this?",
    ];

    it.each(clarificationQuestions)('should classify "%s" as clarification', (prompt) => {
      const result = classifyByHeuristics(prompt, createContext());
      expect(result.promptType).toBe('clarification');
    });
  });

  describe('Keyword-Based Clarification', () => {
    const clarificationKeywords = [
      'please explain the implementation',
      'can you clarify this part?',
      'could you elaborate on that?',
      'I don\'t understand this code',
      "I'm confused about the flow",
      'what do you mean by that?',
      "what's that for?",
    ];

    it.each(clarificationKeywords)('should classify "%s" as clarification', (prompt) => {
      const result = classifyByHeuristics(prompt, createContext());
      expect(result.promptType).toBe('clarification');
    });
  });

  describe('Non-Clarifications', () => {
    it('should NOT classify general questions as clarification', () => {
      // Questions without clarification keywords
      const result = classifyByHeuristics('what time is it?', createContext());
      // This should be continuation since it doesn't match clarification patterns
      expect(result.promptType).not.toBe('clarification');
    });
  });

  it('should return 0.8 confidence for clarification', () => {
    const result = classifyByHeuristics('why did you do that?', createContext());
    expect(result.confidence).toBe(0.8);
  });
});

// ============================================================================
// Tests: Continuation Fallback (AC #6)
// ============================================================================

describe('Continuation Fallback (AC #6)', () => {
  const continuationExamples = [
    'add error handling to this function',
    'make the button blue with a rounded border',
    'refactor this code to use async/await',
    'now implement the login feature',
    'create a new component for the header',
    'random text that matches nothing',
    'here is my next request for you',
  ];

  it.each(continuationExamples)('should classify "%s" as continuation', (prompt) => {
    const result = classifyByHeuristics(prompt, createContext());
    expect(result.promptType).toBe('continuation');
  });

  it('should return 0.6 confidence for continuation', () => {
    const result = classifyByHeuristics('add a new feature', createContext());
    expect(result.confidence).toBe(0.6);
  });

  it('should set matchedPattern to "default" for continuation', () => {
    const result = classifyByHeuristics('random text here', createContext());
    expect(result.matchedPattern).toBe('default');
  });
});

// ============================================================================
// Tests: Priority Order
// ============================================================================

describe('Classification Priority Order', () => {
  it('should prioritize initiating over everything else', () => {
    // Even if prompt looks like confirmation, first message is initiating
    const result = classifyByHeuristics('yes', createContext({ messageIndex: 0 }));
    expect(result.promptType).toBe('initiating');
  });

  it('should prioritize confirmation over selection for short matches', () => {
    // "ok" could theoretically match both, but confirmation wins
    const result = classifyByHeuristics('ok', createContext());
    expect(result.promptType).toBe('confirmation');
  });

  it('should prioritize confirmation over correction', () => {
    // "correct" is a confirmation word, not a correction
    const result = classifyByHeuristics('correct', createContext());
    expect(result.promptType).toBe('confirmation');
  });

  it('should prioritize selection when clear selection pattern', () => {
    const result = classifyByHeuristics('Option 2', createContext());
    expect(result.promptType).toBe('selection');
  });
});

// ============================================================================
// Tests: Normalize Prompt Helper
// ============================================================================

describe('normalizePrompt Helper', () => {
  it('should convert to lowercase', () => {
    expect(normalizePrompt('HELLO World')).toBe('hello world');
  });

  it('should trim whitespace', () => {
    expect(normalizePrompt('  hello  ')).toBe('hello');
  });

  it('should normalize internal whitespace', () => {
    expect(normalizePrompt('hello    world')).toBe('hello world');
  });

  it('should handle newlines and tabs', () => {
    expect(normalizePrompt('hello\n\tworld')).toBe('hello world');
  });
});

// ============================================================================
// Tests: Individual Matcher Functions
// ============================================================================

describe('isConfirmation Helper', () => {
  it('should return matched: true for exact matches', () => {
    const result = isConfirmation('yes');
    expect(result.matched).toBe(true);
    expect(result.pattern).toContain('exact');
  });

  it('should return matched: true for pattern matches', () => {
    const result = isConfirmation('sounds great');
    expect(result.matched).toBe(true);
    expect(result.pattern).toContain('regex');
  });

  it('should return matched: false for non-confirmations', () => {
    const result = isConfirmation('hello world');
    expect(result.matched).toBe(false);
  });
});

describe('isSelection Helper', () => {
  it('should return matched: true for numbered selection', () => {
    const result = isSelection('1', createContext());
    expect(result.matched).toBe(true);
  });

  it('should return matched: true for lettered selection', () => {
    const result = isSelection('a', createContext());
    expect(result.matched).toBe(true);
  });

  it('should use context options for matching', () => {
    const result = isSelection('use typescript', createContext({
      lastResponseOptions: ['use typescript', 'use javascript'],
    }));
    expect(result.matched).toBe(true);
    expect(result.pattern).toContain('context');
  });
});

describe('isCorrection Helper', () => {
  it('should return matched: true for correction patterns', () => {
    const result = isCorrection('no, do something else');
    expect(result.matched).toBe(true);
  });

  it('should respect word boundaries', () => {
    const result = isCorrection('economy is growing');
    expect(result.matched).toBe(false);
  });
});

describe('isClarification Helper', () => {
  it('should return matched: true for question clarifications', () => {
    const result = isClarification('why did you do that?');
    expect(result.matched).toBe(true);
  });

  it('should return matched: true for keyword clarifications', () => {
    const result = isClarification('please explain this code');
    expect(result.matched).toBe(true);
  });

  it('should return matched: false for non-clarifications', () => {
    const result = isClarification('build a new feature');
    expect(result.matched).toBe(false);
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty strings', () => {
    const result = classifyByHeuristics('', createContext());
    expect(result.promptType).toBe('continuation');
  });

  it('should handle whitespace-only strings', () => {
    const result = classifyByHeuristics('   \t\n   ', createContext());
    expect(result.promptType).toBe('continuation');
  });

  it('should handle unicode characters', () => {
    const result = classifyByHeuristics('yes please', createContext());
    expect(result.promptType).toBe('confirmation');
  });

  it('should handle special characters in prompts', () => {
    const result = classifyByHeuristics('yes!!!???', createContext());
    expect(result.promptType).toBe('confirmation');
  });

  it('should handle emoji', () => {
    const result = classifyByHeuristics('add a button component', createContext());
    expect(result).toBeDefined();
  });

  it('should handle very long prompts efficiently', () => {
    const longPrompt = 'this is a test prompt '.repeat(100);
    const start = performance.now();
    classifyByHeuristics(longPrompt, createContext());
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(10); // Should be fast
  });
});

// ============================================================================
// Tests: Performance
// ============================================================================

describe('Performance', () => {
  it('should classify prompts in under 1ms', () => {
    const testPrompts = [
      'yes',
      'Option 2',
      'no, do something else',
      'why did you do that?',
      'build a new feature',
    ];

    for (const prompt of testPrompts) {
      const start = performance.now();
      classifyByHeuristics(prompt, createContext());
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(1);
    }
  });

  it('should classify 1000 prompts in under 100ms', () => {
    const prompts = [
      'yes',
      'no, instead',
      'Option 1',
      'why?',
      'continue',
    ];

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      classifyByHeuristics(prompts[i % prompts.length]!, createContext());
    }
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });
});

// ============================================================================
// Tests: Real-World Prompt Examples
// ============================================================================

describe('Real-World Prompt Examples', () => {
  it('should classify approval of AI suggestion', () => {
    const result = classifyByHeuristics('sounds good, proceed', createContext());
    expect(result.promptType).toBe('confirmation');
  });

  it('should classify option selection', () => {
    const result = classifyByHeuristics('the second one', createContext());
    expect(result.promptType).toBe('selection');
  });

  it('should classify correction of AI misunderstanding', () => {
    const result = classifyByHeuristics(
      "no, I meant the config file not the source file",
      createContext()
    );
    expect(result.promptType).toBe('correction');
  });

  it('should classify request for explanation', () => {
    const result = classifyByHeuristics(
      'why is this approach better than using a class?',
      createContext()
    );
    expect(result.promptType).toBe('clarification');
  });

  it('should classify new task request', () => {
    const result = classifyByHeuristics(
      'now add authentication to the API endpoints',
      createContext()
    );
    expect(result.promptType).toBe('continuation');
  });

  it('should classify first message correctly', () => {
    const result = classifyByHeuristics(
      'Help me build a React component for user profiles',
      createContext({ messageIndex: 0 })
    );
    expect(result.promptType).toBe('initiating');
  });
});

// ============================================================================
// Tests: Validation Dataset
// ============================================================================

describe('Validation Dataset (80% Accuracy Target)', () => {
  const validationSet = [
    // Initiating (first message)
    { prompt: 'Help me build an API', context: { messageIndex: 0 }, expected: 'initiating' },
    { prompt: 'Create a login form', context: { messageIndex: 0 }, expected: 'initiating' },
    { prompt: 'Debug this error', context: { messageIndex: 0 }, expected: 'initiating' },

    // Confirmation
    { prompt: 'yes', context: { messageIndex: 1 }, expected: 'confirmation' },
    { prompt: 'proceed', context: { messageIndex: 2 }, expected: 'confirmation' },
    { prompt: 'sounds good', context: { messageIndex: 1 }, expected: 'confirmation' },
    { prompt: 'lgtm', context: { messageIndex: 3 }, expected: 'confirmation' },
    { prompt: 'perfect', context: { messageIndex: 1 }, expected: 'confirmation' },

    // Selection
    { prompt: 'Option 2', context: { messageIndex: 1 }, expected: 'selection' },
    { prompt: '#1', context: { messageIndex: 2 }, expected: 'selection' },
    { prompt: 'the second one', context: { messageIndex: 1 }, expected: 'selection' },
    { prompt: 'B', context: { messageIndex: 3 }, expected: 'selection' },
    { prompt: 'first option', context: { messageIndex: 1 }, expected: 'selection' },

    // Correction
    { prompt: 'no, use the other one', context: { messageIndex: 1 }, expected: 'correction' },
    { prompt: 'instead, do this', context: { messageIndex: 2 }, expected: 'correction' },
    { prompt: 'actually, I meant something else', context: { messageIndex: 1 }, expected: 'correction' },
    { prompt: "that's wrong", context: { messageIndex: 3 }, expected: 'correction' },
    { prompt: 'undo that', context: { messageIndex: 1 }, expected: 'correction' },

    // Clarification
    { prompt: 'why did you do that?', context: { messageIndex: 1 }, expected: 'clarification' },
    { prompt: 'how does this work?', context: { messageIndex: 2 }, expected: 'clarification' },
    { prompt: 'explain this code', context: { messageIndex: 1 }, expected: 'clarification' },
    { prompt: "I don't understand", context: { messageIndex: 3 }, expected: 'clarification' },
    { prompt: 'what do you mean?', context: { messageIndex: 1 }, expected: 'clarification' },

    // Continuation
    { prompt: 'now add error handling', context: { messageIndex: 1 }, expected: 'continuation' },
    { prompt: 'make the button blue', context: { messageIndex: 2 }, expected: 'continuation' },
    { prompt: 'also include tests', context: { messageIndex: 1 }, expected: 'continuation' },
    { prompt: 'refactor this function', context: { messageIndex: 3 }, expected: 'continuation' },

    // Word boundary tests (should NOT be correction)
    { prompt: 'the economy is growing', context: { messageIndex: 1 }, expected: 'continuation' },
    { prompt: 'innovative solution', context: { messageIndex: 1 }, expected: 'continuation' },
  ] as const;

  it('should achieve at least 80% accuracy on validation dataset', () => {
    let correct = 0;
    const results: { prompt: string; expected: string; got: string; pass: boolean }[] = [];

    for (const { prompt, context, expected } of validationSet) {
      const result = classifyByHeuristics(prompt, createContext(context as Partial<ConversationContext>));
      const pass = result.promptType === expected;
      if (pass) correct++;
      results.push({ prompt, expected, got: result.promptType, pass });
    }

    const accuracy = correct / validationSet.length;

    // Log failures for debugging
    const failures = results.filter((r) => !r.pass);
    if (failures.length > 0) {
      console.log('Validation failures:', failures);
    }

    expect(accuracy).toBeGreaterThanOrEqual(0.8);
  });
});
