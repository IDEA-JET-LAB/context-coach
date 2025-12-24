import React from "react";

export interface LastPromptData {
  id: string;
  text: string;
  overall_score: number;
  clarity_score: number;
  context_score: number;
  specificity_score: number;
  actionability_score: number;
  efficiency_score: number;
  created_at: string;
}

interface LastPromptPanelProps {
  prompt: LastPromptData | null;
  isLoading: boolean;
  onRefresh: () => void;
}

// Format score from 0-100 scale to 1.0-10.0 display
const formatScore = (score: number): string => {
  const scaled = score / 10;
  return scaled.toFixed(1);
};

const DimensionBar: React.FC<{ label: string; score: number }> = ({ label, score }) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "var(--ctx-success)";
    if (score >= 60) return "var(--ctx-primary)";
    if (score >= 40) return "var(--ctx-warning)";
    return "var(--ctx-error)";
  };

  return (
    <div className="dimension-row">
      <div className="dimension-header">
        <span className="dimension-label">{label}</span>
        <span className="dimension-value">{formatScore(score)}</span>
      </div>
      <div className="dimension-bar-track">
        <div
          className="dimension-bar-fill"
          style={{
            width: `${score}%`,
            backgroundColor: getScoreColor(score),
          }}
        />
      </div>
    </div>
  );
};

const formatTimeAgo = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

const getScoreLabel = (score: number): string => {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Great";
  if (score >= 70) return "Good";
  if (score >= 60) return "Fair";
  if (score >= 50) return "Needs Work";
  return "Poor";
};

const getScoreColor = (score: number): string => {
  if (score >= 80) return "var(--ctx-success)";
  if (score >= 60) return "var(--ctx-primary)";
  if (score >= 40) return "var(--ctx-warning)";
  return "var(--ctx-error)";
};

export const LastPromptPanel: React.FC<LastPromptPanelProps> = ({
  prompt,
  isLoading,
  onRefresh,
}) => {
  if (isLoading) {
    return (
      <div className="last-prompt-panel">
        <div className="loading-container">
          <div className="loading-spinner" />
          <span className="loading-text">Loading last prompt...</span>
        </div>
      </div>
    );
  }

  if (!prompt) {
    return (
      <div className="last-prompt-panel">
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h3 className="empty-title">No prompts yet</h3>
          <p className="empty-description">
            Your most recent prompt analysis will appear here.
          </p>
          <button className="retry-button" onClick={onRefresh}>
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="last-prompt-panel">
      {/* Header with refresh */}
      <div className="last-prompt-header">
        <div className="header-info">
          <h2 className="panel-title">Last Prompt</h2>
          <span className="prompt-time">{formatTimeAgo(prompt.created_at)}</span>
        </div>
        <button className="refresh-button" onClick={onRefresh} aria-label="Refresh">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      {/* Overall Score - Large & Prominent */}
      <div className="overall-score-card">
        <div
          className="score-circle"
          style={{ borderColor: getScoreColor(prompt.overall_score) }}
        >
          <span className="score-number">{formatScore(prompt.overall_score)}</span>
        </div>
        <span className="score-label" style={{ color: getScoreColor(prompt.overall_score) }}>
          {getScoreLabel(prompt.overall_score)}
        </span>
      </div>

      {/* Prompt Text */}
      <div className="prompt-text-section">
        <h3 className="section-title">Your Prompt</h3>
        <div className="prompt-text-box">
          <p className="prompt-text">{prompt.text}</p>
        </div>
      </div>

      {/* Dimension Scores */}
      <div className="dimensions-section">
        <h3 className="section-title">Dimension Scores</h3>
        <div className="dimensions-list">
          <DimensionBar label="Clarity" score={prompt.clarity_score} />
          <DimensionBar label="Context" score={prompt.context_score} />
          <DimensionBar label="Specificity" score={prompt.specificity_score} />
          <DimensionBar label="Actionability" score={prompt.actionability_score} />
          <DimensionBar label="Efficiency" score={prompt.efficiency_score} />
        </div>
      </div>
    </div>
  );
};
