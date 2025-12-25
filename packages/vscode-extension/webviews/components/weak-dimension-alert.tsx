/**
 * WeakDimensionAlert Component
 * Story 19-5: Quick Coaching Tips
 *
 * Displays an alert when a dimension consistently scores low,
 * with specific improvement strategies.
 */

import React, { useState } from "react";
import { AlertCircleIcon, TrendUpIcon, TrendDownIcon, ChevronDownIcon } from "./icons";
import type { DimensionName, Trend } from "../shared/types";
import {
  getDimensionColor,
  getDimensionBgColor,
  getScoreColor as getScoreColorFromTokens,
  TREND_COLORS,
} from "../shared/tokens";
import "./weak-dimension-alert.css";

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
 * Dimension to display configuration (labels and descriptions only)
 * Colors are now retrieved from shared/tokens
 */
const dimensionLabels: Record<DimensionName, { label: string; description: string }> = {
  clarity: {
    label: "Clarity",
    description: "How clearly your intent is expressed",
  },
  context: {
    label: "Context",
    description: "Background information provided",
  },
  specificity: {
    label: "Specificity",
    description: "Level of detail in requirements",
  },
  actionability: {
    label: "Actionability",
    description: "How actionable the request is",
  },
  efficiency: {
    label: "Efficiency",
    description: "Conciseness and focus of the prompt",
  },
};

/**
 * Gets the trend icon and color using shared tokens
 */
function getTrendDisplay(trend: Trend): { icon: React.ReactNode; color: string; label: string } {
  switch (trend) {
    case "improving":
      return {
        icon: <TrendUpIcon size={12} />,
        color: TREND_COLORS.improving,
        label: "Improving",
      };
    case "declining":
      return {
        icon: <TrendDownIcon size={12} />,
        color: TREND_COLORS.declining,
        label: "Declining",
      };
    default:
      return {
        icon: null,
        color: TREND_COLORS.stable,
        label: "Stable",
      };
  }
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
  const labels = dimensionLabels[dimension];
  const dimensionColor = getDimensionColor(dimension);
  const dimensionBg = getDimensionBgColor(dimension);
  const trendDisplay = getTrendDisplay(trend);
  const scoreColor = getScoreColorFromTokens(averageScore);

  const handleClick = () => {
    if (strategies.length > 0) {
      setIsExpanded(!isExpanded);
    }
  };

  // CSS custom properties for dynamic colors
  const customProperties = {
    "--alert-dimension-color": dimensionColor,
    "--alert-dimension-bg": dimensionBg,
    "--alert-score-color": scoreColor,
    "--alert-trend-color": trendDisplay.color,
  } as React.CSSProperties;

  const containerClasses = [
    "weak-dimension-alert",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const headerClasses = [
    "weak-dimension-alert__header",
    strategies.length > 0 ? "weak-dimension-alert__header--clickable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const chevronClasses = [
    "weak-dimension-alert__chevron",
    isExpanded ? "weak-dimension-alert__chevron--expanded" : "weak-dimension-alert__chevron--collapsed",
  ].join(" ");

  return (
    <div
      className={containerClasses}
      style={customProperties}
      role="region"
      aria-label={`${labels.label} dimension alert`}
    >
      <div
        className={headerClasses}
        onClick={handleClick}
        role={strategies.length > 0 ? "button" : undefined}
        aria-expanded={strategies.length > 0 ? isExpanded : undefined}
      >
        <div className="weak-dimension-alert__left-section">
          <div className="weak-dimension-alert__icon-container">
            <AlertCircleIcon size={14} />
          </div>
          <div className="weak-dimension-alert__content">
            <span className="weak-dimension-alert__title">{labels.label} needs attention</span>
            <span className="weak-dimension-alert__subtitle">
              Based on {promptCount} recent prompt{promptCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="weak-dimension-alert__right-section">
          <div className="weak-dimension-alert__score-container">
            <span className="weak-dimension-alert__score">{Math.round(averageScore)}%</span>
            {trend !== "stable" && (
              <span className="weak-dimension-alert__trend">
                {trendDisplay.icon}
                {trendDisplay.label}
              </span>
            )}
          </div>
          {strategies.length > 0 && (
            <span className={chevronClasses}>
              <ChevronDownIcon size={14} />
            </span>
          )}
        </div>
      </div>

      {isExpanded && strategies.length > 0 && (
        <div className="weak-dimension-alert__strategies-container">
          <ul className="weak-dimension-alert__strategies-list">
            {strategies.map((strategy, index) => (
              <li key={index} className="weak-dimension-alert__strategy-item">
                {strategy}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default WeakDimensionAlert;
