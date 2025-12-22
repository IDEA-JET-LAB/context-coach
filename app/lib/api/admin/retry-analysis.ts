'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { verifySuperAdmin, SuperAdminError } from '@/lib/auth/admin';
import { revalidatePath } from 'next/cache';
import {
  adminBulkRateLimit,
  adminSingleRateLimit,
  checkRateLimit,
  calculateRetryAfter,
} from '@/lib/rate-limit';
import { logAdminAction } from '@/lib/services/admin-users';

/**
 * Retries analysis for a single failed prompt.
 * Resets the analysis status to 'pending' and clears retry count.
 * Requires super admin access.
 *
 * M38 Fix: Added rate limiting to prevent abuse.
 *
 * @param promptId - The ID of the prompt to retry
 * @returns Success status
 */
export async function retryAnalysis(promptId: string): Promise<{ success: boolean; error?: string; retryAfter?: string }> {
  try {
    // Verify super admin access before any operations
    const adminId = await verifySuperAdmin();

    // M38 Fix: Apply rate limiting for single retry operations
    const rateLimitResult = await checkRateLimit(adminSingleRateLimit, adminId);
    if (!rateLimitResult.success) {
      const retryAfter = calculateRetryAfter(rateLimitResult.reset);
      console.warn(`[Admin] Rate limit exceeded for retry operation by admin ${adminId}`);
      return {
        success: false,
        error: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
        retryAfter,
      };
    }

    const supabase = createAdminClient();

    const { error } = await supabase
      .from('prompts')
      .update({
        analysis_status: 'pending',
        analysis_attempts: 0,
        last_analysis_error: null,
        last_analysis_attempt_at: null,
      })
      .eq('id', promptId);

    if (error) {
      console.error('[Admin] Error retrying analysis:', error);
      return { success: false, error: error.message };
    }

    // M37 Fix: Log the retry action to audit trail
    await logAdminAction(adminId, 'retry_analysis', { promptId });

    // Trigger analysis Edge Function (optional - depends on implementation)
    // The trigger on the prompts table should handle this automatically
    // when analysis_status changes to 'pending'

    console.log(`[Admin] Retried analysis for prompt ${promptId}`);
    revalidatePath('/admin/system');

    return { success: true };
  } catch (error) {
    if (error instanceof SuperAdminError) {
      return { success: false, error: error.message };
    }
    console.error('[Admin] Unexpected error retrying analysis:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Bulk retries all failed analyses (up to 100 at a time).
 * Processes in batches to avoid overloading the system.
 * Requires super admin access.
 *
 * M38 Fix: Added stricter rate limiting for bulk operations.
 *
 * @returns Success status and count of retried prompts
 */
export async function bulkRetryAnalysis(): Promise<{ success: boolean; count: number; error?: string; retryAfter?: string }> {
  try {
    // Verify super admin access before any operations
    const adminId = await verifySuperAdmin();

    // M38 Fix: Apply stricter rate limiting for bulk operations (5 per hour)
    const rateLimitResult = await checkRateLimit(adminBulkRateLimit, adminId);
    if (!rateLimitResult.success) {
      const retryAfter = calculateRetryAfter(rateLimitResult.reset);
      console.warn(`[Admin] Rate limit exceeded for bulk retry by admin ${adminId}`);
      return {
        success: false,
        count: 0,
        error: `Bulk operation rate limit exceeded. Maximum 5 bulk retries per hour. Please try again in ${retryAfter} seconds.`,
        retryAfter,
      };
    }

    const supabase = createAdminClient();

    // Get failed prompts (limit to 100 for batch processing)
    const { data: failed } = await supabase
      .from('prompts')
      .select('id')
      .eq('analysis_status', 'failed')
      .limit(100);

    if (!failed?.length) {
      return { success: true, count: 0 };
    }

    // Reset all failed prompts
    const { error } = await supabase
      .from('prompts')
      .update({
        analysis_status: 'pending',
        analysis_attempts: 0,
        last_analysis_error: null,
        last_analysis_attempt_at: null,
      })
      .in(
        'id',
        failed.map((p) => p.id)
      );

    if (error) {
      console.error('[Admin] Error bulk retrying analyses:', error);
      return { success: false, count: 0, error: error.message };
    }

    // M37 Fix: Log the bulk retry action to audit trail
    await logAdminAction(adminId, 'bulk_retry_analysis', {
      promptCount: failed.length,
      promptIds: failed.map((p) => p.id),
    });

    console.log(`[Admin] Bulk retried ${failed.length} analyses`);
    revalidatePath('/admin/system');

    return { success: true, count: failed.length };
  } catch (error) {
    if (error instanceof SuperAdminError) {
      return { success: false, count: 0, error: error.message };
    }
    console.error('[Admin] Unexpected error bulk retrying analyses:', error);
    return { success: false, count: 0, error: 'An unexpected error occurred' };
  }
}
