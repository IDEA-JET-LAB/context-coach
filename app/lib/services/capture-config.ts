'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { verifySuperAdmin, SuperAdminError } from '@/lib/auth/admin';
import { revalidatePath } from 'next/cache';
import {
  type CaptureConfig,
  type CaptureConfigInput,
  type ActionResult,
  captureConfigSchema,
} from './capture-config-types';
import { clearCaptureConfigCache as _clearCache } from './capture-config-pipeline';

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Helper to handle SuperAdminError in action results.
 */
function handleError(error: unknown): ActionResult<never> {
  if (error instanceof SuperAdminError) {
    return { success: false, error: { code: error.code, message: error.message } };
  }
  console.error('[CaptureConfig] Unexpected error:', error);
  return {
    success: false,
    error: { code: 'UNEXPECTED_ERROR', message: 'An unexpected error occurred' },
  };
}

// ============================================================================
// Server Actions
// ============================================================================

/** Fixed ID for singleton config row */
const CAPTURE_CONFIG_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Get the current capture configuration.
 * Requires super admin access.
 */
export async function getCaptureConfig(): Promise<ActionResult<CaptureConfig>> {
  try {
    await verifySuperAdmin();

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('capture_config')
      .select('*')
      .eq('id', CAPTURE_CONFIG_ID)
      .single();

    if (error) {
      console.error('[CaptureConfig] Failed to fetch config:', error);
      return { success: false, error: { code: 'FETCH_ERROR', message: error.message } };
    }

    if (!data) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Configuration not found' } };
    }

    return {
      success: true,
      data: {
        ...data,
        garbage_patterns: Array.isArray(data.garbage_patterns)
          ? data.garbage_patterns
          : [],
      },
    };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Update capture configuration.
 * Requires super admin access.
 */
export async function updateCaptureConfig(
  input: CaptureConfigInput
): Promise<ActionResult<CaptureConfig>> {
  try {
    const userId = await verifySuperAdmin();

    // Validate input
    const parsed = captureConfigSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: firstError?.message || 'Invalid input',
        },
      };
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('capture_config')
      .update({
        min_prompt_length: parsed.data.min_prompt_length,
        max_prompt_length: parsed.data.max_prompt_length,
        garbage_patterns: parsed.data.garbage_patterns,
        skip_command_only: parsed.data.skip_command_only,
        min_command_args_length: parsed.data.min_command_args_length,
        updated_by: userId,
      })
      .eq('id', CAPTURE_CONFIG_ID)
      .select()
      .single();

    if (error) {
      console.error('[CaptureConfig] Failed to update config:', error);
      return { success: false, error: { code: 'UPDATE_ERROR', message: error.message } };
    }

    // Clear pipeline cache so new config takes effect immediately
    _clearCache();

    // Revalidate admin pages
    revalidatePath('/admin/settings');

    return {
      success: true,
      data: {
        ...data,
        garbage_patterns: Array.isArray(data.garbage_patterns)
          ? data.garbage_patterns
          : [],
      },
    };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Validate a regex pattern.
 * Used by the UI to check patterns before saving.
 */
export async function validatePattern(pattern: string): Promise<ActionResult<boolean>> {
  try {
    await verifySuperAdmin();

    if (!pattern.trim()) {
      return { success: false, error: { code: 'EMPTY_PATTERN', message: 'Pattern cannot be empty' } };
    }

    try {
      new RegExp(pattern);
      return { success: true, data: true };
    } catch {
      return { success: false, error: { code: 'INVALID_REGEX', message: 'Invalid regular expression' } };
    }
  } catch (err) {
    return handleError(err);
  }
}

