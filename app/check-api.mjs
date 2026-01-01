import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testQuery() {
  const targetSession = '20d49eca-fc3f-402d-8a8e-f1ea40f963ea';
  
  // Get the session
  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('session_id', targetSession)
    .single();

  console.log('Session DB ID:', session.id);
  
  // Now test the exact query that get-conversation-thread.ts uses
  const responseSelectParts = [
    'id',
    'prompt_id',
    'created_at',
    'thinking_summary',
    'thinking_word_count',
    'tool_count',
    'tools_used',
    'model',
    'tokens_in',
    'tokens_out',
    'stop_reason',
  ];

  const { data: responsesData, error: responsesError } = await supabase
    .from("prompt_responses")
    .select(responseSelectParts.join(","))
    .eq("session_uuid", session.id)
    .order("created_at", { ascending: true });

  console.log('\n=== QUERY RESULT (same as get-conversation-thread.ts) ===');
  if (responsesError) {
    console.log('ERROR:', responsesError.message);
    console.log('Full error:', JSON.stringify(responsesError, null, 2));
  } else {
    console.log('Success! Found', responsesData?.length || 0, 'responses');
    responsesData?.forEach(r => {
      console.log(`  - ${r.id.substring(0,8)}... | model: ${r.model} | tools: ${r.tool_count}`);
    });
  }
}

testQuery().catch(console.error);
