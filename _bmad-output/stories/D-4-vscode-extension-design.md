# Story D-4: VS Code Extension UI Design

Status: Complete

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

- [x] **Task 1: Research VS Code Extension UX Patterns** (AC: #1)
  - [x] Review VS Code's extension design guidelines
  - [x] Analyze successful extensions (GitLens, GitHub Copilot, Error Lens)
  - [x] Document sidebar panel constraints and patterns
  - [x] Note VS Code's built-in iconography and styling

- [x] **Task 2: Design Sidebar Container** (AC: #1, #5)
  - [x] Design header with Contextor logo and status indicator
  - [x] Design tab navigation for switching panels
  - [x] Design footer with settings shortcut and help link
  - [x] Create dark and light theme variants
  - [x] Implement as `packages/vscode-extension/webviews/sidebar/layout.tsx`

- [x] **Task 3: Design Analytics Panel** (AC: #2)
  - [x] Design session health score display (gauge or number)
  - [x] Design recent prompts list with scores (compact card layout)
  - [x] Design trend mini-chart (sparkline)
  - [x] Design "time since last prompt" indicator
  - [x] Design empty state ("Start coding to see analytics")
  - [x] Design loading state (skeleton)
  - [x] Implement as `packages/vscode-extension/webviews/sidebar/analytics-panel.tsx`

- [x] **Task 4: Design Coaching Panel** (AC: #3)
  - [x] Design suggestion card (icon, message, action buttons)
  - [x] Design suggestion queue (multiple pending suggestions)
  - [x] Design minimized state (badge count only)
  - [x] Design expanded state (full suggestion detail)
  - [x] Design "no suggestions" state
  - [x] Design suggestion history/dismissed list
  - [x] Implement as `packages/vscode-extension/webviews/sidebar/coaching-panel.tsx`

- [x] **Task 5: Design Settings Panel** (AC: #4)
  - [x] Design authentication section (logged in/out states)
  - [x] Design "Connect to Contextor" button and flow
  - [x] Design coaching preferences toggles
  - [x] Design sensitivity slider for suggestions
  - [x] Design connection status indicator
  - [x] Design "About" section with version info
  - [x] Implement as `packages/vscode-extension/webviews/sidebar/settings-panel.tsx`

- [x] **Task 6: Design Notification States** (AC: #3)
  - [x] Design inline notification for new suggestion
  - [x] Design status bar item (optional, for quick glance)
  - [x] Design toast notification pattern for VS Code
  - [x] Document when each notification type is appropriate

- [x] **Task 7: Design Real-time Coaching Overlay (Future)** (AC: #3)
  - [x] Design hover card for suggestion preview
  - [x] Design inline decoration for prompt issues
  - [x] Design quick-fix action pattern
  - [x] Note: This may be for Epic 20, but design now

- [x] **Task 8: Create VS Code Theme Variables Map** (AC: #5)
  - [x] Map Contextor design tokens to VS Code variables
  - [x] Create CSS file with variable mappings
  - [x] Test in both dark and light VS Code themes
  - [x] Document any custom colors needed

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

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **VS Code UX Research (Task 1)**: Reviewed VS Code extension guidelines. Key findings:
   - Extensions should use Views (Tree Views, Welcome Views, Webview Views) for sidebar content
   - Primary and Secondary sidebars available for View placement
   - Must use VS Code's native interface patterns for seamless integration
   - Toolbars available at View and View Container level for actions

2. **Design Approach**: Adopted "Utilitarian Precision" aesthetic - native VS Code feel with subtle refinements:
   - Uses VS Code CSS variables for automatic theme switching (dark/light)
   - Monospace font for scores/metrics (feels code-appropriate)
   - Growth-oriented color palette (blue for improvement, NOT red for low scores)
   - Compact, scannable layouts optimized for sidebar width (250-500px)
   - 8px spacing grid for consistency

3. **Component Architecture**: Built pure React components with inline styles/CSS:
   - No external dependencies (Tailwind, chart libraries) for bundle size
   - Custom SVG-based Sparkline and Gauge components
   - All components support loading, empty, populated, and error states
   - Comprehensive icon set using inline SVG

4. **Theme Variable Mapping**: Created comprehensive CSS variable mapping in `styles.css`:
   - Maps 30+ VS Code variables to Contextor design tokens
   - Includes surface layers, interactive elements, inputs, focus states
   - Custom score colors (high/medium/growth) with transparency variants
   - Animation keyframes for subtle micro-interactions

5. **Notification System**: Designed multi-level notification approach:
   - Status bar item for quick session health glance
   - Inline notifications for new suggestions within sidebar
   - VS Code toast patterns documented for extension-level alerts
   - Rate limiting guidance (max 1 notification per 5 minutes)

6. **Future-Ready Overlay Components (Task 7)**: Designed for Epic 20:
   - HoverCard for suggestion preview on hover
   - InlineDecoration for underline/highlight/gutter marks
   - QuickFixMenu for code action suggestions
   - ProgressIndicator for real-time analysis feedback

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2024-12-23 | Initial implementation of all VS Code extension webview components | Claude Opus 4.5 |

### File List

**Created Files:**

| File | Purpose |
|------|---------|
| `packages/vscode-extension/webviews/sidebar/styles.css` | VS Code theme variable mappings and base styles |
| `packages/vscode-extension/webviews/sidebar/layout.tsx` | Main sidebar container with header, tabs, footer |
| `packages/vscode-extension/webviews/sidebar/analytics-panel.tsx` | Analytics view with gauge, prompts list, sparkline |
| `packages/vscode-extension/webviews/sidebar/coaching-panel.tsx` | Coaching suggestions with minimized/expanded states |
| `packages/vscode-extension/webviews/sidebar/settings-panel.tsx` | Settings with auth, preferences, connection status |
| `packages/vscode-extension/webviews/sidebar/notifications.tsx` | Notification components and patterns documentation |
| `packages/vscode-extension/webviews/sidebar/coaching-overlay.tsx` | Future overlay components for Epic 20 |
| `packages/vscode-extension/webviews/sidebar/index.tsx` | React entry point with VS Code API integration |
| `packages/vscode-extension/webviews/sidebar/index.html` | Webview HTML template |
| `packages/vscode-extension/webviews/sidebar/demo.tsx` | Demo component for development/testing |
| `packages/vscode-extension/webviews/components/status-indicator.tsx` | Connection status dot (green/yellow/red) |
| `packages/vscode-extension/webviews/components/score-badge.tsx` | Score display with color coding |
| `packages/vscode-extension/webviews/components/sparkline.tsx` | Mini trend chart (pure SVG) |
| `packages/vscode-extension/webviews/components/prompt-card.tsx` | Compact prompt card for lists |
| `packages/vscode-extension/webviews/components/suggestion-card.tsx` | Coaching suggestion card |
| `packages/vscode-extension/webviews/components/gauge.tsx` | Semi-circle gauge for scores |
| `packages/vscode-extension/webviews/components/icons.tsx` | SVG icon components |
| `packages/vscode-extension/webviews/components/index.ts` | Component exports |
| `packages/vscode-extension/webviews/index.ts` | Main package exports |

**Directory Structure Created:**
```
packages/vscode-extension/
└── webviews/
    ├── index.ts
    ├── sidebar/
    │   ├── analytics-panel.tsx
    │   ├── coaching-overlay.tsx
    │   ├── coaching-panel.tsx
    │   ├── demo.tsx
    │   ├── index.html
    │   ├── index.tsx
    │   ├── layout.tsx
    │   ├── notifications.tsx
    │   ├── settings-panel.tsx
    │   └── styles.css
    └── components/
        ├── gauge.tsx
        ├── icons.tsx
        ├── index.ts
        ├── prompt-card.tsx
        ├── score-badge.tsx
        ├── sparkline.tsx
        ├── status-indicator.tsx
        └── suggestion-card.tsx
```
