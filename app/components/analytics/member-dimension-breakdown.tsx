'use client';

import { cn } from '@/lib/utils';
import type { DimensionScore } from '@/lib/hooks/use-member-analytics';

interface MemberDimensionBreakdownProps {
  dimensions: DimensionScore[];
}

export function MemberDimensionBreakdown({ dimensions }: MemberDimensionBreakdownProps) {
  if (dimensions.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No dimension data available
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="member-dimension-breakdown">
      {dimensions.map((dim) => {
        const percentage = (dim.score / dim.maxScore) * 100;
        const colorClass = dim.score >= 7 ? 'bg-teal-500' :
                          dim.score >= 4 ? 'bg-amber-500' : 'bg-red-400';

        return (
          <div key={dim.name} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{dim.name}</span>
              <span className={cn(
                'font-medium',
                dim.score >= 7 ? 'text-teal-500' :
                dim.score >= 4 ? 'text-amber-500' : 'text-red-400'
              )}>
                {dim.score.toFixed(1)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#2a2a2a]">
              <div
                className={cn('h-full rounded-full transition-all', colorClass)}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
