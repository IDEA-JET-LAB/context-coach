import React from "react";

interface Activity {
  timestamp: string;
  type: "prompt" | "session_start" | "session_end";
  description: string;
}

interface RecentPromptsProps {
  activities: Activity[];
}

// Format relative time
function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours}h ago`;
  }
  const days = Math.floor(seconds / 86400);
  return `${days}d ago`;
}

// Get icon for activity type
function getActivityIcon(type: Activity["type"]): React.ReactNode {
  switch (type) {
    case "prompt":
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "session_start":
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      );
    case "session_end":
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="6" y="4" width="4" height="16" />
          <rect x="14" y="4" width="4" height="16" />
        </svg>
      );
  }
}

export const RecentPrompts: React.FC<RecentPromptsProps> = ({ activities }) => {
  if (activities.length === 0) {
    return null;
  }

  return (
    <div className="recent-prompts">
      <h3 className="section-title">Recent Activity</h3>
      <ul className="activity-list">
        {activities.slice(0, 5).map((activity, index) => (
          <li key={index} className="activity-item">
            <span className={`activity-icon ${activity.type}`}>
              {getActivityIcon(activity.type)}
            </span>
            <div className="activity-content">
              <span className="activity-description">{activity.description}</span>
              <span className="activity-time">
                {formatRelativeTime(activity.timestamp)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
