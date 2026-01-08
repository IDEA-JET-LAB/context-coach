"use client";

/**
 * ConversationThreadClient - Story 25-5: Connect Conversations UI
 *
 * Client component for conversation thread with API-powered data fetching,
 * real-time updates, and message navigation.
 */

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreBadge } from "@/components/feed/score-badge";
import {
  StageBadge,
  LoopIndicator,
  MessageBubble,
  formatDuration,
  ConversationMessage,
  ProjectStage,
} from "@/components/conversations";
import {
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ArrowLeft,
  GitBranch,
  Folder,
  Clock,
  MessageSquare,
  Calendar,
  Terminal,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useConversation } from "@/lib/hooks/use-conversations";
import { useRealtimeConversationThread } from "@/lib/hooks/use-realtime-conversations";

interface ConversationThreadClientProps {
  sessionId: string;
  teamId: string;
}

/**
 * ConversationThreadClient - Two-column layout for conversation thread
 *
 * Left/Center: Scrollable message thread
 * Right Sidebar: Session metadata, analysis, debugging loop info
 */
export function ConversationThreadClient({
  sessionId,
  teamId,
}: ConversationThreadClientProps) {
  const threadRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Fetch conversation data
  const { data, isPending, error, refetch } = useConversation(sessionId, {
    includeResponses: true,
    includeTools: true,
  });

  // Real-time updates - use conversation.id (database UUID) for subscription
  // and sessionId for cache key
  const conversationUuid = data?.data?.conversation?.id;
  useRealtimeConversationThread(conversationUuid, sessionId);

  // Extract data from response
  const conversation = data?.data?.conversation;
  const apiMessages = data?.data?.messages || [];

  // Map API messages to component type
  const messages: ConversationMessage[] = useMemo(() => {
    return apiMessages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      sequenceNumber: m.sequenceNumber,
      promptType: m.promptType as ConversationMessage["promptType"],
      score: m.score,
      detectedStage: m.detectedStage as ConversationMessage["detectedStage"],
      isInDebuggingLoop: m.isInDebuggingLoop,
      metadata: m.model
        ? {
            model: m.model,
            inputTokens: m.tokensIn,
            outputTokens: m.tokensOut,
          }
        : undefined,
      response:
        m.role === "assistant"
          ? {
              id: m.id,
              responseText: m.content,
              thinkingSummary: m.thinkingSummary,
              thinkingWordCount: m.thinkingWordCount,
              thinkingText: m.thinkingText,
              toolCount: m.toolCount || 0,
              toolsUsed: m.toolsUsed || [],
              toolExecutions: m.toolExecutions,
              model: m.model,
              tokensIn: m.tokensIn,
              tokensOut: m.tokensOut,
              stopReason: m.stopReason,
            }
          : undefined,
      analysis: m.analysis
        ? {
            overallScore: m.analysis.overallScore,
            dimensions: m.analysis.dimensions as {
              clarity: number;
              context: number;
              specificity: number;
              actionability: number;
              efficiency: number;
            },
            feedback: m.analysis.feedback,
          }
        : undefined,
    }));
  }, [apiMessages]);

  // Get user messages for navigation
  const userMessages = useMemo(
    () => messages.filter((m) => m.role === "user"),
    [messages]
  );
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);

  // Scroll to first message on initial load
  useEffect(() => {
    if (messages.length === 0) return;

    const firstMessage = userMessages[0];
    if (firstMessage) {
      const firstRef = messageRefs.current.get(firstMessage.id);
      firstRef?.scrollIntoView({ behavior: "auto", block: "start" });
    }
  }, [messages.length, userMessages]);

  const navigateToPrompt = useCallback(
    (index: number) => {
      const targetMessage = userMessages[index];
      if (!targetMessage) return;
      setCurrentPromptIndex(index);
      const messageRef = messageRefs.current.get(targetMessage.id);
      messageRef?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [userMessages]
  );

  const goToPrevious = () => navigateToPrompt(currentPromptIndex - 1);
  const goToNext = () => navigateToPrompt(currentPromptIndex + 1);

  // Group messages by timestamp (within same minute)
  const groupedMessages = useMemo(() => {
    return messages.reduce(
      (
        acc,
        message,
        idx
      ): Array<
        | { type: "divider"; timestamp: string }
        | { type: "message"; message: ConversationMessage }
      > => {
        const prevMessage = messages[idx - 1];
        const currentDate = new Date(message.timestamp);
        const prevDate = prevMessage ? new Date(prevMessage.timestamp) : null;

        // Check if we need a time divider
        const needsDivider =
          !prevDate ||
          currentDate.getTime() - prevDate.getTime() > 5 * 60 * 1000 || // 5 min gap
          currentDate.toDateString() !== prevDate.toDateString(); // Different day

        if (needsDivider) {
          acc.push({
            type: "divider" as const,
            timestamp: message.timestamp,
          });
        }

        acc.push({
          type: "message" as const,
          message,
        });

        return acc;
      },
      [] as Array<
        | { type: "divider"; timestamp: string }
        | { type: "message"; message: ConversationMessage }
      >
    );
  }, [messages]);

  // Count messages in debugging loops
  const loopMessageCount = messages.filter((m) => m.isInDebuggingLoop).length;

  // Calculate duration
  const duration =
    conversation?.endedAt && conversation?.startedAt
      ? Math.round(
          (new Date(conversation.endedAt).getTime() -
            new Date(conversation.startedAt).getTime()) /
            (1000 * 60)
        )
      : conversation?.duration || null;

  // Format date/time
  const formattedDate = conversation?.startedAt
    ? new Date(conversation.startedAt).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const formattedTime = conversation?.startedAt
    ? new Date(conversation.startedAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  // Calculate average score from user messages with scores
  const scoredMessages = messages.filter((m) => m.role === "user" && m.score);
  const avgScore =
    scoredMessages.length > 0
      ? scoredMessages.reduce((sum, m) => sum + (m.score || 0), 0) /
        scoredMessages.length
      : null;

  // Error state
  if (error) {
    return (
      <div className="flex-1 w-full flex flex-col h-[calc(100vh-4rem)]">
        <div className="flex items-center gap-3 pb-4 shrink-0">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/conversations">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold">Conversation</h1>
          </div>
        </div>

        <Card className="flex-1">
          <CardContent className="flex flex-col items-center justify-center h-full">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-medium">
              Failed to load conversation
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {error.message}
            </p>
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="mt-4"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (isPending || !conversation) {
    return (
      <div className="flex-1 w-full flex flex-col h-[calc(100vh-4rem)]">
        <div className="flex items-center gap-3 pb-4 shrink-0">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/conversations">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <Skeleton className="h-6 w-64 mb-2" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>

        <div className="flex-1 flex gap-6 min-h-0">
          <div className="flex-1 min-w-0 overflow-y-auto pr-2">
            <div className="space-y-4 pb-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          <aside className="w-80 shrink-0">
            <Card>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full flex flex-col h-[calc(100vh-4rem)]">
      {/* Fixed Header: Back + Title + Navigation */}
      <div className="flex items-center gap-3 pb-4 shrink-0">
        {/* Back Button */}
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/conversations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        {/* Title & Metadata */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">
            {conversation.slug || "Unnamed Session"}
          </h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {conversation.projectName && (
              <span className="flex items-center gap-1">
                <Folder className="h-3.5 w-3.5" />
                {conversation.projectName}
              </span>
            )}
            {conversation.gitBranch && (
              <span className="flex items-center gap-1">
                <GitBranch className="h-3.5 w-3.5" />
                {conversation.gitBranch}
              </span>
            )}
          </div>
        </div>

        {/* Refresh Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch()}
          className="h-8 w-8 shrink-0"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>

        {/* Prompt Navigation */}
        {userMessages.length > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={goToPrevious}
              disabled={currentPromptIndex === 0}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground min-w-[4rem] text-center">
              {currentPromptIndex + 1} of {userMessages.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToNext}
              disabled={currentPromptIndex === userMessages.length - 1}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Two-column scrollable area */}
      <div className="flex-1 flex gap-6 min-h-0">
        {/* Left/Center Column - Message Thread */}
        <div className="flex-1 min-w-0 overflow-y-auto pr-2">
          <div ref={threadRef} className="space-y-4 pb-4">
            {groupedMessages.map((item, idx) => {
              if (item.type === "divider") {
                return (
                  <TimeDivider key={`divider-${idx}`} timestamp={item.timestamp} />
                );
              }

              const isUserMessage = item.message.role === "user";

              return (
                <div
                  key={item.message.id}
                  ref={
                    isUserMessage
                      ? (el) => {
                          if (el) messageRefs.current.set(item.message.id, el);
                        }
                      : undefined
                  }
                >
                  <MessageBubble
                    message={item.message}
                    showDetails={isUserMessage}
                  />
                </div>
              );
            })}

            {/* Empty State */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No messages in this conversation yet.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Session Info & Analysis (independently scrollable) */}
        <aside className="w-80 shrink-0 overflow-y-auto">
          <div className="space-y-4 pb-4">
            {/* Session Metadata */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Session Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {formattedDate} at {formattedTime}
                  </span>
                </div>
                {duration !== null && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{formatDuration(duration)}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span>{conversation.userMessageCount} messages</span>
                </div>
                {conversation.claudeCodeVersion && (
                  <div className="flex items-center gap-2 text-sm">
                    <Terminal className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-xs">
                      Claude Code v{conversation.claudeCodeVersion}
                    </span>
                  </div>
                )}
                {conversation.cwd && (
                  <div className="text-xs font-mono text-muted-foreground truncate mt-2 pt-2 border-t">
                    {conversation.cwd}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Analysis Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Stage Badge */}
                {conversation.primaryStage && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Stage</span>
                    <StageBadge stage={conversation.primaryStage as ProjectStage} />
                  </div>
                )}

                {/* Loop Indicator */}
                {conversation.hasDebuggingLoop && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Status
                    </span>
                    <LoopIndicator variant="badge" />
                  </div>
                )}

                {/* Score */}
                {avgScore !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Avg. Score
                    </span>
                    <ScoreBadge score={avgScore} />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Debugging Loop Warning */}
            {conversation.hasDebuggingLoop && (
              <Card className="border-score-growth/50 bg-score-growth/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-score-growth shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-score-growth text-sm">
                        Debugging Loop Detected
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {loopMessageCount} message
                        {loopMessageCount !== 1 ? "s" : ""} in a debugging loop.
                        Consider:
                      </p>
                      <ul className="text-xs text-muted-foreground mt-2 list-disc list-inside space-y-0.5">
                        <li>Providing more architectural context</li>
                        <li>Starting with clearer requirements</li>
                        <li>Breaking into smaller steps</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Score Breakdown (if we have user messages with analysis) */}
            {scoredMessages.length > 0 && scoredMessages[0]?.analysis && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Score Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(
                      scoredMessages[0]?.analysis?.dimensions ?? {}
                    ).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground capitalize w-20">
                          {key}
                        </span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${(value as number) * 10}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium w-8 text-right">
                          {(value as number).toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * TimeDivider - Visual separator between message groups
 */
function TimeDivider({ timestamp }: { timestamp: string }) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  let dateLabel: string;
  if (isToday) {
    dateLabel = "Today";
  } else if (isYesterday) {
    dateLabel = "Yesterday";
  } else {
    dateLabel = date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  const timeLabel = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs text-muted-foreground">
        {dateLabel} at {timeLabel}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

export default ConversationThreadClient;
