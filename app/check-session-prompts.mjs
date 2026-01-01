import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Get prompts for the test session
  const sessionDbId = '6255f87a-c8db-4223-90f2-2e98d6a32d16';
  
  const { data: prompts, error } = await supabase
    .from('prompts')
    .select('id, prompt_text, session_uuid, created_at')
    .eq('session_uuid', sessionDbId)
    .order('created_at', { ascending: true });
  
  console.log('Prompts for session', sessionDbId.substring(0,8) + '...:', prompts?.length || 0);
  if (error) console.log('Error:', error);
  
  prompts?.forEach(p => {
    const text = p.prompt_text?.substring(0, 80) || 'NULL';
    console.log('  -', p.created_at, '|', text);
  });
  
  // Get responses for the same session
  const { data: responses } = await supabase
    .from('prompt_responses')
    .select('id, session_uuid, thinking_summary, created_at')
    .eq('session_uuid', sessionDbId)
    .order('created_at', { ascending: true });
  
  console.log('\nResponses for same session:', responses?.length || 0);
  responses?.forEach(r => {
    const thinking = r.thinking_summary?.substring(0, 60) || 'NULL';
    console.log('  -', r.created_at, '|', thinking);
  });
}

check();
