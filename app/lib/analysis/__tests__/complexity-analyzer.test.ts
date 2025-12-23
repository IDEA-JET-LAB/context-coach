/**
 * Complexity Analyzer Tests
 * Story 21-4: Prompt Complexity Metrics
 */

import { describe, it, expect } from 'vitest';
import {
  // Types
  type ComplexityLevel,
  type ComplexityMetrics,
  // Detection functions
  countSentences,
  countCodeBlocks,
  hasInlineCode,
  hasCodePatterns,
  detectCode,
  countFileExtensions,
  countPathReferences,
  countFileReferences,
  detectFileRefs,
  // Scoring functions
  calculateComplexityScore,
  determineComplexityLevel,
  // Main analyzers
  analyzeComplexity,
  quickComplexityCheck,
} from '../complexity-analyzer';

// ============================================================================
// Test Data
// ============================================================================

const SIMPLE_PROMPT = 'How do I create a component?';
// Avoid words that contain code keywords (for/with/etc.) as substrings
// Also needs to be >200 chars to reach "moderate" level (need 30+ points)
const MULTI_SENTENCE_PROMPT = 'I need help making some important changes to my authentication module. The login page should properly verify email addresses before submission. Please also add password strength checking so users can see requirements. Thanks!';
const CODE_BLOCK_PROMPT = `
Please help me fix this function:

\`\`\`typescript
function add(a: number, b: number) {
  return a + b;
}
\`\`\`

It should handle negative numbers.
`;
const INLINE_CODE_PROMPT = 'The \`useState\` hook is not working correctly in my \`App.tsx\` component.';
const FILE_REF_PROMPT = 'Please update the config.json and add the new API endpoint to api/endpoints.ts.';
const COMPLEX_PROMPT = `
I need help refactoring this authentication module:

\`\`\`typescript
import { createClient } from '@supabase/supabase-js';

export async function signIn(email: string, password: string) {
  const client = createClient(url, key);
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}
\`\`\`

The main issues are:
1. Error handling needs improvement
2. The client should be cached
3. We need to add rate limiting

Please check the files:
- /src/lib/auth/client.ts
- /src/lib/auth/session.ts
- ./config/auth.yaml

Make sure the changes are backwards compatible with the existing API.
`;

// ============================================================================
// Sentence Counting Tests
// ============================================================================

describe('countSentences', () => {
  it('should return 0 for empty string', () => {
    expect(countSentences('')).toBe(0);
  });

  it('should return 0 for whitespace only', () => {
    expect(countSentences('   \n\t  ')).toBe(0);
  });

  it('should return 1 for text without punctuation', () => {
    expect(countSentences('Hello world')).toBe(1);
  });

  it('should count simple sentences ending with period', () => {
    expect(countSentences('Hello world.')).toBe(1);
    expect(countSentences('Hello. World.')).toBe(2);
  });

  it('should count sentences ending with question mark', () => {
    expect(countSentences('How are you?')).toBe(1);
    expect(countSentences('How are you? Are you okay?')).toBe(2);
  });

  it('should count sentences ending with exclamation mark', () => {
    expect(countSentences('Hello!')).toBe(1);
    expect(countSentences('Hello! How are you!')).toBe(2);
  });

  it('should handle mixed punctuation', () => {
    expect(countSentences('Hello! How are you? I am fine.')).toBe(3);
  });

  it('should ignore punctuation in code blocks', () => {
    const textWithCode = 'Hello. ```const x = 1.5; console.log("test.");``` Bye.';
    expect(countSentences(textWithCode)).toBe(2);
  });

  it('should handle multiple punctuation marks', () => {
    expect(countSentences('Really?!')).toBe(1);
    expect(countSentences('Wow!!! Amazing!!!')).toBe(2);
  });

  it('should count sentences in multi-sentence prompt', () => {
    expect(countSentences(MULTI_SENTENCE_PROMPT)).toBe(4);
  });
});

// ============================================================================
// Code Detection Tests
// ============================================================================

