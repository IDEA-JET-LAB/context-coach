import React from "react";

// All possible tab IDs
export type TabId = "analytics" | "lastPrompt" | "conversations" | "sessions" | "import" | "commands" | "status" | "documents" | "bmadSettings";

// Primary section IDs
export type PrimarySectionId = "contextor" | "bmad";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  sessionCount?: number;
  isImporting?: boolean;
  lastContextorTab?: TabId;
  lastBmadTab?: TabId;
}

// Icons
const AnalyticsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 20V10" />
    <path d="M12 20V4" />
    <path d="M6 20v-6" />
  </svg>
);

const SessionsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const ImportIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const LastPromptIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const CommandsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

const ConversationsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

const StatusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const DocumentsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

// Tabs organized by primary section
const contextorTabs: Tab[] = [
  { id: "analytics", label: "Analytics", icon: <AnalyticsIcon /> },
  { id: "lastPrompt", label: "Last Prompt", icon: <LastPromptIcon /> },
  { id: "conversations", label: "Conversations", icon: <ConversationsIcon /> },
  { id: "sessions", label: "Sessions", icon: <SessionsIcon /> },
  { id: "import", label: "Import", icon: <ImportIcon /> },
];

const bmadTabs: Tab[] = [
  { id: "commands", label: "Commands", icon: <CommandsIcon /> },
  { id: "status", label: "Status", icon: <StatusIcon /> },
  { id: "documents", label: "Documents", icon: <DocumentsIcon /> },
  { id: "bmadSettings", label: "Settings", icon: <SettingsIcon /> },
];

// Helper to determine which primary section a tab belongs to
const getSection = (tabId: TabId): PrimarySectionId => {
  if (bmadTabs.some(t => t.id === tabId)) return "bmad";
  return "contextor";
};

export const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onTabChange,
  sessionCount = 0,
  isImporting = false,
  lastContextorTab = "analytics",
  lastBmadTab = "commands",
}) => {
  const activeSection = getSection(activeTab);
  const secondaryTabs = activeSection === "bmad" ? bmadTabs : contextorTabs;

  const handlePrimaryClick = (section: PrimarySectionId) => {
    if (section === activeSection) return;
    // Switch to last used tab in the new section (or default to first)
    if (section === "bmad") {
      onTabChange(lastBmadTab);
    } else {
      onTabChange(lastContextorTab);
    }
  };

  return (
    <div className="tab-navigation-container">
      {/* Primary tabs (section selector) */}
      <div className="primary-tabs">
        <button
          className={`primary-tab ${activeSection === "contextor" ? "active" : ""}`}
          onClick={() => handlePrimaryClick("contextor")}
        >
          Contextor
        </button>
        <button
          className={`primary-tab ${activeSection === "bmad" ? "active" : ""}`}
          onClick={() => handlePrimaryClick("bmad")}
        >
          BMAD
        </button>
      </div>

      {/* Secondary tabs (page selector) */}
      <div className="tab-navigation">
        {secondaryTabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? "active" : ""} ${tab.id === "import" && isImporting ? "importing" : ""}`}
            onClick={() => onTabChange(tab.id)}
            aria-selected={activeTab === tab.id}
            title={tab.label}
          >
            <span className={tab.id === "import" && isImporting ? "icon-spin" : ""}>
              {tab.icon}
            </span>
            {tab.id === "sessions" && sessionCount > 0 && (
              <span className="tab-badge">{sessionCount}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
