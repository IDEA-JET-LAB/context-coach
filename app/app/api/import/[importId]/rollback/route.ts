import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidUuid } from '@/lib/utils/uuid';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { ImportRecordStatus, ImportMetadata } from '@/lib/import/types';

// Rate limit: 3 rollbacks per day per user
let rollbackRateLimit: Ratelimit | null = null;

function getRollbackRateLimit(): Ratelimit | null {
  if (rollbackRateLimit) return rollbackRateLimit;

  const url = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;

  if (!url || !token) {
    console.warn('[Rollback API] Rate limiting disabled - Redis not configured');
    return null;
  }

  rollbackRateLimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(3, '1 d'), // 3 per day
    prefix: 'ratelimit:rollback',
  });

  return rollbackRateLimit;
}

interface RouteContext {
  params: Promise<{ importId: string }>;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check rate limit (3 rollbacks per day)
  const limiter = getRollbackRateLimit();
  if (limiter) {
    const result = await limiter.limit(user.id);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Daily rollback limit reached (3 per day)' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(result.limit),
            'X-RateLimit-Remaining': String(result.remaining),
            'X-RateLimit-Reset': String(result.reset),
          }
        }
      );
    }
  }

  const { importId } = await context.params;

  if (!isValidUuid(importId)) {
    return NextResponse.json({ error: 'Invalid import ID' }, { status: 400 });
  }

  // Check for any rollback in progress for this user (concurrent prevention)
  const { data: inProgressRollback } = await supabase
    .from('historical_imports')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'rolling_back')
    .limit(1)
    .maybeSingle();

  if (inProgressRollback) {
    return NextResponse.json(
      { error: 'Rollback already in progress' },
      { status: 409 }
    );
  }

  // Verify ownership and get import record
  const { data: importRecord, error: fetchError } = await supabase
    .from('historical_imports')
    .select('*')
    .eq('id', importId)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !importRecord) {
    return NextResponse.json({ error: 'Import not found' }, { status: 404 });
  }

  const status = importRecord.status as ImportRecordStatus;

  if (status === 'rolled_back') {
    return NextResponse.json(
      { error: 'Import has already been rolled back' },
      { status: 400 }
    );
  }

  if (status === 'rolling_back') {
    return NextResponse.json(
      { error: 'Rollback is already in progress' },
      { status: 400 }
    );
  }

  if (status !== 'complete') {
    return NextResponse.json(
      { error: `Cannot rollback import with status: ${status}` },
      { status: 400 }
    );
  }

  // Track rollback progress for partial failure handling
  const deletedPromptIds: string[] = [];
  let totalToDelete = 0;

  try {
    // Mark as rolling_back to prevent concurrent rollbacks
    const { error: updateError } = await supabase
      .from('historical_imports')
      .update({ status: 'rolling_back' })
      .eq('id', importId);

    if (updateError) {
      throw new Error('Failed to update import status');
    }

    // Get all prompt IDs for this import (for tracking)
    const { data: prompts, error: promptsError } = await supabase
      .from('prompts')
      .select('id')
      .eq('import_id', importId);

    if (promptsError) {
      throw new Error('Failed to fetch prompts for rollback');
    }

    totalToDelete = prompts?.length || 0;

    if (totalToDelete === 0) {
      // No prompts to delete, just mark as rolled back
      await supabase
        .from('historical_imports')
        .update({ status: 'rolled_back' })
        .eq('id', importId);

      return NextResponse.json({
        success: true,
        deletedCount: 0,
      });
    }

    const promptIds = prompts.map(p => p.id);

    // Delete prompt analyses first (FK constraint)
    const { error: analysesError } = await supabase
      .from('prompt_analyses')
      .delete()
      .in('prompt_id', promptIds);

    if (analysesError) {
      console.error('Error deleting prompt_analyses:', analysesError);
      // Continue - analyses may not exist for all prompts
    }

    // Delete prompt responses (FK constraint)
    const { error: responsesError } = await supabase
      .from('prompt_responses')
      .delete()
      .in('prompt_id', promptIds);

    if (responsesError) {
      console.error('Error deleting prompt_responses:', responsesError);
      // Continue - responses may not exist for all prompts
    }

    // Delete prompts in batches and track progress
    const batchSize = 100;
    for (let i = 0; i < promptIds.length; i += batchSize) {
      const batch = promptIds.slice(i, i + batchSize);
      const { error: deleteError } = await supabase
        .from('prompts')
        .delete()
        .in('id', batch);

      if (deleteError) {
        throw new Error(`Failed to delete batch ${i / batchSize + 1}: ${deleteError.message}`);
      }

      deletedPromptIds.push(...batch);
    }

    // Mark import as rolled back
    await supabase
      .from('historical_imports')
      .update({ status: 'rolled_back' })
      .eq('id', importId);

    return NextResponse.json({
      success: true,
      deletedCount: deletedPromptIds.length,
    });
  } catch (error) {
    console.error('Rollback error:', error);

    // Partial rollback: update status and record what was deleted
    const remainingCount = totalToDelete - deletedPromptIds.length;
    const currentMetadata = (importRecord.metadata as ImportMetadata) || { projects: [], totalDurationMs: 0, version: '1.0' };

    const updatedMetadata: ImportMetadata = {
      ...currentMetadata,
      rollbackError: error instanceof Error ? error.message : String(error),
      deletedPromptIds,
      remainingCount,
    };

    await supabase
      .from('historical_imports')
      .update({
        status: 'partially_rolled_back',
        metadata: updatedMetadata,
      })
      .eq('id', importId);

    return NextResponse.json(
      {
        error: 'Rollback failed mid-operation',
        partialRollback: true,
        deletedCount: deletedPromptIds.length,
        remainingCount,
        deletedPromptIds,
      },
      { status: 500 }
    );
  }
}
