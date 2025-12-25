import React, { useState, useCallback, useMemo } from "react";

// Document tree item type
interface DocumentItem {
  id: string;
  name: string;
  path: string;
  type: "file" | "folder";
  children?: DocumentItem[];
  icon?: string;
}

// Project document definition for BMAD core docs
interface ProjectDocument {
  id: string;
  name: string;
  filename: string;
  description: string;
  workflow: string | null; // Skill command to create, null if no dedicated workflow
  agent: string | null; // Agent to use if no workflow
  required: boolean;
}

type DocumentsTab = "all" | "workflow" | "project";

interface DocumentsPanelProps {
  documents: DocumentItem[];
  isLoading: boolean;
  onOpenDocument: (path: string) => void;
  onRefresh: () => void;
  onCreateDocument?: (doc: ProjectDocument) => void;
}

// Core BMAD project documents with their creation workflows
const PROJECT_DOCUMENTS: ProjectDocument[] = [
  {
    id: "product-brief",
    name: "Product Brief",
    filename: "product-brief.md",
    description: "Vision, users, metrics, and scope definition",
    workflow: "/bmad:bmm:workflows:1-analysis:create-product-brief",
    agent: "pm",
    required: true,
  },
  {
    id: "research",
    name: "Research",
    filename: "research.md",
    description: "Market, domain, and technical research",
    workflow: "/bmad:bmm:workflows:1-analysis:research",
    agent: "analyst",
    required: false,
  },
  {
    id: "prd",
    name: "Product Requirements",
    filename: "prd.md",
    description: "Detailed functional and non-functional requirements",
    workflow: "/bmad:bmm:workflows:2-plan-workflows:prd",
    agent: "pm",
    required: true,
  },
  {
    id: "ux-design",
    name: "UX Design Specification",
    filename: "ux-design-specification.md",
    description: "User experience, design system, and UI patterns",
    workflow: "/bmad:bmm:workflows:2-plan-workflows:create-ux-design",
    agent: "ux-designer",
    required: false,
  },
  {
    id: "architecture",
    name: "Architecture",
    filename: "architecture.md",
    description: "Technical architecture, patterns, and decisions",
    workflow: "/bmad:bmm:workflows:3-solutioning:create-architecture",
    agent: "architect",
    required: true,
  },
  {
    id: "epics",
    name: "Epics & Stories",
    filename: "epics.md",
    description: "Epic breakdown with user stories",
    workflow: "/bmad:bmm:workflows:3-solutioning:create-epics-and-stories",
    agent: "pm",
    required: true,
  },
  {
    id: "project-context",
    name: "Project Context",
    filename: "project-context.md",
    description: "Background context for AI agents",
    workflow: null,
    agent: "analyst",
    required: false,
  },
];

// Icon components
const FolderIcon: React.FC<{ isOpen?: boolean }> = ({ isOpen }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    {isOpen ? (
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    ) : (
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    )}
  </svg>
);

const FileIcon: React.FC<{ type?: string }> = ({ type }) => {
  // Markdown file icon
  if (type === "md") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M9 15L12 12L15 15" />
        <line x1="12" y1="12" x2="12" y2="18" />
      </svg>
    );
  }
  // YAML file icon
  if (type === "yaml" || type === "yml") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="13" y2="17" />
      </svg>
    );
  }
  // Default file icon
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
};

const ChevronIcon: React.FC<{ isExpanded: boolean }> = ({ isExpanded }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{
      transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
      transition: "transform 150ms ease",
    }}
  >
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const PlusIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const CheckIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// Tree item component for All/Workflow tabs
const TreeItem: React.FC<{
  item: DocumentItem;
  depth: number;
  expandedFolders: Set<string>;
  onToggleFolder: (id: string) => void;
  onOpenDocument: (path: string) => void;
}> = ({ item, depth, expandedFolders, onToggleFolder, onOpenDocument }) => {
  const isExpanded = expandedFolders.has(item.id);
  const isFolder = item.type === "folder";
  const fileExt = item.name.split(".").pop()?.toLowerCase();

  const handleClick = () => {
    if (isFolder) {
      onToggleFolder(item.id);
    } else {
      onOpenDocument(item.path);
    }
  };

  return (
    <>
      <div
        className="tree-item"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        {isFolder && (
          <span className="tree-item-chevron">
            <ChevronIcon isExpanded={isExpanded} />
          </span>
        )}
        <span className="tree-item-icon">
          {isFolder ? (
            <FolderIcon isOpen={isExpanded} />
          ) : (
            <FileIcon type={fileExt} />
          )}
        </span>
        <span className="tree-item-name">{item.name}</span>
      </div>
      {isFolder && isExpanded && item.children && (
        <div className="tree-children">
          {item.children.map((child) => (
            <TreeItem
              key={child.id}
              item={child}
              depth={depth + 1}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              onOpenDocument={onOpenDocument}
            />
          ))}
        </div>
      )}
    </>
  );
};

