import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://ddskanjiobrjphscskog.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY);

// Check prompts with known HA-t97 fingerprints
const fingerprints = ['2f4854db14e6', '72a7b8e8e8cf', '9eebcee2eb3e', '422e4b0b3594'];
const { data } = await supabase
  .from('prompts')
  .select('id, project_id, fingerprint, created_at, projects(name)')
  .in('fingerprint', fingerprints);

console.log('Prompts with HA-t97 fingerprints:');
for (const p of data || []) {
  console.log('  Project:', p.projects?.name, '- ID:', p.project_id);
  console.log('  Created:', p.created_at);
}

if (data === null || data.length === 0) {
  console.log('  None found - they may have been deleted or never imported');
}

// Check most recent prompts
const { data: recent } = await supabase
  .from('prompts')
  .select('id, project_id, text, created_at, projects(name)')
  .order('created_at', { ascending: false })
  .limit(10);

console.log('\nMost recent prompts:');
for (const p of recent || []) {
  console.log('  ', p.created_at, '-', p.projects?.name, '-', p.text?.substring(0, 30));
}

// Check all projects created today
const today = new Date().toISOString().split('T')[0];
const { data: projects } = await supabase
  .from('projects')
  .select('id, name, created_at')
  .gte('created_at', today)
  .order('created_at', { ascending: false });

console.log('\nProjects created today:');
for (const p of projects || []) {
  const { count } = await supabase
    .from('prompts')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', p.id);
  console.log('  ', p.name, '- ID:', p.id, '- Prompts:', count);
}
