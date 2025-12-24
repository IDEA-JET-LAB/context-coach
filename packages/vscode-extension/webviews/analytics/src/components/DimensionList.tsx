import React from "react";

interface DimensionScore {
  score: number;
  trend: "up" | "down" | "stable";
  change?: number;
}

interface DimensionListProps {
  dimensions: {
    clarity: DimensionScore;
    context: DimensionScore;
    specificity: DimensionScore;
    actionability: DimensionScore;
    efficiency: DimensionScore;
  };
}

const dimensionLabels: Record<string, string> = {
  clarity: "Clarity",
  context: "Context",
  specificity: "Specificity",
  actionability: "Actionability",
  efficiency: "Efficiency",
};

const TrendIcon: React.FC<{ trend: "up" | "down" | "stable" }> = ({ trend }) => {
  if (trend === "up") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="17 11 12 6 7 11" />
        <line x1="12" y1="6" x2="12" y2="18" />
      </svg>
    );
  }
  if (trend === "down") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="7 13 12 18 17 13" />
        <line x1="12" y1="6" x2="12" y2="18" />
      </svg>
    );
  }
  return null;
};

export const DimensionList: React.FC<DimensionListProps> = ({ dimensions }) => {
  const dimensionEntries = Object.entries(dimensions) as [
    keyof typeof dimensions,
    DimensionScore
  ][];

  return (
    <div className="metrics-list">
      {dimensionEntries.map(([key, dim]) => (
        <div className="metric-row" key={key}>
          <span className="metric-label">{dimensionLabels[key] || key}</span>
          <span className="metric-value">
            {dim.score}%
            {dim.trend !== "stable" && (
              <span className={`score-trend ${dim.trend}`}>
                <TrendIcon trend={dim.trend} />
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
};
