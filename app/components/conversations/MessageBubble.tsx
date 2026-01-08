"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Bot, User, GitBranch, Cpu, Zap, ChevronDown, ChevronUp, MessageSquare, Brain, Wrench, CheckCircle2, XCircle } from "lucide-react";
import { PromptTypeBadge } from "./PromptTypeBadge";
import { ScoreBadge } from "@/components/feed/score-badge";
import { ThinkingSummary } from "./ThinkingSummary";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ConversationMessage,
  ToolExecution,
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
 * AssistantMessageBubble - Tabbed layout for assistant responses
 * Shows Response tab by default, with Thinking and Tools tabs when available
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
  const contentNeedsTruncation = message.content.length > 300 || message.content.split("\n").length > 4;

  // Check for extra content that warrants tabs
  const hasThinking = response?.thinkingText || response?.thinkingSummary;
  const hasTools = (response?.toolExecutions && response.toolExecutions.length > 0) ||
    (response?.toolsUsed && response.toolsUsed.length > 0);

  // Show tabs if we have thinking or detailed tool info
  const showTabs = hasThinking || hasTools;

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
          {/* Token usage */}
          {response?.tokensIn !== undefined && (
            <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {response.tokensIn} → {response.tokensOut || 0}
            </span>
          )}
        </div>

        {/* Content with optional tabs */}
        {showTabs ? (
          <Tabs defaultValue="response" className="px-3 py-2">
            <TabsList className="h-7 text-xs">
              <TabsTrigger value="response" className="text-xs h-6 px-2 gap-1">
                <MessageSquare className="h-3 w-3" />
                Response
              </TabsTrigger>
              {hasThinking && (
                <TabsTrigger value="thinking" className="text-xs h-6 px-2 gap-1">
                  <Brain className="h-3 w-3" />
                  Thinking
                  {response?.thinkingWordCount && (
                    <span className="text-[10px] text-muted-foreground">
                      ({response.thinkingWordCount}w)
                    </span>
                  )}
                </TabsTrigger>
              )}
              {hasTools && (
                <TabsTrigger value="tools" className="text-xs h-6 px-2 gap-1">
                  <Wrench className="h-3 w-3" />
                  Tools
                  <span className="text-[10px] text-muted-foreground">
                    ({response?.toolExecutions?.length || response?.toolsUsed?.length || 0})
                  </span>
                </TabsTrigger>
              )}
            </TabsList>

            {/* Response Tab */}
            <TabsContent value="response" className="mt-2">
              <ResponseContent
                content={message.content}
                toolsUsed={response?.toolsUsed}
                isExpanded={isExpanded}
                needsTruncation={contentNeedsTruncation}
                getPreviewText={getPreviewText}
                onToggleExpand={() => setIsExpanded(!isExpanded)}
              />
            </TabsContent>

            {/* Thinking Tab */}
            {hasThinking && (
              <TabsContent value="thinking" className="mt-2">
                <ThinkingContent
                  thinkingText={response?.thinkingText}
                  thinkingSummary={response?.thinkingSummary}
                  wordCount={response?.thinkingWordCount || 0}
                />
              </TabsContent>
            )}

            {/* Tools Tab */}
            {hasTools && (
              <TabsContent value="tools" className="mt-2">
                <ToolsContent
                  toolExecutions={response?.toolExecutions}
                  toolsUsed={response?.toolsUsed}
                />
              </TabsContent>
            )}
          </Tabs>
        ) : (
          // Simple content without tabs
          <div className="px-3 py-2">
            <ResponseContent
              content={message.content}
              toolsUsed={response?.toolsUsed}
              isExpanded={isExpanded}
              needsTruncation={contentNeedsTruncation}
              getPreviewText={getPreviewText}
              onToggleExpand={() => setIsExpanded(!isExpanded)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ResponseContent - Response text with expand/collapse
 */
function ResponseContent({
  content,
  toolsUsed,
  isExpanded,
  needsTruncation,
  getPreviewText,
  onToggleExpand,
}: {
  content: string;
  toolsUsed?: string[];
  isExpanded: boolean;
  needsTruncation: boolean;
  getPreviewText: () => string;
  onToggleExpand: () => void;
}) {
  return (
    <div>
      {content ? (
        <p className="text-sm text-foreground whitespace-pre-wrap break-words">
          {isExpanded || !needsTruncation ? content : getPreviewText()}
          {!isExpanded && needsTruncation && "..."}
        </p>
      ) : toolsUsed && toolsUsed.length > 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Used {toolsUsed.length} tool{toolsUsed.length !== 1 ? "s" : ""}: {toolsUsed.slice(0, 3).join(", ")}
          {toolsUsed.length > 3 && ` and ${toolsUsed.length - 3} more`}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          (Tool execution - no visible output)
        </p>
      )}

      {/* Expand/Collapse Toggle */}
      {needsTruncation && (
        <button
          onClick={onToggleExpand}
          className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
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
    </div>
  );
}

/**
 * ThinkingContent - Full thinking text display
 */
function ThinkingContent({
  thinkingText,
  thinkingSummary,
  wordCount,
}: {
  thinkingText?: string;
  thinkingSummary?: string;
  wordCount: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const displayText = thinkingText || thinkingSummary || "";
  const needsTruncation = displayText.length > 500;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Brain className="h-3 w-3" />
        <span>{wordCount} words of internal reasoning</span>
      </div>

      <div className="bg-muted/30 rounded-md p-3 border border-border/50">
        <p className="text-sm text-foreground/80 whitespace-pre-wrap break-words italic">
          {isExpanded || !needsTruncation
            ? displayText
            : displayText.slice(0, 500) + "..."}
        </p>

        {needsTruncation && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                Show full thinking ({wordCount} words)
              </>
            )}
          </button>
        )}
      </div>

      {!thinkingText && thinkingSummary && (
        <p className="text-[10px] text-muted-foreground italic">
          Note: Only summary available. Full thinking requires import with thinking capture enabled.
        </p>
      )}
    </div>
  );
}

/**
 * ToolsContent - Tool executions list with details
 */
function ToolsContent({
  toolExecutions,
  toolsUsed,
}: {
  toolExecutions?: ToolExecution[];
  toolsUsed?: string[];
}) {
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  const toggleTool = (toolId: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  };

  // If we have detailed tool executions, show those
  if (toolExecutions && toolExecutions.length > 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wrench className="h-3 w-3" />
          <span>{toolExecutions.length} tool execution{toolExecutions.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="space-y-1">
          {toolExecutions.map((tool) => (
            <ToolExecutionItem
              key={tool.id}
              tool={tool}
              isExpanded={expandedTools.has(tool.id)}
              onToggle={() => toggleTool(tool.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  // Fallback: just show tool names
  if (toolsUsed && toolsUsed.length > 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wrench className="h-3 w-3" />
          <span>{toolsUsed.length} tool{toolsUsed.length !== 1 ? "s" : ""} used</span>
        </div>

        <div className="flex flex-wrap gap-1">
          {toolsUsed.map((tool, idx) => (
            <span
              key={idx}
              className="inline-flex items-center px-2 py-1 text-xs bg-muted rounded text-muted-foreground"
            >
              {tool}
            </span>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground italic">
          Detailed tool input/output requires import with tool capture enabled.
        </p>
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground italic">No tools used in this response.</p>
  );
}

/**
 * ToolExecutionItem - Single tool execution with expandable details
 */
function ToolExecutionItem({
  tool,
  isExpanded,
  onToggle,
}: {
  tool: ToolExecution;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-muted/30 rounded-md border border-border/50 overflow-hidden">
      {/* Tool Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
      >
        <span className="text-xs font-mono font-medium text-foreground">
          {tool.toolName}
        </span>

        {tool.success !== undefined && (
          tool.success ? (
            <CheckCircle2 className="h-3 w-3 text-score-high" />
          ) : (
            <XCircle className="h-3 w-3 text-score-low" />
          )
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          #{tool.executionOrder}
        </span>

        {isExpanded ? (
          <ChevronUp className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        )}
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/50">
          {/* Input Summary */}
          {tool.inputSummary && (
            <div>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Input
              </span>
              <p className="text-xs text-foreground/80 font-mono whitespace-pre-wrap break-all mt-0.5">
                {tool.inputSummary}
              </p>
            </div>
          )}

          {/* Output Summary */}
          {tool.outputSummary && (
            <div>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Output
              </span>
              <p className="text-xs text-foreground/80 font-mono whitespace-pre-wrap break-all mt-0.5">
                {tool.outputSummary}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MessageBubble;
