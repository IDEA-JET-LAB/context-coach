'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

/**
 * Retries analysis for a single failed prompt.
 * Resets the analysis status to 'pending' and clears retry count.
 *
 * @param promptId - The ID of the prompt to retry
 * @returns Success status
 */
export async function retryAnalysis(promptId: string): Promise<{ success: boolean; error?: string }> {
  try {
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

    // Trigger analysis Edge Function (optional - depends on implementation)
    // The trigger on the prompts table should handle this automatically
    // when analysis_status changes to 'pending'

    console.log(`[Admin] Retried analysis for prompt ${promptId}`);
    revalidatePath('/admin/system');

    return { success: true };
  } catch (error) {
    console.error('[Admin] Unexpected error retrying analysis:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Bulk retries all failed analyses (up to 100 at a time).
 * Processes in batches to avoid overloading the system.
 *
 * @returns Success status and count of retried prompts
 */
export async function bulkRetryAnalysis(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
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

    console.log(`[Admin] Bulk retried ${failed.length} analyses`);
    revalidatePath('/admin/system');

    return { success: true, count: failed.length };
  } catch (error) {
    console.error('[Admin] Unexpected error bulk retrying analyses:', error);
    return { success: false, count: 0, error: 'An unexpected error occurred' };
  }
}
