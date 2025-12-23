/**
 * Types for A/B Experiment system
 * Story 22.6: A/B Experiment Creation
 */

export type ExperimentStatus =
  | 'draft'
  | 'active'
  | 'running'
  | 'paused'
  | 'analyzing'
  | 'completed';

export interface Experiment {
  id: string;
  name: string;
  hypothesis: string;
  status: ExperimentStatus;
  traffic_percentage: number;
  min_sample_size: number;
  min_duration_hours: number;
  significance_threshold: number;
  success_metric: string;
  auto_promote_winner: boolean;
  created_at: string;
  updated_at: string;
  activated_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  winner_variant: 'control' | 'variant' | 'inconclusive' | null;
  p_value: number | null;
  effect_size: number | null;
  confidence_interval: { lower: number; upper: number } | null;
}

export interface ExperimentVariant {
  id: string;
  experiment_id: string;
  variant_name: 'control' | 'variant';
  config_id: string;
  config_snapshot: ExperimentConfigSnapshot | null;
  sample_count: number;
  mean_score: number | null;
  std_deviation: number | null;
  created_at: string;
}

export interface ExperimentConfigSnapshot {
  id: string;
  name: string;
  version: number;
  model: string;
  system_prompt: string;
  dimensions: {
    name: string;
    weight: number;
    enabled: boolean;
    description: string;
    prompt_template: string;
    scoring_criteria: string;
  }[];
}

export interface ExperimentAssignment {
  id: string;
  experiment_id: string;
  user_id: string;
  variant_name: 'control' | 'variant';
  assigned_at: string;
}

export interface ExperimentWithVariants extends Experiment {
  variants: ExperimentVariant[];
}

export interface ExperimentWithDetails extends ExperimentWithVariants {
  control_config?: {
    id: string;
    name: string;
    version: number;
  };
  variant_config?: {
    id: string;
    name: string;
    version: number;
  };
}

export interface CreateExperimentInput {
  name: string;
  hypothesis: string;
  control_config_id: string;
  variant_config_id: string;
  traffic_percentage?: number;
  min_sample_size?: number;
  min_duration_hours?: number;
  significance_threshold?: number;
  success_metric?: string;
  auto_promote_winner?: boolean;
}

export interface UpdateExperimentInput {
  name?: string;
  hypothesis?: string;
  control_config_id?: string;
  variant_config_id?: string;
  traffic_percentage?: number;
  min_sample_size?: number;
  min_duration_hours?: number;
  significance_threshold?: number;
  success_metric?: string;
  auto_promote_winner?: boolean;
}

// Success metrics available for experiments
export const SUCCESS_METRICS = [
  { value: 'overall_score', label: 'Overall Score', description: 'Weighted average of all dimensions' },
  { value: 'clarity', label: 'Clarity Score', description: 'Clarity dimension score' },
  { value: 'context', label: 'Context Score', description: 'Context dimension score' },
  { value: 'specificity', label: 'Specificity Score', description: 'Specificity dimension score' },
  { value: 'goal', label: 'Goal Definition Score', description: 'Goal dimension score' },
  { value: 'constraints', label: 'Constraints Score', description: 'Constraints dimension score' },
] as const;

// Duration options for experiment minimum run time
export const DURATION_OPTIONS = [
  { value: 24, label: '1 day' },
  { value: 48, label: '2 days' },
  { value: 72, label: '3 days' },
  { value: 168, label: '1 week' },
  { value: 336, label: '2 weeks' },
  { value: 720, label: '30 days' },
] as const;

// Status badge colors
export const STATUS_COLORS: Record<ExperimentStatus, { bg: string; text: string }> = {
  draft: { bg: 'bg-muted', text: 'text-muted-foreground' },
  active: { bg: 'bg-blue-500/20', text: 'text-blue-500' },
  running: { bg: 'bg-green-500/20', text: 'text-green-500' },
  paused: { bg: 'bg-amber-500/20', text: 'text-amber-500' },
  analyzing: { bg: 'bg-purple-500/20', text: 'text-purple-500' },
  completed: { bg: 'bg-muted', text: 'text-muted-foreground' },
};
