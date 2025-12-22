'use client';

import { DimensionBar } from './dimension-bar';
import type { DimensionScore, DimensionSuggestion } from '@/lib/types/analysis';
import { cn } from '@/lib/utils';
import { Lightbulb, ThumbsUp } from 'lucide-react';

interface DimensionCardProps {
  name: string;
  dimensionScore: DimensionScore;
  suggestion?: DimensionSuggestion;
}

function getScoreTextColor(score: number): string {
  if (score >= 7) return 'text-teal-500';
  if (score >= 4) return 'text-amber-500';
  return 'text-red-400';
}

export function DimensionCard({ name, dimensionScore, suggestion }: DimensionCardProps) {
  const { score, reasoning } = dimensionScore;
  const isReinforcement = suggestion?.type === 'reinforcement';

  return (
    <div
      className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4"
      data-testid="dimension-card"
      data-dimension={name}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-[#fafafa]" data-testid="dimension-name">
          {name}
        </h3>
        <span
          className={cn('text-lg font-bold', getScoreTextColor(score))}
          data-testid="dimension-score"
        >
          {score.toFixed(1)}
        </span>
      </div>

      <DimensionBar score={score} />

      {reasoning && (
        <p
          className="mt-3 text-xs text-muted-foreground"
          data-testid="dimension-reasoning"
        >
          {reasoning}
        </p>
      )}

      {suggestion && (
        <div
          className={cn(
            'mt-3 p-3 rounded-md',
            isReinforcement ? 'bg-teal-500/10' : 'bg-amber-500/10'
          )}
          data-testid="dimension-suggestion"
          data-suggestion-type={suggestion.type}
        >
          <div className="flex items-start gap-2">
            {isReinforcement ? (
              <ThumbsUp className="h-4 w-4 mt-0.5 text-teal-500 flex-shrink-0" />
            ) : (
              <Lightbulb className="h-4 w-4 mt-0.5 text-amber-500 flex-shrink-0" />
            )}
            <div>
              <p
                className={cn(
                  'text-sm',
                  isReinforcement ? 'text-teal-400' : 'text-amber-400'
                )}
                data-testid="suggestion-message"
              >
                {suggestion.message}
              </p>
              {suggestion.example && (
                <p
                  className="mt-2 text-xs text-muted-foreground italic"
                  data-testid="suggestion-example"
                >
                  Example: {suggestion.example}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
