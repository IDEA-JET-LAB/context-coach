import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Get a sample prompt to see the columns
  const { data: sample } = await supabase
    .from('prompts')
    .select('*')
    .limit(1)
    .single();
  
  console.log('Prompt columns:', Object.keys(sample || {}));
  
  // Now get prompts for test session with correct columns
  const { data: prompts } = await supabase
    .from('prompts')
    .select('id, session_uuid, created_at')
    .eq('session_uuid', '6255f87a-c8db-4223-90f2-2e98d6a32d16');
  
  console.log('\nPrompts for test session:', prompts?.length || 0);
}

check();
