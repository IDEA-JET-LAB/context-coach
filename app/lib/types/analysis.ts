/**
 * Analysis Types
 * Story 5.4: Analysis Storage
 *
 * Types for prompt analysis results stored in the prompt_analyses table.
 */

/**
 * Score for a single dimension with reasoning
 * Stored as JSONB in dimension_scores column
 */
export interface DimensionScore {
  /** Score from 1-10 for this dimension */
  score: number;
  /** AI reasoning explaining the score */
  reasoning: string;
}

/**
 * Map of dimension names to their scores
 * Example: { "Clarity": { score: 8, reasoning: "..." }, "Context": { score: 7, reasoning: "..." } }
 */
export type DimensionScores = Record<string, DimensionScore>;

/**
 * Suggestion for a single dimension
 */
export interface DimensionSuggestion {
  /** Type of feedback: reinforcement (good) or improvement (needs work) */
  type: "reinforcement" | "improvement";
  /** Actionable message for the user */
  message: string;
  /** Optional example of improved prompt */
  example?: string;
}

/**
 * Suggestions structure stored in the suggestions JSONB column
 */
export interface Suggestions {
  /** Suggestions organized by dimension name */
  byDimension: Record<string, DimensionSuggestion>;
  /** Ordered list of dimensions to prioritize for improvement */
  prioritized: string[];
  /** ISO 8601 timestamp when suggestions were generated */
  generatedAt: string;
}

/**
 * Full prompt analysis record from the database
 */
export interface PromptAnalysis {
  /** UUID primary key */
  id: string;
  /** Reference to the analyzed prompt */
  prompt_id: string;
  /** Reference to the analysis config version used */
  config_id: string;
  /** Overall score from 1.0 to 10.0 */
  overall_score: number;
  /** Scores and reasoning for each dimension */
  dimension_scores: DimensionScores;
  /** Improvement suggestions and prioritization */
  suggestions: Suggestions;
  /** When the analysis was created */
  created_at: string;
}

/**
 * Analysis result for storage (used by Edge Function)
 */
export interface AnalysisResult {
  promptId: string;
  configId: string;
  overallScore: number;
  dimensionScores: DimensionScores;
  suggestions: Suggestions;
}

/**
 * Analysis with related prompt data (for dashboard views)
 */
export interface PromptAnalysisWithPrompt extends PromptAnalysis {
  prompt: {
    id: string;
    text: string;
    char_count: number;
    word_count: number;
    user_id: string;
    created_at: string;
  };
}
