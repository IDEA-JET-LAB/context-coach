// Fallback Suggestions Module for analyze-prompt Edge Function
// Story 5.3: Improvement Suggestions
// Provides generic suggestions when AI fails to generate specific ones

/**
 * Fallback improvement suggestions for each dimension
 * Used when AI response lacks proper suggestion for scores 1-7
 */
const FALLBACK_IMPROVEMENTS: Record<string, string> = {
  clarity: "Consider breaking down complex requests into clear, numbered steps.",
  context: "Try adding background information about your project or constraints.",
  specificity: "Include specific details like file names or expected formats.",
  goal: "Clearly state what you want to achieve and how you'll know success.",
  constraints: "Mention any limitations or preferences that should guide the response.",
};

/**
 * Fallback reinforcement messages for each dimension
 * Used when AI response lacks proper suggestion for scores 10
 */
const FALLBACK_REINFORCEMENTS: Record<string, string> = {
  clarity: "Excellent clarity! Your request is easy to understand.",
  context: "Great context provided! The background frames the problem well.",
  specificity: "Impressive specificity! Detailed requirements make this actionable.",
  goal: "Clear goal definition! Success criteria are obvious.",
  constraints: "Well-defined constraints! Boundaries focus the response.",
};

/**
 * Fallback next-level suggestions for each dimension
 * Used when AI response lacks proper suggestion for scores 8-9
 */
const FALLBACK_NEXT_LEVEL: Record<string, string> = {
  clarity: "Great clarity! For even more impact, consider adding example outputs.",
  context: "Strong context! You could optionally mention related past decisions.",
  specificity: "Good detail level! Consider including edge cases to handle.",
  goal: "Well-defined goal! Adding measurable success criteria could elevate it further.",
  constraints: "Nice constraint definition! Adding priority order could help even more.",
};

/**
 * Score thresholds for fallback suggestions
 */
const SCORE_THRESHOLD_REINFORCEMENT = 10; // Perfect score
const SCORE_THRESHOLD_ADVANCED = 8; // Good, room for advanced tips

/**
 * Gets the appropriate fallback suggestion based on dimension and score
 * @param dimension The dimension name (lowercase)
 * @param score The dimension score (1-10)
 * @returns A fallback suggestion message
 */
export function getFallbackSuggestion(dimension: string, score: number): string {
  const normalizedDimension = dimension.toLowerCase();

  if (score >= SCORE_THRESHOLD_REINFORCEMENT) {
    return FALLBACK_REINFORCEMENTS[normalizedDimension] || "Great job on this dimension!";
  }

  if (score >= SCORE_THRESHOLD_ADVANCED) {
    return FALLBACK_NEXT_LEVEL[normalizedDimension] || "Good work! Consider adding more detail for even better results.";
  }

  return FALLBACK_IMPROVEMENTS[normalizedDimension] || "Consider adding more detail to improve this aspect.";
}

/**
 * Score thresholds for suggestion types
 * Magic numbers replaced with named constants for clarity and maintainability
 */
const SCORE_THRESHOLD_IMPROVEMENT = 7; // Scores 1-7: Need improvement
const SCORE_THRESHOLD_NEXT_LEVEL = 9; // Scores 8-9: Good but can be enhanced
// Scores 10: Excellent, deserves reinforcement

/**
 * Gets the suggestion type based on score
 * @param score The dimension score (1-10)
 * @returns The suggestion type
 */
export function getSuggestionType(score: number): 'improvement' | 'next_level' | 'reinforcement' {
  if (score <= SCORE_THRESHOLD_IMPROVEMENT) return 'improvement';
  if (score <= SCORE_THRESHOLD_NEXT_LEVEL) return 'next_level';
  return 'reinforcement';
}
