# Story 23-7: BMAD Documents Panel

Status: Completed

## Story

**As a** VS Code extension user,
**I want** to browse and open BMAD documents from the extension,
**So that** I can quickly access project documentation without navigating the file explorer.

## Acceptance Criteria

1. **Given** I navigate to BMAD > Documents tab
   **When** the panel loads
   **Then** I see a tree view of BMAD-related documents

2. **Given** the document tree shows folders
   **When** I click a folder
   **Then** it expands/collapses to show/hide children

3. **Given** the document tree shows files
   **When** I click a file
   **Then** the file opens in the VS Code editor

4. **Given** the workspace has BMAD documents
   **When** the tree loads
   **Then** I see: root docs (prd.md, architecture.md), _bmad-output folder, _bmad folder

5. **Given** I click the refresh button
   **When** the tree reloads
   **Then** I see any newly added documents

## Dependencies

- **Story 23-4**: Workspace Installation Detection
- **Story 23-1**: Two-Level Navigation

## Technical Notes

- Scan workspace for: prd.md, architecture.md, ux-design-specification.md at root
- Scan _bmad-output/ and _bmad/ folders recursively
- Include file types: .md, .yaml, .yml, .json, .txt
- Max depth: 4 levels to prevent excessive scanning
- Sort: folders first, then files alphabetically

## Implementation

**Files Created/Modified:**
- `src/providers/analyticsPanel.ts` - Added `handleFetchDocuments()`, `scanFolder()`, `handleOpenDocument()`
- `src/types/messages.ts` - Added `DocumentItem` interface and message types
- `webviews/analytics/src/components/DocumentsPanel.tsx` - New component with TreeItem
- `webviews/analytics/src/App.tsx` - Documents state and handlers
- `webviews/analytics/src/styles/index.css` - DocumentsPanel styles

**Key Implementation Details:**
```typescript
interface DocumentItem {
  id: string;
  name: string;
  path: string;
  type: "file" | "folder";
  children?: DocumentItem[];
}

// TreeItem component with expand/collapse
const TreeItem: React.FC<{
  item: DocumentItem;
  depth: number;
  expandedFolders: Set<string>;
  onToggleFolder: (id: string) => void;
  onOpenDocument: (path: string) => void;
}> = ({ ... }) => {
  // Render with indentation, icons, click handlers
}
```

- `scanFolder()` recursively scans with depth limit
- Default expanded: _bmad-output, stories folders
- File icons differ from folder icons
- Chevron indicates folder expand state

## Tasks / Subtasks

- [x] **Task 1: Add DocumentItem type**
  - [x] Define interface in messages.ts
  - [x] Add documents and documents-loading message types
  - [x] Add fetch-documents and open-document webview messages

- [x] **Task 2: Implement document scanning**
  - [x] Create handleFetchDocuments() method
  - [x] Scan for root-level docs (prd.md, etc.)
  - [x] Create scanFolder() recursive method
  - [x] Filter by file extensions
  - [x] Sort folders before files

- [x] **Task 3: Create DocumentsPanel component**
  - [x] Create TreeItem sub-component
  - [x] Implement expand/collapse state
  - [x] Add file/folder icons
  - [x] Handle click events for files and folders
  - [x] Add indentation based on depth

- [x] **Task 4: Handle document opening**
  - [x] Add handleOpenDocument() method
  - [x] Use vscode.window.showTextDocument()
  - [x] Handle errors gracefully

- [x] **Task 5: Add styling**
  - [x] Tree item hover states
  - [x] Indentation styling
  - [x] Icon coloring
  - [x] Loading state

## Dev Estimate

4 hours (Completed)
