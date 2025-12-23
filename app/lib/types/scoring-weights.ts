/**
 * Scoring Weight Configuration Types
 *
 * Types for managing dimension weights in the analysis configuration.
 */

export interface DimensionWeight {
  id: string;
  name: string;
  description: string;
  weight: number;
  enabled: boolean;
  prompt_template?: string;
  scoring_criteria?: string;
  sort_order: number;
  minWeight?: number; // Optional minimum (e.g., 5%)
  maxWeight?: number; // Optional maximum (e.g., 50%)
}

export interface WeightConfiguration {
  config_id: string;
  config_version: number;
  config_name: string;
  is_active: boolean;
  dimensions: DimensionWeight[];
  total: number;
  is_valid: boolean;
}

export interface WeightChange {
  dimension_id: string;
  dimension_name: string;
  old_weight: number;
  new_weight: number;
  old_enabled?: boolean;
  new_enabled?: boolean;
}

export interface WeightSaveRequest {
  config_id: string;
  weights: Array<{
    dimension_id: string;
    weight: number;
    enabled: boolean;
  }>;
}

export interface WeightHistoryEntry {
  id: string;
  created_at: string;
  admin_id: string;
  admin_email?: string;
  action: 'weight_update';
  changes: WeightChange[];
  total_weight: number;
}

export interface ScorePreviewResult {
  samplePrompts: {
    id: string;
    text: string;
    originalScore: number;
    newScore: number;
    dimensionScores: Record<string, { original: number; new: number }>;
  }[];
  averageChange: number;
}
