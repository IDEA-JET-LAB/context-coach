import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { count } = await supabase
    .from('prompts')
    .select('*', { count: 'exact', head: true });
  
  console.log('Total prompts in database:', count);
  
  const { data: recent } = await supabase
    .from('prompts')
    .select('id, session_uuid, project_id, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log('\nMost recent prompts:');
  recent?.forEach(p => {
    console.log(' ', p.created_at, '| session:', p.session_uuid?.substring(0,8) || 'NULL', '| project:', p.project_id?.substring(0,8));
  });
}

check();
