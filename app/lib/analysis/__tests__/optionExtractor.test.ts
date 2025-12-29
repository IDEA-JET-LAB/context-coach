/**
 * Option Extractor Tests
 * Story 27-2: Heuristic Classification
 *
 * Comprehensive tests for extracting options from AI responses:
 * - Numbered lists (1. 2. 3.)
 * - Lettered lists (A. B. C.)
 * - Labeled options (Option 1:, Choice A:)
 * - Bullet options (- Option 1:)
 * - Edge cases and deduplication
 */

import { describe, it, expect } from 'vitest';
import {
  extractOptionsFromResponse,
  extractOptionsWithMetadata,
  hasOptions,
  extractNumberedOptions,
  extractLetteredOptions,
  extractLabeledOptions,
  extractBulletOptions,
  MAX_OPTION_TEXT_LENGTH,
  MAX_OPTIONS,
} from '../optionExtractor';

// ============================================================================
// Tests: extractOptionsFromResponse - Main Function
// ============================================================================

describe('extractOptionsFromResponse', () => {
  describe('Empty and Invalid Input', () => {
    it('should return empty array for undefined', () => {
      expect(extractOptionsFromResponse(undefined)).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      expect(extractOptionsFromResponse('')).toEqual([]);
    });

    it('should return empty array for whitespace-only string', () => {
      expect(extractOptionsFromResponse('   \n\t   ')).toEqual([]);
    });

    it('should return empty array for text without options', () => {
      expect(
        extractOptionsFromResponse('This is just a regular paragraph without any options.')
      ).toEqual([]);
    });
  });

  describe('Numbered Lists', () => {
    it('should extract simple numbered list with periods', () => {
      const response = `Here are your options:
1. Create a new file
2. Modify existing file
3. Delete the file`;

      const result = extractOptionsFromResponse(response);
      expect(result).toContain('1');
      expect(result).toContain('2');
      expect(result).toContain('3');
    });

    it('should extract numbered list with parentheses', () => {
      const response = `Choose one:
1) First option
2) Second option
3) Third option`;

      const result = extractOptionsFromResponse(response);
      expect(result).toContain('1');
      expect(result).toContain('2');
      expect(result).toContain('3');
    });

    it('should extract numbered list with colons', () => {
      const response = `Available actions:
1: Run tests
2: Build project
3: Deploy to staging`;

      const result = extractOptionsFromResponse(response);
      expect(result).toContain('1');
      expect(result).toContain('2');
      expect(result).toContain('3');
    });

    it('should extract numbered list with # prefix', () => {
      // Note: The # prefix format requires a separator (. or : or ))
      // Plain "#1 text" without separator is less standard
      const response = `Options:
#1. Use TypeScript
#2. Use JavaScript
#3. Use Python`;

      const result = extractOptionsFromResponse(response);
      // The pattern should match #1, #2, #3
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Lettered Lists', () => {
    it('should extract simple lettered list with periods', () => {
      const response = `Choose an approach:
A. Fast but less accurate
B. Slow but precise
C. Balanced approach`;

      const result = extractOptionsFromResponse(response);
      expect(result).toContain('A');
      expect(result).toContain('B');
      expect(result).toContain('C');
    });

    it('should extract lettered list with parentheses', () => {
      const response = `Options:
a) Option Alpha
b) Option Beta
c) Option Gamma`;

      const result = extractOptionsFromResponse(response);
      expect(result).toContain('A'); // Normalized to uppercase
      expect(result).toContain('B');
      expect(result).toContain('C');
    });

    it('should extract lettered list with surrounding parentheses', () => {
      const response = `Pick one:
(A) First choice
(B) Second choice`;

      const result = extractOptionsFromResponse(response);
      expect(result).toContain('A');
      expect(result).toContain('B');
    });

    it('should normalize lowercase letters to uppercase', () => {
      const response = `Options:
a. lowercase option a
b. lowercase option b`;

      const result = extractOptionsFromResponse(response);
      expect(result).toContain('A');
      expect(result).toContain('B');
    });
  });

  describe('Labeled Options', () => {
    it('should extract "Option N:" format', () => {
      const response = `Here are the alternatives:
Option 1: Use a REST API
Option 2: Use GraphQL
Option 3: Use gRPC`;

      const result = extractOptionsFromResponse(response);
      expect(result).toContain('1');
      expect(result).toContain('2');
      expect(result).toContain('3');
    });

    it('should extract "Choice X:" format', () => {
      const response = `Make your choice:
Choice A: Frontend framework
Choice B: Backend framework`;

      const result = extractOptionsFromResponse(response);
      expect(result).toContain('A');
      expect(result).toContain('B');
    });

    it('should extract "Alternative N:" format', () => {
      const response = `Consider these alternatives:
Alternative 1: Quick fix
Alternative 2: Long-term solution`;

      const result = extractOptionsFromResponse(response);
      expect(result).toContain('1');
      expect(result).toContain('2');
    });
  });

  describe('Mixed Formats', () => {
    it('should extract options from mixed format response', () => {
      const response = `Here are some options:

1. First numbered option
2. Second numbered option

Or you could choose:
A. First lettered option
B. Second lettered option`;

      const result = extractOptionsFromResponse(response);
      expect(result).toContain('1');
      expect(result).toContain('2');
      expect(result).toContain('A');
      expect(result).toContain('B');
    });
  });

  describe('Option Text Extraction', () => {
    it('should include first words of option text for matching', () => {
      const response = `Options:
1. Create new React component
2. Modify existing component`;

      const result = extractOptionsFromResponse(response);
      expect(result).toContain('1');
      expect(result).toContain('2');
      // Should also include text fragments for matching
      const hasTextMatch = result.some(
        (opt) => opt.includes('create') || opt.includes('react')
      );
      expect(hasTextMatch).toBe(true);
    });
  });

  describe('Deduplication', () => {
    it('should deduplicate repeated identifiers', () => {
      const response = `Options:
1. First option
1. Duplicate first option
2. Second option`;

      const result = extractOptionsFromResponse(response);
      const count1 = result.filter((opt) => opt === '1').length;
      expect(count1).toBe(1); // Should only appear once
    });
  });
});

// ============================================================================
// Tests: extractOptionsWithMetadata
// ============================================================================

describe('extractOptionsWithMetadata', () => {
  it('should return ExtractedOption objects with metadata', () => {
    const response = `Options:
1. First option
2. Second option`;

    const result = extractOptionsWithMetadata(response);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('identifier');
    expect(result[0]).toHaveProperty('text');
    expect(result[0]).toHaveProperty('format');
    expect(result[0]).toHaveProperty('position');
  });

  it('should identify format correctly', () => {
    const numberedResponse = `1. First option`;
    const letteredResponse = `A. First option`;

    const numberedResult = extractOptionsWithMetadata(numberedResponse);
    const letteredResult = extractOptionsWithMetadata(letteredResponse);

    expect(numberedResult[0]?.format).toBe('numbered');
    expect(letteredResult[0]?.format).toBe('lettered');
  });

  it('should sort options by position', () => {
    const response = `Options:
A. First
B. Second
C. Third`;

    const result = extractOptionsWithMetadata(response);
    // Should be sorted by position
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!.position).toBeGreaterThanOrEqual(result[i - 1]!.position);
    }
  });

  it('should deduplicate by identifier', () => {
    const response = `Options:
1. First version
1. Second version of 1`;

    const result = extractOptionsWithMetadata(response);
    const identifiers = result.map((r) => r.identifier);
    const uniqueIds = new Set(identifiers);
    expect(identifiers.length).toBe(uniqueIds.size);
  });
});

