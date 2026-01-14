/**
 * StageDashboard - Story 31-9
 *
 * Main dashboard container for project stage analytics.
 * Renders summary cards, charts, timeline, and recent conversations.
 */

"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStageAnalytics } from "@/lib/hooks/use-stage-analytics";
import { StageAnalysisButton } from "@/components/conversations/StageAnalysisButton";
import { StageSummaryCards } from "./StageSummaryCards";
import { StageDistributionChart } from "./StageDistributionChart";
import { StagePromptChart } from "./StagePromptChart";
import { RecentStagedConversations } from "./RecentStagedConversations";
import { StageTimeline } from "@/components/analytics/stage-timeline";

export interface StageDashboardProps {
  projectId: string;
  className?: string;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Summary cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="mt-2 h-8 w-16" />
              <Skeleton className="mt-1 h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[280px]" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[280px]" />
          </CardContent>
        </Card>
      </div>

      {/* Timeline skeleton */}
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-[200px]" />
        </CardContent>
      </Card>

      {/* Recent conversations skeleton */}
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-[300px]" />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Main dashboard for project stage analytics.
 *
 * @example
 * <StageDashboard projectId="uuid" />
 */
export function StageDashboard({ projectId, className }: StageDashboardProps) {
  const { data, isPending, error, refetch } = useStageAnalytics(projectId);

  if (isPending) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <Card className={cn(className)} data-testid="stage-dashboard-error">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="mb-4 h-12 w-12 text-destructive" />
          <p className="mb-2 text-lg font-medium text-foreground">
            Failed to load analytics
          </p>
          <p className="mb-4 text-sm text-muted-foreground">
            {error.message || "An unexpected error occurred"}
          </p>
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const pendingSessions = data?.analysisStatus.pendingSessions || 0;
  const hasData = data && data.summary.sessionsAnalyzed > 0;

  return (
    <div className={cn("space-y-6", className)} data-testid="stage-dashboard">
      {/* Analysis needed banner */}
      {pendingSessions > 0 && (
        <Alert
          className="border-score-medium/30 bg-score-medium/10"
          data-testid="analysis-needed-banner"
        >
          <AlertTriangle className="h-4 w-4 text-score-medium" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-foreground">
              {pendingSessions} session{pendingSessions !== 1 ? "s" : ""} need
              stage analysis for complete data.
            </span>
            <StageAnalysisButton
              projectId={projectId}
              lastAnalyzedAt={data?.analysisStatus.lastAnalyzedAt || null}
              onAnalysisComplete={() => refetch()}
            />
          </AlertDescription>
        </Alert>
      )}

      {/* Summary cards */}
      <StageSummaryCards data={data} isLoading={isPending} />

      {/* Charts row */}
      {hasData ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <StageDistributionChart
            data={data?.summary.stageBreakdown}
            isLoading={isPending}
          />
          <StagePromptChart
            data={data?.summary.stageBreakdown}
            isLoading={isPending}
          />
        </div>
      ) : (
        <Card data-testid="stage-dashboard-no-data">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="mb-2 text-lg font-medium text-foreground">
              No stage data yet
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              Run stage analysis on your sessions to see analytics.
            </p>
            {pendingSessions > 0 && (
              <StageAnalysisButton
                projectId={projectId}
                lastAnalyzedAt={null}
                onAnalysisComplete={() => refetch()}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {hasData && <StageTimeline projectId={projectId} />}

      {/* Recent conversations */}
      <RecentStagedConversations projectId={projectId} limit={5} />
    </div>
  );
}
