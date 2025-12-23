/**
 * Sentiment Classifier Tests
 * Story 21-3: Sentiment Analysis
 *
 * Tests for automatic classification of prompts into sentiment categories:
 * polite, frustrated, neutral, directive, collaborative
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeSentiment,
  Sentiment,
  SentimentResult,
  SENTIMENT_TYPES,
} from '../sentiment-classifier';

// ============================================================================
// Tests: Type and Structure
// ============================================================================

describe('SentimentClassifier Types', () => {
  it('should export 5 sentiment types', () => {
    expect(SENTIMENT_TYPES).toHaveLength(5);
    expect(SENTIMENT_TYPES).toContain('polite');
    expect(SENTIMENT_TYPES).toContain('frustrated');
    expect(SENTIMENT_TYPES).toContain('neutral');
    expect(SENTIMENT_TYPES).toContain('directive');
    expect(SENTIMENT_TYPES).toContain('collaborative');
  });

  it('should return correct result structure', () => {
    const result = analyzeSentiment('test prompt');
    expect(result).toHaveProperty('sentiment');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('politeScore');
    expect(result).toHaveProperty('frustratedScore');
    expect(result).toHaveProperty('directiveScore');
    expect(result).toHaveProperty('collaborativeScore');
    expect(typeof result.sentiment).toBe('string');
    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('should have all scores in 0-1 range', () => {
    const result = analyzeSentiment('please help me fix this bug');
    expect(result.politeScore).toBeGreaterThanOrEqual(0);
    expect(result.politeScore).toBeLessThanOrEqual(1);
    expect(result.frustratedScore).toBeGreaterThanOrEqual(0);
    expect(result.frustratedScore).toBeLessThanOrEqual(1);
    expect(result.directiveScore).toBeGreaterThanOrEqual(0);
    expect(result.directiveScore).toBeLessThanOrEqual(1);
    expect(result.collaborativeScore).toBeGreaterThanOrEqual(0);
    expect(result.collaborativeScore).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// Tests: Polite Detection (AC #2)
// ============================================================================

describe('Polite Detection (AC #2)', () => {
  const politeExamples = [
    { prompt: 'please help me with this', keyword: 'please' },
    { prompt: 'thank you for the help', keyword: 'thank you' },
    { prompt: 'thanks for your assistance', keyword: 'thanks' },
    { prompt: 'could you check this code?', keyword: 'could you' },
    { prompt: 'would you mind reviewing this?', keyword: 'would you' },
    { prompt: 'great work on that feature!', keyword: 'great' },
    { prompt: 'awesome solution!', keyword: 'awesome' },
    { prompt: 'that is excellent, thanks', keyword: 'excellent' },
    { prompt: 'perfect, that worked', keyword: 'perfect' },
    { prompt: 'I really appreciate your help', keyword: 'appreciate' },
    { prompt: 'could you kindly fix this?', keyword: 'kindly' },
  ];

  it.each(politeExamples)(
    'should detect polite sentiment with "$keyword"',
    ({ prompt }) => {
      const result = analyzeSentiment(prompt);
      expect(result.politeScore).toBeGreaterThan(0);
    }
  );

  it('should classify as polite when polite score exceeds threshold', () => {
    const result = analyzeSentiment('please, thank you so much for the help, I really appreciate it');
    expect(result.sentiment).toBe('polite');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should accumulate polite scores from multiple patterns', () => {
    const singlePattern = analyzeSentiment('please help');
    const multiplePatterns = analyzeSentiment('please help, thank you, I appreciate it');
    expect(multiplePatterns.politeScore).toBeGreaterThan(singlePattern.politeScore);
  });

  it('should cap polite score at 1.0', () => {
    // Many polite words should not exceed 1.0
    const result = analyzeSentiment(
      'please thank you thanks appreciate great awesome excellent perfect kindly'
    );
    expect(result.politeScore).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// Tests: Frustrated Detection (AC #3)
// ============================================================================

describe('Frustrated Detection (AC #3)', () => {
  const frustratedExamples = [
    { prompt: 'why is this not working?', keyword: 'why is this' },
    { prompt: "why doesn't this work?", keyword: "why doesn't" },
    { prompt: "why isn't this working?", keyword: "why isn't" },
    { prompt: 'still not working after the fix', keyword: 'still not' },
    { prompt: 'this is still wrong', keyword: 'still wrong' },
    { prompt: 'the system is still broken', keyword: 'still broken' },
    { prompt: 'tests are still failing', keyword: 'still failing' },
    { prompt: 'what the heck is going on', keyword: 'what the' },
    { prompt: 'wtf is this error', keyword: 'wtf' },
    { prompt: 'this is so frustrating', keyword: 'frustrat' },
    { prompt: 'this is annoying', keyword: 'annoy' },
    { prompt: 'this is irritating', keyword: 'irritat' },
    { prompt: 'failed again?!', keyword: 'again?!' },
  ];

  it.each(frustratedExamples)(
    'should detect frustrated sentiment with "$keyword"',
    ({ prompt }) => {
      const result = analyzeSentiment(prompt);
      expect(result.frustratedScore).toBeGreaterThan(0);
    }
  );

  it('should classify as frustrated with high confidence (>0.7) for strong frustration', () => {
    const result = analyzeSentiment('wtf is this? still not working after multiple attempts');
    expect(result.sentiment).toBe('frustrated');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('should prioritize frustrated over other sentiments when score > 0.4', () => {
    // Even with polite words, high frustration should win
    const result = analyzeSentiment('please help, why is this still not working?!');
    expect(result.sentiment).toBe('frustrated');
  });

  it('should detect "I dont understand why" pattern', () => {
    const result = analyzeSentiment("I don't understand why this keeps failing");
    expect(result.frustratedScore).toBeGreaterThan(0);
  });
});

// ============================================================================
// Tests: Directive Detection (AC #4)
// ============================================================================

describe('Directive Detection (AC #4)', () => {
  const directiveExamples = [
    { prompt: 'Do this task', verb: 'Do' },
    { prompt: 'Make a new component', verb: 'Make' },
    { prompt: 'Create a new file', verb: 'Create' },
    { prompt: 'Add a button here', verb: 'Add' },
    { prompt: 'Remove the old code', verb: 'Remove' },
    { prompt: 'Fix the bug in login', verb: 'Fix' },
    { prompt: 'Update the dependencies', verb: 'Update' },
    { prompt: 'Delete the unused files', verb: 'Delete' },
  ];

  it.each(directiveExamples)(
    'should detect directive sentiment starting with "$verb"',
    ({ prompt }) => {
      const result = analyzeSentiment(prompt);
      expect(result.directiveScore).toBeGreaterThan(0);
    }
  );

  it('should classify as directive when prompt starts with imperative verb', () => {
    const result = analyzeSentiment('Fix the authentication bug immediately');
    expect(result.sentiment).toBe('directive');
  });

  it('should not classify as directive when imperative verb is not at start', () => {
    // "please create" has polite pattern before directive
    const result = analyzeSentiment('I want you to create a file');
    expect(result.directiveScore).toBe(0);
  });
});

// ============================================================================
// Tests: Collaborative Detection (AC #5)
// ============================================================================

describe('Collaborative Detection (AC #5)', () => {
  const collaborativeExamples = [
    { prompt: "let's work on this together", keyword: "let's" },
    { prompt: 'we could try a different approach', keyword: 'we could' },
    { prompt: 'we can solve this', keyword: 'we can' },
    { prompt: 'we should refactor this', keyword: 'we should' },
    { prompt: 'shall we start with the tests?', keyword: 'shall we' },
    { prompt: 'working on this together', keyword: 'together' },
    { prompt: 'how about we try something else?', keyword: 'how about we' },
    { prompt: 'what if we used a different pattern?', keyword: 'what if we' },
    { prompt: 'help me understand this code', keyword: 'help me understand' },
    { prompt: 'work with me on this problem', keyword: 'work with me' },
  ];

  it.each(collaborativeExamples)(
    'should detect collaborative sentiment with "$keyword"',
    ({ prompt }) => {
      const result = analyzeSentiment(prompt);
      expect(result.collaborativeScore).toBeGreaterThan(0);
    }
  );

  it('should classify as collaborative when score > 0.35', () => {
    const result = analyzeSentiment("let's work together on this. How about we try a new approach?");
    expect(result.sentiment).toBe('collaborative');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should accumulate collaborative scores from multiple patterns', () => {
    const singlePattern = analyzeSentiment("let's try this");
    const multiplePatterns = analyzeSentiment("let's work together on this, we could also try that");
    expect(multiplePatterns.collaborativeScore).toBeGreaterThan(singlePattern.collaborativeScore);
  });
});

// ============================================================================
// Tests: Neutral Fallback (AC #5)
// ============================================================================

describe('Neutral Fallback', () => {
  const neutralExamples = [
    'what is the current status',
    'show me the file contents',
    'explain this code',
    'list all the dependencies',
    'describe the architecture',
    'random text with no sentiment',
    '',
    '   ',
  ];

  it.each(neutralExamples)(
    'should classify "%s" as neutral',
    (prompt) => {
      const result = analyzeSentiment(prompt);
      expect(result.sentiment).toBe('neutral');
    }
  );

  it('should return 0.7 confidence for neutral classification', () => {
    const result = analyzeSentiment('just a regular question about code');
    expect(result.sentiment).toBe('neutral');
    expect(result.confidence).toBe(0.7);
  });
});

// ============================================================================
// Tests: Priority Ordering (AC #1)
// ============================================================================

describe('Priority Ordering (AC #1)', () => {
  it('should prioritize frustrated over collaborative', () => {
    // Has both collaborative and frustrated patterns
    const result = analyzeSentiment("let's figure out why this is still not working wtf");
    expect(result.sentiment).toBe('frustrated');
  });

  it('should prioritize frustrated over polite', () => {
    const result = analyzeSentiment('please help, this is so frustrating, still broken');
    expect(result.sentiment).toBe('frustrated');
  });

  it('should prioritize collaborative over polite when no frustration', () => {
    const result = analyzeSentiment("let's work together on this please");
    expect(result.sentiment).toBe('collaborative');
  });

  it('should prioritize collaborative over directive when no frustration', () => {
    const result = analyzeSentiment("let's create a new component together");
    expect(result.sentiment).toBe('collaborative');
  });

  it('should prioritize polite over directive when no frustration or collaborative', () => {
    const result = analyzeSentiment('please create a new file for me');
    expect(result.sentiment).toBe('polite');
  });
});

// ============================================================================
// Tests: Confidence Calculation
// ============================================================================

describe('Confidence Calculation', () => {
  it('should have higher confidence for stronger sentiment signals', () => {
    const weakSignal = analyzeSentiment('please help');
    const strongSignal = analyzeSentiment('please thank you I really appreciate your help so much');
    expect(strongSignal.confidence).toBeGreaterThan(weakSignal.confidence);
  });

  it('should cap confidence at appropriate maximum values', () => {
    const result = analyzeSentiment('wtf is going on, this is so frustrating, still broken again?!');
    expect(result.confidence).toBeLessThanOrEqual(0.95);
  });
});

// ============================================================================
// Tests: Performance (AC #7)
// ============================================================================

describe('Performance (AC #7)', () => {
  it('should analyze prompts in under 2ms', () => {
    const testPrompts = [
      'please help me with this',
      'why is this still not working?!',
      "let's work on this together",
      'Fix the bug immediately',
      'just a regular question',
    ];

    for (const prompt of testPrompts) {
      const start = performance.now();
      analyzeSentiment(prompt);
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(2);
    }
  });

  it('should handle very long prompts efficiently (under 5ms)', () => {
    const longPrompt = 'please help me with this complex issue '.repeat(50);
    const start = performance.now();
    analyzeSentiment(longPrompt);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(5);
  });

  it('should analyze 100 prompts in under 50ms total', () => {
    const prompts = [
      'please help',
      'wtf is this',
      "let's do this",
      'Fix it now',
      'random text',
    ];

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      analyzeSentiment(prompts[i % prompts.length]!);
    }
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(50);
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty strings', () => {
    const result = analyzeSentiment('');
    expect(result.sentiment).toBe('neutral');
    expect(result.confidence).toBe(0.7);
  });

  it('should handle whitespace-only strings', () => {
    const result = analyzeSentiment('   \t\n   ');
    expect(result.sentiment).toBe('neutral');
  });

  it('should be case insensitive', () => {
    expect(analyzeSentiment('PLEASE HELP').politeScore).toBeGreaterThan(0);
    expect(analyzeSentiment('WTF IS THIS').frustratedScore).toBeGreaterThan(0);
    expect(analyzeSentiment("LET'S DO THIS").collaborativeScore).toBeGreaterThan(0);
    expect(analyzeSentiment('FIX THIS NOW').directiveScore).toBeGreaterThan(0);
  });

  it('should handle unicode characters', () => {
    const result = analyzeSentiment('please help with this bug 🐛');
    expect(result.politeScore).toBeGreaterThan(0);
  });

  it('should handle special characters', () => {
    const result = analyzeSentiment('please!!! help??? @#$%');
    expect(result.politeScore).toBeGreaterThan(0);
  });
});

// ============================================================================
// Tests: Real-World Prompt Examples
// ============================================================================

describe('Real-World Prompt Examples', () => {
  it('should classify polite code review request', () => {
    const result = analyzeSentiment(
      'Could you please review this pull request? I would really appreciate your feedback. Thanks!'
    );
    expect(result.sentiment).toBe('polite');
  });

  it('should classify frustrated debugging session', () => {
    const result = analyzeSentiment(
      "This is still not working! I've tried everything and the tests keep failing. Why isn't this working?!"
    );
    expect(result.sentiment).toBe('frustrated');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('should classify collaborative planning', () => {
    const result = analyzeSentiment(
      "Let's work together on the architecture. How about we start with the database schema and then move to the API design?"
    );
    expect(result.sentiment).toBe('collaborative');
  });

  it('should classify directive task assignment', () => {
    const result = analyzeSentiment(
      'Create a new React component for the user profile page'
    );
    expect(result.sentiment).toBe('directive');
  });

  it('should classify neutral informational request', () => {
    const result = analyzeSentiment(
      'What is the current version of Node.js being used in this project?'
    );
    expect(result.sentiment).toBe('neutral');
  });
});

// ============================================================================
// Tests: Validation Dataset (80% Accuracy Target)
// ============================================================================

describe('Validation Dataset (80% Accuracy)', () => {
  const validationSet = [
    // Polite examples (10)
    { prompt: 'Please help me understand this code', expected: 'polite' },
    { prompt: 'Thank you so much for the quick fix', expected: 'polite' },
    { prompt: 'Could you explain how this works?', expected: 'polite' },
    { prompt: 'I really appreciate your help on this', expected: 'polite' },
    { prompt: 'Great job on the implementation!', expected: 'polite' },
    { prompt: 'Would you mind looking at this?', expected: 'polite' },
    { prompt: 'Thanks for the clarification', expected: 'polite' },
    { prompt: 'Excellent work on the refactoring', expected: 'polite' },
    { prompt: 'Please create a test for this function', expected: 'polite' },
    { prompt: 'I appreciate you taking the time to review', expected: 'polite' },

    // Frustrated examples (10)
    { prompt: 'Why is this STILL not working?!', expected: 'frustrated' },
    { prompt: 'WTF is going on with this code', expected: 'frustrated' },
    { prompt: 'This is so frustrating, nothing works', expected: 'frustrated' },
    { prompt: 'The tests are still failing, again!', expected: 'frustrated' },
    { prompt: "I don't understand why this keeps breaking", expected: 'frustrated' },
    { prompt: 'Another error?! This is annoying', expected: 'frustrated' },
    { prompt: 'Still broken after all those changes', expected: 'frustrated' },
    { prompt: 'Why does this keep happening?', expected: 'frustrated' },
    { prompt: 'This cannot be right, something is wrong', expected: 'frustrated' },
    { prompt: 'What the heck is this error message', expected: 'frustrated' },

    // Collaborative examples (10)
    { prompt: "Let's work on this feature together", expected: 'collaborative' },
    { prompt: 'We could try a different approach', expected: 'collaborative' },
    { prompt: 'Shall we refactor this module?', expected: 'collaborative' },
    { prompt: 'How about we start with the tests?', expected: 'collaborative' },
    { prompt: "Let's figure this out together", expected: 'collaborative' },
    { prompt: 'What if we used a factory pattern?', expected: 'collaborative' },
    { prompt: 'We should consider the edge cases', expected: 'collaborative' },
    { prompt: 'Help me understand the requirements', expected: 'collaborative' },
    { prompt: 'Work with me on debugging this', expected: 'collaborative' },
    { prompt: "Let's brainstorm some solutions", expected: 'collaborative' },

    // Directive examples (10)
    { prompt: 'Fix the authentication bug', expected: 'directive' },
    { prompt: 'Create a new API endpoint', expected: 'directive' },
    { prompt: 'Delete the deprecated methods', expected: 'directive' },
    { prompt: 'Update the package dependencies', expected: 'directive' },
    { prompt: 'Add input validation', expected: 'directive' },
    { prompt: 'Remove the console.log statements', expected: 'directive' },
    { prompt: 'Make the button larger', expected: 'directive' },
    { prompt: 'Do not use var, use const', expected: 'directive' },
    { prompt: 'Add error handling to the API', expected: 'directive' },
    { prompt: 'Refactor the user service', expected: 'directive' },

    // Neutral examples (10)
    { prompt: 'What is the project structure?', expected: 'neutral' },
    { prompt: 'Show me the config file', expected: 'neutral' },
    { prompt: 'Explain how the auth flow works', expected: 'neutral' },
    { prompt: 'List all the API endpoints', expected: 'neutral' },
    { prompt: 'Describe the database schema', expected: 'neutral' },
    { prompt: 'What dependencies are installed?', expected: 'neutral' },
    { prompt: 'How does the caching work?', expected: 'neutral' },
    { prompt: 'Where is the main entry point?', expected: 'neutral' },
    { prompt: 'What is the current branch?', expected: 'neutral' },
    { prompt: 'When was this file last modified?', expected: 'neutral' },
  ] as const;

  it('should achieve at least 80% accuracy on validation dataset', () => {
    let correct = 0;
    const results: { prompt: string; expected: string; got: string; pass: boolean }[] = [];

    for (const { prompt, expected } of validationSet) {
      const result = analyzeSentiment(prompt);
      const pass = result.sentiment === expected;
      if (pass) correct++;
      results.push({ prompt, expected, got: result.sentiment, pass });
    }

    const accuracy = correct / validationSet.length;

    // Log failures for debugging
    const failures = results.filter(r => !r.pass);
    if (failures.length > 0) {
      console.log('Validation failures:', failures);
    }

    expect(accuracy).toBeGreaterThanOrEqual(0.8);
  });
});
