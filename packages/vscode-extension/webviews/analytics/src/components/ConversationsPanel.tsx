import React, { useState } from "react";

// Types
interface ConversationSummary {
  id: string;
  sessionId: string;
  slug: string;
  projectName: string | null;
  startedAt: string;
  endedAt: string | null;
  messageCount: number;
  primaryStage: string | null;
  hasDebuggingLoop: boolean;
  conversationScore: number | null;
  gitBranch: string | null;
}

interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  promptType?: string;
  score?: number;
  toolsUsed?: string[];
}

interface ConversationsPanelProps {
  conversations: ConversationSummary[];
  selectedConversation: ConversationSummary | null;
  messages: ConversationMessage[];
  isLoading: boolean;
  onSelectConversation: (conversation: ConversationSummary) => void;
  onBack: () => void;
  onRefresh: () => void;
  onOpenInBrowser: () => void;
}

// Stage colors (matching design system)
const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  architecture: { bg: "rgba(59, 130, 246, 0.15)", text: "#3B82F6" },
  specification: { bg: "rgba(139, 92, 246, 0.15)", text: "#8B5CF6" },
  development: { bg: "rgba(34, 197, 94, 0.15)", text: "#22C55E" },
  debugging: { bg: "rgba(245, 158, 11, 0.15)", text: "#F59E0B" },
  enhancement: { bg: "rgba(20, 184, 166, 0.15)", text: "#14B8A6" },
};

// Format duration
function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return "ongoing";
  const start = new Date(startedAt);
  const end = new Date(endedAt);
  const minutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * ConversationsPanel - VS Code extension panel for browsing conversations
 */