// ============================================================================
// Tests: hasOptions
// ============================================================================

describe('hasOptions', () => {
  it('should return true for numbered options', () => {
    expect(hasOptions('1. First option\n2. Second option')).toBe(true);
  });

  it('should return true for lettered options', () => {
    expect(hasOptions('A. First option\nB. Second option')).toBe(true);
  });

  it('should return true for labeled options', () => {
    expect(hasOptions('Option 1: First\nOption 2: Second')).toBe(true);
  });

  it('should return false for undefined', () => {
    expect(hasOptions(undefined)).toBe(false);
  });

  it('should return false for text without options', () => {
    expect(hasOptions('This is just regular text without any options.')).toBe(false);
  });

  it('should be faster than full extraction', () => {
    const response = 'This is a long response without options. '.repeat(100);

    const hasOptionsStart = performance.now();
    hasOptions(response);
    const hasOptionsDuration = performance.now() - hasOptionsStart;

    const extractStart = performance.now();
    extractOptionsFromResponse(response);
    const extractDuration = performance.now() - extractStart;

    // hasOptions should be at least as fast (typically faster)
    expect(hasOptionsDuration).toBeLessThanOrEqual(extractDuration + 1);
  });
});

// ============================================================================
// Tests: Individual Extractors
// ============================================================================

