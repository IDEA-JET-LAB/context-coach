'use client';

import { DimensionBar } from '@/components/prompt-detail/dimension-bar';
import type { DimensionAverage } from '@/lib/hooks/use-personal-analytics';
import {
  DIMENSION_SUGGESTIONS,
  DEFAULT_DIMENSION_SUGGESTION,
  FOCUS_AREA_COUNT,
} from '@/lib/constants/analytics';

interface DimensionBreakdownProps {
  dimensions: DimensionAverage[];
}

export function DimensionBreakdown({ dimensions }: DimensionBreakdownProps) {
  if (!dimensions || dimensions.length === 0) {
    return (
      <div
        className="flex h-full items-center justify-center text-muted-foreground"
        data-testid="dimension-breakdown-empty"
      >
        No dimension data available
      </div>
    );
  }

  // Sort by score ascending (weakest first)
  const sorted = [...dimensions].sort((a, b) => (a.avgScore ?? 0) - (b.avgScore ?? 0));
  const weakest = sorted.slice(0, FOCUS_AREA_COUNT);

  // Add suggestions to weak dimensions
  const weakestWithSuggestions = weakest.map((dim) => ({
    ...dim,
    suggestion:
      DIMENSION_SUGGESTIONS[dim.dimension?.toLowerCase() ?? ''] ||
      DEFAULT_DIMENSION_SUGGESTION(dim.dimension ?? 'dimension'),
  }));

  return (
    <div className="space-y-6" data-testid="dimension-breakdown">
      {/* Focus Areas */}
      <div
        className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4"
        data-testid="focus-areas"
      >
        <h3 className="mb-3 font-medium text-amber-500">Focus Areas</h3>
        <div className="space-y-3">
          {weakestWithSuggestions.map((dim) => (
            <div key={dim.dimension ?? 'unknown'} className="space-y-1" data-testid={`focus-area-${dim.dimension}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#fafafa]">{dim.dimension ?? 'Unknown'}</span>
                <span className="text-sm text-muted-foreground">{(dim.avgScore ?? 0).toFixed(1)}</span>
              </div>
              <DimensionBar score={dim.avgScore ?? 0} />
              <p className="text-xs text-muted-foreground pl-1">{dim.suggestion}</p>
            </div>
          ))}
        </div>
      </div>

      {/* All Dimensions */}
      <div data-testid="all-dimensions">
        <h3 className="mb-3 font-medium text-[#fafafa]">All Dimensions</h3>
        <div className="space-y-3">
          {dimensions.map((dim) => (
            <div key={dim.dimension ?? 'unknown'} className="space-y-1" data-testid={`dimension-${dim.dimension}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#fafafa]">{dim.dimension ?? 'Unknown'}</span>
                <span className="text-sm text-muted-foreground">{(dim.avgScore ?? 0).toFixed(1)}</span>
              </div>
              <DimensionBar score={dim.avgScore ?? 0} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
