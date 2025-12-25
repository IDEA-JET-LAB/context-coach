/**
 * AnalyticsPanel Component
 * Story 19-4: Real-time Analytics Display
 *
 * Displays real-time prompt analytics with dimension scores, recent prompts,
 * time range selection, sync status, and prompt detail views.
 */

import React, { useState, useCallback } from 'react';
import {
  Gauge,
  Sparkline,
  PromptCard,
  ScoreBadge,
  CodeIcon,
  RefreshIcon,
  DimensionScoreCard,
  TimeRangeSelector,
  SyncStatus,
  PromptDetail,
  ErrorState,
  type TimeRange,
  type SyncState,
  type PromptSuggestion,
} from '../components';
import type { DimensionScore, PromptDimensions } from '../shared/types';

// ============================================
// Types
// ============================================

export interface Prompt {
  id: string;
  text: string;
  score: number;
  timestamp: Date | string;
  dimensions?: Record<string, number>;
  isNew?: boolean;
}

export interface AnalyticsData {
  // Overall metrics
  sessionScore: number;
  promptCount: number;
  averageScore: number;
  trendData: number[];
  recentPrompts: Prompt[];
  lastPromptTime?: Date | string;
  // New fields for Story 19-4
  dimensions?: PromptDimensions;
  timeRange?: TimeRange;
  scoreChange?: number;
  countChange?: number;
}

export interface PromptDetailData {
  id: string;
  text: string;
  score: number;
  timestamp: string;
  dimensions: Record<string, number>;
  suggestions: PromptSuggestion[];
}

export interface AnalyticsPanelProps {
  data?: AnalyticsData | null;
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: string | null;
  isOffline?: boolean;
  syncState?: SyncState;
  lastSyncTime?: string;
  selectedTimeRange?: TimeRange;
  promptDetail?: PromptDetailData | null;
  onRefresh?: () => void;
  onPromptClick?: (promptId: string) => void;
  onTimeRangeChange?: (range: TimeRange) => void;
  onPromptDetailClose?: () => void;
  onRetry?: () => void;
}

// ============================================
// Loading Skeleton Component
// ============================================

const LoadingSkeleton: React.FC = () => {
  return (
    <div className="sidebar-analytics__skeleton">
      {/* Header Skeleton */}
      <div className="sidebar-analytics__skeleton-header">
        <div className="sidebar-analytics__skeleton-item sidebar-analytics__skeleton-header-left" />
        <div className="sidebar-analytics__skeleton-item sidebar-analytics__skeleton-header-right" />
      </div>

      {/* Session Health Skeleton */}
      <div className="sidebar-analytics__skeleton-section">
        <div className="sidebar-analytics__skeleton-gauge">
          <div className="sidebar-analytics__skeleton-item sidebar-analytics__skeleton-gauge-shape" />
        </div>
      </div>

      {/* Stats Row Skeleton */}
      <div className="sidebar-analytics__skeleton-stats">
        <div className="sidebar-analytics__skeleton-item sidebar-analytics__skeleton-stat" />
        <div className="sidebar-analytics__skeleton-item sidebar-analytics__skeleton-stat" />
      </div>

      {/* Dimensions Skeleton */}
      <div className="sidebar-analytics__skeleton-section">
        <div className="sidebar-analytics__skeleton-item sidebar-analytics__skeleton-title" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="sidebar-analytics__skeleton-item sidebar-analytics__skeleton-dimension" />
        ))}
      </div>

      {/* Recent Prompts Skeleton */}
      <div className="sidebar-analytics__skeleton-section">
        <div className="sidebar-analytics__skeleton-item sidebar-analytics__skeleton-title" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="sidebar-analytics__skeleton-item sidebar-analytics__skeleton-prompt" />
        ))}
      </div>
    </div>
  );
};

// ============================================
// Empty State Component
// ============================================

const EmptyState: React.FC = () => {
  return (
    <div className="sidebar-analytics__empty">
      <div className="sidebar-analytics__empty-icon">
        <CodeIcon size={48} color="var(--ctx-foreground-muted)" />
      </div>
      <h3 className="sidebar-analytics__empty-title">Start coding to see analytics</h3>
      <p className="sidebar-analytics__empty-desc">
        Your prompt analytics will appear here once you begin using Claude Code.
      </p>
    </div>
  );
};

// ============================================
// Helper Functions
// ============================================

function formatTimeSince(date?: Date | string): string {
  if (!date) return 'No prompts yet';
  const now = new Date();
  const then = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'Active now';
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m since last prompt`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours}h since last prompt`;
  }
  return 'No recent activity';
}

