import { z } from 'zod';

// ============================================================================
// Types
// ============================================================================

/**
 * Capture configuration from database.
 */
export interface CaptureConfig {
  id: string;
  min_prompt_length: number;
  max_prompt_length: number;
  garbage_patterns: string[];
  skip_command_only: boolean;
  min_command_args_length: number;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

/**
 * Input for updating capture configuration.
 */
export interface CaptureConfigInput {
  min_prompt_length: number;
  max_prompt_length: number;
  garbage_patterns: string[];
  skip_command_only: boolean;
  min_command_args_length: number;
}

/**
 * Action result type for consistent error handling.
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

// ============================================================================
// Validation
// ============================================================================

/**
 * Schema for validating capture config updates.
 */
export const captureConfigSchema = z.object({
  min_prompt_length: z
    .number()
    .int()
    .min(0, 'Minimum length must be at least 0')
    .max(1000, 'Minimum length cannot exceed 1000'),
  max_prompt_length: z
    .number()
    .int()
    .min(100, 'Maximum length must be at least 100')
    .max(1000000, 'Maximum length cannot exceed 1,000,000'),
  garbage_patterns: z
    .array(z.string().min(1, 'Pattern cannot be empty'))
    .max(50, 'Cannot have more than 50 patterns'),
  skip_command_only: z.boolean(),
  min_command_args_length: z
    .number()
    .int()
    .min(0, 'Minimum args length must be at least 0')
    .max(1000, 'Minimum args length cannot exceed 1000'),
}).refine(
  (data) => data.min_prompt_length < data.max_prompt_length,
  {
    message: 'Minimum length must be less than maximum length',
    path: ['min_prompt_length'],
  }
);
