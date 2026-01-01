import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const sessionDbId = '6255f87a-c8db-4223-90f2-2e98d6a32d16';
  
  // Check prompts message_uuid
  const { data: prompts } = await supabase
    .from('prompts')
    .select('id, message_uuid, parent_message_uuid, text, created_at')
    .eq('session_uuid', sessionDbId);
  
  console.log('=== PROMPTS ===');
  prompts?.forEach(p => {
    console.log('ID:', p.id.substring(0,8));
    console.log('  message_uuid:', p.message_uuid || 'NULL');
    console.log('  parent_message_uuid:', p.parent_message_uuid || 'NULL');
    console.log('  text:', p.text?.substring(0, 40));
    console.log();
  });
  
  // Check responses message_uuid
  const { data: responses } = await supabase
    .from('prompt_responses')
    .select('id, message_uuid, prompt_id, thinking_summary, created_at')
    .eq('session_uuid', sessionDbId);
  
  console.log('=== RESPONSES ===');
  responses?.forEach(r => {
    console.log('ID:', r.id.substring(0,8));
    console.log('  message_uuid:', r.message_uuid || 'NULL');
    console.log('  prompt_id:', r.prompt_id || 'NULL');
    console.log('  thinking:', r.thinking_summary?.substring(0, 40));
    console.log();
  });
}

check();
