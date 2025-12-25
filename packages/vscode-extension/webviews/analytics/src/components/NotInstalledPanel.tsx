import React from "react";

interface NotInstalledPanelProps {
  type: "contextor" | "bmad";
  onInstall?: () => void;
  onRefresh?: () => void;
}

/**
 * Panel shown when Contextor or BMAD is not installed in the workspace.
 */
export const NotInstalledPanel: React.FC<NotInstalledPanelProps> = ({
  type,
  onInstall,
  onRefresh,
}) => {
  const isContextor = type === "contextor";
  const title = isContextor ? "Contextor Not Installed" : "BMAD Not Installed";
  const description = isContextor
    ? "This project hasn't been registered with Contextor yet. Register your project to start tracking prompts and analytics."
    : "BMAD is not installed in this workspace. Install BMAD to enable workflow management and sprint tracking.";
  const buttonText = isContextor ? "Register Project" : "Install BMAD";
  const icon = isContextor ? (
    // Clipboard/register icon
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ) : (
    // Workflow/cog icon
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

  return (
    <div className="not-installed-panel">
      <div className="not-installed-icon">{icon}</div>
      <h3 className="not-installed-title">{title}</h3>
      <p className="not-installed-description">{description}</p>
      <div className="not-installed-actions">
        {onInstall && (
          <button className="primary-button" onClick={onInstall}>
            {buttonText}
          </button>
        )}
        {onRefresh && (
          <button className="secondary-button" onClick={onRefresh}>
            Refresh Status
          </button>
        )}
      </div>
      {isContextor && (
        <div className="not-installed-hint">
          <p>
            Run <code>npx @contextor/cli init</code> in your terminal to register this project.
          </p>
        </div>
      )}
      {!isContextor && (
        <div className="not-installed-hint">
          <p>
            BMAD helps you manage epics, stories, and sprint workflows with AI-powered agents.
          </p>
        </div>
      )}
    </div>
  );
};
