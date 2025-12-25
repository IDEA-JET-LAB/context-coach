/**
 * TipCard Component
 * Story 19-5: Quick Coaching Tips
 *
 * Displays a single coaching tip with dismiss functionality and optional examples.
 */

import React, { useState } from "react";
import { XIcon } from "./icons";
import type { DimensionName, TipPriority } from "../shared/types";
import {
  getDimensionColor,
  getDimensionBgColor,
  PRIORITY_COLORS,
} from "../shared/tokens";
import "./tip-card.css";

export type { DimensionName, TipPriority };

export interface TipCardProps {
  /** Unique identifier for the tip */
  id: string;
  /** Which dimension this tip addresses */
  dimension: DimensionName;
  /** Short, descriptive title */
  title: string;
  /** Detailed explanation of the improvement */
  description: string;
  /** Optional before/after example */
  example?: {
    before: string;
    after: string;
  };
  /** Priority level for display styling */
  priority: TipPriority;
  /** Callback when tip is dismissed */
  onDismiss?: (tipId: string) => void;
  /** Whether this tip is in dismissing animation state */
  isDismissing?: boolean;
  /** Additional CSS class */
  className?: string;
}

// Note: Priority colors and dimension colors are now imported from shared/tokens

export const TipCard: React.FC<TipCardProps> = ({
  id,
  dimension,
  title,
  description,
  example,
  priority,
  onDismiss,
  isDismissing = false,
  className = "",
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showExample, setShowExample] = useState(false);

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss(id);
    }
  };

  // CSS custom properties for dynamic colors
  const customProperties = {
    "--tip-priority-color": PRIORITY_COLORS[priority],
    "--tip-dimension-color": getDimensionColor(dimension),
    "--tip-dimension-bg": getDimensionBgColor(dimension),
  } as React.CSSProperties;

  const containerClasses = [
    "tip-card",
    isDismissing ? "tip-card--dismissing" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const dismissBtnClasses = [
    "tip-card__dismiss-btn",
    isHovered ? "tip-card__dismiss-btn--visible" : "tip-card__dismiss-btn--hidden",
  ].join(" ");

  const descriptionClasses = [
    "tip-card__description",
    example ? "tip-card__description--with-example" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={containerClasses}
      style={customProperties}
      role="article"
      aria-label={`Coaching tip: ${title}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="tip-card__header">
        <div>
          <span className="tip-card__dimension-badge">{dimension}</span>
        </div>
        {onDismiss && (
          <button
            className={dismissBtnClasses}
            onClick={handleDismiss}
            aria-label="Dismiss tip"
          >
            <XIcon size={12} />
          </button>
        )}
      </div>

      <h4 className="tip-card__title">{title}</h4>
      <p className={descriptionClasses}>{description}</p>

      {example && (
        <>
          <button
            className="tip-card__example-toggle"
            onClick={() => setShowExample(!showExample)}
            aria-expanded={showExample}
          >
            {showExample ? "Hide example" : "Show example"}
          </button>

          {showExample && (
            <div className="tip-card__example">
              <div className="tip-card__example-section">
                <div className="tip-card__example-label">Before:</div>
                <code className="tip-card__example-code tip-card__example-code--before">
                  {example.before}
                </code>
              </div>
              <div className="tip-card__example-section">
                <div className="tip-card__example-label">After:</div>
                <code className="tip-card__example-code tip-card__example-code--after">
                  {example.after}
                </code>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TipCard;
