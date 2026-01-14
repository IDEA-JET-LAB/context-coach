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
  state: "idle" | "scanning" | "selecting" | "project-matching" | "importing" | "complete" | "error" | "cancelled";
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
 * Existing Contextor project for matching
 */
export interface ExistingProject {
  id: string;
  name: string;
}

/**
 * Team with its projects for grouped display
 */
export interface TeamWithProjects {
  id: string;
  name: string;
  projects: ExistingProject[];
}

/**
 * Project mapping: local path to existing project ID or null for "create new"
 */
export type ProjectMappings = Record<string, string | null>;

/**
 * Custom names for new projects: local path to custom name
 */
export type ProjectCustomNames = Record<string, string>;

/**
 * Team IDs for new projects: local path to team ID
 */
export type ProjectTeamIds = Record<string, string>;

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
  allTeamProjects?: TeamWithProjects[];
  allTeamProjectsLoading?: boolean;
  onStartImport: () => void;
  onCancelImport: () => void;
  onConfirmProjects: (selectedPaths: string[], teamId?: string) => void;
  onConfirmProjectMappings: (mappings: ProjectMappings, customNames: ProjectCustomNames, teamIds: ProjectTeamIds) => void;
  onFetchTeams?: () => void;
  onFetchAllTeamProjects?: () => void;
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
 * Get the display name from a path
 */
const getDisplayNameFromPath = (path: string): string => {
  // Extract just the folder name from the path
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
};

/**
 * Calculate similarity between two strings (0-1, higher = more similar)
 * Uses a simple approach: lowercase comparison + common substring ratio
 */
const calculateSimilarity = (str1: string, str2: string): number => {
  const s1 = str1.toLowerCase().replace(/[-_\s]/g, "");
  const s2 = str2.toLowerCase().replace(/[-_\s]/g, "");

  // Exact match
  if (s1 === s2) return 1;

  // One contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;

  // Calculate Levenshtein-like similarity
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1;

  // Count matching characters
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }

  return matches / longer.length;
};

/**
 * Find the best matching project for a given path
 * Returns project ID if similarity > 0.7, otherwise null
 */
const findBestMatch = (
  localPath: string,
  existingProjects: ExistingProject[]
): string | null => {
  const displayName = getDisplayNameFromPath(localPath);

  let bestMatch: { id: string; similarity: number } | null = null;

  for (const project of existingProjects) {
    const similarity = calculateSimilarity(displayName, project.name);
    if (similarity > 0.7 && (!bestMatch || similarity > bestMatch.similarity)) {
      bestMatch = { id: project.id, similarity };
    }
  }

  return bestMatch?.id || null;
};

/**
 * Project mapping item component - for matching import paths to existing projects
 * Shows projects grouped by team in dropdown, with team selector for new projects
 */
