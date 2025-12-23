# Story D-4: VS Code Extension UI Design

Status: Ready

## Story

**As a** developer using VS Code,
**I want** a well-designed extension interface that integrates naturally with my IDE,
**So that** I can view Contextor analytics and coaching without leaving my coding environment.

## Acceptance Criteria

1. **Given** the VS Code extension sidebar
   **When** the design is complete
   **Then** mockups exist for all sidebar panel states (loading, empty, populated, error)
   **And** the design follows VS Code's visual language
   **And** both dark and light theme variants are designed

2. **Given** the analytics panel
   **When** designed
   **Then** it shows current session metrics in a scannable format
   **And** recent prompts with scores are visible
   **And** trend indicators show improvement over time
   **And** the design works in the constrained sidebar width (~300px)

3. **Given** the coaching suggestions panel
   **When** designed
   **Then** real-time suggestions appear with clear visual hierarchy
   **And** users can dismiss or apply suggestions
   **And** the panel doesn't distract from coding when minimized

4. **Given** the settings panel
   **When** designed
   **Then** authentication status is clearly shown
   **And** coaching preferences are easy to configure
   **And** connection status to Contextor cloud is visible

5. **Given** all panel designs
   **When** implemented as React components
   **Then** they render correctly in VS Code webview
   **And** they use VS Code CSS variables for theming
   **And** they are performant (< 100KB bundle, < 100ms render)

## Tasks / Subtasks

