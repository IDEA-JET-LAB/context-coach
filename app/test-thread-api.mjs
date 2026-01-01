import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testThread() {
  const sessionId = '20d49eca-fc3f-402d-8a8e-f1ea40f963ea';
  
  // Step 1: Get session
  const { data: session } = await supabase
    .from('sessions')
    .select('id, team_id, project_id, session_id')
    .eq('session_id', sessionId)
    .single();
  
  console.log('Session:', session);
  
  // Step 2: Get prompts
  const { data: prompts } = await supabase
    .from('prompts')
    .select('id, text, session_uuid, created_at')
    .eq('session_uuid', session.id)
    .order('created_at', { ascending: true });
  
  console.log('\nPrompts:', prompts?.length);
  prompts?.forEach(p => {
    console.log('  -', p.id.substring(0,8), '|', p.text?.substring(0, 60));
  });
  
  // Step 3: Get responses  
  const { data: responses } = await supabase
    .from('prompt_responses')
    .select('id, prompt_id, session_uuid, thinking_summary, model, created_at')
    .eq('session_uuid', session.id)
    .order('created_at', { ascending: true });
  
  console.log('\nResponses:', responses?.length);
  responses?.forEach(r => {
    console.log('  -', r.id.substring(0,8), '| prompt_id:', r.prompt_id?.substring(0,8) || 'NULL', '|', r.thinking_summary?.substring(0, 40));
  });
  
  // Step 4: Test the conversation thread function output
  console.log('\n=== EXPECTED THREAD ===');
  const messages = [];
  
  for (const prompt of prompts || []) {
    messages.push({
      type: 'user',
      id: prompt.id,
      text: prompt.text?.substring(0, 50),
      created_at: prompt.created_at
    });
    
    // Find matching response
    const response = responses?.find(r => r.prompt_id === prompt.id);
    if (response) {
      messages.push({
        type: 'assistant',
        id: response.id,
        thinking: response.thinking_summary?.substring(0, 50),
        created_at: response.created_at
      });
    }
  }
  
  // Add unlinked responses
  const unlinked = responses?.filter(r => !r.prompt_id) || [];
  console.log('Unlinked responses:', unlinked.length);
  
  console.log('\nThread messages:', messages.length);
  messages.forEach(m => {
    console.log(' ', m.type, '|', m.text || m.thinking);
  });
}

testThread();
