import React, { useState, useEffect, useMemo } from "react";

export interface ImportHistory {
  timestamp: string;
  importedCount: number;
  skippedCount: number;
  totalSessions: number;
}

/**
 * Discovered Claude Code project info for display
 */
export interface DiscoveredProjectInfo {
  path: string;
  normalizedPath: string;
  sessionCount: number;
  estimatedPrompts: number;
  oldestSession: string;
  newestSession: string;
  displayName: string;
}

export interface ImportStatus {
  state: "idle" | "scanning" | "selecting" | "importing" | "complete" | "error" | "cancelled";
  totalSessions: number;
  importedCount: number;
  skippedCount: number;
  errorMessage?: string;
  statusMessage?: string;
  currentProject?: string;
  progress?: number;
  discoveredProjects?: DiscoveredProjectInfo[];
}

/**
 * Team info for import team selection
 */
export interface ImportTeamInfo {
  id: string;
  name: string;
}

interface ImportPanelProps {
  isLoading: boolean;
  importStatus: ImportStatus | null;
  lastImport?: ImportHistory | null;
  teams?: ImportTeamInfo[];
  teamsLoading?: boolean;
  onStartImport: () => void;
  onCancelImport: () => void;
  onConfirmProjects: (selectedPaths: string[], teamId?: string) => void;
  onFetchTeams?: () => void;
  onResetImport?: () => void;
}

// Helper to format relative time
const formatRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

// Helper to format date range
const formatDateRange = (oldest: string, newest: string): string => {
  const oldestDate = new Date(oldest);
  const newestDate = new Date(newest);
  const now = new Date();

  const daysDiff = Math.floor((now.getTime() - oldestDate.getTime()) / 86400000);

  if (daysDiff === 0) return "Today";
  if (daysDiff === 1) return "Yesterday - Today";
  if (daysDiff < 7) return `${daysDiff} days`;
  if (daysDiff < 30) return `${Math.floor(daysDiff / 7)} weeks`;
  if (daysDiff < 365) return `${Math.floor(daysDiff / 30)} months`;
  return `${Math.floor(daysDiff / 365)}+ years`;
};

/**
 * Project selection item component
 */
const ProjectItem: React.FC<{
  project: DiscoveredProjectInfo;
  isSelected: boolean;
  onToggle: () => void;
}> = ({ project, isSelected, onToggle }) => {
  return (
    <div
      className={`project-item ${isSelected ? "selected" : ""}`}
      onClick={onToggle}
    >
      <div className="project-checkbox">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <div className="project-info">
        <div className="project-name">{project.displayName}</div>
        <div className="project-path">{project.path}</div>
        <div className="project-stats">
          <span className="stat">
            <span className="stat-value">{project.sessionCount}</span>
            <span className="stat-label">sessions</span>
          </span>
          <span className="stat">
            <span className="stat-value">~{project.estimatedPrompts}</span>
            <span className="stat-label">prompts</span>
          </span>
          <span className="stat">
            <span className="stat-value">{formatDateRange(project.oldestSession, project.newestSession)}</span>
            <span className="stat-label">span</span>
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Project selection list component
 */
const ProjectSelectionList: React.FC<{
  projects: DiscoveredProjectInfo[];
  selectedPaths: Set<string>;
  onToggle: (path: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}> = ({ projects, selectedPaths, onToggle, onSelectAll, onSelectNone }) => {
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      // Sort by newest session first
      return new Date(b.newestSession).getTime() - new Date(a.newestSession).getTime();
    });
  }, [projects]);

  const totalEstimatedPrompts = useMemo(() => {
    return projects
      .filter(p => selectedPaths.has(p.path))
      .reduce((sum, p) => sum + p.estimatedPrompts, 0);
  }, [projects, selectedPaths]);

  return (
    <div className="project-selection">
      <div className="selection-header">
        <div className="selection-info">
          <span className="selection-count">
            {selectedPaths.size} of {projects.length} projects
          </span>
          <span className="selection-estimate">
            (~{totalEstimatedPrompts} prompts)
          </span>
        </div>
        <div className="selection-actions">
          <button
            className="link-button"
            onClick={onSelectAll}
            disabled={selectedPaths.size === projects.length}
          >
            Select All
          </button>
          <button
            className="link-button"
            onClick={onSelectNone}
            disabled={selectedPaths.size === 0}
          >
            Select None
          </button>
        </div>
      </div>
      <div className="project-list">
        {sortedProjects.map(project => (
          <ProjectItem
            key={project.path}
            project={project}
            isSelected={selectedPaths.has(project.path)}
            onToggle={() => onToggle(project.path)}
          />
        ))}
      </div>
    </div>
  );
};

