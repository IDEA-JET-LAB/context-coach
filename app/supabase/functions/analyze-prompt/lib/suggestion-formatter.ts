// Suggestion Formatter Module for analyze-prompt Edge Function
// Story 5.3: Improvement Suggestions
// Formats and structures suggestions for storage and display

import { getFallbackSuggestion, getSuggestionType } from './fallback-suggestions.ts';

/**
 * Dimension score with optional AI-generated suggestion
 */
export interface DimensionScoreWithSuggestion {
  name: string;
  score: number;
  weight: number;
  reasoning: string;
  suggestion?: string;
  example?: string;
}

/**
 * Formatted suggestion for output
 */
export interface FormattedSuggestion {
  dimension: string;
  type: 'improvement' | 'reinforcement' | 'next_level';
  message: string;
  example?: string;
  priority: number;
}

/**
 * Stored suggestions structure for JSONB column
 */
export interface StoredSuggestions {
  byDimension: Record<string, {
    type: 'improvement' | 'reinforcement' | 'next_level';
    message: string;
    example?: string;
  }>;
  prioritized: string[]; // Top 3 dimension names in priority order (lowest scores)
  generatedAt: string; // ISO timestamp
}

/**
 * Maximum character length for suggestion messages
 */
const MAX_SUGGESTION_LENGTH = 500;

/**
 * Truncates a string to the specified max length
 * @param text The text to truncate
 * @param maxLength Maximum allowed length
 * @returns Truncated text with ellipsis if needed
 */
function truncate(text: string, maxLength: number = MAX_SUGGESTION_LENGTH): string {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Sanitizes text for screen reader compatibility
 * Removes special characters that might break TTS
 * @param text The text to sanitize
 * @returns Sanitized text
 */
function sanitizeForScreenReader(text: string): string {
  if (!text) return text;
  // Remove problematic characters for TTS while keeping punctuation
  return text
    .replace(/[<>{}[\]\\|^~`]/g, '') // Remove brackets and special chars
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Ensures coaching-positive language in suggestions
 * Replaces negative phrasings with positive alternatives
 * @param message The suggestion message
 * @returns Message with coaching-positive language
 */
function ensureCoachingPositiveLanguage(message: string): string {
  if (!message) return message;

  const replacements: [RegExp, string][] = [
    [/\byou failed to\b/gi, 'consider'],
    [/\byou didn't\b/gi, 'try'],
    [/\bmissing\b/gi, 'try adding'],
    [/\blacking\b/gi, 'could benefit from'],
    [/\bweak\b/gi, 'could be strengthened'],
    [/\bpoor\b/gi, 'could be enhanced'],
    [/\bbad\b/gi, 'could be improved'],
    [/\bwrong\b/gi, 'could be adjusted'],
    [/\bdon't\b/gi, 'consider not'],
    [/\bshould have\b/gi, 'could include'],
    [/\bfailed\b/gi, 'could be improved'],
    [/\bneeds work\b/gi, 'has room for enhancement'],
  ];

  let result = message;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

/**
 * Formats dimension scores into structured suggestions
 * @param dimensionScores Array of dimension scores with optional suggestions
 * @returns Array of formatted suggestions sorted by priority (lowest score first)
 */
export function formatSuggestions(dimensionScores: DimensionScoreWithSuggestion[]): FormattedSuggestion[] {
  return dimensionScores
    .map((score) => {
      const type = getSuggestionType(score.score);
      const rawMessage = score.suggestion || getFallbackSuggestion(score.name, score.score);
      const message = sanitizeForScreenReader(
        ensureCoachingPositiveLanguage(
          truncate(rawMessage)
        )
      );

      return {
        dimension: score.name,
        type,
        message,
        example: score.example ? sanitizeForScreenReader(truncate(score.example, 200)) : undefined,
        priority: score.score, // Lower score = higher priority for improvement
      };
    })
    .sort((a, b) => a.priority - b.priority); // Sort by score ascending (lowest first)
}

/**
 * Builds the stored suggestions structure for JSONB column
 * @param formattedSuggestions Array of formatted suggestions
 * @returns StoredSuggestions object ready for database storage
 */
export function buildStoredSuggestions(formattedSuggestions: FormattedSuggestion[]): StoredSuggestions {
  const byDimension: StoredSuggestions['byDimension'] = {};

  for (const suggestion of formattedSuggestions) {
    byDimension[suggestion.dimension] = {
      type: suggestion.type,
      message: suggestion.message,
      ...(suggestion.example && { example: suggestion.example }),
    };
  }

  // Get top 3 dimensions in priority order (already sorted by score ascending)
  const prioritized = formattedSuggestions
    .slice(0, 3)
    .map((s) => s.dimension);

  return {
    byDimension,
    prioritized,
    generatedAt: new Date().toISOString(),
  };
}
