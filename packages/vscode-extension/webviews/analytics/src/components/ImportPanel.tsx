import React, { useState } from "react";

interface ImportPanelProps {
  isLoading: boolean;
  importStatus: ImportStatus | null;
  onStartImport: () => void;
  onCancelImport: () => void;
}

export interface ImportStatus {
  state: "idle" | "scanning" | "importing" | "complete" | "error" | "cancelled";
  totalSessions: number;
  importedCount: number;
  skippedCount: number;
  errorMessage?: string;
  /** Detailed status message for user feedback */
  statusMessage?: string;
  /** Current project being processed */
  currentProject?: string;
  /** Progress percentage (0-100) */
  progress?: number;
}

export const ImportPanel: React.FC<ImportPanelProps> = ({
  isLoading,
  importStatus,
  onStartImport,
  onCancelImport,
}) => {
  const [confirmed, setConfirmed] = useState(false);

  const renderContent = () => {
    if (isLoading || importStatus?.state === "scanning") {
      const progress = importStatus?.progress ?? 0;
      const statusMessage = importStatus?.statusMessage || "Scanning for Claude Code transcripts...";

      return (
        <div className="import-progress">
          <div className="progress-header">
            <span>Scanning...</span>
            <span>{progress}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="status-message">{statusMessage}</p>
          {importStatus?.currentProject && (
            <p className="current-project">Current: {importStatus.currentProject}</p>
          )}
        </div>
      );
    }

    if (importStatus?.state === "importing") {
      const progress = importStatus.progress ?? 0;
      const statusMessage = importStatus.statusMessage || "Importing transcripts...";

      return (
        <div className="import-progress">
          <div className="progress-header">
            <span>Importing...</span>
            <span>{progress}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="status-message">{statusMessage}</p>
          {importStatus.currentProject && (
            <p className="current-project">Project: {importStatus.currentProject}</p>
          )}
          <div className="progress-stats">
            <span>{importStatus.importedCount} imported</span>
            {importStatus.skippedCount > 0 && (
              <span className="skipped">{importStatus.skippedCount} skipped</span>
            )}
          </div>
          <button className="cancel-button" onClick={onCancelImport}>
            Cancel
          </button>
        </div>
      );
    }

    if (importStatus?.state === "complete") {
      return (
        <div className="import-complete">
          <div className="success-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h3 className="success-title">Import Complete!</h3>
          {importStatus.statusMessage && (
            <p className="status-message">{importStatus.statusMessage}</p>
          )}
          <div className="import-summary">
            <div className="summary-item">
              <span className="summary-value">{importStatus.importedCount}</span>
              <span className="summary-label">Imported</span>
            </div>
            <div className="summary-item">
              <span className="summary-value">{importStatus.skippedCount}</span>
              <span className="summary-label">Skipped</span>
            </div>
          </div>
          <button className="primary-button" onClick={() => setConfirmed(false)}>
            Import More
          </button>
        </div>
      );
    }

    if (importStatus?.state === "cancelled") {
      return (
        <div className="import-cancelled">
          <div className="cancelled-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h3 className="cancelled-title">Import Cancelled</h3>
          <div className="import-summary">
            <div className="summary-item">
              <span className="summary-value">{importStatus.importedCount}</span>
              <span className="summary-label">Imported before cancel</span>
            </div>
          </div>
          <button className="primary-button" onClick={onStartImport}>
            Start Again
          </button>
        </div>
      );
    }

    if (importStatus?.state === "error") {
      return (
        <div className="import-error">
          <div className="error-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h3 className="error-title">Import Failed</h3>
          {importStatus.statusMessage && (
            <p className="status-message">{importStatus.statusMessage}</p>
          )}
          <p className="error-message">{importStatus.errorMessage}</p>
          <button className="primary-button" onClick={onStartImport}>
            Try Again
          </button>
        </div>
      );
    }

    // Default: Show start import UI
    return (
      <div className="import-start">
        <div className="import-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <h3 className="import-title">Import Claude Code History</h3>
        <p className="import-description">
          Import your existing Claude Code conversation transcripts to analyze your prompting patterns and track improvement over time.
        </p>

        <div className="import-info">
          <h4>What gets imported:</h4>
          <ul>
            <li>Your prompts from Claude Code sessions</li>
            <li>Session metadata (timestamps, project info)</li>
          </ul>
          <p className="info-note">
            Claude responses are not imported or stored.
          </p>
        </div>

        <div className="confirm-checkbox">
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>I understand my prompts will be uploaded for analysis</span>
          </label>
        </div>

        <button
          className="primary-button"
          onClick={onStartImport}
          disabled={!confirmed}
        >
          Start Import
        </button>
      </div>
    );
  };

  return (
    <div className="import-panel">
      {renderContent()}
    </div>
  );
};
