/**
 * Analysis Configuration Types
 * Story 5.6: Analysis Configuration Management
 *
 * Types for analysis configuration and dimensions used by the AI Analysis Engine.
 */

/**
 * Analysis configuration version
 * Defines the system prompt, model, and associated dimensions for scoring prompts.
 */
export interface AnalysisConfig {
  /** UUID primary key */
  id: string;
  /** Monotonically increasing version number */
  version: number;
  /** Human-readable name for this config version */
  name: string;
  /** System prompt sent to the AI model for analysis */
  system_prompt: string;
  /** AI model to use for analysis (e.g., 'gpt-4o-mini') */
  model: string;
  /** Whether this is the active config (only one can be active) */
  is_active: boolean;
  /** User ID who created this config (null for seed data) */
  created_by: string | null;
  /** When this config was created */
  created_at: string;
  /** Associated dimensions (optional, included in queries with select) */
  analysis_dimensions?: AnalysisDimension[];
}

/**
 * Scoring dimension within an analysis config
 * Defines a single dimension like "Clarity" or "Context" with its weight and scoring criteria.
 */
export interface AnalysisDimension {
  /** UUID primary key */
  id: string;
  /** Reference to parent analysis config */
  config_id: string;
  /** Dimension name (e.g., 'Clarity', 'Context', 'Specificity') */
  name: string;
  /** Human-readable description of what this dimension measures */
  description: string;
  /** Percentage weight for this dimension (0-100, all enabled must sum to 100) */
  weight: number;
  /** Template text for the AI to evaluate this dimension */
  prompt_template: string;
  /** Criteria describing score ranges (1-10) */
  scoring_criteria: string;
  /** Whether this dimension is currently enabled for scoring */
  enabled: boolean;
  /** Display order for this dimension */
  sort_order: number;
}

/**
 * Form data for creating/updating a config
 * Used in admin UI for config management
 */
export interface ConfigFormData {
  name: string;
  system_prompt: string;
  model: string;
  dimensions: Omit<AnalysisDimension, "id" | "config_id">[];
}

/**
 * Error codes for config mutations
 */
export type ConfigMutationError = {
  code: "WEIGHTS_INVALID" | "VERSION_EXISTS" | "UNAUTHORIZED" | "UNKNOWN";
  message: string;
};
