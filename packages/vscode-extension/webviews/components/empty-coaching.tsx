/**
 * EmptyCoaching Component
 * Story 19-5: Quick Coaching Tips
 *
 * Empty state shown when there are no coaching tips or prompts yet.
 * Displays getting started tips to guide new users.
 */

import React from "react";
import { SparklesIcon } from "./icons";

export interface EmptyCoachingProps {
  /** Additional CSS class */
  className?: string;
}

/**
 * Default getting started tips for new users
 */
const gettingStartedTips = [
  {
    title: "Be specific about what you want",
    description: "State your goal clearly at the beginning of the prompt",
  },
  {
    title: "Provide relevant context",
    description: "Include language, framework, or constraints",
  },
  {
    title: "Define the expected output",
    description: "Specify format: code, explanation, or step-by-step",
  },
  {
    title: "Break complex tasks into steps",
    description: "Handle one thing at a time for better results",
  },
];

export const EmptyCoaching: React.FC<EmptyCoachingProps> = ({ className = "" }) => {
  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "24px 16px",
  };

  const iconContainerStyle: React.CSSProperties = {
    marginBottom: "16px",
    opacity: 0.5,
    animation: "pulse 2s ease-in-out infinite",
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--ctx-foreground, var(--vscode-foreground))",
    marginBottom: "8px",
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: "12px",
    lineHeight: "1.5",
    color: "var(--ctx-foreground-muted, var(--vscode-descriptionForeground))",
    maxWidth: "220px",
    marginBottom: "24px",
  };

  const tipsContainerStyle: React.CSSProperties = {
    width: "100%",
    textAlign: "left",
  };

  const tipsSectionTitleStyle: React.CSSProperties = {
    fontSize: "10px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--ctx-foreground-muted, var(--vscode-descriptionForeground))",
    marginBottom: "12px",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  };

  const tipsListStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  };

  const tipItemStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "10px 12px",
    backgroundColor: "var(--ctx-surface, var(--vscode-editor-background))",
    borderRadius: "var(--ctx-radius, 6px)",
    borderLeft: "3px solid var(--ctx-focus, var(--vscode-focusBorder))",
  };

  const tipTitleStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--ctx-foreground, var(--vscode-foreground))",
  };

  const tipDescriptionStyle: React.CSSProperties = {
    fontSize: "10px",
    color: "var(--ctx-foreground-muted, var(--vscode-descriptionForeground))",
    lineHeight: "1.4",
  };

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.05);
          }
        }
      `}</style>
      <div className={className} style={containerStyle} role="region" aria-label="No coaching tips yet">
        <div style={iconContainerStyle}>
          <SparklesIcon
            size={48}
            color="var(--ctx-foreground-muted, var(--vscode-descriptionForeground))"
          />
        </div>
        <h3 style={titleStyle}>No tips yet</h3>
        <p style={descriptionStyle}>
          Submit a few prompts and we'll analyze your patterns to provide personalized coaching tips.
        </p>

        <div style={tipsContainerStyle}>
          <h4 style={tipsSectionTitleStyle}>
            <SparklesIcon size={12} />
            Getting Started Tips
          </h4>
          <div style={tipsListStyle}>
            {gettingStartedTips.map((tip, index) => (
              <div key={index} style={tipItemStyle}>
                <span style={tipTitleStyle}>{tip.title}</span>
                <span style={tipDescriptionStyle}>{tip.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default EmptyCoaching;
