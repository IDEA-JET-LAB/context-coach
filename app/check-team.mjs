import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTeam() {
  // Get the session's team
  const targetSession = '20d49eca-fc3f-402d-8a8e-f1ea40f963ea';
  
  const { data: session } = await supabase
    .from('sessions')
    .select('id, team_id, project_id')
    .eq('session_id', targetSession)
    .single();

  console.log('Session:', session);
  
  // Get test user
  const { data: users } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', 'edgars@test.com');
  
  console.log('\nTest user:', users);
  
  if (users && users.length > 0) {
    const userId = users[0].id;
    
    // Check team membership
    const { data: memberships } = await supabase
      .from('team_members')
      .select('team_id, role')
      .eq('user_id', userId);
    
    console.log('\nUser team memberships:', memberships);
    
    // Check if user is member of session's team
    const isMember = memberships?.some(m => m.team_id === session.team_id);
    console.log('\nUser is member of session team:', isMember);
  }
  
  // What team owns this session?
  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .eq('id', session.team_id)
    .single();
  
  console.log('\nSession team:', team);
}

checkTeam().catch(console.error);
