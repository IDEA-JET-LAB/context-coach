'use client';

import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRightLeft,
  Target,
} from 'lucide-react';
import type { InsightsComplexity, InsightsTiming, InsightsSummary } from '@/lib/types/insights';

export interface ComparisonPanelProps {
  currentSummary: InsightsSummary;
  complexity: InsightsComplexity;
  timing: InsightsTiming;
  loading?: boolean;
  className?: string;
}

interface MetricComparison {
  label: string;
  currentValue: string | number;
  previousValue?: string | number;
  change?: number;
  benchmark?: string | number;
  unit?: string;
}

export function ComparisonPanel({
  currentSummary,
  complexity,
  timing,
  loading = false,
  className,
}: ComparisonPanelProps) {
  if (loading) {
    return (
      <div
        className={cn('rounded-lg border border-border bg-card p-4', className)}
        data-testid="comparison-panel-loading"
      >
        <div className="h-4 w-48 animate-pulse rounded bg-muted mb-4" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const metrics: MetricComparison[] = [
    {
      label: 'Average Score',
      currentValue: currentSummary.avgPromptScore?.toFixed(1) ?? 'N/A',
      change: currentSummary.scoreChange ?? undefined,
      benchmark: '7.0',
      unit: '',
    },
    {
      label: 'Session Duration',
      currentValue: currentSummary.avgSessionDurationMinutes.toFixed(0),
      benchmark: '30',
      unit: 'min',
    },
    {
      label: 'Prompt Complexity',
      currentValue: complexity.avgComplexity.toFixed(1),
      benchmark: '5.0',
      unit: '/10',
    },
    {
      label: 'Avg Chars/Prompt',
      currentValue: complexity.avgCharsPerPrompt,
      benchmark: '150',
      unit: '',
    },
    {
      label: 'Rapid Fire Rate',
      currentValue: (timing.rapidFireRate * 100).toFixed(0),
      benchmark: '<20',
      unit: '%',
    },
    {
      label: 'Response Gap',
      currentValue: timing.medianGapSeconds,
      benchmark: '30-120',
      unit: 's',
    },
  ];

  // Complexity distribution
  const totalComplexity = complexity.distribution.simple +
    complexity.distribution.moderate +
    complexity.distribution.complex || 1;

  return (
    <div
      className={cn('rounded-lg border border-border bg-card p-4', className)}
      data-testid="comparison-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Efficiency Metrics</h3>
        </div>
        <span className="text-xs text-muted-foreground">vs. Benchmarks</span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        {metrics.map((metric) => {
          const hasChange = metric.change !== undefined;
          const TrendIcon = hasChange
            ? metric.change! > 0 ? TrendingUp : metric.change! < 0 ? TrendingDown : Minus
            : null;
          const trendColor = hasChange
            ? metric.change! > 0 ? 'text-score-high' : metric.change! < 0 ? 'text-score-growth' : 'text-muted-foreground'
            : '';

          return (
            <div
              key={metric.label}
              className="p-3 rounded-lg bg-muted/30"
            >
              <p className="text-xs text-muted-foreground mb-1">{metric.label}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-foreground">
                  {metric.currentValue}
                </span>
                {metric.unit && (
                  <span className="text-xs text-muted-foreground">{metric.unit}</span>
                )}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground">
                  Benchmark: {metric.benchmark}{metric.unit}
                </span>
                {TrendIcon && (
                  <div className={cn('flex items-center gap-0.5', trendColor)}>
                    <TrendIcon className="h-3 w-3" />
                    <span className="text-xs">
                      {metric.change! > 0 ? '+' : ''}{metric.change!.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Complexity Distribution */}
      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground mb-2">Prompt Complexity Distribution</p>
        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <div className="flex h-3 rounded-full overflow-hidden">
              <div
                className="bg-score-high transition-all duration-300"
                style={{ width: `${(complexity.distribution.simple / totalComplexity) * 100}%` }}
              />
              <div
                className="bg-primary transition-all duration-300"
                style={{ width: `${(complexity.distribution.moderate / totalComplexity) * 100}%` }}
              />
              <div
                className="bg-score-growth transition-all duration-300"
                style={{ width: `${(complexity.distribution.complex / totalComplexity) * 100}%` }}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-between text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-score-high" />
            <span className="text-muted-foreground">
              Simple ({complexity.distribution.simple})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-muted-foreground">
              Moderate ({complexity.distribution.moderate})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-score-growth" />
            <span className="text-muted-foreground">
              Complex ({complexity.distribution.complex})
            </span>
          </div>
        </div>
      </div>

      {/* Code Inclusion Rate */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Code Inclusion Rate</span>
          <span className="text-sm font-medium text-foreground">
            {(complexity.codeInclusionRate * 100).toFixed(0)}%
          </span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${complexity.codeInclusionRate * 100}%` }}
          />
        </div>
      </div>

      {/* Accessible description */}
      <span className="sr-only">
        Efficiency metrics comparison panel.
        Average score: {currentSummary.avgPromptScore?.toFixed(1) ?? 'N/A'}.
        Session duration: {currentSummary.avgSessionDurationMinutes.toFixed(0)} minutes.
        Complexity: {complexity.avgComplexity.toFixed(1)} out of 10.
      </span>
    </div>
  );
}