const ProjectMappingItem: React.FC<{
  localPath: string;
  allTeamProjects: TeamWithProjects[];
  selectedProjectId: string | null;
  selectedTeamId: string;
  customName: string;
  onSelect: (projectId: string | null) => void;
  onTeamChange: (teamId: string) => void;
  onCustomNameChange: (name: string) => void;
  onExclude: () => void;
}> = ({ localPath, allTeamProjects, selectedProjectId, selectedTeamId, customName, onSelect, onTeamChange, onCustomNameChange, onExclude }) => {
  const displayName = getDisplayNameFromPath(localPath);
  const isCreatingNew = selectedProjectId === null;

  // Flatten all projects for matching
  const allProjects = useMemo(() => {
    const projects: Array<ExistingProject & { teamId: string; teamName: string }> = [];
    for (const team of allTeamProjects) {
      for (const project of team.projects) {
        projects.push({ ...project, teamId: team.id, teamName: team.name });
      }
    }
    return projects;
  }, [allTeamProjects]);

  return (
    <div className="project-mapping-item">
      <div className="mapping-header">
        <div className="mapping-path">
          <span className="mapping-full-path">{localPath}</span>
        </div>
        <button
          className="exclude-button"
          onClick={onExclude}
          title="Exclude from import"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="mapping-controls">
        <select
          className="mapping-select"
          value={selectedProjectId ?? ""}
          onChange={(e) => onSelect(e.target.value === "" ? null : e.target.value)}
        >
          <option value="">Create new project</option>
          {allTeamProjects.map((team) => (
            <optgroup key={team.id} label={team.name}>
              {team.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {isCreatingNew && (
        <>
          <div className="mapping-team-select">
            <label className="mapping-name-label">Team:</label>
            <select
              className="mapping-team-dropdown"
              value={selectedTeamId}
              onChange={(e) => onTeamChange(e.target.value)}
            >
              {allTeamProjects.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mapping-name-input">
            <label className="mapping-name-label">Project name:</label>
            <input
              type="text"
              className="mapping-name-field"
              value={customName}
              onChange={(e) => onCustomNameChange(e.target.value)}
              placeholder={displayName}
            />
          </div>
        </>
      )}
    </div>
  );
};

/**
 * Project matching UI component - maps imported projects to existing ones
 * Shows all teams' projects grouped in dropdowns
 */
const ProjectMatchingPanel: React.FC<{
  selectedPaths: string[];
  allTeamProjects: TeamWithProjects[];
  isLoading: boolean;
  mappings: ProjectMappings;
  customNames: ProjectCustomNames;
  teamIds: ProjectTeamIds;
  onMappingChange: (path: string, projectId: string | null) => void;
  onCustomNameChange: (path: string, name: string) => void;
  onTeamIdChange: (path: string, teamId: string) => void;
  onExclude: (path: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}> = ({ selectedPaths, allTeamProjects, isLoading, mappings, customNames, teamIds, onMappingChange, onCustomNameChange, onTeamIdChange, onExclude, onConfirm, onBack }) => {
  // Flatten all projects for smart matching
  const allProjects = useMemo(() => {
    const projects: ExistingProject[] = [];
    for (const team of allTeamProjects) {
      for (const project of team.projects) {
        projects.push(project);
      }
    }
    return projects;
  }, [allTeamProjects]);

  // Apply smart matching when projects load
  useEffect(() => {
    if (!isLoading && allProjects.length > 0) {
      // For each path that doesn't have a mapping yet, try to find a match
      selectedPaths.forEach(path => {
        if (mappings[path] === null || mappings[path] === undefined) {
          const bestMatch = findBestMatch(path, allProjects);
          if (bestMatch) {
            onMappingChange(path, bestMatch);
          }
        }
      });
    }
  }, [isLoading, allProjects, selectedPaths]); // Intentionally exclude mappings and onMappingChange to avoid loops

  if (isLoading) {
    return (
      <div className="project-matching-loading">
        <div className="loading-spinner" />
        <p>Loading existing projects...</p>
      </div>
    );
  }

  // Get default team ID (first team)
  const defaultTeamId = allTeamProjects[0]?.id || "";

  const newProjectCount = selectedPaths.filter(p => mappings[p] === null || mappings[p] === undefined).length;
  const linkedProjectCount = selectedPaths.filter(p => mappings[p] !== null && mappings[p] !== undefined).length;

  return (
    <div className="project-matching">
      <div className="matching-header">
        <h3 className="matching-title">Link Projects</h3>
        <p className="matching-description">
          Link imported projects to existing ones, or create new projects.
        </p>
      </div>

      <div className="matching-summary">
        <span className="summary-item">
          <span className="summary-value">{linkedProjectCount}</span> linked
        </span>
        <span className="summary-separator">|</span>
        <span className="summary-item">
          <span className="summary-value">{newProjectCount}</span> new
        </span>
      </div>

      <div className="mapping-list">
        {selectedPaths.map((path) => (
          <ProjectMappingItem
            key={path}
            localPath={path}
            allTeamProjects={allTeamProjects}
            selectedProjectId={mappings[path] ?? null}
            selectedTeamId={teamIds[path] ?? defaultTeamId}
            customName={customNames[path] ?? getDisplayNameFromPath(path)}
            onSelect={(projectId) => onMappingChange(path, projectId)}
            onTeamChange={(teamId) => onTeamIdChange(path, teamId)}
            onCustomNameChange={(name) => onCustomNameChange(path, name)}
            onExclude={() => onExclude(path)}
          />
        ))}
      </div>

      {selectedPaths.length === 0 && (
        <div className="no-projects-message">
          No projects selected. Go back to select projects.
        </div>
      )}

      <div className="matching-footer">
        <button className="secondary-button" onClick={onBack}>
          Back
        </button>
        <button
          className="primary-button"
          onClick={onConfirm}
          disabled={selectedPaths.length === 0}
        >
          Start Import
        </button>
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
  allTeamProjects,
  allTeamProjectsLoading,
  onStartImport,
  onCancelImport,
  onConfirmProjects,
  onConfirmProjectMappings,
  onFetchTeams,
  onFetchAllTeamProjects,
  onResetImport,
}) => {
  const [confirmed, setConfirmed] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>();
  const [projectMappings, setProjectMappings] = useState<ProjectMappings>({});
  const [projectCustomNames, setProjectCustomNames] = useState<ProjectCustomNames>({});
  const [projectTeamIds, setProjectTeamIds] = useState<ProjectTeamIds>({});

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

  // Initialize project mappings when entering project-matching state
  useEffect(() => {
    if (importStatus?.state === "project-matching") {
      // Initialize all mappings to null (create new project)
      const initialMappings: ProjectMappings = {};
      Array.from(selectedPaths).forEach(path => {
        initialMappings[path] = null;
      });
      setProjectMappings(initialMappings);

      // Fetch all team projects for matching
      if (onFetchAllTeamProjects) {
        onFetchAllTeamProjects();
      }
    }
  }, [importStatus?.state, selectedPaths, onFetchAllTeamProjects]);

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

  // Transition to project-matching state
  const handleConfirmProjectSelection = () => {
    onConfirmProjects(Array.from(selectedPaths), selectedTeamId);
  };

  // Handle project mapping change
  const handleMappingChange = (path: string, projectId: string | null) => {
    setProjectMappings(prev => ({
      ...prev,
      [path]: projectId,
    }));
  };

  // Handle custom name change for new projects
  const handleCustomNameChange = (path: string, name: string) => {
    setProjectCustomNames(prev => ({
      ...prev,
      [path]: name,
    }));
  };

  // Handle team ID change for new projects
  const handleTeamIdChange = (path: string, teamId: string) => {
    setProjectTeamIds(prev => ({
      ...prev,
      [path]: teamId,
    }));
  };

  // Confirm project mappings and start import
  const handleConfirmMappings = () => {
    onConfirmProjectMappings(projectMappings, projectCustomNames, projectTeamIds);
  };

  // Go back from project-matching to selection
  const handleBackToSelection = () => {
    // Reset to selecting state - this will be handled by extension
    onCancelImport();
  };

  // Exclude a project from import (in project-matching state)
  const handleExcludeProject = (path: string) => {
    setSelectedPaths(prev => {
      const newSet = new Set(prev);
      newSet.delete(path);
      return newSet;
    });
    // Also remove from mappings, custom names, and team IDs
    setProjectMappings(prev => {
      const newMappings = { ...prev };
      delete newMappings[path];
      return newMappings;
    });
    setProjectCustomNames(prev => {
      const newNames = { ...prev };
      delete newNames[path];
      return newNames;
    });
    setProjectTeamIds(prev => {
      const newIds = { ...prev };
      delete newIds[path];
      return newIds;
    });
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
              onClick={handleConfirmProjectSelection}
              disabled={selectedPaths.size === 0}
            >
              Continue
            </button>
          </div>
        </div>
      );
    }

    // Project matching state
    if (importStatus?.state === "project-matching") {
      return (
        <ProjectMatchingPanel
          selectedPaths={Array.from(selectedPaths)}
          allTeamProjects={allTeamProjects || []}
          isLoading={allTeamProjectsLoading || false}
          mappings={projectMappings}
          customNames={projectCustomNames}
          teamIds={projectTeamIds}
          onMappingChange={handleMappingChange}
          onCustomNameChange={handleCustomNameChange}
          onTeamIdChange={handleTeamIdChange}
          onExclude={handleExcludeProject}
          onConfirm={handleConfirmMappings}
          onBack={handleBackToSelection}
        />
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
            setProjectMappings({});
            setProjectCustomNames({});
            setProjectTeamIds({});
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