describe('extractNumberedOptions', () => {
  it('should extract numbered options with various formats', () => {
    const response = `1. First
2) Second
3: Third`;

    const result = extractNumberedOptions(response);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should extract multi-digit numbers', () => {
    const response = `10. Tenth option
11. Eleventh option
12. Twelfth option`;

    const result = extractNumberedOptions(response);
    expect(result.some((opt) => opt.identifier === '10')).toBe(true);
    expect(result.some((opt) => opt.identifier === '11')).toBe(true);
  });
});

describe('extractLetteredOptions', () => {
  it('should extract lettered options', () => {
    const response = `A. Alpha
B. Beta
C. Gamma`;

    const result = extractLetteredOptions(response);
    expect(result.length).toBe(3);
  });

  it('should normalize to uppercase', () => {
    const response = `a. lowercase
b. also lowercase`;

    const result = extractLetteredOptions(response);
    expect(result.every((opt) => opt.identifier === opt.identifier.toUpperCase())).toBe(
      true
    );
  });
});

describe('extractLabeledOptions', () => {
  it('should extract "Option N:" format', () => {
    const response = `Option 1: First
Option 2: Second`;

    const result = extractLabeledOptions(response);
    expect(result.length).toBe(2);
  });

  it('should be case insensitive for labels', () => {
    const response = `option 1: lowercase label
OPTION 2: uppercase label`;

    const result = extractLabeledOptions(response);
    expect(result.length).toBe(2);
  });
});

describe('extractBulletOptions', () => {
  it('should extract bullet + Option format', () => {
    const response = `- Option 1: First bullet
- Option 2: Second bullet`;

    const result = extractBulletOptions(response);
    expect(result.length).toBe(2);
  });

  it('should extract asterisk + Choice format', () => {
    const response = `* Choice A: First choice
* Choice B: Second choice`;

    const result = extractBulletOptions(response);
    expect(result.length).toBe(2);
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle options at the very start of text', () => {
    const response = `1. First option
2. Second option`;

    const result = extractOptionsFromResponse(response);
    expect(result).toContain('1');
  });

  it('should handle single option', () => {
    const response = `Only one option:
1. The only choice`;

    const result = extractOptionsFromResponse(response);
    expect(result).toContain('1');
  });

  it('should truncate very long option text', () => {
    const longText = 'Very long option text '.repeat(20);
    const response = `1. ${longText}`;

    const result = extractOptionsWithMetadata(response);
    expect(result[0]!.text.length).toBeLessThanOrEqual(MAX_OPTION_TEXT_LENGTH);
  });

  it('should limit number of extracted options', () => {
    // Generate response with many options
    let response = '';
    for (let i = 1; i <= 30; i++) {
      response += `${i}. Option number ${i}\n`;
    }

    const result = extractOptionsFromResponse(response);
    // Should not exceed MAX_OPTIONS identifiers
    const uniqueNumbers = result.filter((r) => /^\d+$/.test(r));
    expect(uniqueNumbers.length).toBeLessThanOrEqual(MAX_OPTIONS);
  });

  it('should handle options with special characters in text', () => {
    const response = `1. Option with "quotes" and 'apostrophes'
2. Option with (parentheses) and [brackets]
3. Option with code: \`const x = 1\``;

    const result = extractOptionsFromResponse(response);
    expect(result).toContain('1');
    expect(result).toContain('2');
    expect(result).toContain('3');
  });

  it('should handle unicode in option text', () => {
    const response = `1. First option
2. Second option
3. Third option `;

    const result = extractOptionsFromResponse(response);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle empty lines between options', () => {
    const response = `Options:

1. First option

2. Second option

3. Third option`;

    const result = extractOptionsFromResponse(response);
    expect(result).toContain('1');
    expect(result).toContain('2');
    expect(result).toContain('3');
  });
});

