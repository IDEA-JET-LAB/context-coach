import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const teamId = '6c52481b-3303-431c-8d3b-375469096799';
  
  // Raw team_members query
  const { data: members, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', teamId);
  
  console.log('Team members (raw):', members);
  if (error) console.log('Error:', error);
  
  // Check profiles for edgars@ideajetlab.com
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', 'edgars@ideajetlab.com')
    .single();
  
  console.log('\nProfile for edgars@ideajetlab.com:', profile);
  
  // Check all team memberships for this user
  if (profile) {
    const { data: allMemberships } = await supabase
      .from('team_members')
      .select('team_id, role, teams(name)')
      .eq('user_id', profile.id);
    
    console.log('\nAll memberships for this user:', allMemberships);
  }
  
  // Check project ownership
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, team_id, teams(name)')
    .eq('id', '20b73977-8a12-4973-a35e-842f9b4ebc1a')
    .single();
  
  console.log('\nProject:', project);
}

check().catch(console.error);
