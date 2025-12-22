'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow, format } from 'date-fns';
import { ArrowLeft, Calendar, Folder, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScoreBadge } from '@/components/feed/score-badge';
import { DimensionCard } from './dimension-card';
import type { PromptWithFullAnalysis } from '@/lib/hooks/use-prompt';

interface PromptDetailViewProps {
  prompt: PromptWithFullAnalysis;
}

// Default dimension order
const DIMENSION_ORDER = ['Clarity', 'Context', 'Specificity', 'Goal', 'Constraints'];

export function PromptDetailView({ prompt }: PromptDetailViewProps) {
  const router = useRouter();

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // Handle Escape key to go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBack]);

  const dimensionScores = prompt.analysis?.dimension_scores ?? {};
  const suggestions = prompt.analysis?.suggestions;

  // Sort dimensions by the predefined order, with any extras at the end
  const sortedDimensions = Object.keys(dimensionScores).sort((a, b) => {
    const indexA = DIMENSION_ORDER.indexOf(a);
    const indexB = DIMENSION_ORDER.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  return (
    <div className="max-w-3xl mx-auto" data-testid="prompt-detail-view">
      {/* Header with back button and overall score */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="gap-2"
          data-testid="back-button"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to feed
        </Button>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Overall Score</span>
          <ScoreBadge
            score={prompt.analysis?.overall_score}
            status={prompt.analysis_status}
            size="lg"
          />
        </div>
      </div>

      {/* Metadata bar */}
      <div className="flex flex-wrap items-center gap-4 mb-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5" data-testid="prompt-date">
          <Calendar className="h-4 w-4" />
          <span>{format(new Date(prompt.created_at), 'MMM d, yyyy h:mm a')}</span>
          <span className="text-xs">
            ({formatDistanceToNow(new Date(prompt.created_at), { addSuffix: true })})
          </span>
        </div>

        {prompt.project && (
          <div className="flex items-center gap-1.5" data-testid="prompt-project">
            <Folder className="h-4 w-4" />
            <span>{prompt.project.name}</span>
          </div>
        )}


        <div className="flex items-center gap-1.5" data-testid="prompt-stats">
          <FileText className="h-4 w-4" />
          <span>{prompt.word_count} words, {prompt.char_count} chars</span>
        </div>
      </div>

      {/* Full prompt text */}
      <div
        className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4 mb-8"
        data-testid="prompt-text-container"
      >
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Prompt</h2>
        <p
          className="text-[#fafafa] whitespace-pre-wrap"
          data-testid="prompt-full-text"
        >
          {prompt.text}
        </p>
      </div>

      {/* Dimension scores */}
      {prompt.analysis_status === 'complete' && Object.keys(dimensionScores).length > 0 && (
        <div data-testid="dimension-breakdown">
          <h2 className="text-lg font-medium text-[#fafafa] mb-4">Score Breakdown</h2>
          <div className="space-y-3">
            {sortedDimensions.map((dimension) => {
              const score = dimensionScores[dimension];
              if (!score) return null;
              return (
                <DimensionCard
                  key={dimension}
                  name={dimension}
                  dimensionScore={score}
                  suggestion={suggestions?.byDimension?.[dimension]}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Analyzing state */}
      {(prompt.analysis_status === 'pending' || prompt.analysis_status === 'processing') && (
        <div
          className="text-center py-12"
          data-testid="analyzing-state"
        >
          <ScoreBadge status={prompt.analysis_status} size="lg" />
          <p className="mt-4 text-muted-foreground">
            {prompt.analysis_status === 'pending'
              ? 'This prompt is queued for analysis...'
              : 'Analyzing your prompt...'}
          </p>
        </div>
      )}

      {/* Failed state */}
      {prompt.analysis_status === 'failed' && (
        <div
          className="text-center py-12"
          data-testid="analysis-failed-state"
        >
          <ScoreBadge status="failed" size="lg" />
          <p className="mt-4 text-red-400">Analysis could not be completed</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Please try again later or contact support if the problem persists.
          </p>
        </div>
      )}
    </div>
  );
}