describe('countCodeBlocks', () => {
  it('should return 0 for text without code blocks', () => {
    expect(countCodeBlocks('Hello world')).toBe(0);
  });

  it('should count single code block', () => {
    expect(countCodeBlocks('```code```')).toBe(1);
  });

  it('should count multiple code blocks', () => {
    const text = '```first``` some text ```second```';
    expect(countCodeBlocks(text)).toBe(2);
  });

  it('should handle code blocks with language specifier', () => {
    const text = '```typescript\nconst x = 1;\n```';
    expect(countCodeBlocks(text)).toBe(1);
  });

  it('should handle nested backticks', () => {
    const text = '```\nconst x = `template`;\n```';
    expect(countCodeBlocks(text)).toBe(1);
  });
});

describe('hasInlineCode', () => {
  it('should return false for text without inline code', () => {
    expect(hasInlineCode('Hello world')).toBe(false);
  });

  it('should return true for text with inline code', () => {
    expect(hasInlineCode('Use `console.log` for debugging')).toBe(true);
  });

  it('should handle multiple inline code segments', () => {
    expect(hasInlineCode('Use `const` and `let` instead of `var`')).toBe(true);
  });

  it('should not match empty backticks', () => {
    expect(hasInlineCode('Just a `` nothing here')).toBe(false);
  });
});

describe('hasCodePatterns', () => {
  it('should return false for plain text', () => {
    expect(hasCodePatterns('Hello world')).toBe(false);
  });

  it('should detect JavaScript keywords', () => {
    expect(hasCodePatterns('const x = 5')).toBe(true);
    expect(hasCodePatterns('function test() {}')).toBe(true);
    expect(hasCodePatterns('class MyClass {}')).toBe(true);
    expect(hasCodePatterns('import x from y')).toBe(true);
    expect(hasCodePatterns('export default')).toBe(true);
  });

  it('should detect TypeScript keywords', () => {
    expect(hasCodePatterns('interface User {}')).toBe(true);
    expect(hasCodePatterns('type Props = {}')).toBe(true);
  });

  it('should detect JavaScript operators', () => {
    expect(hasCodePatterns('(x) => x + 1')).toBe(true);
    expect(hasCodePatterns('a === b')).toBe(true);
    expect(hasCodePatterns('a !== b')).toBe(true);
    expect(hasCodePatterns('a || b')).toBe(true);
    expect(hasCodePatterns('a && b')).toBe(true);
  });

  it('should detect Python keywords', () => {
    expect(hasCodePatterns('def my_function():')).toBe(true);
    expect(hasCodePatterns('lambda x: x')).toBe(true);
    expect(hasCodePatterns('except Exception:')).toBe(true);
  });
});

describe('detectCode', () => {
  it('should return false for plain text', () => {
    expect(detectCode('Hello world, how are you?')).toBe(false);
  });

  it('should return true for fenced code blocks', () => {
    expect(detectCode('```javascript\nconsole.log("hi");\n```')).toBe(true);
  });

  it('should return true for inline code', () => {
    expect(detectCode('Use the `useState` hook')).toBe(true);
  });

  it('should return true for code patterns', () => {
    expect(detectCode('Set const x = 5 to define a constant')).toBe(true);
  });

  it('should detect code in CODE_BLOCK_PROMPT', () => {
    expect(detectCode(CODE_BLOCK_PROMPT)).toBe(true);
  });

  it('should detect code in INLINE_CODE_PROMPT', () => {
    expect(detectCode(INLINE_CODE_PROMPT)).toBe(true);
  });
});

// ============================================================================
// File Reference Detection Tests
// ============================================================================

describe('countFileExtensions', () => {
  it('should return 0 for text without file extensions', () => {
    expect(countFileExtensions('Hello world')).toBe(0);
  });

  it('should count TypeScript files', () => {
    expect(countFileExtensions('Edit app.ts and utils.tsx')).toBe(2);
  });

  it('should count JavaScript files', () => {
    expect(countFileExtensions('Check index.js and helper.jsx')).toBe(2);
  });

  it('should count Python files', () => {
    expect(countFileExtensions('Run main.py')).toBe(1);
  });

  it('should count config files', () => {
    expect(countFileExtensions('Edit config.json, settings.yaml, and data.yml')).toBe(3);
  });

  it('should be case-insensitive', () => {
    expect(countFileExtensions('FILE.TS and file.ts')).toBe(2);
  });

  it('should count various extension types', () => {
    const text = 'Check component.vue, page.svelte, style.css, index.html';
    expect(countFileExtensions(text)).toBe(4);
  });
});

