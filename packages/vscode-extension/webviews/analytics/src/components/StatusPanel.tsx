import React from "react";

// Status types from sprint-status.yaml
type EpicStatus = "done" | "in-progress" | "backlog" | "deferred";
type StoryStatus = "done" | "in-progress" | "ready-for-dev" | "backlog" | "future" | "design-only" | "optional";

export interface StoryData {
  id: string;
  name: string;
  status: StoryStatus;
}

export interface EpicData {
  id: string;
  name: string;
  status: EpicStatus;
  description?: string;
  stories: StoryData[];
}

export interface ProjectStatusData {
  project: string;
  generated: string;
  epics: EpicData[];
}

// Section collapsed state type
export interface StatusSectionState {
  inProgress: boolean;
  backlog: boolean;
  completed: boolean;
  deferred: boolean;
}

interface StatusPanelProps {
  status: ProjectStatusData | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpenFile?: () => void;
  sectionState?: StatusSectionState;
  onSectionToggle?: (section: keyof StatusSectionState) => void;
}

// Status color mapping
const getStatusColor = (status: string): string => {
  switch (status) {
    case "done":
      return "var(--ctx-success)";
    case "in-progress":
      return "var(--ctx-primary)";
    case "ready-for-dev":
      return "var(--ctx-warning)";
    case "backlog":
      return "var(--ctx-foreground-muted)";
    case "deferred":
    case "future":
      return "var(--ctx-foreground-subtle)";
    case "design-only":
      return "#9333EA"; // purple
    case "optional":
      return "var(--ctx-foreground-subtle)";
    default:
      return "var(--ctx-foreground-muted)";
  }
};

// Icons
const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const OpenFileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

// Status icons - all icon-only, different per status
const CheckCircleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const PlayCircleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polygon points="10 8 16 12 10 16 10 8" />
  </svg>
);

const CircleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
  </svg>
);

const PauseCircleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="10" y1="15" x2="10" y2="9" />
    <line x1="14" y1="15" x2="14" y2="9" />
  </svg>
);

const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 19l7-7 3 3-7 7-3-3z" />
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <path d="M2 2l7.586 7.586" />
    <circle cx="11" cy="11" r="2" />
  </svg>
);

const SkipIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

// Status icon component - icon only, colored
const StatusIcon: React.FC<{ status: string; size?: "sm" | "md" }> = ({ status, size = "md" }) => {
  const color = getStatusColor(status);
  const scale = size === "sm" ? 0.85 : 1;

  const getIcon = () => {
    switch (status) {
      case "done":
        return <CheckCircleIcon />;
      case "in-progress":
        return <ClockIcon />;
      case "ready-for-dev":
        return <PlayCircleIcon />;
      case "backlog":
        return <CircleIcon />;
      case "deferred":
      case "future":
        return <PauseCircleIcon />;
      case "design-only":
        return <PencilIcon />;
      case "optional":
        return <SkipIcon />;
      default:
        return <CircleIcon />;
    }
  };

  return (
    <span
      className="status-icon"
      style={{ color, transform: `scale(${scale})` }}
      title={status.replace(/-/g, " ")}
    >
      {getIcon()}
    </span>
  );
};

// Extract epic number from ID (e.g., "epic-1" → "1", "epic-14.5" → "14.5")
const getEpicNumber = (epicId: string): string => {
  const match = epicId.match(/epic-(\d+(?:\.\d+)?)/);
  return match ? match[1] : epicId;
};

// Extract story number from ID (e.g., "1-1-project-initialization" → "1.1")
const getStoryNumber = (storyId: string): string => {
  const match = storyId.match(/^(\d+(?:\.\d+)?)-(\d+)/);
  return match ? `${match[1]}.${match[2]}` : storyId;
};

// Calculate epic progress
const getEpicProgress = (epic: EpicData): { done: number; total: number; percent: number } => {
  const stories = epic.stories.filter(s => s.status !== "optional");
  const done = stories.filter(s => s.status === "done").length;
  const total = stories.length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, percent };
};

