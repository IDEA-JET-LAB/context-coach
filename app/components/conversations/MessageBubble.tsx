"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Bot, User, GitBranch, Cpu, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { PromptTypeBadge } from "./PromptTypeBadge";
import { ScoreBadge } from "@/components/feed/score-badge";
import { ThinkingSummary } from "./ThinkingSummary";
import {
  ConversationMessage,
  formatRelativeTime,
} from "./types";

interface MessageBubbleProps {
  message: ConversationMessage;
  showDetails?: boolean;
  className?: string;
}

/**
 * MessageBubble - Displays a single message in the conversation thread
 *
 * User messages: Side-by-side layout with prompt on left, analysis on right
 * Assistant messages: Full-width with tool usage summary
 */
export function MessageBubble({
  message,
  showDetails = true,
  className,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const hasAnalysis = showDetails && !!message.analysis;

  // User messages get side-by-side layout
  if (isUser) {
    return (
      <UserMessageBubble
        message={message}
        showAnalysis={hasAnalysis}
        className={className}
      />
    );
  }

  // Assistant messages stay full-width
  return (
    <AssistantMessageBubble message={message} className={className} />
  );
}

/**
 * UserMessageBubble - Side-by-side layout for user prompts
 */
function UserMessageBubble({
  message,
  showAnalysis,
  className,
}: {
  message: ConversationMessage;
  showAnalysis: boolean;
  className?: string;
}) {
  const { analysis, metadata } = message;

  return (
    <div
      className={cn("flex flex-col gap-1", className)}
      data-testid="message-bubble-user"
    >
      {/* Timestamp */}
      <span className="text-xs text-muted-foreground">
        {formatRelativeTime(message.timestamp)}
      </span>

      {/* Side-by-side Container */}
      <div className="flex gap-4">
        {/* Left: Prompt Content */}
        <div className="flex-1 min-w-0 bg-primary/10 border border-primary/20 rounded-lg">
          {/* Header */}
          <div className="flex items-center gap-2 px-3 pt-2">
            <User className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">
              You
            </span>
            {message.promptType && (
              <PromptTypeBadge type={message.promptType} size="sm" />
            )}
          </div>

          {/* Content */}
          <div className="px-3 py-2">
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">
              {message.content}
            </p>
          </div>

          {/* Metadata Footer */}
          {metadata && (
            <div className="px-3 pb-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground border-t border-primary/10 pt-2">
              {metadata.gitBranch && (
                <span className="flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  <span className="font-mono">{metadata.gitBranch}</span>
                </span>
              )}
              {metadata.model && (
                <span className="flex items-center gap-1">
                  <Cpu className="h-3 w-3" />
                  <span className="font-mono text-[10px]">
                    {metadata.model.replace("claude-", "").replace("-20251101", "")}
                  </span>
                </span>
              )}
              {metadata.inputTokens !== undefined && (
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  {metadata.inputTokens} → {metadata.outputTokens || 0}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Analysis Panel */}
        {showAnalysis && analysis && (
          <div className="w-64 shrink-0 bg-surface border border-border rounded-lg p-3">
            {/* Score Header */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground">
                Analysis
              </span>
              <ScoreBadge score={message.score ?? analysis.overallScore} />
            </div>

            {/* Dimension Bars */}
            <div className="space-y-2">
              {Object.entries(analysis.dimensions).map(([key, value]) => (
                <DimensionBar key={key} label={key} value={value} />
              ))}
            </div>

            {/* Feedback */}
            {analysis.feedback && (
              <p className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                {analysis.feedback}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * DimensionBar - Visual score bar for a single dimension
 */
function DimensionBar({ label, value }: { label: string; value: number }) {
  // Color based on score
  const getBarColor = (score: number) => {
    if (score >= 8) return "bg-score-high";
    if (score >= 6) return "bg-score-medium";
    if (score >= 4) return "bg-score-growth";
    return "bg-score-low";
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground capitalize w-20 truncate">
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", getBarColor(value))}
          style={{ width: `${value * 10}%` }}
        />
      </div>
      <span className="text-xs font-medium w-6 text-right">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

/**
 * AssistantMessageBubble - Collapsible layout for assistant responses
 * Shows first 3 lines by default, expandable on click
 */
function AssistantMessageBubble({
  message,
  className,
}: {
  message: ConversationMessage;
  className?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { response } = message;

  // Check if content needs truncation (roughly 3 lines = ~300 chars or has newlines)
  const needsTruncation = message.content.length > 300 || message.content.split("\n").length > 4;

  // Get preview text (first ~3 lines)
  const getPreviewText = () => {
    const lines = message.content.split("\n").slice(0, 3);
    let preview = lines.join("\n");
    if (preview.length > 300) {
      preview = preview.slice(0, 300);
    }
    return preview;
  };

  return (
    <div
      className={cn("flex flex-col gap-1", className)}
      data-testid="message-bubble-assistant"
    >
      {/* Timestamp */}
      <span className="text-xs text-muted-foreground">
        {formatRelativeTime(message.timestamp)}
      </span>

      {/* Message Container */}
      <div className="max-w-[90%] bg-surface border border-border rounded-lg">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 pt-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            Claude
          </span>
          {response?.model && (
            <span className="text-[10px] font-mono text-muted-foreground/70">
              {response.model.replace("claude-", "").replace("-20251101", "")}
            </span>
          )}
          {/* Tool count badge */}
          {response?.toolsUsed && response.toolsUsed.length > 0 && (
            <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
              {response.toolsUsed.length} tools
            </span>
          )}
        </div>

        {/* Content - Collapsible */}
        <div className="px-3 py-2">
          <p className="text-sm text-foreground whitespace-pre-wrap break-words">
            {isExpanded || !needsTruncation ? message.content : getPreviewText()}
            {!isExpanded && needsTruncation && "..."}
          </p>
        </div>

        {/* Expand/Collapse Toggle */}
        {needsTruncation && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border-t border-border/50 transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                Show more
              </>
            )}
          </button>
        )}

        {/* Tool Usage & Tokens (only when expanded) */}
        {isExpanded && response && (response.toolsUsed?.length > 0 || response.tokensIn) && (
          <div className="px-3 pb-2 flex flex-wrap items-center gap-2 border-t border-border/50 pt-2">
            {/* Tools Used */}
            {response.toolsUsed && response.toolsUsed.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {response.toolsUsed.map((tool, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-1.5 py-0.5 text-xs bg-muted rounded text-muted-foreground"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            )}
            {/* Token Count */}
            {response.tokensIn !== undefined && (
              <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {response.tokensIn} → {response.tokensOut || 0}
              </span>
            )}
          </div>
        )}

        {/* Thinking Summary (only when expanded) */}
        {isExpanded && response?.thinkingSummary && (
          <div className="px-3 pb-3 border-t border-border/50 pt-2">
            <ThinkingSummary
              summary={response.thinkingSummary}
              wordCount={response.thinkingWordCount || 0}
              truncated={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default MessageBubble;
