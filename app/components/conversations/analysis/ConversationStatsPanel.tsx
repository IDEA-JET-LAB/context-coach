'use client';

/**
 * ConversationStatsPanel - Story 30-6: Analysis Panel UI
 *
 * A comprehensive stats panel that displays conversation analytics
 * including token usage, tools, agents, context window, and outcome.
 */

import {
  Clock,
  MessageSquare,
  BarChart3,
  RefreshCw,
  AlertCircle,
  Wrench,
  Users,
  Target,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useConversationStats } from '@/lib/hooks/use-conversation-stats';
import { formatTokens } from '@/lib/analysis/token-estimator';
import { cn } from '@/lib/utils';
import { ContextWindowGauge } from './ContextWindowGauge';
import { ToolBreakdown } from './ToolBreakdown';
import { AgentBreakdown } from './AgentBreakdown';
import { OutcomeIndicator } from './OutcomeIndicator';

interface ConversationStatsPanelProps {
  /** The session database UUID */
  sessionId: string;
  /** Optional className for custom styling */
  className?: string;
}

/**
 * ConversationStatsPanel
 *
 * Displays comprehensive conversation statistics including:
 * - Basic stats (duration, turns)
 * - Token usage breakdown
 * - Context window usage
 * - Tool usage breakdown
 * - Agent/subagent breakdown
 * - Session outcome
 */
export function ConversationStatsPanel({
  sessionId,
  className,
}: ConversationStatsPanelProps) {
  const { data: stats, isPending, error, refetch } = useConversationStats(sessionId);

  // Loading state
  if (isPending) {
    return <ConversationStatsPanelSkeleton className={className} />;
  }

  // Error state
  if (error) {
    return (
      <Card className={cn('border-destructive/50', className)}>
        <CardContent className="p-4">
          <div className="flex flex-col items-center text-center">
            <AlertCircle className="h-8 w-8 text-destructive mb-2" />
            <p className="text-sm font-medium">Failed to load stats</p>
            <p className="text-xs text-muted-foreground mt-1">
              {error.message}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="mt-3"
            >
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No stats (shouldn't happen, but handle gracefully)
  if (!stats) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Session Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatItem
            icon={<Clock className="h-4 w-4" />}
            label="Duration"
            value={
              stats.durationMinutes !== null
                ? formatDuration(stats.durationMinutes)
                : stats.isOngoing
                ? 'Ongoing'
                : 'Unknown'
            }
          />
          <StatItem
            icon={<MessageSquare className="h-4 w-4" />}
            label="Turns"
            value={stats.turnCount.toString()}
          />
        </div>

        {/* Token Usage */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            Token Usage
          </div>
          <div className="grid grid-cols-3 gap-2">
            <TokenStat label="In" value={stats.tokens.input} />
            <TokenStat label="Out" value={stats.tokens.output} />
            <TokenStat label="Total" value={stats.tokens.total} highlight />
          </div>
        </div>

        {/* Context Window */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            Context Window
          </div>
          <ContextWindowGauge
            peakPercentage={stats.contextWindow.peakPercentage}
            peakTurn={stats.contextWindow.peakTurn}
            avgPercentage={stats.contextWindow.avgPercentage}
          />
        </div>

        {/* Tools */}
        {stats.tools.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Wrench className="h-3 w-3" />
              Tools Used
            </div>
            <ToolBreakdown tools={stats.tools} />
          </div>
        )}

        {/* Agents */}
        {stats.agents.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3 w-3" />
              Subagents
            </div>
            <AgentBreakdown agents={stats.agents} />
          </div>
        )}

        {/* Outcome */}
        <div className="space-y-2 pt-2 border-t">
          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Target className="h-3 w-3" />
            Outcome
          </div>
          <OutcomeIndicator outcome={stats.outcome} />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Loading skeleton for the stats panel
 */
function ConversationStatsPanelSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic stats */}
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>

        {/* Token usage */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        </div>

        {/* Context window */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-3 w-32" />
        </div>

        {/* Tools */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>

        {/* Outcome */}
        <div className="space-y-2 pt-2 border-t">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Small stat item with icon, label, and value
 */
function StatItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
      <span className="text-muted-foreground">{icon}</span>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-medium">{value}</span>
      </div>
    </div>
  );
}

/**
 * Token stat display
 */
function TokenStat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center p-2 rounded-md',
        highlight ? 'bg-primary/10' : 'bg-muted/50'
      )}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-sm font-medium tabular-nums',
          highlight && 'text-primary'
        )}
      >
        {formatTokens(value)}
      </span>
    </div>
  );
}

/**
 * Formats duration in minutes to human-readable string
 */
function formatDuration(minutes: number): string {
  if (minutes < 1) {
    return '<1 min';
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

export default ConversationStatsPanel;