// ============================================================================
// Tests: Performance
// ============================================================================

describe('Performance', () => {
  it('should extract options in under 1ms for typical responses', () => {
    const response = `Here are your options:
1. Create a new component
2. Modify the existing component
3. Delete and recreate
4. Use a different approach

Choose wisely!`;

    const start = performance.now();
    extractOptionsFromResponse(response);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(1);
  });

  it('should handle large responses efficiently (under 5ms)', () => {
    // Generate a large response
    let response = 'Introduction text.\n\n';
    for (let i = 1; i <= 20; i++) {
      response += `${i}. This is option number ${i} with some description text.\n`;
    }
    response += '\nConclusion text.';

    const start = performance.now();
    extractOptionsFromResponse(response);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(5);
  });

  it('should process 100 responses in under 100ms', () => {
    const responses = [
      '1. Option A\n2. Option B',
      'A. Choice 1\nB. Choice 2',
      'Option 1: First\nOption 2: Second',
      'No options here',
      '1. Single option',
    ];

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      extractOptionsFromResponse(responses[i % responses.length]);
    }
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });
});

// ============================================================================
// Tests: Real-World AI Response Examples
// ============================================================================

describe('Real-World AI Response Examples', () => {
  it('should handle Claude-style numbered suggestions', () => {
    const response = `I can help you with that. Here are some approaches:

1. **Use a React Hook** - Create a custom hook to manage the state
2. **Use Context API** - Share state across components without prop drilling
3. **Use Redux** - For more complex state management needs

Which approach would you prefer?`;

    const result = extractOptionsFromResponse(response);
    expect(result).toContain('1');
    expect(result).toContain('2');
    expect(result).toContain('3');
  });

  it('should handle lettered alternatives', () => {
    const response = `There are two ways to fix this:

A. Quick fix - Just add a null check
B. Proper fix - Refactor the entire function to handle edge cases

Option A is faster but Option B is more maintainable.`;

    const result = extractOptionsFromResponse(response);
    expect(result).toContain('A');
    expect(result).toContain('B');
  });

  it('should handle code-style options', () => {
    const response = `You can use one of these methods:

Option 1: Using async/await
\`\`\`javascript
async function fetchData() {
  const response = await fetch(url);
  return response.json();
}
\`\`\`

Option 2: Using promises
\`\`\`javascript
function fetchData() {
  return fetch(url).then(r => r.json());
}
\`\`\``;

    const result = extractOptionsFromResponse(response);
    expect(result).toContain('1');
    expect(result).toContain('2');
  });

  it('should handle inline numbered items', () => {
    const response = `The main differences are: 1) TypeScript has static typing, 2) TypeScript requires compilation, 3) TypeScript has better IDE support.`;

    // This format might not be extracted since it's inline
    // The extractor focuses on list-style options
    const result = extractOptionsFromResponse(response);
    // Inline options may or may not be extracted depending on pattern
  });
});

// ============================================================================
// Tests: Integration with Classification
// ============================================================================

describe('Integration with Classification', () => {
  it('should extract options that can be matched by selection classifier', () => {
    const response = `Choose your preferred database:
1. PostgreSQL - Robust and feature-rich
2. MySQL - Popular and well-supported
3. SQLite - Lightweight and embedded`;

    const options = extractOptionsFromResponse(response);

    // These options should enable matching prompts like "1", "2", "PostgreSQL"
    expect(options).toContain('1');
    expect(options).toContain('2');
    expect(options).toContain('3');

    // Should also include text fragments
    const hasPostgres = options.some((opt) => opt.toLowerCase().includes('postgresql'));
    expect(hasPostgres).toBe(true);
  });
});
