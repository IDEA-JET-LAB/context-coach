'use client';

import { Gauge } from '@/components/charts';
import { InsightCard } from '@/components/analytics';
import type { DimensionScore, DimensionSuggestion } from '@/lib/types/analysis';
import { cn } from '@/lib/utils';

interface DimensionCardProps {
  name: string;
  dimensionScore: DimensionScore;
  suggestion?: DimensionSuggestion;
}

export function DimensionCard({ name, dimensionScore, suggestion }: DimensionCardProps) {
  const { score, reasoning } = dimensionScore;
  const isReinforcement = suggestion?.type === 'reinforcement';

  return (
    <div
      className="rounded-lg border border-border bg-card p-4"
      data-testid="dimension-card"
      data-dimension={name}
    >
      <div className="flex items-start gap-4">
        {/* Gauge for score visualization */}
        <div className="flex-shrink-0">
          <Gauge
            value={score}
            label={name}
            size="sm"
            data-testid="dimension-gauge"
          />
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-foreground" data-testid="dimension-name">
              {name}
            </h3>
            <span
              className={cn(
                'text-lg font-bold',
                score >= 7 ? 'text-score-high' : score >= 4 ? 'text-score-medium' : 'text-score-growth'
              )}
              data-testid="dimension-score"
            >
              {score.toFixed(1)}
            </span>
          </div>

          {reasoning && (
            <p
              className="text-xs text-muted-foreground mb-3"
              data-testid="dimension-reasoning"
            >
              {reasoning}
            </p>
          )}

          {suggestion && (
            <InsightCard
              type={isReinforcement ? 'achievement' : 'suggestion'}
              message={suggestion.message}
              details={suggestion.example ? `Example: ${suggestion.example}` : undefined}
              dismissible={false}
              className="mt-2"
              data-testid="dimension-suggestion"
              data-suggestion-type={suggestion.type}
            />
          )}
        </div>
      </div>
    </div>
  );
}