export const ConversationsPanel: React.FC<ConversationsPanelProps> = ({
  conversations,
  selectedConversation,
  messages,
  isLoading,
  onSelectConversation,
  onBack,
  onRefresh,
  onOpenInBrowser,
}) => {
  // Show conversation thread if one is selected
  if (selectedConversation) {
    return (
      <ConversationThread
        conversation={selectedConversation}
        messages={messages}
        isLoading={isLoading}
        onBack={onBack}
      />
    );
  }

  // Show conversation list
  return (
    <div className="conversations-panel">
      {/* Header */}
      <div className="conversations-header">
        <div className="conversations-title">
          <span>Recent Conversations</span>
          <span className="conversations-count">{conversations.length}</span>
        </div>
        <div className="conversations-actions">
          <button
            className="icon-button"
            onClick={onRefresh}
            title="Refresh"
            disabled={isLoading}
          >
            <RefreshIcon spinning={isLoading} />
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && conversations.length === 0 && (
        <div className="conversations-loading">
          <div className="loading-spinner" />
          <span>Loading conversations...</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && conversations.length === 0 && (
        <div className="conversations-empty">
          <ConversationsEmptyIcon />
          <p>No conversations yet</p>
          <span>Start a Claude Code session to see conversations here</span>
        </div>
      )}

      {/* Conversation List */}
      {conversations.length > 0 && (
        <div className="conversations-list">
          {conversations.map((conv) => (
            <ConversationCard
              key={conv.id}
              conversation={conv}
              onClick={() => onSelectConversation(conv)}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="conversations-footer">
        <button className="link-button" onClick={onOpenInBrowser}>
          View All in Browser →
        </button>
      </div>
    </div>
  );
};

/**
 * ConversationCard - Individual conversation in the list
 */
const ConversationCard: React.FC<{
  conversation: ConversationSummary;
  onClick: () => void;
}> = ({ conversation, onClick }) => {
  const stageColor = conversation.primaryStage
    ? STAGE_COLORS[conversation.primaryStage]
    : null;

  return (
    <div className="conversation-card" onClick={onClick}>
      {/* Header */}
      <div className="conversation-card-header">
        <span className="conversation-slug">{conversation.slug || "Unnamed"}</span>
        <span className="conversation-time">
          {formatRelativeTime(conversation.startedAt)}
        </span>
      </div>

      {/* Meta */}
      <div className="conversation-card-meta">
        {conversation.projectName && (
          <span className="conversation-project">
            <FolderIcon />
            {conversation.projectName}
          </span>
        )}
        <span className="conversation-stats">
          {conversation.messageCount} msgs
          {conversation.endedAt && (
            <> · {formatDuration(conversation.startedAt, conversation.endedAt)}</>
          )}
        </span>
      </div>

      {/* Badges */}
      <div className="conversation-card-badges">
        {stageColor && (
          <span
            className="badge stage-badge"
            style={{ backgroundColor: stageColor.bg, color: stageColor.text }}
          >
            {conversation.primaryStage}
          </span>
        )}
        {conversation.hasDebuggingLoop && (
          <span className="badge loop-badge">
            <WarningIcon />
            Loop
          </span>
        )}
        {conversation.conversationScore !== null && (
          <span
            className={`badge score-badge ${getScoreClass(conversation.conversationScore)}`}
          >
            {conversation.conversationScore}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * ConversationThread - Displays conversation messages
 */
const ConversationThread: React.FC<{
  conversation: ConversationSummary;
  messages: ConversationMessage[];
  isLoading: boolean;
  onBack: () => void;
}> = ({ conversation, messages, isLoading, onBack }) => {
  return (
    <div className="conversation-thread">
      {/* Header */}
      <div className="thread-header">
        <button className="back-button" onClick={onBack}>
          <BackIcon />
        </button>
        <div className="thread-title">
          <span className="thread-slug">{conversation.slug || "Unnamed"}</span>
          <span className="thread-meta">
            {conversation.projectName && `${conversation.projectName} · `}
            {conversation.messageCount} messages
          </span>
        </div>
      </div>

      {/* Badges */}
      <div className="thread-badges">
        {conversation.primaryStage && (
          <StageBadge stage={conversation.primaryStage} />
        )}
        {conversation.hasDebuggingLoop && <LoopBadge />}
        {conversation.conversationScore !== null && (
          <ScoreBadgeVS score={conversation.conversationScore} />
        )}
      </div>

      {/* Messages */}
      <div className="thread-messages">
        {isLoading && (
          <div className="thread-loading">
            <div className="loading-spinner" />
            <span>Loading messages...</span>
          </div>
        )}

        {!isLoading && messages.length === 0 && (
          <div className="thread-empty">
            <p>No messages in this conversation</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubbleVS key={msg.id} message={msg} />
        ))}
      </div>
    </div>
  );
};

/**
 * MessageBubbleVS - Message display for VS Code
 */
const MessageBubbleVS: React.FC<{ message: ConversationMessage }> = ({
  message,
}) => {
  const isUser = message.role === "user";

  return (
    <div className={`message-bubble ${isUser ? "user" : "assistant"}`}>
      <div className="message-header">
        <span className="message-role">{isUser ? "You" : "Claude"}</span>
        <span className="message-time">{formatRelativeTime(message.timestamp)}</span>
      </div>
      <div className="message-content">{message.content}</div>
      {isUser && (
        <div className="message-footer">
          {message.promptType && (
            <span className="prompt-type-badge">{message.promptType}</span>
          )}
          {message.score !== undefined && (
            <span className={`score-mini ${getScoreClass(message.score)}`}>
              {message.score}
            </span>
          )}
        </div>
      )}
      {!isUser && message.toolsUsed && message.toolsUsed.length > 0 && (
        <div className="message-tools">
          {message.toolsUsed.map((tool, idx) => (
            <span key={idx} className="tool-badge">
              {tool}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// Badge components
const StageBadge: React.FC<{ stage: string }> = ({ stage }) => {
  const color = STAGE_COLORS[stage] || { bg: "#333", text: "#999" };
  return (
    <span
      className="badge stage-badge"
      style={{ backgroundColor: color.bg, color: color.text }}
    >
      {stage}
    </span>
  );
};

const LoopBadge: React.FC = () => (
  <span className="badge loop-badge">
    <WarningIcon />
    Debugging Loop
  </span>
);

const ScoreBadgeVS: React.FC<{ score: number }> = ({ score }) => (
  <span className={`badge score-badge ${getScoreClass(score)}`}>
    Score: {score}
  </span>
);

// Helper function for score classes
function getScoreClass(score: number): string {
  if (score >= 70) return "score-high";
  if (score >= 40) return "score-medium";
  return "score-growth";
}

// Icon components
const RefreshIcon: React.FC<{ spinning?: boolean }> = ({ spinning }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={spinning ? "icon-spin" : ""}
  >
    <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m0 0a9 9 0 0 1 9-9m-9 9a9 9 0 0 0 9 9" />
  </svg>
);

const BackIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const FolderIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const WarningIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const ConversationsEmptyIcon: React.FC = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

export default ConversationsPanel;
