/**
 * Prompt Types
 * Story 6.2: Prompt Feed with Real-time Updates
 */

import type { PromptAnalysis } from './analysis';

/**
 * Status of prompt analysis
 */
export type AnalysisStatus = 'pending' | 'processing' | 'complete' | 'failed' | 'skipped';

/**
 * Type of prompt classification
 * Story 5.7: Command Prompt Classification
 */
export type PromptType = 'prompt' | 'command' | 'command_with_prompt';

/**
 * Complexity level classification
 * Story 21-4: Prompt Complexity Metrics
 */
export type ComplexityLevel = 'simple' | 'moderate' | 'complex';

/**
 * Prompt record from the database
 */
export interface Prompt {
  id: string;
  team_id: string;
  project_id: string;
  user_id: string;
  text: string;
  analyzed_text: string | null;
  prompt_type: PromptType;
  char_count: number;
  word_count: number;
  created_at: string;
  analysis_status: AnalysisStatus;
  // Session tracking (Story 16-1)
  session_uuid: string | null;
  sequence_number: number | null;
  parent_prompt_id: string | null;
  // Complexity metrics (Story 21-4)
  sentence_count: number | null;
  has_code: boolean;
  has_file_refs: boolean;
  code_block_count: number;
  file_ref_count: number;
  complexity_level: ComplexityLevel | null;
  complexity_score: number | null;
}

/**
 * Prompt with joined analysis data (for feed display)
 */
export interface PromptWithAnalysis extends Prompt {
  analysis: Pick<PromptAnalysis, 'overall_score' | 'dimension_scores'> | null;
}
