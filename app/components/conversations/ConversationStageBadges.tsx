"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StageBadge } from "./StageBadge";
import { StageBreakdownTooltip } from "./StageBreakdownTooltip";
import {
  SessionStageBreakdown,
  ProjectStage,
  STAGE_CONFIG,
} from "./types";

interface ConversationStageBadgesProps {
  /** Stage breakdown data from session analysis */
  stageBreakdown?: SessionStageBreakdown | null;
  /** Fallback primary stage when no breakdown is available */
  primaryStage?: ProjectStage | null;
  /** Maximum number of badges to show (default: 3) */
  maxBadges?: number;
  /** Badge size */
  size?: "sm" | "md";
  /** Additional CSS classes */
  className?: string;
}

interface StageEntry {
  stage: ProjectStage;
  activeMinutes: number;
  promptCount: number;
  percentage: number;
}

/**
 * ConversationStageBadges - Displays multiple stage badges for a conversation
 *
 * Shows up to maxBadges stage badges ordered by active time (most active first).
 * Displays a "+N" indicator if there are more stages than maxBadges.
 * Shows a tooltip with full breakdown on hover.
 * Falls back to single primaryStage badge when no breakdown is available.
 */
export function ConversationStageBadges({
  stageBreakdown,
  primaryStage,
  maxBadges = 3,
  size = "sm",
  className,
}: ConversationStageBadgesProps) {
  // If no breakdown available, fall back to primary stage
  if (!stageBreakdown || Object.keys(stageBreakdown.stages).length === 0) {
    if (primaryStage) {
      return (
        <div className={cn("flex items-center gap-1", className)}>
          <StageBadge stage={primaryStage} size={size} />
        </div>
      );
    }
    return null;
  }

  // Sort stages by active minutes descending
  const sortedStages: StageEntry[] = Object.entries(stageBreakdown.stages)
    .filter(([, data]) => data.activeMinutes > 0 || data.promptCount > 0)
    .map(([stage, data]) => ({
      stage: stage as ProjectStage,
      activeMinutes: data.activeMinutes,
      promptCount: data.promptCount,
      percentage: data.percentage,
    }))
    .sort((a, b) => b.activeMinutes - a.activeMinutes);

  // If no stages with activity, fall back to primary stage
  if (sortedStages.length === 0) {
    if (primaryStage) {
      return (
        <div className={cn("flex items-center gap-1", className)}>
          <StageBadge stage={primaryStage} size={size} />
        </div>
      );
    }
    return null;
  }

  const visibleStages = sortedStages.slice(0, maxBadges);
  const remainingCount = sortedStages.length - maxBadges;
  const hasMore = remainingCount > 0;

  const badgesContent = (
    <div
      className={cn("flex items-center gap-1 flex-wrap", className)}
      data-testid="conversation-stage-badges"
    >
      {visibleStages.map(({ stage }) => (
        <StageBadge key={stage} stage={stage} size={size} />
      ))}
      {hasMore && (
        <span
          className={cn(
            "inline-flex items-center font-medium rounded-md text-muted-foreground bg-muted/50",
            size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-xs"
          )}
          data-testid="stage-badges-overflow"
        >
          +{remainingCount}
        </span>
      )}
    </div>
  );

  // Wrap with tooltip showing full breakdown
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-pointer">{badgesContent}</div>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        className="p-0 bg-background border border-border shadow-lg"
      >
        <StageBreakdownTooltip breakdown={stageBreakdown} />
      </TooltipContent>
    </Tooltip>
  );
}

export default ConversationStageBadges;
