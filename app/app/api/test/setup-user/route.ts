import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Test endpoint to fully set up a user with team and project.
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
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Email and password required' } },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Step 1: Check if user exists in auth
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    let authUser = existingUsers?.users?.find(u => u.email === email);

    if (!authUser) {
      // Create user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError) {
        return NextResponse.json(
          { error: { code: 'CREATE_FAILED', message: createError.message } },
          { status: 500 }
        );
      }
      authUser = newUser.user;
    } else {
      // Ensure email is confirmed and update password
      await supabase.auth.admin.updateUserById(authUser.id, {
        email_confirm: true,
        password: password,
      });
    }

    const userId = authUser!.id;

    // Step 2: Ensure user exists in public.users
    const { data: publicUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (!publicUser) {
      await supabase.from('users').insert({
        id: userId,
        email: email,
        full_name: 'Test User',
      });
    }

    // Step 3: Check if user has a team
    const { data: teamMembership } = await supabase
      .from('team_members')
      .select('team_id, teams(id, name)')
      .eq('user_id', userId)
      .single();

    let teamId = teamMembership?.team_id;

    if (!teamId) {
      // Create a team for the user
      const { data: newTeam, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: 'Test Team',
          created_by: userId,
        })
        .select('id')
        .single();

      if (teamError) {
        return NextResponse.json(
          { error: { code: 'TEAM_CREATE_FAILED', message: teamError.message } },
          { status: 500 }
        );
      }

      teamId = newTeam.id;

      // Add user as team admin
      await supabase.from('team_members').insert({
        team_id: teamId,
        user_id: userId,
        role: 'admin',
      });
    }

    // Step 4: Check if team has a project
    const { data: existingProject } = await supabase
      .from('projects')
      .select('id, name')
      .eq('team_id', teamId)
      .eq('archived', false)
      .single();

    let projectId = existingProject?.id;

    if (!projectId) {
      // Create a project
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: 'Test Project',
          team_id: teamId,
          created_by: userId,
        })
        .select('id')
        .single();

      if (projectError) {
        console.error('Project creation error:', projectError);
        // Not fatal, continue
      } else {
        projectId = newProject.id;
      }
    }

    return NextResponse.json({
      success: true,
      userId,
      teamId,
      projectId,
      message: 'User fully set up with team and project',
    });

  } catch (error) {
    console.error('[Setup] Unexpected error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
