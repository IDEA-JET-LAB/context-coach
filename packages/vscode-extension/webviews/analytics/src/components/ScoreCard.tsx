import React from "react";

interface ScoreCardProps {
  score: number;
  label: string;
  trend?: "up" | "down" | "stable";
}

export const ScoreCard: React.FC<ScoreCardProps> = ({
  score,
  label,
  trend = "stable",
}) => {
  // Determine score color based on value
  const getScoreColor = (value: number): string => {
    if (value >= 80) return "var(--ctx-success)";
    if (value >= 60) return "var(--ctx-warning)";
    return "var(--ctx-error)";
  };

  // Calculate the gauge arc
  const radius = 40;
  const circumference = Math.PI * radius;
  const progress = (score / 100) * circumference;
  const dashOffset = circumference - progress;

  return (
    <div className="score-card">
      <div className="score-gauge">
        <svg width="100" height="60" viewBox="0 0 100 60">
          {/* Background arc */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="var(--ctx-border)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke={getScoreColor(score)}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.5s ease-out" }}
          />
        </svg>
        <div className="score-value" style={{ color: getScoreColor(score) }}>
          {score}
        </div>
      </div>
      <div className="score-info">
        <span className="score-label">{label}</span>
        {trend !== "stable" && (
          <span className={`score-trend ${trend}`}>
            {trend === "up" ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4l-8 8h5v8h6v-8h5z" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 20l8-8h-5V4H9v8H4z" />
              </svg>
            )}
          </span>
        )}
      </div>
    </div>
  );
};