// Project document item for Project tab
const ProjectDocItem: React.FC<{
  doc: ProjectDocument;
  exists: boolean;
  onOpen: () => void;
  onCreate: () => void;
}> = ({ doc, exists, onOpen, onCreate }) => {
  return (
    <div
      className={`project-doc-item ${exists ? "" : "missing"}`}
      onClick={exists ? onOpen : onCreate}
      title={exists ? `Open ${doc.filename}` : `Create ${doc.name}`}
    >
      <div className="project-doc-status">
        {exists ? (
          <span className="status-check"><CheckIcon /></span>
        ) : (
          <span className="status-plus"><PlusIcon /></span>
        )}
      </div>
      <div className="project-doc-info">
        <div className="project-doc-name">
          {doc.name}
          {doc.required && <span className="required-badge">Required</span>}
        </div>
        <div className="project-doc-desc">{doc.description}</div>
        <div className="project-doc-file">{doc.filename}</div>
      </div>
      {!exists && (
        <div className="project-doc-action">
          <span className="create-hint">Click to create</span>
        </div>
      )}
    </div>
  );
};

/**
 * BMAD Documents Panel - displays a file tree of workflow documents
 * with sub-tabs: All / Workflow / Project
 */
export const DocumentsPanel: React.FC<DocumentsPanelProps> = ({
  documents,
  isLoading,
  onOpenDocument,
  onRefresh,
  onCreateDocument,
}) => {
  const [activeTab, setActiveTab] = useState<DocumentsTab>("project");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(["_bmad-output", "stories"]) // Default expanded folders
  );

  const handleToggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  // Filter documents for workflow tab (only _bmad folder content)
  const workflowDocuments = useMemo(() => {
    return documents.filter(
      (doc) => doc.id === "_bmad" || doc.name === "_bmad"
    );
  }, [documents]);

  // Check which project documents exist
  const existingProjectDocs = useMemo(() => {
    const existing = new Set<string>();

    // Flatten all documents to check filenames
    const checkDocs = (items: DocumentItem[]) => {
      for (const item of items) {
        if (item.type === "file") {
          // Check if this file matches any project document
          const filename = item.name.toLowerCase();
          for (const projDoc of PROJECT_DOCUMENTS) {
            if (filename === projDoc.filename.toLowerCase()) {
              existing.add(projDoc.id);
            }
          }
        }
        if (item.children) {
          checkDocs(item.children);
        }
      }
    };

    checkDocs(documents);
    return existing;
  }, [documents]);

  // Find the path of an existing project document
  const findDocPath = useCallback((filename: string): string | null => {
    const findInItems = (items: DocumentItem[]): string | null => {
      for (const item of items) {
        if (item.type === "file" && item.name.toLowerCase() === filename.toLowerCase()) {
          return item.path;
        }
        if (item.children) {
          const found = findInItems(item.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findInItems(documents);
  }, [documents]);

  const handleCreateDocument = useCallback((doc: ProjectDocument) => {
    if (onCreateDocument) {
      onCreateDocument(doc);
    }
  }, [onCreateDocument]);

  if (isLoading) {
    return (
      <div className="documents-panel">
        <div className="documents-loading">
          <div className="spinner" />
          <p>Loading documents...</p>
        </div>
      </div>
    );
  }

  // Tab content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case "project":
        return (
          <div className="project-docs-list">
            {PROJECT_DOCUMENTS.map((doc) => {
              const exists = existingProjectDocs.has(doc.id);
              const path = exists ? findDocPath(doc.filename) : null;
              return (
                <ProjectDocItem
                  key={doc.id}
                  doc={doc}
                  exists={exists}
                  onOpen={() => path && onOpenDocument(path)}
                  onCreate={() => handleCreateDocument(doc)}
                />
              );
            })}
          </div>
        );

      case "workflow":
        if (workflowDocuments.length === 0) {
          return (
            <div className="documents-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <p>No workflow documents found</p>
              <span>BMAD workflows are in the _bmad folder</span>
            </div>
          );
        }
        return (
          <div className="documents-tree">
            {workflowDocuments.map((item) => (
              <TreeItem
                key={item.id}
                item={item}
                depth={0}
                expandedFolders={expandedFolders}
                onToggleFolder={handleToggleFolder}
                onOpenDocument={onOpenDocument}
              />
            ))}
          </div>
        );

      case "all":
      default:
        if (documents.length === 0) {
          return (
            <div className="documents-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <p>No BMAD documents found</p>
              <span>Run BMAD workflow to generate project documents</span>
              <button className="secondary-button" onClick={onRefresh}>
                Refresh
              </button>
            </div>
          );
        }
        return (
          <div className="documents-tree">
            {documents.map((item) => (
              <TreeItem
                key={item.id}
                item={item}
                depth={0}
                expandedFolders={expandedFolders}
                onToggleFolder={handleToggleFolder}
                onOpenDocument={onOpenDocument}
              />
            ))}
          </div>
        );
    }
  };

  return (
    <div className="documents-panel">
      <div className="documents-header">
        <h3>BMAD Project Documents</h3>
        <button className="icon-button" onClick={onRefresh} title="Refresh documents">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>

      {/* Sub-tabs: All | Project | Workflow */}
      <div className="documents-tabs">
        <button
          className={`doc-tab ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          All
        </button>
        <button
          className={`doc-tab ${activeTab === "project" ? "active" : ""}`}
          onClick={() => setActiveTab("project")}
        >
          Project
        </button>
        <button
          className={`doc-tab ${activeTab === "workflow" ? "active" : ""}`}
          onClick={() => setActiveTab("workflow")}
        >
          Workflow
        </button>
      </div>

      {renderTabContent()}
    </div>
  );
};

// Export types
export type { DocumentItem, DocumentsPanelProps, ProjectDocument };
