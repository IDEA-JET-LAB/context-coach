import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Create client as anon (simulating frontend)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAuthQuery() {
  // Sign in as test user
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'edgars@test.com',
    password: 'password123'
  });
  
  if (authError) {
    console.log('Auth error:', authError.message);
    return;
  }
  console.log('Signed in as:', authData.user.email);
  
  const targetSession = '20d49eca-fc3f-402d-8a8e-f1ea40f963ea';
  
  // Get the session
  const { data: session, error: sessErr } = await supabase
    .from('sessions')
    .select('*')
    .eq('session_id', targetSession)
    .single();

  if (sessErr) {
    console.log('Session query error:', sessErr.message);
    return;
  }
  console.log('Session DB ID:', session.id);
  
  // Query responses as authenticated user
  const { data: responsesData, error: responsesError } = await supabase
    .from("prompt_responses")
    .select("id, prompt_id, session_uuid, model, stop_reason, created_at")
    .eq("session_uuid", session.id)
    .order("created_at", { ascending: true });

  console.log('\n=== AUTHENTICATED USER QUERY ===');
  if (responsesError) {
    console.log('ERROR:', responsesError.message);
  } else {
    console.log('Found', responsesData?.length || 0, 'responses');
    responsesData?.forEach(r => {
      console.log(`  - ${r.id.substring(0,8)}... | session_uuid: ${r.session_uuid?.substring(0,8)} | model: ${r.model}`);
    });
  }
}

testAuthQuery().catch(console.error);
