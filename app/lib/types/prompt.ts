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
}

/**
 * Prompt with joined analysis data (for feed display)
 */
export interface PromptWithAnalysis extends Prompt {
  analysis: Pick<PromptAnalysis, 'overall_score' | 'dimension_scores'> | null;
}