export const ImportPanel: React.FC<ImportPanelProps> = ({
  isLoading,
  importStatus,
  lastImport,
  teams,
  teamsLoading,
  onStartImport,
  onCancelImport,
  onConfirmProjects,
  onFetchTeams,
  onResetImport,
}) => {
  const [confirmed, setConfirmed] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>();

  // Initialize selected paths when projects are discovered
  useEffect(() => {
    if (importStatus?.state === "selecting" && importStatus.discoveredProjects) {
      // Default: select all projects
      setSelectedPaths(new Set(importStatus.discoveredProjects.map(p => p.path)));
      // Fetch teams when entering selection mode
      if (onFetchTeams) {
        onFetchTeams();
      }
    }
  }, [importStatus?.state, importStatus?.discoveredProjects, onFetchTeams]);

  // Set default team when teams are loaded
  useEffect(() => {
    if (teams && teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  const handleToggleProject = (path: string) => {
    setSelectedPaths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (importStatus?.discoveredProjects) {
      setSelectedPaths(new Set(importStatus.discoveredProjects.map(p => p.path)));
    }
  };

  const handleSelectNone = () => {
    setSelectedPaths(new Set());
  };

  const handleConfirmImport = () => {
    onConfirmProjects(Array.from(selectedPaths), selectedTeamId);
  };

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

    // Project selection state
    if (importStatus?.state === "selecting" && importStatus.discoveredProjects) {
      const projects = importStatus.discoveredProjects;
      const showTeamSelector = teams && teams.length > 1;

      return (
        <div className="import-selecting">
          <div className="selecting-header">
            <h3 className="selecting-title">Select Projects to Import</h3>
            <p className="selecting-description">
              Choose which Claude Code projects you want to synchronize with Contextor.
            </p>
          </div>

          {/* Team selector - only shown when user has multiple teams */}
          {showTeamSelector && (
            <div className="team-selector">
              <label htmlFor="import-team-select" className="team-selector-label">
                Import to team:
              </label>
              {teamsLoading ? (
                <span className="teams-loading">Loading teams...</span>
              ) : (
                <select
                  id="import-team-select"
                  className="team-select"
                  value={selectedTeamId || ""}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                >
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <ProjectSelectionList
            projects={projects}
            selectedPaths={selectedPaths}
            onToggle={handleToggleProject}
            onSelectAll={handleSelectAll}
            onSelectNone={handleSelectNone}
          />

          <div className="selecting-footer">
            <button
              className="secondary-button"
              onClick={onCancelImport}
            >
              Cancel
            </button>
            <button
              className="primary-button"
              onClick={handleConfirmImport}
              disabled={selectedPaths.size === 0}
            >
              Import {selectedPaths.size} Project{selectedPaths.size !== 1 ? "s" : ""}
            </button>
          </div>
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
          <button className="primary-button" onClick={() => {
            setConfirmed(false);
            setSelectedPaths(new Set());
            setSelectedTeamId(undefined);
            onResetImport?.();
          }}>
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

        {lastImport && (
          <div className="last-import-info">
            <h4>Last Import</h4>
            <div className="last-import-details">
              <span className="last-import-time">{formatRelativeTime(lastImport.timestamp)}</span>
              <span className="last-import-stats">
                {lastImport.importedCount} imported, {lastImport.skippedCount} skipped
              </span>
            </div>
          </div>
        )}

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
          Scan for Projects
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
