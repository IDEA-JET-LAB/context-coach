/**
 * ReDoS Detector
 * Story 22-2: Classification Rule Editor
 *
 * Detects potential Regular Expression Denial of Service (ReDoS) vulnerabilities.
 *
 * Common dangerous patterns:
 * - Nested quantifiers: (a+)+
 * - Overlapping alternations: (a|a)+
 * - Greedy quantifiers with backtracking: .*.*
 */

import type { RedosRisk, RedosAnalysis } from '@/lib/types/classification-rules';

export type { RedosRisk, RedosAnalysis };

/**
 * Analyzes a regex pattern for potential ReDoS vulnerabilities.
 *
 * @param pattern - The regex pattern to analyze
 * @returns Analysis result with risk level, issues, and suggestions
 */
export function analyzePattern(pattern: string): RedosAnalysis {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Handle empty pattern
  if (!pattern) {
    return { risk: 'safe', issues: [], suggestions: [] };
  }

  // Check for valid regex syntax first
  try {
    new RegExp(pattern);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      risk: 'warning',
      issues: [`Invalid regex syntax: ${message}`],
      suggestions: ['Fix the regex syntax error before proceeding.'],
    };
  }

  // Check for nested quantifiers: (pattern+)+ or (pattern*)* or (pattern*)+
  // This is the most common ReDoS pattern
  const nestedQuantifierPatterns = [
    /\([^)]*[+*]\)[+*?]/, // (x+)+ or (x+)* or (x+)?
    /\([^)]*\{[^}]+\}\)[+*]/, // (x{n,m})+
    /\(\[[^\]]*\][+*]\)[+*]/, // ([abc]+)+
    /\(\\[wWdDsS][+*]\)[+*]/, // (\w+)+ or (\d+)+
    /\(\.[+*]\)[+*]/, // (.+)+
  ];

  for (const testPattern of nestedQuantifierPatterns) {
    if (testPattern.test(pattern)) {
      issues.push(
        'Nested quantifiers detected (e.g., (a+)+). This can cause exponential backtracking.'
      );
      suggestions.push(
        'Replace nested quantifiers with atomic groups or possessive quantifiers.',
        'Consider using more specific character classes instead of .'
      );
      break;
    }
  }

  // Check for overlapping alternations: (a|a)+
  // Matches patterns like (x|x)+ where both alternatives can match same input
  const overlappingAltPatterns = [
    /\(([^|()]+)\|\1\)[+*]/, // (a|a)+ - exact duplicate
    /\(\.?\*\|\.?\*\)[+*]/, // (.*|.*)+ - wildcard duplicates
  ];

  for (const testPattern of overlappingAltPatterns) {
    if (testPattern.test(pattern)) {
      issues.push(
        'Overlapping alternations detected. Matches can be ambiguous causing backtracking.'
      );
      suggestions.push('Make alternation branches mutually exclusive.');
      break;
    }
  }

  // Check for .* followed by another quantified pattern (potential backtracking)
  // But only flag it if followed by another .* or complex pattern
  const greedyDotPatterns = [
    /\.\*.*\.\*/, // .*...* (two greedy dots)
    /\.\*\.[+*]/, // .*.+ or .*.*
  ];

  for (const testPattern of greedyDotPatterns) {
    if (testPattern.test(pattern)) {
      if (!issues.some((i) => i.includes('Greedy'))) {
        issues.push(
          'Greedy .* may cause excessive backtracking on non-matching input.'
        );
        suggestions.push(
          "Consider using .*? (lazy) or more specific patterns.",
          'Anchor the pattern with ^ or $ where possible.'
        );
      }
      break;
    }
  }

  // Single greedy .* without lazy modifier (less severe, just warning)
  if (!issues.length && /\.\*[^?]/.test(pattern) && !/\.\*\?/.test(pattern)) {
    // Only warn if there's potential for backtracking
    const hasTrailingPattern = /\.\*[^?$]/.test(pattern);
    if (hasTrailingPattern) {
      issues.push(
        'Greedy .* followed by other patterns may cause backtracking.'
      );
      suggestions.push('Consider using .*? (lazy) instead of .* (greedy).');
    }
  }

  // Check for consecutive quantified patterns that can overlap
  const consecutiveQuantifiers = [
    /[+*]\w*[+*]/, // a+b+ where both can match same chars
  ];

  // Timeout-based safety test for patterns with issues
  let timeoutFailed = false;
  if (issues.length > 0) {
    const isSafe = testPatternSafety(pattern, 50);
    if (!isSafe) {
      timeoutFailed = true;
      issues.push('Pattern took too long on crafted input (possible ReDoS).');
      suggestions.push(
        'Simplify the pattern or add constraints to limit backtracking.'
      );
    }
  }

  // Determine risk level
  let risk: RedosRisk = 'safe';
  if (issues.length > 0 && timeoutFailed) {
    risk = 'dangerous';
  } else if (issues.length > 0) {
    // Check if it's a truly dangerous pattern
    const hasDangerousPattern =
      nestedQuantifierPatterns.some((p) => p.test(pattern)) ||
      overlappingAltPatterns.some((p) => p.test(pattern));
    risk = hasDangerousPattern ? 'dangerous' : 'warning';
  }

  return { risk, issues, suggestions };
}

/**
 * Tests if a regex pattern executes within a safe time limit.
 *
 * @param pattern - The regex pattern to test
 * @param timeoutMs - Maximum allowed execution time in milliseconds (default: 100)
 * @returns true if pattern is safe, false if it times out or is invalid
 */
export function testPatternSafety(
  pattern: string,
  timeoutMs: number = 100
): boolean {
  try {
    const regex = new RegExp(pattern, 'i');

    // Craft inputs that trigger exponential backtracking
    const testInputs = [
      'a'.repeat(30) + '!', // For nested quantifier patterns
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaab', // For (a+)+ with trailing b
      'x'.repeat(25) + 'y', // General backtracking test
    ];

    for (const evilInput of testInputs) {
      const start = performance.now();
      regex.test(evilInput);
      const elapsed = performance.now() - start;

      if (elapsed >= timeoutMs) {
        return false;
      }
    }

    return true;
  } catch {
    // Invalid pattern or execution error
    return false;
  }
}

/**
 * Quick check if a pattern is likely safe without full analysis.
 * Useful for filtering before detailed analysis.
 *
 * @param pattern - The regex pattern to check
 * @returns true if pattern appears safe, false if it needs detailed analysis
 */
export function isLikelySafe(pattern: string): boolean {
  // Patterns with nested quantifiers are never quick-safe
  if (/\([^)]*[+*]\)[+*]/.test(pattern)) {
    return false;
  }

  // Patterns with multiple .* are suspicious
  if ((pattern.match(/\.\*/g) || []).length > 1) {
    return false;
  }

  // Simple word boundary patterns are safe
  if (/^\\b\([^)]+\)\\b$/.test(pattern)) {
    return true;
  }

  // Simple alternation without quantifiers on groups is safe
  if (/^\([\w|]+\)$/.test(pattern)) {
    return true;
  }

  return true;
}
