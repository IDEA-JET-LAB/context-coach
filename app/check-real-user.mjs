import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkMembers() {
  const teamId = '6c52481b-3303-431c-8d3b-375469096799';
  
  // Get team members
  const { data: members } = await supabase
    .from('team_members')
    .select(`
      user_id,
      role,
      profiles!inner(id, email, display_name)
    `)
    .eq('team_id', teamId);
  
  console.log('=== TEAM MEMBERS OF "Idea Jet Lab" ===');
  members?.forEach(m => {
    console.log(`  - ${m.profiles.email} (${m.role}) - ID: ${m.user_id}`);
  });
  
  // Also check auth.users table
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  console.log('\n=== ALL AUTH USERS ===');
  authUsers?.users?.forEach(u => {
    console.log(`  - ${u.email} - ID: ${u.id}`);
  });
}

checkMembers().catch(console.error);
