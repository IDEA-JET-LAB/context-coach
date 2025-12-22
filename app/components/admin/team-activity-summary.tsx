'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface TeamActivitySummaryProps {
  recentPromptsCount: number;
  previousPeriodPromptsCount: number;
  mostActiveMembers?: Array<{ userId: string; name: string | null; count: number }>;
  lastPromptAt?: string | null;
}

export function TeamActivitySummary({
  recentPromptsCount,
  previousPeriodPromptsCount,
  mostActiveMembers = [],
  lastPromptAt,
}: TeamActivitySummaryProps) {
  const trend = recentPromptsCount - previousPeriodPromptsCount;
  const trendPercent =
    previousPeriodPromptsCount > 0
      ? Math.round((trend / previousPeriodPromptsCount) * 100)
      : recentPromptsCount > 0
        ? 100
        : 0;

  return (
    <Card className="bg-[#0f0f0f] border-[#2a2a2a]" data-testid="team-activity-section">
      <CardHeader>
        <CardTitle className="text-lg">Activity (Last 7 Days)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Prompts</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{recentPromptsCount}</span>
            {trend > 0 && (
              <span className="text-green-500 flex items-center text-sm">
                <TrendingUp className="h-4 w-4 mr-1" />
                +{trendPercent}%
              </span>
            )}
            {trend < 0 && (
              <span className="text-red-500 flex items-center text-sm">
                <TrendingDown className="h-4 w-4 mr-1" />
                {trendPercent}%
              </span>
            )}
            {trend === 0 && (
              <span className="text-muted-foreground flex items-center text-sm">
                <Minus className="h-4 w-4 mr-1" />
                0%
              </span>
            )}
          </div>
        </div>

        {mostActiveMembers.length > 0 && (
          <div>
            <span className="text-sm text-muted-foreground">Most Active</span>
            <ul className="mt-2 space-y-2">
              {mostActiveMembers.slice(0, 3).map((member, idx) => (
                <li key={member.userId} className="text-sm flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">{idx + 1}.</span>
                    <span>{member.name || member.userId}</span>
                  </span>
                  <span className="text-muted-foreground">{member.count} prompts</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {mostActiveMembers.length === 0 && recentPromptsCount === 0 && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No activity in the last 7 days</p>
          </div>
        )}

        {lastPromptAt && (
          <div className="pt-2 border-t border-[#2a2a2a]">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last prompt</span>
              <span className="text-foreground">
                {formatDistanceToNow(new Date(lastPromptAt), { addSuffix: true })}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