// ============================================
// Main Analytics Panel Component
// ============================================

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
  data,
  isLoading = false,
  isRefreshing = false,
  error = null,
  isOffline = false,
  syncState = 'idle',
  lastSyncTime,
  selectedTimeRange = '7d',
  promptDetail = null,
  onRefresh,
  onPromptClick,
  onTimeRangeChange,
  onPromptDetailClose,
  onRetry,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = useCallback(async () => {
    if (onRetry) {
      setIsRetrying(true);
      try {
        await onRetry();
      } finally {
        setIsRetrying(false);
      }
    }
  }, [onRetry]);

  // Show prompt detail if one is selected
  if (promptDetail) {
    return (
      <PromptDetail
        id={promptDetail.id}
        text={promptDetail.text}
        score={promptDetail.score}
        timestamp={promptDetail.timestamp}
        dimensions={promptDetail.dimensions}
        suggestions={promptDetail.suggestions}
        onClose={onPromptDetailClose || (() => {})}
      />
    );
  }

  // Show error state
  if (error && !data) {
    return (
      <ErrorState
        message={error}
        isOffline={isOffline}
        onRetry={handleRetry}
        isRetrying={isRetrying}
      />
    );
  }

  // Show loading skeleton on initial load
  if (isLoading && !data) {
    return <LoadingSkeleton />;
  }

  // Show empty state if no data
  if (!data || data.recentPrompts.length === 0) {
    return <EmptyState />;
  }

  // Default dimensions if not provided
  const dimensions = data.dimensions || {
    clarity: { score: 0, trend: 'stable' as const },
    context: { score: 0, trend: 'stable' as const },
    specificity: { score: 0, trend: 'stable' as const },
    actionability: { score: 0, trend: 'stable' as const },
    efficiency: { score: 0, trend: 'stable' as const },
  };

  return (
    <div>
      {/* Header with Time Range Selector */}
      <div className="sidebar-analytics__header-row">
        <span className="sidebar-analytics__header-title">Analytics</span>
        {onTimeRangeChange && (
          <TimeRangeSelector
            value={selectedTimeRange}
            onChange={onTimeRangeChange}
            disabled={isLoading}
          />
        )}
      </div>

      {/* Sync Status */}
      {(syncState !== 'idle' || lastSyncTime || isOffline) && (
        <div className="sidebar-analytics__sync-status">
          <SyncStatus
            state={isOffline ? 'offline' : syncState}
            lastSyncTime={lastSyncTime}
            onSync={onRefresh}
            disabled={isLoading || isRefreshing}
          />
        </div>
      )}

      {/* Session Health Score */}
      <div className="sidebar-analytics__section">
        <div className="sidebar-analytics__section-header">
          <span className="sidebar-analytics__section-title">Overall Score</span>
          {onRefresh && !isRefreshing && (
            <button
              className="sidebar-analytics__refresh-button"
              onClick={onRefresh}
              aria-label="Refresh analytics"
            >
              <RefreshIcon size={14} />
            </button>
          )}
        </div>
        <div className="sidebar-analytics__gauge-container">
          {isRefreshing && (
            <div className="sidebar-analytics__refresh-indicator">
              <RefreshIcon size={12} />
            </div>
          )}
          <Gauge value={data.sessionScore} size="md" label="Session Score" />
          <p className="sidebar-analytics__activity">{formatTimeSince(data.lastPromptTime)}</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="sidebar-analytics__section sidebar-analytics__stats-row">
        <div className="sidebar-analytics__stat-card">
          <div className="sidebar-analytics__stat-label">Prompts</div>
          <div className="sidebar-analytics__stat-value">{data.promptCount}</div>
        </div>
        <div className="sidebar-analytics__stat-card">
          <div className="sidebar-analytics__stat-label">Avg Score</div>
          <div className="sidebar-analytics__stat-value">
            <ScoreBadge score={data.averageScore} size="sm" />
          </div>
        </div>
      </div>

      {/* Dimension Scores */}
      <div className="sidebar-analytics__section">
        <div className="sidebar-analytics__section-header">
          <span className="sidebar-analytics__section-title">Dimension Breakdown</span>
        </div>
        <div className="sidebar-analytics__dimensions" role="list" aria-label="Dimension scores">
          {Object.entries(dimensions).map(([name, dimData]) => (
            <DimensionScoreCard
              key={name}
              name={name}
              score={dimData.score}
              trend={dimData.trend}
              change={dimData.change}
              size="sm"
            />
          ))}
        </div>
      </div>

      {/* Trend Chart */}
      {data.trendData.length > 1 && (
        <div className="sidebar-analytics__trend-container">
          <div className="sidebar-analytics__trend-label">
            <span className="sidebar-analytics__stat-label">Score Trend</span>
            <span className="sidebar-analytics__trend-text">
              Last {data.trendData.length} prompts
            </span>
          </div>
          <Sparkline
            data={data.trendData}
            width={100}
            height={28}
            showArea
            showDots
          />
        </div>
      )}

      {/* Recent Prompts */}
      <div className="sidebar-analytics__section">
        <div className="sidebar-analytics__section-header">
          <span className="sidebar-analytics__section-title">Recent Prompts</span>
        </div>
        <div className="sidebar-analytics__prompts-list">
          {data.recentPrompts.slice(0, 5).map((prompt, index) => (
            <div
              key={prompt.id}
              className="sidebar-analytics__prompt-item"
            >
              <PromptCard
                text={prompt.text}
                score={prompt.score}
                timestamp={prompt.timestamp}
                isNew={prompt.isNew}
                onClick={onPromptClick ? () => onPromptClick(prompt.id) : undefined}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Offline/Error indicator at bottom */}
      {error && data && (
        <div className="sidebar-analytics__error-footer">
          {error}
        </div>
      )}
    </div>
  );
};

export default AnalyticsPanel;
