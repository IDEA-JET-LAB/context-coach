# Story 23-8: Smart Project Documents Panel

Status: Completed

## Story

**As a** VS Code extension user,
**I want** to see both existing and missing BMAD project documents with quick creation,
**So that** I can easily understand what documents my project has and create missing ones with one click.

## Acceptance Criteria

1. **Given** I navigate to BMAD > Documents tab
   **When** I see the panel
   **Then** I see three sub-tabs: All, Workflow, Project

2. **Given** I click on the "Project" sub-tab
   **When** the view loads
   **Then** I see a list of core BMAD documents with their status

3. **Given** a document exists (e.g., prd.md)
   **When** I view it in the Project tab
   **Then** I see a checkmark icon and can click to open it

4. **Given** a document is missing (e.g., product-brief.md)
   **When** I view it in the Project tab
   **Then** I see it with dashed border and "Click to create" hint

5. **Given** I click on a missing document
   **When** the click is registered
   **Then** a terminal opens running Claude with the appropriate BMAD workflow

6. **Given** the document has a dedicated workflow
   **When** I click to create it
   **Then** the terminal runs the workflow skill command (e.g., /bmad:bmm:workflows:prd)

7. **Given** the document has no dedicated workflow but has an agent
   **When** I click to create it
   **Then** the terminal starts Claude with the agent and a prompt about creating the document

## Dependencies

- **Story 23-7**: BMAD Documents Panel

## Technical Notes

- Core project documents defined in `PROJECT_DOCUMENTS` constant
- Each document has: id, name, filename, description, workflow, agent, required flag
- Existence detection via recursive filename matching
- Terminal automation uses `claude` CLI with skill commands

## Implementation

**Files Modified:**
- `webviews/analytics/src/components/DocumentsPanel.tsx` - Added sub-tabs, ProjectDocItem, PROJECT_DOCUMENTS
- `webviews/analytics/src/styles/index.css` - Added styles for .documents-tabs, .project-doc-item, etc.
- `webviews/analytics/src/App.tsx` - Added handleCreateDocument, imported ProjectDocument type
- `src/providers/analyticsPanel.ts` - Added handleCreateDocument method
- `src/types/messages.ts` - Added ProjectDocumentInfo interface and create-document message

**Core Project Documents:**
| Document | Filename | Workflow | Agent | Required |
|----------|----------|----------|-------|----------|
| Product Brief | product-brief.md | create-product-brief | pm | Yes |
| Research | research.md | research | analyst | No |
| Product Requirements | prd.md | prd | pm | Yes |
| UX Design Specification | ux-design-specification.md | create-ux-design | ux-designer | No |
| Architecture | architecture.md | create-architecture | architect | Yes |
| Epics & Stories | epics.md | create-epics-and-stories | pm | Yes |
| Project Context | project-context.md | - | analyst | No |

**Terminal Command Building:**
```typescript
if (doc.workflow) {
  command = `claude "${doc.workflow}"`;
} else if (doc.agent) {
  const agentSkill = `/bmad:bmm:agents:${doc.agent}`;
  command = `claude "${agentSkill}" --prompt "..."`;
} else {
  command = `claude --prompt "..."`;
}
```

## Tasks / Subtasks

- [x] **Task 1: Add sub-tab navigation**
  - [x] Create DocumentsTab type ("all" | "workflow" | "project")
  - [x] Add activeTab state
  - [x] Create tab buttons with styles
  - [x] Implement tab switching

- [x] **Task 2: Define PROJECT_DOCUMENTS constant**
  - [x] Create ProjectDocument interface
  - [x] Define 7 core documents with metadata
  - [x] Map workflows and agents to each

- [x] **Task 3: Create ProjectDocItem component**
  - [x] Show checkmark for existing, plus for missing
  - [x] Display name, description, filename
  - [x] Add "Required" badge where applicable
  - [x] Style existing vs missing states

- [x] **Task 4: Implement existence detection**
  - [x] Create existingProjectDocs useMemo
  - [x] Recursively scan documents for matching filenames
  - [x] Create findDocPath helper

- [x] **Task 5: Add message handling**
  - [x] Add ProjectDocumentInfo interface to messages.ts
  - [x] Add create-document message type
  - [x] Add handleCreateDocument in App.tsx
  - [x] Pass onCreateDocument to DocumentsPanel

- [x] **Task 6: Implement terminal automation**
  - [x] Add handleCreateDocument in analyticsPanel.ts
  - [x] Build command based on workflow/agent availability
  - [x] Create terminal and send command
  - [x] Show info message to user

- [x] **Task 7: Add CSS styles**
  - [x] Style .documents-tabs container
  - [x] Style .doc-tab buttons
  - [x] Style .project-docs-list
  - [x] Style .project-doc-item (existing and missing states)

## Dev Estimate

4 hours (Completed)
