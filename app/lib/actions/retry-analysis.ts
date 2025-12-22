'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function retryAnalysis(promptId: string): Promise<void> {
  const supabase = await createClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  // Verify user has access to this prompt via team
  const { data: prompt, error: fetchError } = await supabase
    .from('prompts')
    .select('id, team_id')
    .eq('id', promptId)
    .single();

  if (fetchError || !prompt) {
    throw new Error('Prompt not found');
  }

  // Verify user is a member of the prompt's team
  const { data: membership, error: membershipError } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', prompt.team_id)
    .eq('user_id', user.id)
    .single();

  if (membershipError || !membership) {
    throw new Error('Access denied');
  }

  // Reset status to pending and reset attempts counter
  const { error: updateError } = await supabase
    .from('prompts')
    .update({
      analysis_status: 'pending',
      analysis_attempts: 0,
      last_analysis_error: null,
      last_analysis_attempt_at: null,
    })
    .eq('id', promptId);

  if (updateError) {
    throw new Error('Failed to reset analysis status');
  }

  // The Edge Function will pick up the pending prompt
  // and process it automatically via database trigger

  revalidatePath('/');
  revalidatePath('/dashboard');
}
