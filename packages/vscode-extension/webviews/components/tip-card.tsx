/**
 * TipCard Component
 * Story 19-5: Quick Coaching Tips
 *
 * Displays a single coaching tip with dismiss functionality and optional examples.
 */

import React, { useState } from "react";
import { XIcon } from "./icons";

export type TipPriority = "high" | "medium" | "low";
export type DimensionName =
  | "clarity"
  | "context"
  | "specificity"
  | "actionability"
  | "efficiency";

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

/**
 * Priority to border color mapping
 */
const priorityColors: Record<TipPriority, string> = {
  high: "var(--vscode-inputValidation-errorBorder, #f14c4c)",
  medium: "var(--vscode-inputValidation-warningBorder, #cca700)",
  low: "var(--vscode-inputValidation-infoBorder, #3794ff)",
};

/**
 * Dimension to badge color mapping
 */
const dimensionColors: Record<DimensionName, string> = {
  clarity: "#3b82f6",
  context: "#8b5cf6",
  specificity: "#10b981",
  actionability: "#f59e0b",
  efficiency: "#ef4444",
};

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

  const containerStyle: React.CSSProperties = {
    borderLeft: `3px solid ${priorityColors[priority]}`,
    padding: "12px",
    marginBottom: "8px",
    backgroundColor: "var(--ctx-surface, var(--vscode-editor-background))",
    borderRadius: "var(--ctx-radius, 4px)",
    opacity: isDismissing ? 0 : 1,
    transform: isDismissing ? "translateX(100%)" : "translateX(0)",
    transition: "opacity 200ms ease, transform 200ms ease",
    animation: "tipSlideIn 200ms ease-out",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "8px",
    marginBottom: "8px",
  };

  const dimensionBadgeStyle: React.CSSProperties = {
    display: "inline-block",
    fontSize: "9px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    padding: "2px 6px",
    borderRadius: "2px",
    backgroundColor: `${dimensionColors[dimension]}20`,
    color: dimensionColors[dimension],
  };

  const dismissButtonStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2px",
    background: "transparent",
    border: "none",
    borderRadius: "2px",
    color: "var(--ctx-foreground-muted, var(--vscode-descriptionForeground))",
    cursor: "pointer",
    opacity: isHovered ? 1 : 0.5,
    transition: "opacity 100ms ease, background-color 100ms ease",
    flexShrink: 0,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--ctx-foreground, var(--vscode-foreground))",
    marginBottom: "4px",
    lineHeight: "1.3",
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: "11px",
    lineHeight: "1.5",
    color: "var(--ctx-foreground-muted, var(--vscode-descriptionForeground))",
    marginBottom: example ? "8px" : 0,
  };

  const exampleToggleStyle: React.CSSProperties = {
    fontSize: "10px",
    color: "var(--ctx-link, var(--vscode-textLink-foreground))",
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    textDecoration: "underline",
  };

  const exampleContainerStyle: React.CSSProperties = {
    marginTop: "8px",
    padding: "8px",
    backgroundColor: "var(--ctx-background, var(--vscode-sideBar-background))",
    borderRadius: "4px",
    fontSize: "11px",
    animation: "fadeIn 150ms ease-out",
  };

  const exampleLabelStyle: React.CSSProperties = {
    fontSize: "9px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--ctx-foreground-muted, var(--vscode-descriptionForeground))",
    marginBottom: "4px",
  };

  const exampleCodeStyle: React.CSSProperties = {
    fontFamily: "var(--ctx-font-mono, var(--vscode-editor-font-family), monospace)",
    fontSize: "10px",
    lineHeight: "1.4",
    color: "var(--ctx-foreground, var(--vscode-foreground))",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };

  const beforeStyle: React.CSSProperties = {
    ...exampleCodeStyle,
    opacity: 0.6,
    textDecoration: "line-through",
  };

  const afterStyle: React.CSSProperties = {
    ...exampleCodeStyle,
    color: "var(--ctx-score-high, #22c55e)",
  };

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss(id);
    }
  };

  return (
    <>
      <style>{`
        @keyframes tipSlideIn {
          from {
            opacity: 0;
            transform: translateX(8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      <div
        className={className}
        style={containerStyle}
        role="article"
        aria-label={`Coaching tip: ${title}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div style={headerStyle}>
          <div>
            <span style={dimensionBadgeStyle}>{dimension}</span>
          </div>
          {onDismiss && (
            <button
              style={dismissButtonStyle}
              onClick={handleDismiss}
              aria-label="Dismiss tip"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  "var(--ctx-surface-hover, var(--vscode-toolbar-hoverBackground))";
                e.currentTarget.style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.opacity = isHovered ? "1" : "0.5";
              }}
            >
              <XIcon size={12} />
            </button>
          )}
        </div>

        <h4 style={titleStyle}>{title}</h4>
        <p style={descriptionStyle}>{description}</p>

        {example && (
          <>
            <button
              style={exampleToggleStyle}
              onClick={() => setShowExample(!showExample)}
              aria-expanded={showExample}
            >
              {showExample ? "Hide example" : "Show example"}
            </button>

            {showExample && (
              <div style={exampleContainerStyle}>
                <div style={{ marginBottom: "8px" }}>
                  <div style={exampleLabelStyle}>Before:</div>
                  <code style={beforeStyle}>{example.before}</code>
                </div>
                <div>
                  <div style={exampleLabelStyle}>After:</div>
                  <code style={afterStyle}>{example.after}</code>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default TipCard;
