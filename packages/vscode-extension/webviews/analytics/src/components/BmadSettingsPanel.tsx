import React from "react";

export interface BmadVersionInfo {
  installedVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  lastChecked: string | null;
}

interface BmadSettingsPanelProps {
  versionInfo: BmadVersionInfo | null;
  isLoading: boolean;
  onCheckVersion: () => void;
  onUpgrade: () => void;
}

export const BmadSettingsPanel: React.FC<BmadSettingsPanelProps> = ({
  versionInfo,
  isLoading,
  onCheckVersion,
  onUpgrade,
}) => {
  if (isLoading) {
    return (
      <div className="bmad-settings-panel">
        <div className="loading-container">
          <div className="loading-spinner" />
          <span className="loading-text">Checking BMAD version...</span>
        </div>
      </div>
    );
  }

  const hasUpdate = versionInfo?.updateAvailable ?? false;
  const installed = versionInfo?.installedVersion;
  const latest = versionInfo?.latestVersion;

  return (
    <div className="bmad-settings-panel">
      <div className="settings-header">
        <h2 className="panel-title">BMAD Settings</h2>
        <button className="refresh-button" onClick={onCheckVersion} aria-label="Check for updates">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      <div className="settings-section">
        <h3 className="section-title">Version Information</h3>

        <div className="version-card">
          <div className="version-row">
            <span className="version-label">Installed Version</span>
            <span className={`version-value ${!installed ? "not-installed" : ""}`}>
              {installed || "Not installed"}
            </span>
          </div>

          <div className="version-row">
            <span className="version-label">Latest Version</span>
            <span className="version-value">
              {latest || "Unknown"}
            </span>
          </div>

          {versionInfo?.lastChecked && (
            <div className="version-row last-checked">
              <span className="version-label">Last Checked</span>
              <span className="version-value muted">
                {formatTimeAgo(versionInfo.lastChecked)}
              </span>
            </div>
          )}
        </div>

        {hasUpdate && (
          <div className="update-available">
            <div className="update-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>Update available: {installed} → {latest}</span>
            </div>
            <button className="upgrade-button" onClick={onUpgrade}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upgrade BMAD
            </button>
          </div>
        )}

        {!installed && (
          <div className="not-installed-notice">
            <p>BMAD is not installed in this project.</p>
            <p className="hint">Use the "Install BMAD" button in the Commands tab to install it.</p>
          </div>
        )}

        {installed && !hasUpdate && latest && (
          <div className="up-to-date">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>You're up to date!</span>
          </div>
        )}
      </div>
    </div>
  );
};

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