- [ ] **Task 1: Research VS Code Extension UX Patterns** (AC: #1)
  - [ ] Review VS Code's extension design guidelines
  - [ ] Analyze successful extensions (GitLens, GitHub Copilot, Error Lens)
  - [ ] Document sidebar panel constraints and patterns
  - [ ] Note VS Code's built-in iconography and styling

- [ ] **Task 2: Design Sidebar Container** (AC: #1, #5)
  - [ ] Design header with Contextor logo and status indicator
  - [ ] Design tab navigation for switching panels
  - [ ] Design footer with settings shortcut and help link
  - [ ] Create dark and light theme variants
  - [ ] Implement as `packages/vscode-extension/webviews/sidebar/layout.tsx`

- [ ] **Task 3: Design Analytics Panel** (AC: #2)
  - [ ] Design session health score display (gauge or number)
  - [ ] Design recent prompts list with scores (compact card layout)
  - [ ] Design trend mini-chart (sparkline)
  - [ ] Design "time since last prompt" indicator
  - [ ] Design empty state ("Start coding to see analytics")
  - [ ] Design loading state (skeleton)
  - [ ] Implement as `packages/vscode-extension/webviews/sidebar/analytics-panel.tsx`

- [ ] **Task 4: Design Coaching Panel** (AC: #3)
  - [ ] Design suggestion card (icon, message, action buttons)
  - [ ] Design suggestion queue (multiple pending suggestions)
  - [ ] Design minimized state (badge count only)
  - [ ] Design expanded state (full suggestion detail)
  - [ ] Design "no suggestions" state
  - [ ] Design suggestion history/dismissed list
  - [ ] Implement as `packages/vscode-extension/webviews/sidebar/coaching-panel.tsx`

- [ ] **Task 5: Design Settings Panel** (AC: #4)
  - [ ] Design authentication section (logged in/out states)
  - [ ] Design "Connect to Contextor" button and flow
  - [ ] Design coaching preferences toggles
  - [ ] Design sensitivity slider for suggestions
  - [ ] Design connection status indicator
  - [ ] Design "About" section with version info
  - [ ] Implement as `packages/vscode-extension/webviews/sidebar/settings-panel.tsx`

- [ ] **Task 6: Design Notification States** (AC: #3)
  - [ ] Design inline notification for new suggestion
  - [ ] Design status bar item (optional, for quick glance)
  - [ ] Design toast notification pattern for VS Code
  - [ ] Document when each notification type is appropriate

- [ ] **Task 7: Design Real-time Coaching Overlay (Future)** (AC: #3)
  - [ ] Design hover card for suggestion preview
  - [ ] Design inline decoration for prompt issues
  - [ ] Design quick-fix action pattern
  - [ ] Note: This may be for Epic 20, but design now

- [ ] **Task 8: Create VS Code Theme Variables Map** (AC: #5)
  - [ ] Map Contextor design tokens to VS Code variables
  - [ ] Create CSS file with variable mappings
  - [ ] Test in both dark and light VS Code themes
  - [ ] Document any custom colors needed

## Dev Notes

### VS Code Sidebar Constraints

| Constraint | Value |
|------------|-------|
| Minimum width | 250px |
| Typical width | 300px |
| Maximum width | 500px (user-resizable) |
| Scroll | Vertical only |
| Font | VS Code uses system font stack |

### VS Code CSS Variables

```css
/* Primary theming variables */
--vscode-editor-background
--vscode-editor-foreground
--vscode-sideBar-background
--vscode-sideBarTitle-foreground
--vscode-panel-border
--vscode-button-background
--vscode-button-foreground
--vscode-input-background
--vscode-input-foreground
--vscode-input-border
--vscode-focusBorder
--vscode-badge-background
--vscode-badge-foreground
```

### Panel Structure

```
┌─────────────────────────────────────┐
│ 🎯 Contextor          ● Connected  │ ← Header
├─────────────────────────────────────┤
│ [Analytics] [Coaching] [Settings]  │ ← Tabs
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Session Health: 7.8/10      │   │
│  │ ▃▅▇█▇▅▃ (trend)             │   │
│  └─────────────────────────────┘   │
│                                     │
│  Recent Prompts:                   │
│  ┌─────────────────────────────┐   │
│  │ "Fix the login..." • 8.2    │   │
│  │ 2 min ago                   │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ "Add validation..." • 6.5   │   │
│  │ 15 min ago                  │   │
│  └─────────────────────────────┘   │
│                                     │ ← Content area
├─────────────────────────────────────┤
│ ⚙️ Settings  •  📖 Docs            │ ← Footer
└─────────────────────────────────────┘
```

### Component File Structure

```
packages/vscode-extension/
├── webviews/
│   ├── sidebar/
│   │   ├── index.html            # Webview entry
│   │   ├── index.tsx             # React entry
│   │   ├── layout.tsx            # Container with header/tabs/footer
│   │   ├── analytics-panel.tsx   # Analytics view
│   │   ├── coaching-panel.tsx    # Suggestions view
│   │   ├── settings-panel.tsx    # Settings view
│   │   └── styles.css            # VS Code themed styles
│   └── components/               # Shared components (from D-3)
│       ├── score-badge.tsx
│       ├── prompt-card.tsx
│       ├── sparkline.tsx
│       └── ...
```

### Extension Points Used

| VS Code API | Purpose |
|-------------|---------|
| `window.registerWebviewViewProvider` | Sidebar panel |
| `window.createStatusBarItem` | Status bar indicator |
| `window.showInformationMessage` | Notifications |
| `workspace.onDidSaveTextDocument` | Trigger analysis |

### Design References

- [VS Code Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [VS Code Webview UI Toolkit](https://github.com/microsoft/vscode-webview-ui-toolkit)
- GitLens sidebar (excellent example)
- GitHub Copilot chat panel

## Recommended Tools & Agents

### Pixel Agent (Visual Asset Generator)

Use the **Pixel agent** (`/bmad:custom:agents:pixel`) for VS Code extension visual assets:

```
Pixel Commands:
- *generate          → Generate image with project style awareness
- *batch             → Generate cohesive icon/illustration sets
- *analyze-url       → Analyze VS Code marketplace examples for inspiration
```

**Use Pixel For:**
| Asset Type | Specs | Notes |
|------------|-------|-------|
| Extension icon | 128x128 PNG | Required for marketplace |
| Sidebar header logo | 24x24 or 32x32 | Fits VS Code sidebar |
| Empty state illustrations | ~200x150 | "No data yet" graphics |
| Status icons | 16x16 | Connection status, alerts |
| Onboarding graphics | Variable | First-run experience |

**Workflow:**
1. Run `*analyze-project` to capture Contextor's visual style
2. Generate extension icon: `*generate "Contextor logo icon, minimalist, dark background compatible, 128x128"`
3. Generate status icons as batch for consistency
4. `*accept` to deploy to `packages/vscode-extension/images/`

**Important:** VS Code extensions support both dark and light themes. Generate icon variants or use transparent backgrounds with good contrast in both modes.

### Frontend-Design Skill

Use `/frontend-design` for webview React components (sidebar panels, settings UI).

## Dependencies

- **Depends on:** Story D-1 (Design System), Story D-3 (Component Library)
- **Blocks:** Epic 19 implementation stories

## References

- Epic: Epic D: Phase 2 Design Foundation
- Epic 19: VS Code Extension
- Architecture: Phase 2 Architecture - VS Code Extension section

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by design agent after completion*

### Change Log

| Date | Change | Author |
|------|--------|--------|

### File List

*To be filled by design agent - list all files created/modified*
