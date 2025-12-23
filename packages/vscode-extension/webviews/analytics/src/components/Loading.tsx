import React from "react";

export const Loading: React.FC = () => {
  return (
    <div className="loading-container">
      <div className="loading-spinner" />
      <p className="loading-text">Loading analytics...</p>
    </div>
  );
};
