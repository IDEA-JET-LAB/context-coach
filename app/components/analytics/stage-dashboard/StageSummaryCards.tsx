/**
 * StageSummaryCards - Story 31-9
 *
 * Displays 4 summary metric cards for stage analytics:
 * - Active Time
 * - Primary Stage
 * - Stages Used
 * - Avg Session Duration
 */

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Target, Layers, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGE_CONFIG, formatDuration } from "@/components/conversations/types";
import type { ProjectStageAnalytics } from "@/lib/types/stage-analytics";
import type { ProjectStage } from "@/lib/types/conversations";

export interface StageSummaryCardsProps {
  data?: ProjectStageAnalytics;
  isLoading?: boolean;
  className?: string;
}

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  colorClass?: string;
}

function SummaryCardSkeleton() {
  return (
    <Card data-testid="stage-summary-card-loading">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-4" />
        </div>
        <Skeleton className="mt-2 h-8 w-16" />
        <Skeleton className="mt-1 h-3 w-24" />
      </CardContent>
    </Card>
  );
}

function SummaryCard({ title, value, subtitle, icon: Icon, colorClass }: SummaryCardProps) {
  return (
    <Card data-testid="stage-summary-card">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="mt-2">
          <span className={cn("text-2xl font-bold text-foreground", colorClass)}>
            {value}
          </span>
        </div>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Renders 4 summary cards for stage analytics.
 *
 * @example
 * <StageSummaryCards data={stageAnalytics} isLoading={isLoading} />
 */
export function StageSummaryCards({
  data,
  isLoading = false,
  className,
}: StageSummaryCardsProps) {
  if (isLoading) {
    return (
      <div
        className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}
        data-testid="stage-summary-cards-loading"
      >
        <SummaryCardSkeleton />
        <SummaryCardSkeleton />
        <SummaryCardSkeleton />
        <SummaryCardSkeleton />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // Get primary stage config
  const primaryStage = data.primaryStage as ProjectStage;
  const stageConfig = STAGE_CONFIG[primaryStage] || STAGE_CONFIG.unknown;

  // Count unique stages used
  const stagesUsed = data.summary.stageBreakdown.length;

  // Format total active time
  const totalMinutes = Math.round(data.summary.totalActiveMinutes);
  const activeTimeFormatted = formatDuration(totalMinutes);

  // Format average session duration
  const avgMinutes = Math.round(data.averageSessionMinutes);
  const avgSessionFormatted = formatDuration(avgMinutes);

  return (
    <div
      className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}
      data-testid="stage-summary-cards"
    >
      <SummaryCard
        title="Active Time"
        value={activeTimeFormatted}
        subtitle={`${data.summary.totalPrompts.toLocaleString()} prompts`}
        icon={Clock}
      />
      <SummaryCard
        title="Primary Stage"
        value={stageConfig.label}
        subtitle={`${data.summary.stageBreakdown[0]?.percentage || 0}% of time`}
        icon={Target}
        colorClass={stageConfig.color}
      />
      <SummaryCard
        title="Stages Used"
        value={stagesUsed.toString()}
        subtitle="distinct stages"
        icon={Layers}
      />
      <SummaryCard
        title="Avg Session"
        value={avgSessionFormatted}
        subtitle={`${data.summary.sessionsAnalyzed} sessions analyzed`}
        icon={BarChart3}
      />
    </div>
  );
}