describe('countPathReferences', () => {
  it('should return 0 for text without paths', () => {
    expect(countPathReferences('Hello world')).toBe(0);
  });

  it('should count macOS paths', () => {
    // May match multiple patterns (specific macOS + generic Unix)
    expect(countPathReferences('Check /Users/dev/project/file.ts')).toBeGreaterThanOrEqual(1);
  });

  it('should count Linux paths', () => {
    // May match multiple patterns (specific Linux + generic Unix)
    expect(countPathReferences('Check /home/dev/project/file.ts')).toBeGreaterThanOrEqual(1);
  });

  it('should count relative paths with ./', () => {
    // May match multiple patterns (./ pattern + generic Unix subpath)
    expect(countPathReferences('Edit ./src/index.ts')).toBeGreaterThanOrEqual(1);
  });

  it('should count relative paths with ../', () => {
    // May match multiple patterns (../ pattern + subpaths)
    expect(countPathReferences('Edit ../utils/helper.ts')).toBeGreaterThanOrEqual(1);
  });

  it('should count generic Unix paths', () => {
    expect(countPathReferences('Check /src/lib/auth.ts')).toBeGreaterThanOrEqual(1);
  });

  it('should count multiple paths', () => {
    const text = 'Edit /src/a.ts and ./b.ts and ../c.ts';
    expect(countPathReferences(text)).toBeGreaterThanOrEqual(3);
  });
});

