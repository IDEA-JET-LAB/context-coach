"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StageBadge } from "./StageBadge";
import { SourceBadge } from "./SourceBadge";
import { LoopIndicator } from "./LoopIndicator";
import { ScoreBadge } from "@/components/feed/score-badge";
import { ConversationSummary, formatDuration } from "./types";
import {
  ArrowLeft,
  GitBranch,
  Folder,
  Clock,
  MessageSquare,
  Calendar,
  ExternalLink,
} from "lucide-react";

interface ConversationHeaderProps {
  conversation: ConversationSummary;
  showBreadcrumb?: boolean;
  className?: string;
}

/**
 * ConversationHeader - Header section for conversation thread view
 *
 * Shows project link, session slug, metadata, and status badges
 */
export function ConversationHeader({
  conversation,
  showBreadcrumb = true,
  className,
}: ConversationHeaderProps) {
  const {
    slug,
    projectId,
    projectName,
    startedAt,
    endedAt,
    userMessageCount,
    totalMessages,
    primaryStage,
    hasDebuggingLoop,
    conversationScore,
    gitBranch,
    cwd,
    claudeCodeVersion,
    isImported,
  } = conversation;

  // Calculate duration
  const duration = endedAt
    ? Math.round(
        (new Date(endedAt).getTime() - new Date(startedAt).getTime()) /
          (1000 * 60)
      )
    : null;

  const formattedDate = new Date(startedAt).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const formattedTime = new Date(startedAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className={cn("space-y-4", className)}>
      {/* Breadcrumb */}
      {showBreadcrumb && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/conversations" className="flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back to Conversations
            </Link>
          </Button>
        </div>
      )}

      {/* Header Card */}
      <Card>
        <CardContent className="p-4">
          {/* Project and Branch Row */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {projectName ? (
              <Link
                href={`/projects/${projectId}`}
                className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <Folder className="h-4 w-4" />
                {projectName}
                <ExternalLink className="h-3 w-3" />
              </Link>
            ) : (
              <span className="flex items-center gap-1.5">
                <Folder className="h-4 w-4" />
                Unlinked Project
              </span>
            )}
            {gitBranch && (
              <span className="flex items-center gap-1.5">
                <GitBranch className="h-4 w-4" />
                {gitBranch}
              </span>
            )}
          </div>

          {/* Session Slug Title */}
          <h1 className="text-xl font-semibold mt-2">
            {slug || "Unnamed Session"}
          </h1>

          {/* Metadata Row */}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {formattedDate} at {formattedTime}
            </span>
            {duration !== null && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {formatDuration(duration)}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4" />
              {userMessageCount || totalMessages} messages
            </span>
            {claudeCodeVersion && (
              <span className="text-xs font-mono">
                Claude Code v{claudeCodeVersion}
              </span>
            )}
          </div>

          {/* CWD */}
          {cwd && (
            <p className="text-xs font-mono text-muted-foreground mt-2 truncate">
              {cwd}
            </p>
          )}

          {/* Badges Row */}
          <div className="flex items-center gap-2 mt-4">
            <SourceBadge source={isImported ? "imported" : "live"} />
            {primaryStage && <StageBadge stage={primaryStage} />}
            {hasDebuggingLoop && <LoopIndicator variant="badge" />}
            {conversationScore !== null && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Score:</span>
                <ScoreBadge score={conversationScore / 10} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ConversationHeader;
