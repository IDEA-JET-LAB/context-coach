/**
 * RecentStagedConversations - Story 31-9
 *
 * Displays a list of recent conversations with their stage badges,
 * duration, and timestamp. Links to conversation detail pages.
 */

"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STAGE_CONFIG,
  formatDuration,
  formatRelativeTime,
} from "@/components/conversations/types";
import { useConversations } from "@/lib/hooks/use-conversations";
import type { ProjectStage } from "@/lib/types/conversations";

export interface RecentStagedConversationsProps {
  projectId: string;
  limit?: number;
  className?: string;
}

function ConversationSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b border-border py-3 last:border-0">
      <Skeleton className="h-10 w-10 rounded-lg" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-4 w-4" />
    </div>
  );
}

function ListSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent className="px-4">
        <ConversationSkeleton />
        <ConversationSkeleton />
        <ConversationSkeleton />
        <ConversationSkeleton />
        <ConversationSkeleton />
      </CardContent>
    </Card>
  );
}

function StageBadge({ stage }: { stage: ProjectStage }) {
  const config = STAGE_CONFIG[stage] || STAGE_CONFIG.unknown;
  return (
    <Badge
      variant="secondary"
      className={cn("text-xs", config.bgColor, config.color)}
    >
      {config.label}
    </Badge>
  );
}

/**
 * Renders a list of recent conversations with stage information.
 *
 * @example
 * <RecentStagedConversations projectId="uuid" limit={5} />
 */
export function RecentStagedConversations({
  projectId,
  limit = 5,
  className,
}: RecentStagedConversationsProps) {
  const { data, isPending, error } = useConversations({
    projectId,
    sortBy: "date",
    limit,
  });

  if (isPending) {
    return <ListSkeleton />;
  }

  if (error) {
    return (
      <Card className={cn(className)} data-testid="recent-conversations-error">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            Recent Conversations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Failed to load conversations
          </div>
        </CardContent>
      </Card>
    );
  }

  const conversations = data?.data?.conversations || [];

  if (conversations.length === 0) {
    return (
      <Card className={cn(className)} data-testid="recent-conversations-empty">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            Recent Conversations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No conversations yet
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(className)} data-testid="recent-staged-conversations">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">
          Recent Conversations
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        {conversations.map((conversation) => {
          // Calculate duration if both started and ended timestamps exist
          let duration: number | null = null;
          if (conversation.startedAt && conversation.endedAt) {
            const startTime = new Date(conversation.startedAt).getTime();
            const endTime = new Date(conversation.endedAt).getTime();
            duration = Math.round((endTime - startTime) / (1000 * 60));
          }

          return (
            <Link
              key={conversation.id}
              href={`/conversations/${conversation.sessionId}`}
              className="group flex items-center gap-3 border-b border-border py-3 transition-colors last:border-0 hover:bg-muted/50"
            >
              {/* Message count indicator */}
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                <span className="text-sm font-medium text-muted-foreground">
                  {conversation.userMessageCount}
                </span>
              </div>

              {/* Conversation details */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {conversation.slug || `Session ${conversation.sessionId.slice(0, 8)}`}
                  </span>
                  {conversation.primaryStage && (
                    <StageBadge stage={conversation.primaryStage as ProjectStage} />
                  )}
                </div>

                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  {duration !== null && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(duration)}
                    </span>
                  )}
                  <span>{formatRelativeTime(conversation.startedAt)}</span>
                </div>
              </div>

              {/* Arrow */}
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
