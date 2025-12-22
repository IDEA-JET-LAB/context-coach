'use client';

import { DimensionBar } from '@/components/prompt-detail/dimension-bar';
import type { DimensionAverage } from '@/lib/hooks/use-personal-analytics';

interface DimensionBreakdownProps {
  dimensions: DimensionAverage[];
}

// Default suggestions for weak dimensions
const DIMENSION_SUGGESTIONS: Record<string, string> = {
  clarity: 'Try using more specific language and avoid ambiguous terms.',
  context: 'Include more background information about your situation or codebase.',
  specificity: 'Add concrete examples and specific requirements.',
  goal: 'Clearly state what you want to achieve or the expected outcome.',
  constraints: 'Mention any limitations, requirements, or boundaries.',
};

export function DimensionBreakdown({ dimensions }: DimensionBreakdownProps) {
  if (dimensions.length === 0) {
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
  const sorted = [...dimensions].sort((a, b) => a.avgScore - b.avgScore);
  const weakest = sorted.slice(0, 2);

  // Add suggestions to weak dimensions
  const weakestWithSuggestions = weakest.map((dim) => ({
    ...dim,
    suggestion:
      DIMENSION_SUGGESTIONS[dim.dimension.toLowerCase()] ||
      `Focus on improving your ${dim.dimension.toLowerCase()} scores.`,
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
            <div key={dim.dimension} className="space-y-1" data-testid={`focus-area-${dim.dimension}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#fafafa]">{dim.dimension}</span>
                <span className="text-sm text-muted-foreground">{dim.avgScore.toFixed(1)}</span>
              </div>
              <DimensionBar score={dim.avgScore} />
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
            <div key={dim.dimension} className="space-y-1" data-testid={`dimension-${dim.dimension}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#fafafa]">{dim.dimension}</span>
                <span className="text-sm text-muted-foreground">{dim.avgScore.toFixed(1)}</span>
              </div>
              <DimensionBar score={dim.avgScore} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
