import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Import the actual function
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConversationThread() {
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
  console.log('Session found:', session.id);
  
  // Step 2: Get prompts for this session
  const { data: prompts, error: promptsError } = await supabase
    .from('prompts')
    .select('id, prompt_text, session_uuid, created_at')
    .eq('session_uuid', session.id)
    .order('created_at', { ascending: true });
  
  console.log('\nPrompts for session:', prompts?.length || 0);
  prompts?.forEach(p => {
    console.log(`  - ${p.id.substring(0,8)}... | ${p.prompt_text?.substring(0,50)}...`);
  });
  
  // Step 3: Get responses for this session
  const { data: responses, error: responsesError } = await supabase
    .from('prompt_responses')
    .select('id, prompt_id, session_uuid, model, stop_reason, thinking_summary, created_at')
    .eq('session_uuid', session.id)
    .order('created_at', { ascending: true });
  
  console.log('\nResponses for session:', responses?.length || 0);
  if (responsesError) {
    console.log('Response error:', responsesError);
  }
  responses?.forEach(r => {
    console.log(`  - ${r.id.substring(0,8)}... | prompt_id: ${r.prompt_id || 'NULL'} | ${r.model} | thinking: ${r.thinking_summary?.substring(0,50) || 'none'}...`);
  });
  
  // Step 4: Try to get decrypted response
  if (responses && responses.length > 0) {
    const { data: decrypted, error: decryptError } = await supabase
      .rpc('get_decrypted_response', { p_response_id: responses[0].id });
    
    console.log('\nDecrypted response:');
    if (decryptError) {
      console.log('Decrypt error:', decryptError);
    } else {
      console.log('  response_text:', decrypted?.[0]?.response_text?.substring(0, 200) || 'NULL');
    }
  }
}

testConversationThread().catch(console.error);
