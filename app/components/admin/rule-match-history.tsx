'use client';

/**
 * Rule Match History Component
 * Story 22-2: Classification Rule Editor - Task 10
 *
 * Shows recent prompts that matched a rule.
 */

import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, TrendingUp } from 'lucide-react';

interface RuleMatchHistoryProps {
  matches: Array<{
    id: string;
    text: string;
    created_at: string;
  }>;
  matchCount: number;
  lastMatchedAt: string | null;
}

export function RuleMatchHistory({
  matches,
  matchCount,
  lastMatchedAt,
}: RuleMatchHistoryProps) {
  return (
    <Card className="border-border bg-surface-secondary sticky top-6">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          Match History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-surface-tertiary">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-3 w-3" />
              <span className="text-xs">Total Matches</span>
            </div>
            <p className="text-xl font-bold text-foreground">
              {matchCount.toLocaleString()}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-surface-tertiary">
            <div className="text-xs text-muted-foreground mb-1">Last Match</div>
            <p className="text-sm font-medium text-foreground">
              {lastMatchedAt
                ? formatDistanceToNow(new Date(lastMatchedAt), { addSuffix: true })
                : 'Never'}
            </p>
          </div>
        </div>

        {/* Recent Matches */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Recent Matches</span>
            <Badge variant="secondary" className="text-xs">
              {matches.length} shown
            </Badge>
          </div>

          {matches.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No matching prompts found recently
            </p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {matches.map((match) => (
                <div
                  key={match.id}
                  className="p-2 rounded bg-surface-primary text-sm"
                >
                  <p className="text-foreground line-clamp-2">{match.text}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(match.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
