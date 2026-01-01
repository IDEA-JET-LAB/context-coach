import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRaw() {
  // Check raw response data
  const { data: responses } = await supabase
    .from('prompt_responses')
    .select('id, response_text_encrypted, thinking_summary, model')
    .eq('session_uuid', '6255f87a-c8db-4223-90f2-2e98d6a32d16')
    .limit(2);

  console.log('=== RAW RESPONSES ===');
  responses?.forEach(r => {
    console.log('ID:', r.id);
    console.log('  encrypted text exists:', !!r.response_text_encrypted);
    console.log('  encrypted text length:', r.response_text_encrypted ? r.response_text_encrypted.length : 0);
    console.log('  thinking_summary:', r.thinking_summary ? r.thinking_summary.substring(0, 100) : 'NULL');
    console.log();
  });

  // Check prompts table - are prompts being stored at all?
  const { data: recentPrompts } = await supabase
    .from('prompts')
    .select('id, session_uuid, prompt_text, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('=== RECENT PROMPTS ===');
  recentPrompts?.forEach(p => {
    const sessionPart = p.session_uuid ? p.session_uuid.substring(0, 8) : 'NULL';
    const textPart = p.prompt_text ? p.prompt_text.substring(0, 50) : 'NULL';
    console.log('  -', p.id.substring(0, 8) + '...', '| session:', sessionPart + '...', '|', textPart);
  });

  // Check if there are prompts with the specific session
  const sessionId = '20d49eca-fc3f-402d-8a8e-f1ea40f963ea';
  const { data: sessionPrompts } = await supabase
    .from('prompts')
    .select('id')
    .or('session_uuid.eq.6255f87a-c8db-4223-90f2-2e98d6a32d16,session_id.eq.' + sessionId);

  console.log('\nPrompts matching this session (by session_uuid OR session_id):', sessionPrompts ? sessionPrompts.length : 0);
}

checkRaw().catch(console.error);
