"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { StageBadge } from "./StageBadge";
import { LoopIndicator } from "./LoopIndicator";
import { ScoreBadge } from "@/components/feed/score-badge";
import {
  ConversationSummary,
  formatDuration,
  formatRelativeTime,
} from "./types";
import { MessageSquare, Clock, GitBranch, Folder } from "lucide-react";

interface ConversationCardProps {
  conversation: ConversationSummary;
  onClick?: () => void;
  selected?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * ConversationCard - Displays a conversation/session summary
 *
 * Shows: slug, project, date, duration, message count, stage, score, loop status
 */
export function ConversationCard({
  conversation,
  onClick,
  selected = false,
  compact = false,
  className,
}: ConversationCardProps) {
  const {
    slug,
    projectName,
    startedAt,
    endedAt,
    userMessageCount,
    totalMessages,
    primaryStage,
    hasDebuggingLoop,
    conversationScore,
    gitBranch,
  } = conversation;

  // Calculate duration in minutes
  const duration = endedAt
    ? Math.round(
        (new Date(endedAt).getTime() - new Date(startedAt).getTime()) /
          (1000 * 60)
      )
    : null;

  return (
    <Card
      className={cn(
        "transition-colors cursor-pointer",
        selected
          ? "border-primary bg-surface-hover"
          : "hover:bg-surface-hover hover:border-primary/50",
        className
      )}
      onClick={onClick}
      data-testid="conversation-card"
    >
      <CardContent className={cn("p-4", compact && "p-3")}>
        {/* Header: Slug and Date */}
        <div className="flex items-start justify-between gap-2">
          <h3
            className={cn(
              "font-medium text-foreground truncate",
              compact ? "text-sm" : "text-base"
            )}
            title={slug}
          >
            {slug || "Unnamed Session"}
          </h3>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatRelativeTime(startedAt)}
          </span>
        </div>

        {/* Project and Branch */}
        <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
          {projectName && (
            <span className="flex items-center gap-1 truncate">
              <Folder className="h-3.5 w-3.5" />
              {projectName}
            </span>
          )}
          {gitBranch && (
            <span className="flex items-center gap-1 truncate">
              <GitBranch className="h-3.5 w-3.5" />
              {gitBranch}
            </span>
          )}
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            {userMessageCount || totalMessages} messages
          </span>
          {duration !== null && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(duration)}
            </span>
          )}
        </div>

        {/* Badges Row */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {primaryStage && <StageBadge stage={primaryStage} size="sm" />}
          {hasDebuggingLoop && <LoopIndicator variant="badge" />}
          {conversationScore !== null && (
            <ScoreBadge score={conversationScore / 10} size="sm" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ConversationCard;
