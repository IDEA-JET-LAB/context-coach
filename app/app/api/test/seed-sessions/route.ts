import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Test endpoint to seed sample sessions for the logged-in user.
 * Only available in development/test environments.
 */
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: { code: 'NOT_ALLOWED', message: 'Not allowed in production' } },
      { status: 403 }
    );
  }

  try {
    // Get the authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Must be logged in' } },
        { status: 401 }
      );
    }

    // Get user's team membership
    const { data: membership } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: { code: 'NO_TEAM', message: 'User must have a team' } },
        { status: 400 }
      );
    }

    // Get a project for the team
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('team_id', membership.team_id)
      .eq('archived', false)
      .single();

    const projectId = project?.id || null;

    // Use admin client to insert sessions (bypasses RLS)
    const adminClient = createAdminClient();

    // Check if sessions already exist
    const { count } = await adminClient
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (count && count > 0) {
      return NextResponse.json({
        message: 'Sessions already exist',
        sessionCount: count
      });
    }

    // Create test sessions
    const now = new Date();
    const sessions = [
      {
        session_id: `test-${user.id.slice(0, 8)}-001`,
        user_id: user.id,
        team_id: membership.team_id,
        project_id: projectId,
        started_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        ended_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
        end_reason: 'completed',
        git_branch: 'feature/auth-flow',
        claude_code_version: '1.0.23',
        slug: 'Implement OAuth login',
        cwd: '/Users/dev/project',
        total_prompts: 15,
        total_tokens: 45000,
        primary_stage: 'implementation',
        has_debugging_loop: false,
        conversation_score: 78,
        user_message_count: 15
      },
      {
        session_id: `test-${user.id.slice(0, 8)}-002`,
        user_id: user.id,
        team_id: membership.team_id,
        project_id: projectId,
        started_at: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
        ended_at: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
        end_reason: 'completed',
        git_branch: 'fix/database-issue',
        claude_code_version: '1.0.23',
        slug: 'Fix database connection timeout',
        cwd: '/Users/dev/project',
        total_prompts: 28,
        total_tokens: 82000,
        primary_stage: 'debugging',
        has_debugging_loop: true,
        conversation_score: 62,
        user_message_count: 28
      },
      {
        session_id: `test-${user.id.slice(0, 8)}-003`,
        user_id: user.id,
        team_id: membership.team_id,
        project_id: projectId,
        started_at: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        ended_at: new Date(now.getTime() - 24 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString(),
        end_reason: 'completed',
        git_branch: 'main',
        claude_code_version: '1.0.22',
        slug: 'Plan API refactoring',
        cwd: '/Users/dev/project',
        total_prompts: 8,
        total_tokens: 25000,
        primary_stage: 'planning',
        has_debugging_loop: false,
        conversation_score: 85,
        user_message_count: 8
      },
      {
        session_id: `test-${user.id.slice(0, 8)}-004`,
        user_id: user.id,
        team_id: membership.team_id,
        project_id: projectId,
        started_at: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
        ended_at: null,
        end_reason: null,
        git_branch: 'feature/new-ui',
        claude_code_version: '1.0.23',
        slug: 'Build conversation UI',
        cwd: '/Users/dev/project',
        total_prompts: 5,
        total_tokens: 15000,
        primary_stage: 'implementation',
        has_debugging_loop: false,
        conversation_score: null,
        user_message_count: 5
      },
      {
        session_id: `test-${user.id.slice(0, 8)}-005`,
        user_id: user.id,
        team_id: membership.team_id,
        project_id: projectId,
        started_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        ended_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
        end_reason: 'completed',
        git_branch: 'docs/api-reference',
        claude_code_version: '1.0.21',
        slug: 'Write API documentation',
        cwd: '/Users/dev/project',
        total_prompts: 12,
        total_tokens: 35000,
        primary_stage: 'documentation',
        has_debugging_loop: false,
        conversation_score: 91,
        user_message_count: 12
      }
    ];

    const { data: insertedSessions, error: insertError } = await adminClient
      .from('sessions')
      .insert(sessions)
      .select('id, session_id, slug');

    if (insertError) {
      console.error('[Seed] Error inserting sessions:', insertError);
      return NextResponse.json(
        { error: { code: 'INSERT_FAILED', message: insertError.message } },
        { status: 500 }
      );
    }

    // Create sample prompts for each session
    const prompts = [];
    const samplePromptTexts = [
      'Help me implement the login form with email and password validation',
      'Why is this function returning undefined? Here is the code...',
      'Can you refactor this to use async/await instead of callbacks?',
      'Write unit tests for the authentication service',
      'Explain how the middleware works in this codebase',
      'Fix this TypeScript error: Type X is not assignable to type Y',
      'How should I structure the database schema for this feature?',
      'Review this code and suggest improvements'
    ];

    for (const session of insertedSessions || []) {
      const originalSession = sessions.find(s => s.session_id === session.session_id);
      const promptCount = Math.min(originalSession?.user_message_count || 5, 8);

      for (let i = 0; i < promptCount; i++) {
        const promptTime = new Date(
          new Date(originalSession?.started_at || now).getTime() + i * 5 * 60 * 1000
        );

        prompts.push({
          session_uuid: session.id,
          user_id: user.id,
          team_id: membership.team_id,
          project_id: projectId,
          content: samplePromptTexts[i % samplePromptTexts.length],
          prompt_type: ['question', 'instruction', 'debugging', 'context'][i % 4],
          sequence_number: i + 1,
          created_at: promptTime.toISOString(),
          detected_stage: originalSession?.primary_stage,
          is_in_debugging_loop: originalSession?.has_debugging_loop && i > 5
        });
      }
    }

    const { error: promptsError } = await adminClient
      .from('prompts')
      .insert(prompts);

    if (promptsError) {
      console.error('[Seed] Error inserting prompts:', promptsError);
      // Don't fail - sessions were created
    }

    return NextResponse.json({
      success: true,
      sessionsCreated: insertedSessions?.length || 0,
      promptsCreated: prompts.length,
      sessions: insertedSessions?.map(s => ({ id: s.id, slug: s.slug }))
    });

  } catch (error) {
    console.error('[Seed] Unexpected error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
