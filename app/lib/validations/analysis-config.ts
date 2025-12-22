import { z } from 'zod';

export const dimensionSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Dimension name is required').max(100),
  description: z.string().max(500).default(''),
  weight: z.number().min(0, 'Weight must be at least 0').max(100, 'Weight cannot exceed 100'),
  prompt_template: z.string().min(1, 'Prompt template is required'),
  scoring_criteria: z.string().min(1, 'Scoring criteria is required'),
  sort_order: z.number().default(0),
  enabled: z.boolean().default(true),
});

export const analysisConfigSchema = z.object({
  name: z.string().min(1, 'Version name is required').max(100),
  system_prompt: z.string().min(1, 'System prompt is required'),
  model: z.enum(['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet', 'claude-3-5-haiku'], {
    message: 'AI model is required',
  }),
  dimensions: z
    .array(dimensionSchema)
    .min(1, 'At least one dimension is required')
    .refine(
      (dims) => dims.reduce((sum, d) => sum + d.weight, 0) === 100,
      'Dimension weights must sum to 100'
    ),
});

export const updateConfigSchema = analysisConfigSchema.partial().extend({
  id: z.string().uuid(),
});

// Use z.input for form types (allows optionals before parsing)
export type DimensionFormInput = z.input<typeof dimensionSchema>;
export type AnalysisConfigFormInput = z.input<typeof analysisConfigSchema>;

// Use z.infer for validated types (after parsing with defaults applied)
export type DimensionInput = z.infer<typeof dimensionSchema>;
export type AnalysisConfigInput = z.infer<typeof analysisConfigSchema>;
export type UpdateConfigInput = z.infer<typeof updateConfigSchema>;

// Model options for UI
export const AI_MODEL_OPTIONS = [
  { value: 'gpt-4o', label: 'GPT-4o', provider: 'OpenAI' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'OpenAI' },
  { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { value: 'claude-3-5-haiku', label: 'Claude 3.5 Haiku', provider: 'Anthropic' },
] as const;

// TypeScript types matching database schema
export interface AnalysisConfig {
  id: string;
  version: number;
  name: string;
  system_prompt: string;
  model: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface AnalysisDimension {
  id: string;
  config_id: string;
  name: string;
  description: string;
  weight: number;
  prompt_template: string;
  scoring_criteria: string;
  enabled: boolean;
  sort_order: number;
}

export interface AnalysisConfigWithDimensions extends AnalysisConfig {
  analysis_dimensions: AnalysisDimension[];
}
