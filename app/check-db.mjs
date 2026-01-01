import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkResponses() {
  // Check for any responses in the database
  const { data: responses, error: respError } = await supabase
    .from('prompt_responses')
    .select('id, session_uuid, prompt_id, model, stop_reason, tool_count, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('=== RESPONSES IN DATABASE ===');
  if (respError) {
    console.log('Error:', respError.message);
  } else {
    console.log(`Found ${responses?.length || 0} responses`);
    responses?.forEach(r => {
      console.log(`  - ${r.id.substring(0,8)}... | session_uuid: ${r.session_uuid?.substring(0,8) || 'NULL'}... | prompt_id: ${r.prompt_id ? r.prompt_id.substring(0,8) + '...' : 'NULL'} | model: ${r.model?.substring(0,20)} | stop: ${r.stop_reason}`);
    });
  }

  // Check if session 20d49eca-fc3f-402d-8a8e-f1ea40f963ea exists
  const targetSession = '20d49eca-fc3f-402d-8a8e-f1ea40f963ea';
  
  // First check by session_id (Claude Code format)
  const { data: session, error: sErr } = await supabase
    .from('sessions')
    .select('*')
    .eq('session_id', targetSession)
    .maybeSingle();

  console.log('\n=== TARGET SESSION (Claude ID: ' + targetSession + ') ===');
  if (sErr) {
    console.log('Error finding session:', sErr.message);
  } else if (session) {
    console.log('Found session with DB ID:', session.id);
    console.log('Team ID:', session.team_id);
    console.log('Project ID:', session.project_id);
    
    // Get responses for this session using the DB UUID
    const { data: sessResponses, error: rErr } = await supabase
      .from('prompt_responses')
      .select('id, session_uuid, model, stop_reason, created_at')
      .eq('session_uuid', session.id);
    
    console.log(`\nResponses linked to this session: ${sessResponses?.length || 0}`);
    if (rErr) console.log('Error:', rErr.message);
    sessResponses?.forEach(r => {
      console.log(`  - ${r.id.substring(0,8)}... | ${r.model?.substring(0,25)} | ${r.stop_reason} | ${r.created_at}`);
    });
  } else {
    console.log('Session NOT FOUND in database!');
  }
}

checkResponses().catch(console.error);
