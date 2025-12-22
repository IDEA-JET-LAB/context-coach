'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemberAnalytics } from '@/lib/hooks/use-member-analytics';
import { MemberDimensionBreakdown } from './member-dimension-breakdown';
import { ScoreBadge } from '@/components/feed/score-badge';
import { formatDistanceToNow } from 'date-fns';
import type { MemberPrompt } from '@/lib/hooks/use-member-analytics';
import { MessageSquare, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { TEXT_TRUNCATION, RECENT_PROMPTS_DISPLAY_COUNT, SCORE_THRESHOLDS } from '@/lib/constants/analytics';

interface MemberDetailProps {
  memberId: string | null;
  teamId: string;
  onClose: () => void;
}

function SimplePromptRow({ prompt }: { prompt: MemberPrompt }) {
  const truncatedText =
    prompt.text?.length > TEXT_TRUNCATION.MEMBER_DETAIL
      ? prompt.text.slice(0, TEXT_TRUNCATION.MEMBER_DETAIL) + '...'
      : (prompt.text || '');

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-3">
      <ScoreBadge
        score={prompt.analysis?.overall_score}
        status={prompt.analysis_status}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#fafafa] line-clamp-1">{truncatedText}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(prompt.created_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

function MemberDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-20 bg-[#1a1a1a]" />
        <Skeleton className="h-20 bg-[#1a1a1a]" />
      </div>
      <Skeleton className="h-32 bg-[#1a1a1a]" />
      <Skeleton className="h-48 bg-[#1a1a1a]" />
    </div>
  );
}

export function MemberDetail({ memberId, teamId, onClose }: MemberDetailProps) {
  const router = useRouter();
  const { data, isPending, error } = useMemberAnalytics(memberId, teamId);

  const handleViewAllPrompts = () => {
    if (memberId) {
      router.push(`/prompts?user=${memberId}`);
      onClose();
    }
  };

  return (
    <Sheet open={!!memberId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="w-full sm:max-w-xl bg-[#0a0a0a] border-[#2a2a2a] overflow-y-auto"
        data-testid="member-detail-panel"
      >
        <SheetHeader>
          <SheetTitle className="text-[#fafafa]">
            {data?.member.name ? `${data.member.name}'s Analytics` : 'Member Analytics'}
          </SheetTitle>
        </SheetHeader>

        {isPending ? (
          <div className="mt-6">
            <MemberDetailSkeleton />
          </div>
        ) : error ? (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-red-400">Failed to load member data</p>
          </div>
        ) : data ? (
          <div className="mt-6 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-[#1a1a1a] p-4 border border-[#2a2a2a]">
                <p className="text-sm text-muted-foreground">Prompts</p>
                <p className="text-2xl font-bold text-[#fafafa]" data-testid="member-prompt-count">
                  {data.promptCount}
                </p>
              </div>
              <div className="rounded-lg bg-[#1a1a1a] p-4 border border-[#2a2a2a]">
                <p className="text-sm text-muted-foreground">Avg Score</p>
                <p className={`text-2xl font-bold ${
                  data.avgScore >= SCORE_THRESHOLDS.GOOD ? 'text-teal-500' :
                  data.avgScore >= SCORE_THRESHOLDS.MODERATE ? 'text-amber-500' : 'text-red-400'
                }`} data-testid="member-avg-score">
                  {data.avgScore.toFixed(1)}
                </p>
              </div>
            </div>

            {/* Coaching Opportunities */}
            {data.coachingOpportunities && data.coachingOpportunities.length > 0 && (
              <div
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4"
                data-testid="coaching-opportunities"
              >
                <h3 className="font-medium text-amber-500 mb-2">
                  Coaching Opportunities
                </h3>
                <ul className="space-y-1">
                  {data.coachingOpportunities.map((opp, i) => (
                    <li key={`coaching-${i}`} className="text-sm text-amber-100">{opp}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Dimension Breakdown */}
            {data.dimensions && data.dimensions.length > 0 && (
              <div>
                <h3 className="font-medium text-[#fafafa] mb-3">Dimension Scores</h3>
                <MemberDimensionBreakdown dimensions={data.dimensions} />
              </div>
            )}

            {/* Recent Prompts */}
            <div>
              <h3 className="font-medium text-[#fafafa] mb-3">Recent Prompts</h3>
              <div className="space-y-2" data-testid="member-recent-prompts">
                {data.recentPrompts && data.recentPrompts.slice(0, RECENT_PROMPTS_DISPLAY_COUNT).map((prompt) => (
                  <SimplePromptRow key={prompt.id} prompt={prompt} />
                ))}
              </div>
              {(!data.recentPrompts || data.recentPrompts.length === 0) && (
                <p className="text-sm text-muted-foreground">No prompts yet</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="default"
                className="flex-1"
                disabled
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Share Feedback
              </Button>
              <Button
                variant="outline"
                size="default"
                className="flex-1"
                onClick={handleViewAllPrompts}
                data-testid="view-all-prompts-btn"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View All Prompts
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
