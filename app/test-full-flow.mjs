import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFullFlow() {
  const sessionId = '20d49eca-fc3f-402d-8a8e-f1ea40f963ea';
  
  // Step 1: Get session
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single();
  
  if (sessionError) {
    console.log('Session error:', sessionError);
    return;
  }
  console.log('Session:', session.id);
  
  // Step 2: Get prompts
  const { data: prompts, error: promptsError } = await supabase
    .from('prompts')
    .select('id, text, created_at, session_uuid, sequence_number')
    .eq('session_uuid', session.id)
    .order('created_at', { ascending: true });
  
  console.log('\nPrompts:', prompts?.length, promptsError?.message || '');
  
  // Step 3: Get responses  
  const { data: responses, error: responsesError } = await supabase
    .from('prompt_responses')
    .select('id, prompt_id, created_at, thinking_summary, model, stop_reason, session_uuid')
    .eq('session_uuid', session.id)
    .order('created_at', { ascending: true });
  
  console.log('Responses:', responses?.length, responsesError?.message || '');
  
  // Step 4: Match by timestamp
  console.log('\n=== BUILDING THREAD ===');
  const messages = [];
  const unlinkedResponses = [...(responses || [])].filter(r => !r.prompt_id);
  
  console.log('Unlinked responses to match:', unlinkedResponses.length);
  
  for (const prompt of prompts || []) {
    messages.push({
      role: 'user',
      id: prompt.id.substring(0,8),
      text: prompt.text?.substring(0, 50),
      timestamp: prompt.created_at
    });
    
    // Try timestamp matching
    const promptTime = new Date(prompt.created_at).getTime();
    const promptIdx = prompts.indexOf(prompt);
    const nextPromptTime = promptIdx < prompts.length - 1
      ? new Date(prompts[promptIdx + 1].created_at).getTime()
      : Infinity;
    
    const matchIdx = unlinkedResponses.findIndex((r) => {
      const respTime = new Date(r.created_at).getTime();
      return respTime > promptTime && respTime < nextPromptTime;
    });
    
    if (matchIdx !== -1) {
      const response = unlinkedResponses[matchIdx];
      messages.push({
        role: 'assistant',
        id: response.id.substring(0,8),
        thinking: response.thinking_summary?.substring(0, 50),
        timestamp: response.created_at
      });
      unlinkedResponses.splice(matchIdx, 1);
    }
  }
  
  console.log('\n=== FINAL THREAD ===');
  messages.forEach((m, i) => {
    console.log(i + 1, m.role.padEnd(10), '|', m.timestamp, '|', m.text || m.thinking || 'N/A');
  });
  
  console.log('\nRemaining unmatched responses:', unlinkedResponses.length);
}

testFullFlow();
