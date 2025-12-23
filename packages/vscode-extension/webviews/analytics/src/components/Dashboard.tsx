import React from "react";
import { ScoreCard } from "./ScoreCard";
import { RecentPrompts } from "./RecentPrompts";

interface AnalyticsData {
  sessions: {
    todayCount: number;
    todayPrompts: number;
    avgDuration: number;
    streak: number;
  };
  efficiency: {
    overallScore: number;
    promptsPerHour: number;
    avgPromptLength: number;
    contextUtilization: number;
  };
  recentActivity: Array<{
    timestamp: string;
    type: "prompt" | "session_start" | "session_end";
    description: string;
  }>;
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
  onRefresh?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  analytics,
  user,
  onRefresh,
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

  const { sessions, efficiency, recentActivity } = analytics;

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h2 className="dashboard-title">Analytics</h2>
          {user && <span className="user-greeting">Hi, {user.name || user.email}</span>}
        </div>
        {onRefresh && (
          <button
            className="refresh-button"
            onClick={onRefresh}
            aria-label="Refresh analytics"
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
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        )}
      </div>

      {/* Score Card */}
      <section className="section">
        <ScoreCard
          score={efficiency.overallScore}
          label="Efficiency Score"
          trend={efficiency.contextUtilization > 60 ? "up" : "stable"}
        />
      </section>

      {/* Stats Grid */}
      <section className="section">
        <h3 className="section-title">Today's Stats</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-value">{sessions.todayCount}</span>
            <span className="stat-label">Sessions</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{sessions.todayPrompts}</span>
            <span className="stat-label">Prompts</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{sessions.avgDuration}m</span>
            <span className="stat-label">Avg Duration</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{sessions.streak}</span>
            <span className="stat-label">Day Streak</span>
          </div>
        </div>
      </section>

      {/* Efficiency Metrics */}
      <section className="section">
        <h3 className="section-title">Efficiency</h3>
        <div className="metrics-list">
          <div className="metric-row">
            <span className="metric-label">Prompts/Hour</span>
            <span className="metric-value">{efficiency.promptsPerHour}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Avg Prompt Length</span>
            <span className="metric-value">{efficiency.avgPromptLength} chars</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Context Utilization</span>
            <span className="metric-value">{efficiency.contextUtilization}%</span>
          </div>
        </div>
      </section>

      {/* Recent Activity */}
      <section className="section">
        <RecentPrompts activities={recentActivity} />
      </section>
    </div>
  );
};
