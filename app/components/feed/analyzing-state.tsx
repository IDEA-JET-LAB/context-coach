'use client';

import { Loader2, Clock } from 'lucide-react';
import type { AnalysisStatus } from '@/lib/types/prompt';

interface AnalyzingStateProps {
  status: AnalysisStatus;
  estimatedTime?: number; // seconds
}

export function AnalyzingState({ status, estimatedTime }: AnalyzingStateProps) {
  const isPending = status === 'pending';
  const isProcessing = status === 'processing';

  if (!isPending && !isProcessing) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 text-muted-foreground" role="status" aria-live="polite">
      {isPending ? (
        <Clock className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      )}
      <div>
        <p className="text-sm">
          {isPending ? 'Queued for analysis' : 'Analyzing...'}
        </p>
        {isProcessing && estimatedTime && (
          <p className="text-xs">
            Estimated time: ~{estimatedTime}s
          </p>
        )}
      </div>
    </div>
  );
}
