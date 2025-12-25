import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Debug endpoint to check sessions table structure
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }

  const supabase = createAdminClient();

  // Try a simple query first
  const { data: simpleData, error: simpleError } = await supabase
    .from('sessions')
    .select('id, session_id, slug')
    .limit(5);

  // Try the full query
  const { data: fullData, error: fullError } = await supabase
    .from('sessions')
    .select(`
      id,
      session_id,
      slug,
      project_id,
      user_id,
      team_id,
      started_at,
      ended_at,
      total_prompts,
      git_branch,
      cwd,
      claude_code_version,
      primary_stage,
      has_debugging_loop,
      conversation_score,
      user_message_count
    `)
    .limit(5);

  // Count total
  const { count } = await supabase
    .from('sessions')
    .select('id', { count: 'exact', head: true });

  return NextResponse.json({
    totalSessions: count,
    simpleQuery: {
      success: !simpleError,
      error: simpleError ? { code: simpleError.code, message: simpleError.message } : null,
      data: simpleData,
    },
    fullQuery: {
      success: !fullError,
      error: fullError ? { code: fullError.code, message: fullError.message, details: fullError.details } : null,
      data: fullData,
    },
  });
}
