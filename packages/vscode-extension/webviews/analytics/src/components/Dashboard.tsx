import React from "react";
import { ScoreCard } from "./ScoreCard";
import { DimensionList } from "./DimensionList";

/**
 * Analytics data structure matching extension types
 */
interface DimensionScore {
  score: number;
  trend: "up" | "down" | "stable";
  change?: number;
}

interface AnalyticsData {
  summary: {
    overallScore: number;
    promptCount: number;
    timeRange: string;
    scoreChange?: number;
    countChange?: number;
  };
  dimensions: {
    clarity: DimensionScore;
    context: DimensionScore;
    specificity: DimensionScore;
    actionability: DimensionScore;
    efficiency: DimensionScore;
  };
  lastUpdated: string;
}

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
}

interface DashboardProps {
  analytics: AnalyticsData | null;
  user: UserProfile | null;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onSignOut?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  analytics,
  user,
  isRefreshing = false,
  onRefresh,
  onSignOut,
}) => {
  if (!analytics) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        <h3 className="empty-title">No analytics yet</h3>
        <p className="empty-description">
          Start using Claude Code to see your analytics here.
        </p>
      </div>
    );
  }

  const { summary, dimensions } = analytics;

  // Determine overall trend from score change
  const getOverallTrend = (): "up" | "down" | "stable" => {
    if (!summary.scoreChange || Math.abs(summary.scoreChange) < 1) return "stable";
    return summary.scoreChange > 0 ? "up" : "down";
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h2 className="dashboard-title">Analytics</h2>
          {user && <span className="user-greeting">Hi, {user.name || user.email}</span>}
        </div>
        <div className="header-actions">
          {onRefresh && (
            <button
              className={`refresh-button ${isRefreshing ? "refreshing" : ""}`}
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label={isRefreshing ? "Refreshing..." : "Refresh analytics"}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={isRefreshing ? "spin" : ""}
              >
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          )}
          {onSignOut && (
            <button
              className="sign-out-button"
              onClick={onSignOut}
              aria-label="Sign out"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Score Card */}
      <section className="section">
        <ScoreCard
          score={summary.overallScore}
          label="Overall Score"
          trend={getOverallTrend()}
        />
      </section>

      {/* Stats Grid */}
      <section className="section">
        <h3 className="section-title">Summary</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-value">{summary.promptCount}</span>
            <span className="stat-label">Prompts</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{summary.timeRange}</span>
            <span className="stat-label">Time Range</span>
          </div>
        </div>
      </section>

      {/* Dimension Scores */}
      <section className="section">
        <h3 className="section-title">Dimensions</h3>
        <DimensionList dimensions={dimensions} />
      </section>
    </div>
  );
};