// Collapsible Epic component
const EpicCard: React.FC<{ epic: EpicData; defaultExpanded?: boolean }> = ({
  epic,
  defaultExpanded = false
}) => {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const progress = getEpicProgress(epic);
  const epicNumber = getEpicNumber(epic.id);

  return (
    <div className={`epic-card ${epic.status}`}>
      <div
        className="epic-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="epic-title-row">
          <span className={`expand-icon ${isExpanded ? "expanded" : ""}`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </span>
          <span className="epic-number">{epicNumber}</span>
          <span className="epic-title">{epic.name}</span>
          <StatusIcon status={epic.status} />
        </div>

        {epic.status !== "done" && epic.status !== "backlog" && epic.status !== "deferred" && (
          <div className="epic-progress">
            <div className="progress-bar-mini">
              <div
                className="progress-fill-mini"
                style={{
                  width: `${progress.percent}%`,
                  backgroundColor: getStatusColor(epic.status),
                }}
              />
            </div>
            <span className="progress-text">{progress.done}/{progress.total}</span>
          </div>
        )}
      </div>

      {isExpanded && epic.stories.length > 0 && (
        <div className="story-list">
          {epic.stories.map((story) => (
            <div key={story.id} className={`story-item ${story.status}`}>
              <span className="story-number">{getStoryNumber(story.id)}</span>
              <span className="story-name">{story.name}</span>
              <StatusIcon status={story.status} size="sm" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Collapsible section component for epic categories
const CollapsibleSection: React.FC<{
  title: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, count, isExpanded, onToggle, children }) => {
  return (
    <div className="epic-section collapsible">
      <h4 className="section-title clickable" onClick={onToggle}>
        <span className={`section-expand-icon ${isExpanded ? "expanded" : ""}`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </span>
        <span className="section-title-text">{title}</span>
        <span className="section-count">({count})</span>
      </h4>
      {isExpanded && children}
    </div>
  );
};

// Summary stats component
const StatusSummary: React.FC<{ epics: EpicData[] }> = ({ epics }) => {
  const epicCounts = {
    done: epics.filter(e => e.status === "done").length,
    inProgress: epics.filter(e => e.status === "in-progress").length,
    backlog: epics.filter(e => e.status === "backlog").length,
    deferred: epics.filter(e => e.status === "deferred").length,
  };

  const allStories = epics.flatMap(e => e.stories);
  const storyCounts = {
    done: allStories.filter(s => s.status === "done").length,
    inProgress: allStories.filter(s => s.status === "in-progress").length,
    readyForDev: allStories.filter(s => s.status === "ready-for-dev").length,
    backlog: allStories.filter(s => s.status === "backlog").length,
  };

  return (
    <div className="status-summary">
      <div className="summary-section">
        <h4>Epics</h4>
        <div className="summary-stats">
          <div className="stat-item done">
            <span className="stat-value">{epicCounts.done}</span>
            <span className="stat-label">Done</span>
          </div>
          <div className="stat-item in-progress">
            <span className="stat-value">{epicCounts.inProgress}</span>
            <span className="stat-label">Active</span>
          </div>
          <div className="stat-item backlog">
            <span className="stat-value">{epicCounts.backlog}</span>
            <span className="stat-label">Backlog</span>
          </div>
        </div>
      </div>

      <div className="summary-section">
        <h4>Stories</h4>
        <div className="summary-stats">
          <div className="stat-item done">
            <span className="stat-value">{storyCounts.done}</span>
            <span className="stat-label">Done</span>
          </div>
          <div className="stat-item in-progress">
            <span className="stat-value">{storyCounts.inProgress}</span>
            <span className="stat-label">Active</span>
          </div>
          <div className="stat-item ready-for-dev">
            <span className="stat-value">{storyCounts.readyForDev}</span>
            <span className="stat-label">Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Default section state (all expanded)
const defaultSectionState: StatusSectionState = {
  inProgress: true,
  backlog: true,
  completed: true,
  deferred: true,
};

export const StatusPanel: React.FC<StatusPanelProps> = ({
  status,
  isLoading,
  error,
  onRefresh,
  onOpenFile,
  sectionState = defaultSectionState,
  onSectionToggle,
}) => {
  if (isLoading) {
    return (
      <div className="status-panel">
        <div className="status-loading">
          <div className="loading-spinner" />
          <span>Loading project status...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="status-panel">
        <div className="status-error">
          <span className="error-text">{error}</span>
          <button className="retry-button" onClick={onRefresh}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="status-panel">
        <div className="status-empty">
          <p>No sprint-status.yaml found in workspace.</p>
          <p className="status-hint">
            This tab shows BMAD project status when a sprint-status.yaml file exists.
          </p>
          <button className="primary-button" onClick={onRefresh}>
            <RefreshIcon /> Scan Workspace
          </button>
        </div>
      </div>
    );
  }

  // Group epics by status for better display
  const inProgressEpics = status.epics.filter(e => e.status === "in-progress");
  const backlogEpics = status.epics.filter(e => e.status === "backlog");
  const doneEpics = status.epics.filter(e => e.status === "done");
  const deferredEpics = status.epics.filter(e => e.status === "deferred");

  return (
    <div className="status-panel">
      <div className="status-header">
        <div className="header-left">
          <h3>Project Status</h3>
          <span className="project-name">{status.project}</span>
        </div>
        <div className="header-actions">
          {onOpenFile && (
            <button
              className="icon-button"
              onClick={onOpenFile}
              title="Open sprint-status.yaml"
            >
              <OpenFileIcon />
            </button>
          )}
          <button
            className="icon-button"
            onClick={onRefresh}
            title="Refresh status"
          >
            <RefreshIcon />
          </button>
        </div>
      </div>

      <StatusSummary epics={status.epics} />

      <div className="epic-sections">
        {inProgressEpics.length > 0 && (
          <CollapsibleSection
            title="In Progress"
            count={inProgressEpics.length}
            isExpanded={sectionState.inProgress}
            onToggle={() => onSectionToggle?.("inProgress")}
          >
            {inProgressEpics.map((epic) => (
              <EpicCard key={epic.id} epic={epic} defaultExpanded />
            ))}
          </CollapsibleSection>
        )}

        {backlogEpics.length > 0 && (
          <CollapsibleSection
            title="Backlog"
            count={backlogEpics.length}
            isExpanded={sectionState.backlog}
            onToggle={() => onSectionToggle?.("backlog")}
          >
            {backlogEpics.map((epic) => (
              <EpicCard key={epic.id} epic={epic} />
            ))}
          </CollapsibleSection>
        )}

        {doneEpics.length > 0 && (
          <CollapsibleSection
            title="Completed"
            count={doneEpics.length}
            isExpanded={sectionState.completed}
            onToggle={() => onSectionToggle?.("completed")}
          >
            {doneEpics.map((epic) => (
              <EpicCard key={epic.id} epic={epic} />
            ))}
          </CollapsibleSection>
        )}

        {deferredEpics.length > 0 && (
          <CollapsibleSection
            title="Deferred"
            count={deferredEpics.length}
            isExpanded={sectionState.deferred}
            onToggle={() => onSectionToggle?.("deferred")}
          >
            {deferredEpics.map((epic) => (
              <EpicCard key={epic.id} epic={epic} />
            ))}
          </CollapsibleSection>
        )}
      </div>

      <div className="status-footer">
        <span className="generated-date">
          Generated: {new Date(status.generated).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
};
