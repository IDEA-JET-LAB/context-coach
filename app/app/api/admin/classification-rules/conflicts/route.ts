import { NextResponse } from 'next/server';
import { requireSuperAdminApi } from '@/lib/auth/admin';
import { detectPatternConflicts } from '@/lib/utils/pattern-conflict-detector';
import { z } from 'zod';

const requestSchema = z.object({
  pattern: z.string().min(1),
  categoryId: z.string().uuid(),
  excludeRuleId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const validated = requestSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid request' } },
        { status: 400 }
      );
    }

    const conflicts = await detectPatternConflicts(
      validated.data.pattern,
      validated.data.categoryId,
      validated.data.excludeRuleId
    );

    return NextResponse.json({ conflicts });
  } catch (error) {
    console.error('[API] Conflict detection error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to detect conflicts' } },
      { status: 500 }
    );
  }
}