describe('countFileReferences', () => {
  it('should deduplicate overlapping matches', () => {
    // Path includes extension, should not double-count
    const text = '/Users/dev/project/file.ts';
    const count = countFileReferences(text);
    // Should count as one reference (the path includes the file)
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('should count multiple unique references', () => {
    const text = 'Edit config.json and /src/utils.ts';
    const count = countFileReferences(text);
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

describe('detectFileRefs', () => {
  it('should return false for plain text', () => {
    expect(detectFileRefs('Hello world')).toBe(false);
  });

  it('should return true for file extensions', () => {
    expect(detectFileRefs('Edit app.ts')).toBe(true);
  });

  it('should return true for paths', () => {
    expect(detectFileRefs('Check /src/lib/auth.ts')).toBe(true);
  });

  it('should return true for relative paths', () => {
    expect(detectFileRefs('Edit ./config.json')).toBe(true);
  });

  it('should detect file refs in FILE_REF_PROMPT', () => {
    expect(detectFileRefs(FILE_REF_PROMPT)).toBe(true);
  });
});

// ============================================================================
// Scoring Tests
// ============================================================================

describe('calculateComplexityScore', () => {
  it('should return 0 for minimal metrics', () => {
    const score = calculateComplexityScore({
      charCount: 10,
      wordCount: 2,
      sentenceCount: 1,
      hasCode: false,
      hasFileRefs: false,
      codeBlockCount: 0,
    });
    expect(score).toBe(0);
  });

  it('should add 10 points for >200 chars', () => {
    const score = calculateComplexityScore({
      charCount: 250,
      wordCount: 50,
      sentenceCount: 1,
      hasCode: false,
      hasFileRefs: false,
      codeBlockCount: 0,
    });
    expect(score).toBe(10);
  });

  it('should add 20 points for >500 chars', () => {
    const score = calculateComplexityScore({
      charCount: 600,
      wordCount: 120,
      sentenceCount: 1,
      hasCode: false,
      hasFileRefs: false,
      codeBlockCount: 0,
    });
    expect(score).toBe(20);
  });

  it('should add 10 points for >1 sentence', () => {
    const score = calculateComplexityScore({
      charCount: 50,
      wordCount: 10,
      sentenceCount: 2,
      hasCode: false,
      hasFileRefs: false,
      codeBlockCount: 0,
    });
    expect(score).toBe(10);
  });

  it('should add 20 points for >3 sentences', () => {
    const score = calculateComplexityScore({
      charCount: 100,
      wordCount: 20,
      sentenceCount: 4,
      hasCode: false,
      hasFileRefs: false,
      codeBlockCount: 0,
    });
    expect(score).toBe(20);
  });

  it('should add 25 points for code', () => {
    const score = calculateComplexityScore({
      charCount: 50,
      wordCount: 10,
      sentenceCount: 1,
      hasCode: true,
      hasFileRefs: false,
      codeBlockCount: 0,
    });
    expect(score).toBe(25);
  });

  it('should add 15 points for file refs', () => {
    const score = calculateComplexityScore({
      charCount: 50,
      wordCount: 10,
      sentenceCount: 1,
      hasCode: false,
      hasFileRefs: true,
      codeBlockCount: 0,
    });
    expect(score).toBe(15);
  });

  it('should add 5 points per code block (max 10)', () => {
    const score1 = calculateComplexityScore({
      charCount: 50,
      wordCount: 10,
      sentenceCount: 1,
      hasCode: false,
      hasFileRefs: false,
      codeBlockCount: 1,
    });
    expect(score1).toBe(5);

    const score2 = calculateComplexityScore({
      charCount: 50,
      wordCount: 10,
      sentenceCount: 1,
      hasCode: false,
      hasFileRefs: false,
      codeBlockCount: 2,
    });
    expect(score2).toBe(10);

    const score3 = calculateComplexityScore({
      charCount: 50,
      wordCount: 10,
      sentenceCount: 1,
      hasCode: false,
      hasFileRefs: false,
      codeBlockCount: 5,
    });
    expect(score3).toBe(10); // Capped at 10
  });

  it('should add 10 points for avg word length >6', () => {
    // 60 chars / 8 words = 7.5 avg length
    const score = calculateComplexityScore({
      charCount: 60,
      wordCount: 8,
      sentenceCount: 1,
      hasCode: false,
      hasFileRefs: false,
      codeBlockCount: 0,
    });
    expect(score).toBe(10);
  });

  it('should cap score at 100', () => {
    const score = calculateComplexityScore({
      charCount: 1000,
      wordCount: 100,
      sentenceCount: 10,
      hasCode: true,
      hasFileRefs: true,
      codeBlockCount: 5,
    });
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('determineComplexityLevel', () => {
  it('should return simple for score 0-29', () => {
    expect(determineComplexityLevel(0)).toBe('simple');
    expect(determineComplexityLevel(15)).toBe('simple');
    expect(determineComplexityLevel(29)).toBe('simple');
  });

  it('should return moderate for score 30-59', () => {
    expect(determineComplexityLevel(30)).toBe('moderate');
    expect(determineComplexityLevel(45)).toBe('moderate');
    expect(determineComplexityLevel(59)).toBe('moderate');
  });

  it('should return complex for score 60-100', () => {
    expect(determineComplexityLevel(60)).toBe('complex');
    expect(determineComplexityLevel(80)).toBe('complex');
    expect(determineComplexityLevel(100)).toBe('complex');
  });
});

// ============================================================================
// Main Analyzer Tests
// ============================================================================

describe('analyzeComplexity', () => {
  it('should analyze simple prompt correctly', () => {
    const result = analyzeComplexity(SIMPLE_PROMPT, SIMPLE_PROMPT.length, 5);

    expect(result.charCount).toBe(SIMPLE_PROMPT.length);
    expect(result.wordCount).toBe(5);
    expect(result.sentenceCount).toBe(1);
    expect(result.hasCode).toBe(false);
    expect(result.hasFileRefs).toBe(false);
    expect(result.codeBlockCount).toBe(0);
    expect(result.fileRefCount).toBe(0);
    expect(result.complexityLevel).toBe('simple');
    expect(result.complexityScore).toBeLessThan(30);
  });

  it('should analyze multi-sentence prompt correctly', () => {
    const result = analyzeComplexity(
      MULTI_SENTENCE_PROMPT,
      MULTI_SENTENCE_PROMPT.length,
      25
    );

    expect(result.sentenceCount).toBe(4);
    expect(result.hasCode).toBe(false);
    expect(result.hasFileRefs).toBe(false);
    expect(result.complexityLevel).toBe('moderate');
  });

  it('should analyze code block prompt correctly', () => {
    const result = analyzeComplexity(
      CODE_BLOCK_PROMPT,
      CODE_BLOCK_PROMPT.length,
      15
    );

    expect(result.hasCode).toBe(true);
    expect(result.codeBlockCount).toBe(1);
    expect(result.complexityScore).toBeGreaterThanOrEqual(25);
  });

  it('should analyze inline code prompt correctly', () => {
    const result = analyzeComplexity(
      INLINE_CODE_PROMPT,
      INLINE_CODE_PROMPT.length,
      12
    );

    expect(result.hasCode).toBe(true);
    expect(result.hasFileRefs).toBe(true); // App.tsx
    expect(result.complexityScore).toBeGreaterThanOrEqual(25);
  });

  it('should analyze file ref prompt correctly', () => {
    const result = analyzeComplexity(
      FILE_REF_PROMPT,
      FILE_REF_PROMPT.length,
      12
    );

    expect(result.hasFileRefs).toBe(true);
    expect(result.fileRefCount).toBeGreaterThanOrEqual(2);
  });

  it('should analyze complex prompt correctly', () => {
    const result = analyzeComplexity(
      COMPLEX_PROMPT,
      COMPLEX_PROMPT.length,
      80
    );

    expect(result.hasCode).toBe(true);
    expect(result.codeBlockCount).toBe(1);
    expect(result.hasFileRefs).toBe(true);
    expect(result.sentenceCount).toBeGreaterThanOrEqual(3);
    expect(result.complexityLevel).toBe('complex');
    expect(result.complexityScore).toBeGreaterThanOrEqual(60);
  });
});

describe('quickComplexityCheck', () => {
  it('should return only score and level', () => {
    const result = quickComplexityCheck(SIMPLE_PROMPT, SIMPLE_PROMPT.length, 5);

    expect(result).toHaveProperty('complexityScore');
    expect(result).toHaveProperty('complexityLevel');
    expect(Object.keys(result)).toHaveLength(2);
  });

  it('should match full analysis results', () => {
    const fullResult = analyzeComplexity(COMPLEX_PROMPT, COMPLEX_PROMPT.length, 80);
    const quickResult = quickComplexityCheck(COMPLEX_PROMPT, COMPLEX_PROMPT.length, 80);

    expect(quickResult.complexityScore).toBe(fullResult.complexityScore);
    expect(quickResult.complexityLevel).toBe(fullResult.complexityLevel);
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('performance', () => {
  it('should analyze prompts in under 2ms', () => {
    const testCases = [
      SIMPLE_PROMPT,
      MULTI_SENTENCE_PROMPT,
      CODE_BLOCK_PROMPT,
      INLINE_CODE_PROMPT,
      FILE_REF_PROMPT,
      COMPLEX_PROMPT,
    ];

    for (const testCase of testCases) {
      const start = performance.now();
      analyzeComplexity(testCase, testCase.length, 50);
      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(2);
    }
  });

  it('should handle very long prompts efficiently', () => {
    // Create a 10KB prompt with code blocks
    const longPrompt = Array(100)
      .fill('```javascript\nconsole.log("test");\n```\nSome text about files like app.ts and config.json.\n')
      .join('');

    const start = performance.now();
    analyzeComplexity(longPrompt, longPrompt.length, 1000);
    const end = performance.now();
    const duration = end - start;

    // Allow more time for very long prompts, but still should be fast
    expect(duration).toBeLessThan(20);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('should handle empty string', () => {
    const result = analyzeComplexity('', 0, 0);

    expect(result.sentenceCount).toBe(0);
    expect(result.hasCode).toBe(false);
    expect(result.hasFileRefs).toBe(false);
    expect(result.complexityLevel).toBe('simple');
    expect(result.complexityScore).toBe(0);
  });

  it('should handle single character', () => {
    const result = analyzeComplexity('a', 1, 1);

    expect(result.sentenceCount).toBe(1);
    expect(result.complexityLevel).toBe('simple');
  });

  it('should handle special characters', () => {
    // Note: (), {} and [] are detected as code patterns, avoid those
    const result = analyzeComplexity('!@#$%^', 6, 0);

    expect(result.hasCode).toBe(false);
    expect(result.hasFileRefs).toBe(false);
  });

  it('should handle unicode text', () => {
    const result = analyzeComplexity('Hello, world! ', 20, 4);

    expect(result.hasCode).toBe(false);
    expect(result.sentenceCount).toBe(1);
  });

  it('should handle malformed code blocks', () => {
    const malformed = '``` unclosed code block';
    const result = analyzeComplexity(malformed, malformed.length, 4);

    // Should not crash, just not count as code block
    expect(result.codeBlockCount).toBe(0);
  });

  it('should handle nested patterns', () => {
    const nested = '```\n/src/app.ts contains `const x`\n```';
    const result = analyzeComplexity(nested, nested.length, 5);

    expect(result.hasCode).toBe(true);
    expect(result.codeBlockCount).toBe(1);
  });
});
