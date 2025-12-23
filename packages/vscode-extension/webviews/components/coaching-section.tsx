/**
 * CoachingSection Component
 * Story 19-5: Quick Coaching Tips
 *
 * Main coaching section that displays personalized tips and weak dimension alerts.
 * Combines TipCard, WeakDimensionAlert, and EmptyCoaching components.
 */

import React, { useState, useCallback } from "react";
import { TipCard, TipCardProps } from "./tip-card";
import { WeakDimensionAlert, WeakDimensionAlertProps } from "./weak-dimension-alert";
import { EmptyCoaching } from "./empty-coaching";
import { RefreshIcon, SparklesIcon, ChevronDownIcon, HistoryIcon } from "./icons";

export type TipPriority = TipCardProps["priority"];
export type DimensionName = TipCardProps["dimension"];

export interface CoachingTip {
  id: string;
  dimension: DimensionName;
  title: string;
  description: string;
  example?: { before: string; after: string };
  priority: TipPriority;
  source: "pattern" | "recent" | "general";
  createdAt: string;
}

export interface WeakDimension {
  dimension: DimensionName;
  averageScore: number;
  promptCount: number;
  trend: "improving" | "declining" | "stable";
  strategies: string[];
}

export interface CoachingSectionProps {
  /** Personalized coaching tips */
  tips: CoachingTip[];
  /** Dimensions with consistently low scores */
  weakDimensions: WeakDimension[];
  /** Previously dismissed tips (for history) */
  dismissedTips?: CoachingTip[];
  /** Whether data is loading */
  isLoading?: boolean;
  /** Callback when a tip is dismissed */
  onDismiss?: (tipId: string) => void;
  /** Callback to refresh coaching data */
  onRefresh?: () => void;
  /** Maximum number of tips to show initially */
  maxTips?: number;
  /** Additional CSS class */
  className?: string;
}

/**
 * Loading skeleton for coaching section
 */
const LoadingSkeleton: React.FC = () => {
  const skeletonStyle: React.CSSProperties = {
    background:
      "linear-gradient(90deg, var(--ctx-surface, var(--vscode-editor-background)) 0%, var(--ctx-surface-hover, var(--vscode-list-hoverBackground)) 50%, var(--ctx-surface, var(--vscode-editor-background)) 100%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.5s ease-in-out infinite",
    borderRadius: "4px",
  };

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div>
        <div style={{ ...skeletonStyle, width: "100px", height: "10px", marginBottom: "16px" }} />
        <div style={{ ...skeletonStyle, height: "60px", marginBottom: "8px" }} />
        <div style={{ ...skeletonStyle, height: "80px", marginBottom: "8px" }} />
        <div style={{ ...skeletonStyle, height: "80px", marginBottom: "8px" }} />
      </div>
    </>
  );
};

