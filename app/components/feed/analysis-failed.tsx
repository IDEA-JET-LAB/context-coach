'use client';

import { AlertTriangle, RefreshCw, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { retryAnalysis } from '@/lib/actions/retry-analysis';
import { toast } from 'sonner';

interface AnalysisFailedProps {
  promptId: string;
  errorMessage?: string;
}

export function AnalysisFailed({ promptId, errorMessage }: AnalysisFailedProps) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retryAnalysis(promptId);
      toast.success('Analysis retry queued');
    } catch {
      toast.error('Failed to retry analysis');
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="flex items-center gap-3" role="alert">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
        <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
      </div>
      <div className="flex-1">
        <p className="text-sm text-red-400">Analysis failed</p>
        {errorMessage && (
          <p className="text-xs text-muted-foreground">{errorMessage}</p>
        )}
        <a
          href="https://docs.contextor.com/troubleshooting/analysis-failures"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Learn more
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleRetry}
        disabled={retrying}
        aria-label={retrying ? 'Retrying analysis' : 'Retry analysis'}
      >
        {retrying ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <>
            <RefreshCw className="h-4 w-4 mr-1" aria-hidden="true" />
            Retry
          </>
        )}
      </Button>
    </div>
  );
}
