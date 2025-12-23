'use client';

import { useState } from 'react';
import { ArrowUpDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MemberDetail } from './member-detail';
import type { MemberStats } from '@/lib/hooks/use-team-analytics';
import { SCORE_THRESHOLDS } from '@/lib/constants/analytics';

interface MemberBreakdownProps {
  members: MemberStats[];
  teamId: string;
}

function TrendIcon({ trend }: { trend: string }) {
  switch (trend) {
    case 'up':
      return <TrendingUp className="h-4 w-4 text-teal-500" />;
    case 'down':
      return <TrendingDown className="h-4 w-4 text-red-400" />;
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
}

export function MemberBreakdown({ members, teamId }: MemberBreakdownProps) {
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'score' | 'count'>('score');

  const sorted = [...members].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'score':
        return b.avgScore - a.avgScore;
      case 'count':
        return b.promptCount - a.promptCount;
    }
  });

  if (members.length === 0) {
    return (
      <div
        className="rounded-lg border border-border bg-card p-8 text-center"
        data-testid="member-breakdown-empty"
      >
        <p className="text-muted-foreground">No team member activity yet</p>
      </div>
    );
  }

  return (
    <>
      <div
        className="rounded-lg border border-border overflow-hidden"
        data-testid="member-breakdown"
      >
        <table className="w-full">
          <thead className="bg-card">
            <tr>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSortBy('name')}
                  className={cn(
                    'h-auto py-1 px-2',
                    sortBy === 'name' && 'text-foreground'
                  )}
                >
                  Member
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSortBy('count')}
                  className={cn(
                    'h-auto py-1 px-2',
                    sortBy === 'count' && 'text-foreground'
                  )}
                >
                  Prompts
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSortBy('score')}
                  className={cn(
                    'h-auto py-1 px-2',
                    sortBy === 'score' && 'text-foreground'
                  )}
                >
                  Avg Score
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                Trend
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((member) => (
              <tr
                key={member.userId}
                onClick={() => setSelectedMember(member.userId)}
                className="border-t border-border cursor-pointer hover:bg-card transition-colors"
                data-testid={`member-row-${member.userId}`}
              >
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm text-foreground">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-foreground">{member.name}</span>
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">{member.promptCount}</td>
                <td className="p-3">
                  <span
                    className={cn(
                      'font-medium',
                      member.avgScore >= SCORE_THRESHOLDS.GOOD ? 'text-teal-500' :
                      member.avgScore >= SCORE_THRESHOLDS.MODERATE ? 'text-amber-500' : 'text-red-400'
                    )}
                  >
                    {member.avgScore.toFixed(1)}
                  </span>
                </td>
                <td className="p-3">
                  <TrendIcon trend={member.trend} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MemberDetail
        memberId={selectedMember}
        teamId={teamId}
        onClose={() => setSelectedMember(null)}
      />
    </>
  );
}