export const CoachingSection: React.FC<CoachingSectionProps> = ({
  tips,
  weakDimensions,
  dismissedTips = [],
  isLoading = false,
  onDismiss,
  onRefresh,
  maxTips = 5,
  className = "",
}) => {
  const [dismissingTips, setDismissingTips] = useState<Set<string>>(new Set());
  const [showAllTips, setShowAllTips] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Filter out tips that are being dismissed
  const visibleTips = tips.filter((tip) => !dismissingTips.has(tip.id));
  const displayedTips = showAllTips ? visibleTips : visibleTips.slice(0, maxTips);
  const hasMoreTips = visibleTips.length > maxTips;

  // Sort tips by priority
  const sortedTips = [...displayedTips].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const handleDismiss = useCallback(
    (tipId: string) => {
      // Start dismissing animation
      setDismissingTips((prev) => new Set([...prev, tipId]));

      // After animation, call the actual dismiss callback
      setTimeout(() => {
        setDismissingTips((prev) => {
          const next = new Set(prev);
          next.delete(tipId);
          return next;
        });
        onDismiss?.(tipId);
      }, 200);
    },
    [onDismiss]
  );

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (tips.length === 0 && weakDimensions.length === 0 && dismissedTips.length === 0) {
    return <EmptyCoaching />;
  }

  const sectionStyle: React.CSSProperties = {
    marginBottom: "16px",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
  };

  const titleContainerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: "10px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--ctx-foreground-muted, var(--vscode-descriptionForeground))",
  };

  const badgeStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "18px",
    height: "18px",
    padding: "0 5px",
    fontSize: "10px",
    fontWeight: 600,
    backgroundColor: "var(--ctx-badge-bg, var(--vscode-badge-background))",
    color: "var(--ctx-badge-fg, var(--vscode-badge-foreground))",
    borderRadius: "9px",
  };

  const refreshButtonStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px",
    background: "transparent",
    border: "none",
    borderRadius: "3px",
    color: "var(--ctx-foreground-muted, var(--vscode-descriptionForeground))",
    cursor: "pointer",
    transition: "all 100ms ease",
  };

  const showMoreButtonStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px",
    fontSize: "11px",
    color: "var(--ctx-link, var(--vscode-textLink-foreground))",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    textAlign: "center",
    borderRadius: "4px",
    transition: "background-color 100ms ease",
  };

  const historyToggleStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "8px 0",
    background: "transparent",
    border: "none",
    color: "var(--ctx-foreground-muted, var(--vscode-descriptionForeground))",
    fontSize: "10px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    cursor: "pointer",
    transition: "color 100ms ease",
  };

  const chevronStyle: React.CSSProperties = {
    transition: "transform 200ms ease",
    transform: showHistory ? "rotate(180deg)" : "rotate(0)",
  };

  const emptyActiveStyle: React.CSSProperties = {
    textAlign: "center",
    padding: "20px 16px",
    color: "var(--ctx-foreground-muted, var(--vscode-descriptionForeground))",
    fontSize: "12px",
  };

  return (
    <div className={className}>
      {/* Weak Dimensions Section */}
      {weakDimensions.length > 0 && (
        <section style={sectionStyle}>
          <div style={headerStyle}>
            <span style={sectionTitleStyle}>Areas for Improvement</span>
          </div>
          {weakDimensions.map((wd) => (
            <WeakDimensionAlert
              key={wd.dimension}
              dimension={wd.dimension}
              averageScore={wd.averageScore}
              promptCount={wd.promptCount}
              trend={wd.trend}
              strategies={wd.strategies}
            />
          ))}
        </section>
      )}

      {/* Active Tips Section */}
      {visibleTips.length > 0 && (
        <section style={sectionStyle}>
          <div style={headerStyle}>
            <div style={titleContainerStyle}>
              <SparklesIcon size={12} color="var(--ctx-foreground-muted)" />
              <span style={sectionTitleStyle}>Coaching Tips</span>
              <span style={badgeStyle}>{visibleTips.length}</span>
            </div>
            {onRefresh && (
              <button
                style={refreshButtonStyle}
                onClick={onRefresh}
                aria-label="Refresh coaching tips"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "var(--ctx-surface-hover, var(--vscode-toolbar-hoverBackground))";
                  e.currentTarget.style.color =
                    "var(--ctx-foreground, var(--vscode-foreground))";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color =
                    "var(--ctx-foreground-muted, var(--vscode-descriptionForeground))";
                }}
              >
                <RefreshIcon size={14} />
              </button>
            )}
          </div>

          <div>
            {sortedTips.map((tip) => (
              <TipCard
                key={tip.id}
                id={tip.id}
                dimension={tip.dimension}
                title={tip.title}
                description={tip.description}
                example={tip.example}
                priority={tip.priority}
                onDismiss={onDismiss ? handleDismiss : undefined}
                isDismissing={dismissingTips.has(tip.id)}
              />
            ))}
          </div>

          {hasMoreTips && (
            <button
              style={showMoreButtonStyle}
              onClick={() => setShowAllTips(!showAllTips)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  "var(--ctx-surface-hover, var(--vscode-list-hoverBackground))";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {showAllTips
                ? "Show less"
                : `Show ${visibleTips.length - maxTips} more tip${
                    visibleTips.length - maxTips > 1 ? "s" : ""
                  }`}
            </button>
          )}
        </section>
      )}

      {/* Empty state when all tips dismissed but history exists */}
      {visibleTips.length === 0 && dismissedTips.length > 0 && (
        <div style={emptyActiveStyle}>
          <p
            style={{
              marginBottom: "4px",
              fontWeight: 500,
              color: "var(--ctx-foreground, var(--vscode-foreground))",
            }}
          >
            All caught up!
          </p>
          <p>No active suggestions right now.</p>
        </div>
      )}

      {/* Dismissed Tips History */}
      {dismissedTips.length > 0 && (
        <div
          style={{
            borderTop: "1px solid var(--ctx-border-subtle, var(--vscode-panel-border))",
            paddingTop: "12px",
            marginTop: "8px",
          }}
        >
          <button
            style={historyToggleStyle}
            onClick={() => setShowHistory(!showHistory)}
            aria-expanded={showHistory}
            onMouseEnter={(e) => {
              e.currentTarget.style.color =
                "var(--ctx-foreground, var(--vscode-foreground))";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color =
                "var(--ctx-foreground-muted, var(--vscode-descriptionForeground))";
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <HistoryIcon size={12} />
              History ({dismissedTips.length})
            </span>
            <span style={chevronStyle}>
              <ChevronDownIcon size={12} />
            </span>
          </button>

          {showHistory && (
            <div
              style={{
                paddingTop: "8px",
                animation: "slideUp 200ms ease-out",
              }}
            >
              <style>{`
                @keyframes slideUp {
                  from { opacity: 0; transform: translateY(-8px); }
                  to { opacity: 1; transform: translateY(0); }
                }
              `}</style>
              {dismissedTips.slice(0, 5).map((tip) => (
                <TipCard
                  key={tip.id}
                  id={tip.id}
                  dimension={tip.dimension}
                  title={tip.title}
                  description={tip.description}
                  priority={tip.priority}
                  // No onDismiss for history items
                />
              ))}
              {dismissedTips.length > 5 && (
                <p
                  style={{
                    fontSize: "11px",
                    color: "var(--ctx-foreground-muted)",
                    textAlign: "center",
                    padding: "8px 0",
                  }}
                >
                  +{dismissedTips.length - 5} more in history
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CoachingSection;
