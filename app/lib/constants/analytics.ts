/**
 * Analytics constants
 * Centralizes magic numbers and hardcoded values for analytics components
 */

// Score thresholds for color coding
export const SCORE_THRESHOLDS = {
  GOOD: 7,
  MODERATE: 4,
} as const;

// Score display precision
export const SCORE_DECIMAL_PLACES = 1;

// Chart dimensions
export const CHART_HEIGHT = {
  TREND: 300,
  DISTRIBUTION: 250,
} as const;

// Dimension improvement suggestions
export const DIMENSION_SUGGESTIONS: Record<string, string> = {
  clarity: 'Try using more specific language and avoid ambiguous terms.',
  context: 'Include more background information about your situation or codebase.',
  specificity: 'Add concrete examples and specific requirements.',
  goal: 'Clearly state what you want to achieve or the expected outcome.',
  constraints: 'Mention any limitations, requirements, or boundaries.',
} as const;

// Default fallback suggestion for dimensions not in the map
export const DEFAULT_DIMENSION_SUGGESTION = (dimension: string) =>
  `Focus on improving your ${dimension.toLowerCase()} scores.`;

// Number of weak dimensions to show in focus areas
export const FOCUS_AREA_COUNT = 2;

// Number of recent prompts to display in member detail
export const RECENT_PROMPTS_DISPLAY_COUNT = 5;

// Text truncation limits
export const TEXT_TRUNCATION = {
  PROMPT_ROW: 150,
  MEMBER_DETAIL: 100,
} as const;
