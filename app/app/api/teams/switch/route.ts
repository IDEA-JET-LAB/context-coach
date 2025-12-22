import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

const switchTeamSchema = z.object({
  teamId: z.string().uuid('Invalid team ID format'),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { teamId } = switchTeamSchema.parse(body);

    const { data, error } = await supabase.rpc('switch_team', {
      new_team_id: teamId,
    });

    if (error) {
      console.error('[API] teams/switch POST: RPC error', error);
      return NextResponse.json(
        { error: { code: 'SWITCH_FAILED', message: error.message } },
        { status: 400 }
      );
    }

    if (data?.error) {
      const errorCode = data.error;
      const errorMessage =
        errorCode === 'NOT_A_MEMBER'
          ? 'You are not a member of this team'
          : 'Failed to switch team';

      return NextResponse.json(
        { error: { code: errorCode, message: errorMessage } },
        { status: 403 }
      );
    }

    return NextResponse.json({ data: { team: data.team } });
  } catch (error) {
    if (error instanceof ZodError) {
      const zodError = error as ZodError & { issues?: Array<{ message: string }>; errors?: Array<{ message: string }> };
      const firstError = zodError.issues?.[0] || zodError.errors?.[0];
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: firstError?.message || 'Validation failed',
          },
        },
        { status: 400 }
      );
    }

    console.error('[API] teams/switch POST: unexpected error', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
