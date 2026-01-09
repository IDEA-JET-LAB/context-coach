import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://ddskanjiobrjphscskog.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY);

const projectId = '9f080da4-978a-40e1-9137-8caa8e22cc68';

// Get all unique session_uuids from prompts in this project
const { data: prompts } = await supabase
  .from('prompts')
  .select('session_uuid')
  .eq('project_id', projectId);

const sessionUuids = [...new Set(prompts?.map(p => p.session_uuid).filter(Boolean))];
console.log('Unique session_uuids in prompts:', sessionUuids.length);

if (sessionUuids.length === 0) {
  console.log('No sessions to fix');
  process.exit(0);
}

// Check which of these sessions have wrong project_id
const { data: sessions } = await supabase
  .from('sessions')
  .select('id, session_id, project_id')
  .in('id', sessionUuids);

const wrongProject = (sessions || []).filter(s => s.project_id !== projectId);
console.log('Sessions with wrong project_id:', wrongProject.length);

if (wrongProject.length > 0) {
  const idsToFix = wrongProject.map(s => s.id);
  const { error } = await supabase
    .from('sessions')
    .update({ project_id: projectId })
    .in('id', idsToFix);
  console.log('Fixed', idsToFix.length, 'sessions', error ? 'Error: ' + error.message : '');
}

// Verify all sessions now have correct project_id
const { data: allSessions } = await supabase
  .from('sessions')
  .select('id, session_id, project_id, total_prompts')
  .eq('project_id', projectId);

console.log('\nSessions for HA-t97 project:', allSessions?.length);
for (const s of allSessions || []) {
  console.log('  ', s.session_id, '- Prompts:', s.total_prompts);
}
