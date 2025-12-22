'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

/**
 * Dismisses a failed analysis by marking it as 'dismissed'.
 * The prompt is not deleted, but it's removed from the dead letter queue view.
 *
 * @param promptId - The ID of the prompt to dismiss
 * @returns Success status
 */
export async function dismissFailedAnalysis(
  promptId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();

    // First, verify the prompt exists and is in failed state
    const { data: prompt, error: fetchError } = await supabase
      .from('prompts')
      .select('id, analysis_status')
      .eq('id', promptId)
      .single();

    if (fetchError || !prompt) {
      console.error('[Admin] Prompt not found for dismissal:', promptId);
      return { success: false, error: 'Prompt not found' };
    }

    if (prompt.analysis_status !== 'failed') {
      return { success: false, error: 'Prompt is not in failed state' };
    }

    // Mark as dismissed (we use 'complete' with a special error message)
    // Alternative: Add a 'dismissed' status to the schema
    const { error } = await supabase
      .from('prompts')
      .update({
        analysis_status: 'complete',
        last_analysis_error: '[DISMISSED BY ADMIN]',
      })
      .eq('id', promptId);

    if (error) {
      console.error('[Admin] Error dismissing failed analysis:', error);
      return { success: false, error: error.message };
    }

    console.log(`[Admin] Dismissed failed analysis for prompt ${promptId}`);
    revalidatePath('/admin/system');

    return { success: true };
  } catch (error) {
    console.error('[Admin] Unexpected error dismissing analysis:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Bulk dismisses all failed analyses.
 *
 * @returns Success status and count of dismissed prompts
 */
export async function bulkDismissFailedAnalyses(): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  try {
    const supabase = createAdminClient();

    // Get count of failed prompts
    const { count } = await supabase
      .from('prompts')
      .select('id', { count: 'exact', head: true })
      .eq('analysis_status', 'failed');

    if (!count || count === 0) {
      return { success: true, count: 0 };
    }

    // Dismiss all failed prompts
    const { error } = await supabase
      .from('prompts')
      .update({
        analysis_status: 'complete',
        last_analysis_error: '[DISMISSED BY ADMIN]',
      })
      .eq('analysis_status', 'failed');

    if (error) {
      console.error('[Admin] Error bulk dismissing analyses:', error);
      return { success: false, count: 0, error: error.message };
    }

    console.log(`[Admin] Bulk dismissed ${count} failed analyses`);
    revalidatePath('/admin/system');

    return { success: true, count };
  } catch (error) {
    console.error('[Admin] Unexpected error bulk dismissing analyses:', error);
    return { success: false, count: 0, error: 'An unexpected error occurred' };
  }
}
