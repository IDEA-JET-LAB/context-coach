import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Simulate a user who is a member of the team
async function testWithRealUser() {
  // First, get an access token for a real user in the team
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  // Find user edgars@ideajetlab.com and get their ID
  const { data: userData } = await adminClient.auth.admin.listUsers();
  const user = userData.users.find(u => u.email === 'edgars@ideajetlab.com');
  console.log('User ID:', user?.id);
  
  // Check if user is in the team
  const { data: membership } = await adminClient
    .from('team_members')
    .select('*')
    .eq('user_id', user?.id)
    .eq('team_id', '6c52481b-3303-431c-8d3b-375469096799')
    .single();
  
  console.log('Membership:', membership ? 'YES' : 'NO');
  
  // Now simulate what the API does - create client with user context
  // In reality this would be done via JWT, but we'll use service role and check manually
  
  // Test the RPC function that respects RLS
  const { data: responses, error } = await adminClient.rpc('get_session_responses', {
    p_session_uuid: '6255f87a-c8db-4223-90f2-2e98d6a32d16'
  });
  
  console.log('\nget_session_responses result:');
  console.log('  Count:', responses?.length || 0);
  console.log('  Error:', error?.message || 'none');
  
  if (responses && responses.length > 0) {
    console.log('  First response thinking:', responses[0].thinking_summary?.substring(0, 50));
    console.log('  First response text:', responses[0].response_text?.substring(0, 50) || 'NULL');
  }
}

testWithRealUser();
