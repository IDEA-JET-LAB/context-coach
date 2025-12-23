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

export interface DimensionScore {
  score: number;
  trend: 'up' | 'down' | 'stable';
  change?: number;
}

export interface PromptDimensions {
  clarity: DimensionScore;
  context: DimensionScore;
  specificity: DimensionScore;
  actionability: DimensionScore;
  efficiency: DimensionScore;
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
  const skeletonStyle: React.CSSProperties = {
    background: 'linear-gradient(90deg, var(--ctx-surface) 0%, var(--ctx-surface-hover) 50%, var(--ctx-surface) 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s ease-in-out infinite',
    borderRadius: '4px',
  };

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div style={{ padding: '0' }}>
        {/* Header Skeleton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ ...skeletonStyle, width: '100px', height: '10px' }} />
          <div style={{ ...skeletonStyle, width: '120px', height: '24px' }} />
        </div>

        {/* Session Health Skeleton */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <div style={{ ...skeletonStyle, width: '80px', height: '50px', borderRadius: '40px 40px 0 0' }} />
          </div>
        </div>

        {/* Stats Row Skeleton */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <div style={{ ...skeletonStyle, flex: 1, height: '48px' }} />
          <div style={{ ...skeletonStyle, flex: 1, height: '48px' }} />
        </div>

        {/* Dimensions Skeleton */}
        <div style={{ ...skeletonStyle, width: '100px', height: '10px', marginBottom: '12px' }} />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ ...skeletonStyle, height: '36px', marginBottom: '8px' }} />
        ))}

        {/* Recent Prompts Skeleton */}
        <div style={{ marginTop: '20px' }}>
          <div style={{ ...skeletonStyle, width: '100px', height: '10px', marginBottom: '12px' }} />
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ ...skeletonStyle, height: '64px', marginBottom: '8px' }} />
          ))}
        </div>
      </div>
    </>
  );
};

// ============================================
// Empty State Component
// ============================================

const EmptyState: React.FC = () => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '32px 16px',
    color: 'var(--ctx-foreground-muted)',
  };

  const iconStyle: React.CSSProperties = {
    marginBottom: '16px',
    opacity: 0.5,
    animation: 'float 3s ease-in-out infinite',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--ctx-foreground)',
    marginBottom: '8px',
  };

  const descStyle: React.CSSProperties = {
    fontSize: '11px',
    lineHeight: '1.5',
    maxWidth: '180px',
  };

  return (
    <>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
      <div style={containerStyle}>
        <div style={iconStyle}>
          <CodeIcon size={48} color="var(--ctx-foreground-muted)" />
        </div>
        <h3 style={titleStyle}>Start coding to see analytics</h3>
        <p style={descStyle}>
          Your prompt analytics will appear here once you begin using Claude Code.
        </p>
      </div>
    </>
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

  // ============================================
  // Styles
  // ============================================

  const sectionStyle: React.CSSProperties = {
    marginBottom: '20px',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--ctx-foreground-muted)',
  };

  const headerRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  };

  const gaugeContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 0',
    position: 'relative',
  };

  const refreshIndicatorStyle: React.CSSProperties = {
    position: 'absolute',
    top: '4px',
    right: '4px',
    animation: 'spin 1s linear infinite',
    color: 'var(--ctx-foreground-muted)',
  };

  const statsRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
  };

  const statCardStyle: React.CSSProperties = {
    flex: 1,
    padding: '10px 12px',
    backgroundColor: 'var(--ctx-surface)',
    border: '1px solid var(--ctx-border-subtle)',
    borderRadius: '4px',
  };

  const statLabelStyle: React.CSSProperties = {
    fontSize: '10px',
    color: 'var(--ctx-foreground-muted)',
    marginBottom: '4px',
  };

  const statValueStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: 'var(--ctx-font-mono)',
    color: 'var(--ctx-foreground)',
  };

  const trendContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    backgroundColor: 'var(--ctx-surface)',
    border: '1px solid var(--ctx-border-subtle)',
    borderRadius: '4px',
    marginBottom: '20px',
  };

  const trendLabelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  };

  const activityStyle: React.CSSProperties = {
    fontSize: '10px',
    color: 'var(--ctx-foreground-muted)',
    marginTop: '8px',
    textAlign: 'center',
  };

  const dimensionsContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  };

  const refreshButtonStyle: React.CSSProperties = {
    padding: '4px',
    background: 'transparent',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    color: 'var(--ctx-foreground-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 100ms ease',
  };

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
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Header with Time Range Selector */}
      <div style={headerRowStyle}>
        <span style={sectionTitleStyle}>Analytics</span>
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
        <div style={{ marginBottom: '16px' }}>
          <SyncStatus
            state={isOffline ? 'offline' : syncState}
            lastSyncTime={lastSyncTime}
            onSync={onRefresh}
            disabled={isLoading || isRefreshing}
          />
        </div>
      )}

      {/* Session Health Score */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitleStyle}>Overall Score</span>
          {onRefresh && !isRefreshing && (
            <button
              style={refreshButtonStyle}
              onClick={onRefresh}
              aria-label="Refresh analytics"
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--ctx-foreground)';
                e.currentTarget.style.backgroundColor = 'var(--ctx-surface-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--ctx-foreground-muted)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <RefreshIcon size={14} />
            </button>
          )}
        </div>
        <div style={gaugeContainerStyle}>
          {isRefreshing && (
            <div style={refreshIndicatorStyle}>
              <RefreshIcon size={12} />
            </div>
          )}
          <Gauge value={data.sessionScore} size="md" label="Session Score" />
          <p style={activityStyle}>{formatTimeSince(data.lastPromptTime)}</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ ...sectionStyle, ...statsRowStyle }}>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>Prompts</div>
          <div style={statValueStyle}>{data.promptCount}</div>
        </div>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>Avg Score</div>
          <div style={statValueStyle}>
            <ScoreBadge score={data.averageScore} size="sm" />
          </div>
        </div>
      </div>

      {/* Dimension Scores */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitleStyle}>Dimension Breakdown</span>
        </div>
        <div style={dimensionsContainerStyle} role="list" aria-label="Dimension scores">
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
        <div style={trendContainerStyle}>
          <div style={trendLabelStyle}>
            <span style={statLabelStyle}>Score Trend</span>
            <span style={{ fontSize: '11px', color: 'var(--ctx-foreground)' }}>
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
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitleStyle}>Recent Prompts</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {data.recentPrompts.slice(0, 5).map((prompt, index) => (
            <div
              key={prompt.id}
              style={{
                animation: 'slideUp 200ms ease-out',
                animationDelay: `${index * 50}ms`,
                animationFillMode: 'backwards',
              }}
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
        <div style={{
          padding: '8px 12px',
          backgroundColor: 'var(--ctx-score-growth-bg)',
          border: '1px solid var(--ctx-score-growth)',
          borderRadius: 'var(--ctx-radius)',
          fontSize: '11px',
          color: 'var(--ctx-score-growth)',
          marginTop: '16px',
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default AnalyticsPanel;
