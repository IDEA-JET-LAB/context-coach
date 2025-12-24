import React from "react";

export interface Session {
  sessionId: string;
  projectName: string;
  lastActivity: string;
  lastPrompt: string;
  messageCount: number;
  isInterrupted?: boolean;
}

interface SessionsPanelProps {
  sessions: Session[];
  isLoading: boolean;
  onScan: () => void;
  onRecover: (sessionId: string) => void;
  onDismiss: (sessionId: string) => void;
}

const formatTimeAgo = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return `${minutes}m ago`;
};

const truncate = (str: string, len: number): string => {
  if (!str) return "";
  return str.length > len ? str.substring(0, len - 3) + "..." : str;
};

export const SessionsPanel: React.FC<SessionsPanelProps> = ({
  sessions,
  isLoading,
  onScan,
  onRecover,
  onDismiss,
}) => {
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p className="loading-text">Scanning for sessions...</p>
      </div>
    );
  }

  return (
    <div className="sessions-panel">
      <div className="sessions-header">
        <h2 className="section-title">Recent Sessions</h2>
        <button className="scan-button" onClick={onScan} title="Scan for sessions">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Scan
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <h3 className="empty-title">No sessions found</h3>
          <p className="empty-description">
            Click Scan to find recent Claude Code sessions
          </p>
        </div>
      ) : (
        <ul className="session-list">
          {sessions.map((session) => (
            <li key={session.sessionId} className="session-item">
              <div className="session-info">
                <div className="session-header">
                  <span className="session-project">{session.projectName}</span>
                  <span className="session-time">{formatTimeAgo(session.lastActivity)}</span>
                </div>
                <p className="session-prompt">{truncate(session.lastPrompt, 80)}</p>
                <div className="session-meta">
                  <span className="session-messages">{session.messageCount} messages</span>
                  {session.isInterrupted && (
                    <span className="session-interrupted-badge">Interrupted</span>
                  )}
                </div>
              </div>
              <div className="session-actions">
                <button
                  className="session-recover-btn"
                  onClick={() => onRecover(session.sessionId)}
                  title="Generate recovery prompt"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  Recover
                </button>
                <button
                  className="session-dismiss-btn"
                  onClick={() => onDismiss(session.sessionId)}
                  title="Dismiss this session"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
