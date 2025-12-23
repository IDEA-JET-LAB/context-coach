'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, X, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import type { ScorePreviewResult, DimensionWeight } from '@/lib/types/scoring-weights';

export interface WeightPreviewProps {
  currentWeights: DimensionWeight[];
  onClose: () => void;
}

// Sample prompts for preview (in real implementation, these would come from actual data)
const SAMPLE_PROMPTS = [
  {
    id: '1',
    text: 'Help me write a function that sorts an array of objects by a specific property...',
    dimensionScores: {
      clarity: 8,
      context: 6,
      specificity: 7,
      goal: 8,
      constraints: 5,
    },
  },
  {
    id: '2',
    text: 'Create a dashboard component that displays analytics with charts...',
    dimensionScores: {
      clarity: 7,
      context: 5,
      specificity: 6,
      goal: 7,
      constraints: 4,
    },
  },
  {
    id: '3',
    text: 'Refactor the authentication module to use OAuth 2.0...',
    dimensionScores: {
      clarity: 9,
      context: 8,
      specificity: 8,
      goal: 9,
      constraints: 7,
    },
  },
];

// Default weights for comparison
const DEFAULT_WEIGHTS: Record<string, number> = {
  clarity: 20,
  context: 20,
  specificity: 25,
  goal: 20,
  constraints: 15,
};

function calculateScore(
  dimensionScores: Record<string, number>,
  weights: Record<string, number>
): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [dimension, score] of Object.entries(dimensionScores)) {
    const weight = weights[dimension.toLowerCase()] ?? 0;
    weightedSum += score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return weightedSum / totalWeight;
}

export function WeightPreview({ currentWeights, onClose }: WeightPreviewProps) {
  const [isLoading] = useState(false);

  // Convert current weights to a map
  const currentWeightMap: Record<string, number> = {};
  currentWeights.forEach((w) => {
    currentWeightMap[w.name.toLowerCase()] = w.enabled ? w.weight : 0;
  });

  // Calculate scores for sample prompts
  const previewResults: ScorePreviewResult = {
    samplePrompts: SAMPLE_PROMPTS.map((prompt) => {
      const originalScore = calculateScore(prompt.dimensionScores, DEFAULT_WEIGHTS);
      const newScore = calculateScore(prompt.dimensionScores, currentWeightMap);

      const dimensionScores: Record<string, { original: number; new: number }> = {};
      for (const [dim, score] of Object.entries(prompt.dimensionScores)) {
        const origWeight = DEFAULT_WEIGHTS[dim.toLowerCase()] ?? 0;
        const newWeight = currentWeightMap[dim.toLowerCase()] ?? 0;
        dimensionScores[dim] = {
          original: (score * origWeight) / 100,
          new: (score * newWeight) / 100,
        };
      }

      return {
        id: prompt.id,
        text: prompt.text,
        originalScore,
        newScore,
        dimensionScores,
      };
    }),
    averageChange: 0,
  };

  // Calculate average change
  if (previewResults.samplePrompts.length > 0) {
    previewResults.averageChange =
      previewResults.samplePrompts.reduce(
        (sum, p) => sum + (p.newScore - p.originalScore),
        0
      ) / previewResults.samplePrompts.length;
  }

  const totalNewWeight = Object.values(currentWeightMap).reduce((sum, w) => sum + w, 0);
  const isWeightsValid = totalNewWeight === 100;

  return (
    <Card className="border-border bg-background" data-testid="weight-preview">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Score Impact Preview
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} data-testid="close-preview">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isWeightsValid && (
          <div
            className="flex items-center gap-2 p-3 rounded-lg bg-score-growth/10 text-score-growth text-sm"
            data-testid="preview-warning"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>
              Weights must sum to 100% for accurate preview. Current total: {totalNewWeight}%
            </span>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <>
            {/* Average Change Summary */}
            <div
              className="rounded-lg border border-border p-4 bg-card"
              data-testid="average-change"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Average Score Change</span>
                <div className="flex items-center gap-2">
                  {previewResults.averageChange > 0 ? (
                    <TrendingUp className="h-4 w-4 text-score-high" />
                  ) : previewResults.averageChange < 0 ? (
                    <TrendingDown className="h-4 w-4 text-score-growth" />
                  ) : (
                    <Minus className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Badge
                    className={cn(
                      previewResults.averageChange > 0
                        ? 'bg-score-high/20 text-score-high hover:bg-score-high/30'
                        : previewResults.averageChange < 0
                          ? 'bg-score-growth/20 text-score-growth hover:bg-score-growth/30'
                          : 'bg-muted text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {previewResults.averageChange > 0 ? '+' : ''}
                    {previewResults.averageChange.toFixed(2)}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Sample Prompts */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Sample Prompts</p>
              {previewResults.samplePrompts.map((sample, index) => (
                <div
                  key={sample.id}
                  className="rounded-lg border border-border p-4 bg-card space-y-3"
                  data-testid={`preview-sample-${index}`}
                >
                  <p className="text-sm text-foreground line-clamp-2">"{sample.text}"</p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Original:</span>
                      <Badge variant="secondary">{sample.originalScore.toFixed(1)}</Badge>
                    </div>
                    <span className="text-muted-foreground">→</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">New:</span>
                      <Badge
                        className={cn(
                          sample.newScore > sample.originalScore
                            ? 'bg-score-high/20 text-score-high hover:bg-score-high/30'
                            : sample.newScore < sample.originalScore
                              ? 'bg-score-growth/20 text-score-growth hover:bg-score-growth/30'
                              : 'bg-muted text-muted-foreground hover:bg-muted'
                        )}
                      >
                        {sample.newScore.toFixed(1)}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground ml-auto">
                      ({sample.newScore > sample.originalScore ? '+' : ''}
                      {(sample.newScore - sample.originalScore).toFixed(1)})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
