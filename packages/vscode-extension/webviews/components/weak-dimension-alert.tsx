/**
 * WeakDimensionAlert Component
 * Story 19-5: Quick Coaching Tips
 *
 * Displays an alert when a dimension consistently scores low,
 * with specific improvement strategies.
 */

import React, { useState } from "react";
import { AlertCircleIcon, TrendUpIcon, TrendDownIcon, ChevronDownIcon } from "./icons";

export type DimensionName =
  | "clarity"
  | "context"
  | "specificity"
  | "actionability"
  | "efficiency";

export type Trend = "improving" | "declining" | "stable";

export interface WeakDimensionAlertProps {
  /** The dimension name */
  dimension: DimensionName;
  /** Average score for this dimension (0-100) */
  averageScore: number;
  /** Number of prompts analyzed */
  promptCount: number;
  /** Trend compared to previous period */
  trend: Trend;
  /** Specific improvement strategies */
  strategies: string[];
  /** Additional CSS class */
  className?: string;
}

/**
 * Dimension to display configuration
 */
const dimensionConfig: Record<
  DimensionName,
  { label: string; color: string; description: string }
> = {
  clarity: {
    label: "Clarity",
    color: "#3b82f6",
    description: "How clearly your intent is expressed",
  },
  context: {
    label: "Context",
    color: "#8b5cf6",
    description: "Background information provided",
  },
  specificity: {
    label: "Specificity",
    color: "#10b981",
    description: "Level of detail in requirements",
  },
  actionability: {
    label: "Actionability",
    color: "#f59e0b",
    description: "How actionable the request is",
  },
  efficiency: {
    label: "Efficiency",
    color: "#ef4444",
    description: "Conciseness and focus of the prompt",
  },
};

/**
 * Gets the trend icon and color
 */
function getTrendDisplay(trend: Trend): { icon: React.ReactNode; color: string; label: string } {
  switch (trend) {
    case "improving":
      return {
        icon: <TrendUpIcon size={12} />,
        color: "var(--ctx-score-high, #22c55e)",
        label: "Improving",
      };
    case "declining":
      return {
        icon: <TrendDownIcon size={12} />,
        color: "var(--ctx-score-low, #ef4444)",
        label: "Declining",
      };
    default:
      return {
        icon: null,
        color: "var(--ctx-foreground-muted)",
        label: "Stable",
      };
  }
}

/**
 * Gets score color based on value
 */
function getScoreColor(score: number): string {
  if (score >= 70) return "var(--ctx-score-high, #22c55e)";
  if (score >= 40) return "var(--ctx-score-medium, #f59e0b)";
  return "var(--ctx-score-low, #ef4444)";
}

export const WeakDimensionAlert: React.FC<WeakDimensionAlertProps> = ({
  dimension,
  averageScore,
  promptCount,
  trend,
  strategies,
  className = "",
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = dimensionConfig[dimension];
  const trendDisplay = getTrendDisplay(trend);
  const scoreColor = getScoreColor(averageScore);

  const containerStyle: React.CSSProperties = {
    backgroundColor: `${config.color}10`,
    border: `1px solid ${config.color}30`,
    borderRadius: "var(--ctx-radius, 6px)",
    marginBottom: "12px",
    overflow: "hidden",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    cursor: strategies.length > 0 ? "pointer" : "default",
    transition: "background-color 100ms ease",
  };

  const leftSectionStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  };

  const iconContainerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    backgroundColor: `${config.color}20`,
    color: config.color,
  };

  const contentStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--ctx-foreground, var(--vscode-foreground))",
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: "10px",
    color: "var(--ctx-foreground-muted, var(--vscode-descriptionForeground))",
  };

  const rightSectionStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  };

  const scoreContainerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "2px",
  };

  const scoreStyle: React.CSSProperties = {
    fontSize: "14px",
    fontWeight: 700,
    color: scoreColor,
  };

  const trendStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "10px",
    color: trendDisplay.color,
  };

  const chevronStyle: React.CSSProperties = {
    transition: "transform 200ms ease",
    transform: isExpanded ? "rotate(180deg)" : "rotate(0)",
    color: "var(--ctx-foreground-muted)",
  };

  const strategiesContainerStyle: React.CSSProperties = {
    padding: "0 12px 12px 12px",
    borderTop: `1px solid ${config.color}20`,
    animation: "slideDown 150ms ease-out",
  };

  const strategiesListStyle: React.CSSProperties = {
    margin: 0,
    padding: "12px 0 0 16px",
    fontSize: "11px",
    lineHeight: "1.6",
    color: "var(--ctx-foreground, var(--vscode-foreground))",
  };

  const strategyItemStyle: React.CSSProperties = {
    marginBottom: "4px",
  };

  const handleClick = () => {
    if (strategies.length > 0) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <>
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            max-height: 0;
          }
          to {
            opacity: 1;
            max-height: 200px;
          }
        }
      `}</style>
      <div
        className={className}
        style={containerStyle}
        role="region"
        aria-label={`${config.label} dimension alert`}
      >
        <div
          style={headerStyle}
          onClick={handleClick}
          onMouseEnter={(e) => {
            if (strategies.length > 0) {
              e.currentTarget.style.backgroundColor = `${config.color}15`;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
          role={strategies.length > 0 ? "button" : undefined}
          aria-expanded={strategies.length > 0 ? isExpanded : undefined}
        >
          <div style={leftSectionStyle}>
            <div style={iconContainerStyle}>
              <AlertCircleIcon size={14} />
            </div>
            <div style={contentStyle}>
              <span style={titleStyle}>{config.label} needs attention</span>
              <span style={subtitleStyle}>
                Based on {promptCount} recent prompt{promptCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <div style={rightSectionStyle}>
            <div style={scoreContainerStyle}>
              <span style={scoreStyle}>{Math.round(averageScore)}%</span>
              {trend !== "stable" && (
                <span style={trendStyle}>
                  {trendDisplay.icon}
                  {trendDisplay.label}
                </span>
              )}
            </div>
            {strategies.length > 0 && (
              <span style={chevronStyle}>
                <ChevronDownIcon size={14} />
              </span>
            )}
          </div>
        </div>

        {isExpanded && strategies.length > 0 && (
          <div style={strategiesContainerStyle}>
            <ul style={strategiesListStyle}>
              {strategies.map((strategy, index) => (
                <li key={index} style={strategyItemStyle}>
                  {strategy}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
};

export default WeakDimensionAlert;
