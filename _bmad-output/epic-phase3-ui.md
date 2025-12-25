# Epic: Phase 3 UI Implementation

**Epic ID:** UI-P3
**Status:** In Progress
**Date:** 2025-12-25
**Priority:** P0

---

## Table of Contents

- [Overview](#overview) (Line 18)
- [Screen Inventory](#screen-inventory) (Line 35)
- [Web App Screens](#web-app-screens) (Line 55)
  - [Conversations List Page](#conversations-list-page) (Line 60)
  - [Conversation Thread Page](#conversation-thread-page) (Line 130)
  - [Project Mapping UI](#project-mapping-ui) (Line 200)
  - [Team Conversations Dashboard](#team-conversations-dashboard) (Line 260)
- [VS Code Extension Views](#vs-code-extension-views) (Line 320)
  - [Conversations Tab](#conversations-tab) (Line 325)
  - [Conversation Thread View](#conversation-thread-view) (Line 380)
  - [Loop Alert Notifications](#loop-alert-notifications) (Line 430)
- [Shared Components](#shared-components) (Line 480)
- [Design System Requirements](#design-system-requirements) (Line 680)
- [Implementation Checklist](#implementation-checklist) (Line 750)

---

## Overview

This epic covers ALL user interface screens and components needed to implement Phase 3: Conversation Intelligence Platform. The implementation follows the established design system and uses existing components wherever possible.

### Goals

1. Create conversation-centric navigation (vs. prompt-centric)
2. Display conversations with chat-like thread views
3. Show prompt classification, debugging loops, and project stages
4. Enable project path mapping during import
5. Provide team-level conversation analytics

### Design Principles

- **Composition over creation** — Extend existing components
- **Semantic tokens only** — No hardcoded colors
- **Responsive design** — Works on all screen sizes
- **Accessibility first** — ARIA labels, keyboard navigation

---

## Screen Inventory

### Web App (Next.js)

| Screen | Route | Priority | Status |
|--------|-------|----------|--------|
| Conversations List | `/conversations` | P0 | Pending |
| Conversation Thread | `/conversations/[sessionId]` | P0 | Pending |
| Project Mapping Modal | (modal in import flow) | P1 | Pending |
| Team Conversations | `/team/conversations` | P2 | Pending |
| Enhanced Analytics | `/analytics` (extend) | P1 | Pending |

### VS Code Extension

| View | Location | Priority | Status |
|------|----------|----------|--------|
| Conversations Tab | Analytics Panel Tab | P0 | Pending |
| Conversation Thread | Within Conversations Tab | P0 | Pending |
| Loop Alert | Notification + Badge | P0 | Pending |
| Project Mapping | Import Panel Overlay | P1 | Pending |

---

## Web App Screens

### Conversations List Page

**Route:** `/conversations`
**File:** `app/(dashboard)/conversations/page.tsx`

#### Description

Primary landing page for browsing conversations (sessions). Displays a list of conversations grouped by project with filtering and sorting capabilities.

#### Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│ Sidebar │ Header                                                    │
├─────────┼───────────────────────────────────────────────────────────┤
│         │ Conversations                              [Time Range ▾] │
│ [icons] │                                                           │
│         │ ┌─────────────────────────────────────────────────────┐   │
│         │ │ Filters: [Project ▾] [Stage ▾] [Has Loop ▾] [Search]│   │
│         │ └─────────────────────────────────────────────────────┘   │
│         │                                                           │
│         │ ┌─────────────────────────────────────────────────────┐   │
│         │ │ Project: context-coach                              │   │
│         │ │ ┌───────────────────────────────────────────────┐   │   │
│         │ │ │ inherited-seeking-thimble        Dec 25, 2025 │   │   │
│         │ │ │ 45 messages · 2h 30m · [Development] [Score:72]│   │   │
│         │ │ └───────────────────────────────────────────────┘   │   │
│         │ │ ┌───────────────────────────────────────────────┐   │   │
│         │ │ │ curious-dancing-penguin          Dec 24, 2025 │   │   │
│         │ │ │ 23 messages · 45m · [Debugging] [Loop!] [65]  │   │   │
│         │ │ └───────────────────────────────────────────────┘   │   │
│         │ └─────────────────────────────────────────────────────┘   │
│         │                                                           │
│         │ ┌─────────────────────────────────────────────────────┐   │
│         │ │ Project: my-other-project                           │   │
│         │ │ ┌───────────────────────────────────────────────┐   │   │
│         │ │ │ ...                                           │   │   │
│         │ │ └───────────────────────────────────────────────┘   │   │
│         │ └─────────────────────────────────────────────────────┘   │
└─────────┴───────────────────────────────────────────────────────────┘
```

#### Components Used

| Component | Source | Purpose |
|-----------|--------|---------|
| `Card`, `CardHeader`, `CardContent` | `ui/card` | Project grouping |
| `Select` | `ui/select` | Filter dropdowns |
| `Input` | `ui/input` | Search |
| `Badge` | `ui/badge` | Stage, loop indicators |
| `TimeRangeSelector` | `analytics/` | Date filtering |
| **New:** `ConversationCard` | Create | Session card |
| **New:** `StageBadge` | Create | Stage indicator |
| **New:** `LoopIndicator` | Create | Debugging loop badge |

#### Data Requirements

```typescript
interface ConversationsPageData {
  conversations: Array<{
    id: string;
    sessionId: string;
    slug: string;
    projectId: string | null;
    projectName: string | null;
    startedAt: string;
    endedAt: string | null;
    userMessageCount: number;
    primaryStage: ProjectStage | null;
    hasDebuggingLoop: boolean;
    conversationScore: number | null;
    duration: number; // minutes
  }>;
  projects: Array<{ id: string; name: string }>;
}
```

---

### Conversation Thread Page

**Route:** `/conversations/[sessionId]`
**File:** `app/(dashboard)/conversations/[sessionId]/page.tsx`

#### Description

Displays a single conversation as a chat-like thread with expandable message details, metadata, and conversation-level insights.

#### Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│ Sidebar │ ← Back to Conversations                                   │
├─────────┼───────────────────────────────────────────────────────────┤
│         │ ┌─────────────────────────────────────────────────────┐   │
│         │ │ PROJECT: context-coach · BRANCH: main               │   │
│         │ │ inherited-seeking-thimble                           │   │
│         │ │ Dec 25, 2025 · 2h 30m · 45 messages                 │   │
│         │ │ [Development] [Score: 72/100]                       │   │
│         │ └─────────────────────────────────────────────────────┘   │
│         │                                                           │
│         │ ┌─────────────────────────────────────────────────────┐   │
│         │ │ 10:30 AM                                            │   │
│         │ │ ┌───────────────────────────────────┐               │   │
│         │ │ │ Help me implement user            │ [Initiating]  │   │
│         │ │ │ authentication with Google OAuth. │ Score: 78     │   │
│         │ │ │ The app uses Next.js 14...        │               │   │
│         │ │ │                                   │ [▾ Details]   │   │
│         │ │ └───────────────────────────────────┘               │   │
│         │ │                                                     │   │
│         │ │         ┌───────────────────────────────────────┐   │   │
│         │ │         │ I'll help you implement Google OAuth  │   │   │
│         │ │         │ Let me start by examining...          │   │   │
│         │ │         │                                       │   │   │
│         │ │         │ [Read] [Edit] [Bash] (3 tools)        │   │   │
│         │ │         └───────────────────────────────────────┘   │   │
│         │ │                                                     │   │
│         │ │ ┌───────────────────────────────────┐               │   │
│         │ │ │ Yes, proceed with that approach   │ [Confirmation]│   │
│         │ │ │                                   │ (not scored)  │   │
│         │ │ └───────────────────────────────────┘               │   │
│         │ └─────────────────────────────────────────────────────┘   │
│         │                                                           │
│         │ [Jump to Top] [Jump to Bottom]                            │
└─────────┴───────────────────────────────────────────────────────────┘
```

#### Expanded Message Detail

```
┌───────────────────────────────────────────────────────────────┐
│ Help me implement user authentication with Google OAuth...   │
│                                                               │
│ ─── Details ──────────────────────────────────────────────── │
│                                                               │
│ Classification: Initiating         Score: 78/100             │
│ Stage: Development                                            │
│                                                               │
│ Dimensions:                                                   │
│ ├─ Clarity:       8.2  ████████░░                            │
│ ├─ Context:       7.5  ███████░░░                            │
│ ├─ Specificity:   7.0  ███████░░░                            │
│ ├─ Actionability: 8.0  ████████░░                            │
│ └─ Efficiency:    8.5  ████████░░                            │
│                                                               │
│ Metadata:                                                     │
│ ├─ Git Branch: main                                          │
│ ├─ CWD: /Users/edgars/context-coach                          │
│ └─ Claude Version: 2.0.76                                    │
└───────────────────────────────────────────────────────────────┘
```

#### Components Used

| Component | Source | Purpose |
|-----------|--------|---------|
| `Breadcrumb` | `ui/breadcrumb` | Navigation |
| `Card` | `ui/card` | Header, containers |
| `Badge` | `ui/badge` | Stage, type badges |
| `Collapsible` | `ui/collapsible` | Expandable details |
| `DimensionList` | Existing in ext | Score breakdown |
| **New:** `ConversationHeader` | Create | Header with metadata |
| **New:** `MessageBubble` | Create | Chat message |
| **New:** `MessageDetail` | Create | Expanded metadata |
| **New:** `PromptTypeBadge` | Create | Classification badge |
| **New:** `ToolExecutionList` | Create | Tools used |
| **New:** `ThinkingSummary` | Create | Thinking preview |

---

### Project Mapping UI

**Location:** Modal within Import flow
**File:** `components/import/ProjectMappingModal.tsx`

#### Description

During import, when Claude Code project paths need to be mapped to Contextor projects, this modal allows users to confirm auto-matches and manually map unmatched paths.

#### Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│ Map Projects                                                    [X] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ We found 5 Claude Code projects. Please confirm mappings:          │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ✓ Auto-Matched (3)                                              │ │
│ │ ┌─────────────────────────────────────────────────────────────┐ │ │
│ │ │ /Users/edgars/context-coach                                 │ │ │
│ │ │ → context-coach (98% confidence)              [Change ▾]    │ │ │
│ │ └─────────────────────────────────────────────────────────────┘ │ │
│ │ ┌─────────────────────────────────────────────────────────────┐ │ │
│ │ │ /Users/edgars/my-website                                    │ │ │
│ │ │ → my-website (95% confidence)                 [Change ▾]    │ │ │
│ │ └─────────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ⚠ Needs Mapping (2)                                             │ │
│ │ ┌─────────────────────────────────────────────────────────────┐ │ │
│ │ │ /Users/edgars/experiments/test-project                      │ │ │
│ │ │ Select project: [Choose project...          ▾]              │ │ │
│ │ │                 [+ Create "test-project"]                   │ │ │
│ │ └─────────────────────────────────────────────────────────────┘ │ │
│ │ ┌─────────────────────────────────────────────────────────────┐ │ │
│ │ │ /tmp/scratch-work                                           │ │ │
│ │ │ [☐ Skip this project]                                       │ │ │
│ │ └─────────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│                                      [Cancel] [Confirm & Import]    │
└─────────────────────────────────────────────────────────────────────┘
```

#### Components Used

| Component | Source | Purpose |
|-----------|--------|---------|
| `Dialog`, `DialogContent` | `ui/dialog` | Modal container |
| `Select` | `ui/select` | Project selection |
| `Checkbox` | `ui/checkbox` | Skip option |
| `Button` | `ui/button` | Actions |
| `Badge` | `ui/badge` | Confidence indicator |
| **New:** `ProjectMappingCard` | Create | Individual mapping |
| **New:** `ConfidenceBadge` | Create | Match confidence |

---

### Team Conversations Dashboard

**Route:** `/team/conversations`
**File:** `app/(dashboard)/team/conversations/page.tsx`

#### Description

Team-level view of conversations with aggregate metrics, member breakdown, and stage analysis.

#### Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│ Sidebar │ Team Conversations                        [Time Range ▾] │
├─────────┼───────────────────────────────────────────────────────────┤
│         │                                                           │
│         │ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐ │
│         │ │ Sessions   │ │ Avg Score  │ │ Loops      │ │ Members  │ │
│         │ │ 127        │ │ 72/100     │ │ 12 (9%)    │ │ 5 active │ │
│         │ │ ↑ 15%      │ │ ↑ 3 pts    │ │ ↓ 20%     │ │          │ │
│         │ └────────────┘ └────────────┘ └────────────┘ └──────────┘ │
│         │                                                           │
│         │ ┌─────────────────────────────────────────────────────┐   │
│         │ │ Stage Distribution                                  │   │
│         │ │ ┌─────────────────────────────────────────────────┐ │   │
│         │ │ │ [====Architecture 15%====]                      │ │   │
│         │ │ │ [============Development 45%============]       │ │   │
│         │ │ │ [========Debugging 30%========]                 │ │   │
│         │ │ │ [===Enhancement 10%===]                         │ │   │
│         │ │ └─────────────────────────────────────────────────┘ │   │
│         │ └─────────────────────────────────────────────────────┘   │
│         │                                                           │
│         │ ┌─────────────────────────────────────────────────────┐   │
│         │ │ Team Members                           [Filter ▾]   │   │
│         │ │ ┌───────────────────────────────────────────────┐   │   │
│         │ │ │ Alice   45 sessions  Avg: 78  Loops: 2 (4%)   │   │   │
│         │ │ │ Bob     32 sessions  Avg: 71  Loops: 5 (16%)  │   │   │
│         │ │ │ Carol   28 sessions  Avg: 75  Loops: 3 (11%)  │   │   │
│         │ │ └───────────────────────────────────────────────┘   │   │
│         │ └─────────────────────────────────────────────────────┘   │
└─────────┴───────────────────────────────────────────────────────────┘
```

#### Components Used

| Component | Source | Purpose |
|-----------|--------|---------|
| `MetricCard` | `analytics/` | KPI cards |
| `MemberBreakdown` | `analytics/` | Team member stats |
| `BarChart` | `charts/` | Stage distribution |
| `TimeRangeSelector` | `analytics/` | Date filtering |
| **New:** `StageBreakdownChart` | Create | Stage distribution |
| **New:** `LoopFrequencyCard` | Create | Loop metrics |
| **New:** `TeamMemberRow` | Create | Member stats |

---

## VS Code Extension Views

### Conversations Tab

**Location:** New tab in Analytics Panel
**File:** `packages/vscode-extension/webviews/analytics/src/components/ConversationsPanel.tsx`

#### Description

A new tab alongside Analytics, Last Prompt, Sessions, Import that provides conversation browsing within VS Code.

#### Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│ [Analytics] [Last Prompt] [Conversations] [Sessions] [Import]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Recent Conversations                          [Refresh ↻]  │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ inherited-seeking-thimble                               │ │
│ │ context-coach · Dec 25 · 45 msgs                        │ │
│ │ [Development] [72/100]                                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ curious-dancing-penguin                                 │ │
│ │ my-project · Dec 24 · 23 msgs                           │ │
│ │ [Debugging] [Loop!] [65/100]                            │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ wandering-blue-elephant                                 │ │
│ │ api-service · Dec 23 · 12 msgs                          │ │
│ │ [Architecture] [81/100]                                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [View All in Browser →]                                     │
└─────────────────────────────────────────────────────────────┘
```

#### Components

| Component | Purpose |
|-----------|---------|
| `ConversationListItem` | Session summary in list |
| `StageBadge` (webview) | Stage indicator |
| `LoopBadge` (webview) | Loop warning |
| `ScoreBadge` (existing) | Score display |

---

### Conversation Thread View

**Location:** Expands from Conversations Tab
**File:** `packages/vscode-extension/webviews/analytics/src/components/ConversationThread.tsx`

#### Description

When a conversation is selected, displays the message thread inline or in an expanded view.

#### Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│ [←] inherited-seeking-thimble                               │
│ context-coach · main · 45 messages                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 10:30 AM ─────────────────────────────────────────────────  │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Help me implement user authentication...                │ │
│ │ [Initiating] [78]                           [▾ Details] │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ I'll help you implement Google OAuth...             │   │
│   │ Tools: Read, Edit, Bash                             │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Yes, proceed                                            │ │
│ │ [Confirmation] (not scored)                             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│                                               [↑ Top] [↓ End]│
└─────────────────────────────────────────────────────────────┘
```

---

### Loop Alert Notifications

**Location:** VS Code notification + status bar badge
**File:** `packages/vscode-extension/src/services/loopAlertService.ts`

#### Description

When a debugging loop is detected, show a notification with escape recommendations.

#### Notification Design

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠ Debugging Loop Detected                                   │
│                                                             │
│ You've made 4 similar fix attempts. Consider:               │
│ • Providing more architectural context                      │
│ • Starting a fresh conversation                             │
│ • Breaking the problem into smaller steps                   │
│                                                             │
│ [View Details]  [Dismiss]  [Don't Show Again]               │
└─────────────────────────────────────────────────────────────┘
```

#### Status Bar Badge

When a loop is detected, the Contextor status bar item shows a warning indicator:

```
[Contextor ⚠]  ← Yellow warning when loop detected
[Contextor ✓]  ← Normal state
```

---

## Shared Components

### New Components to Create

#### 1. ConversationCard

**File:** `app/components/conversations/ConversationCard.tsx`

```typescript
interface ConversationCardProps {
  session: {
    id: string;
    slug: string;
    projectName?: string;
    startedAt: string;
    duration: number;
    messageCount: number;
    primaryStage?: ProjectStage;
    hasDebuggingLoop: boolean;
    conversationScore?: number;
  };
  onClick?: () => void;
  selected?: boolean;
}
```

**Design:**
- Uses `Card` component as base
- Shows slug as title
- Project name, date, duration as secondary info
- Stage badge, loop indicator, score badge in footer

---

#### 2. MessageBubble

**File:** `app/components/conversations/MessageBubble.tsx`

```typescript
interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  promptType?: PromptType;
  score?: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  metadata?: MessageMetadata;
}
```

**Design:**
- User messages: Right-aligned, primary background
- Assistant messages: Left-aligned, surface background
- Prompt type badge for user messages
- Score badge for analyzed prompts
- Expandable details section

---

#### 3. StageBadge

**File:** `app/components/conversations/StageBadge.tsx`

```typescript
interface StageBadgeProps {
  stage: 'architecture' | 'specification' | 'development' | 'debugging' | 'enhancement';
  size?: 'sm' | 'md';
}
```

**Design:**
- Each stage has distinct color from design system
- Architecture: Blue (info)
- Specification: Purple (secondary)
- Development: Green (success)
- Debugging: Orange (warning)
- Enhancement: Teal (primary)

---

#### 4. LoopIndicator

**File:** `app/components/conversations/LoopIndicator.tsx`

```typescript
interface LoopIndicatorProps {
  loopCount?: number;
  variant?: 'badge' | 'icon' | 'full';
}
```

**Design:**
- Badge variant: `[Loop!]` or `[3 loops]`
- Icon variant: Warning icon only
- Full variant: Text with icon
- Uses `bg-score-growth` (coral/orange) for warning color

---

#### 5. PromptTypeBadge

**File:** `app/components/conversations/PromptTypeBadge.tsx`

```typescript
interface PromptTypeBadgeProps {
  type: 'initiating' | 'continuation' | 'selection' | 'correction' | 'confirmation' | 'clarification';
  size?: 'sm' | 'md';
}
```

**Design:**
- Initiating: Primary color (full scoring)
- Continuation: Muted (partial scoring)
- Selection/Confirmation: Subtle/gray (not scored)
- Correction: Warning color
- Clarification: Info color

---

#### 6. ConversationHeader

**File:** `app/components/conversations/ConversationHeader.tsx`

```typescript
interface ConversationHeaderProps {
  session: SessionWithDetails;
  showBreadcrumb?: boolean;
}
```

**Design:**
- Project name as link
- Git branch badge
- Session slug as title
- Date, duration, message count as metadata row
- Stage badge, score badge, loop indicator

---

#### 7. MessageDetail

**File:** `app/components/conversations/MessageDetail.tsx`

```typescript
interface MessageDetailProps {
  prompt: PromptWithAnalysis;
  response?: ResponseData;
}
```

**Design:**
- Collapsible section
- Prompt classification and score
- Dimension breakdown (reuse DimensionList)
- Metadata: git branch, cwd, claude version
- Tool executions list
- Thinking summary (if available)

---

#### 8. ToolExecutionList

**File:** `app/components/conversations/ToolExecutionList.tsx`

```typescript
interface ToolExecutionListProps {
  tools: Array<{
    name: string;
    inputSummary: string;
    success?: boolean;
  }>;
  compact?: boolean;
}
```

**Design:**
- Compact: Just tool name pills `[Read] [Edit] [Bash]`
- Expanded: List with input summaries
- Success/failure indicators

---

#### 9. ThinkingSummary

**File:** `app/components/conversations/ThinkingSummary.tsx`

```typescript
interface ThinkingSummaryProps {
  summary: string;
  wordCount: number;
  truncated: boolean;
}
```

**Design:**
- Muted text styling
- "Thinking (523 words)" header
- Truncated preview with "Show more" if very long

---

#### 10. ProjectMappingCard

**File:** `app/components/import/ProjectMappingCard.tsx`

```typescript
interface ProjectMappingCardProps {
  claudePath: string;
  matchedProject?: { id: string; name: string };
  confidence?: number;
  availableProjects: Array<{ id: string; name: string }>;
  onSelect: (projectId: string | null) => void;
  onCreateNew: () => void;
  onSkip: () => void;
}
```

**Design:**
- Path displayed prominently
- Matched project with confidence badge
- Dropdown to change selection
- "Create new" and "Skip" options

---

#### 11. StageBreakdownChart

**File:** `app/components/analytics/StageBreakdownChart.tsx`

```typescript
interface StageBreakdownChartProps {
  data: Record<ProjectStage, number>;
  variant?: 'bar' | 'pie';
}
```

**Design:**
- Horizontal bar chart (default)
- Each stage colored per design system
- Percentage labels

---

#### 12. ConversationScoreCard

**File:** `app/components/analytics/ConversationScoreCard.tsx`

```typescript
interface ConversationScoreCardProps {
  score: number;
  promptCount: number;
  excludedCount: number; // selection/confirmation prompts
  trend?: 'up' | 'down' | 'stable';
}
```

**Design:**
- Large score display
- "Based on X of Y prompts" subtitle
- Trend indicator

---

## Design System Requirements

### Colors Used

All components MUST use semantic tokens:

| Element | Token |
|---------|-------|
| User message bg | `bg-primary/10` |
| Assistant message bg | `bg-surface` |
| Selected card | `bg-surface-hover` |
| Stage: Architecture | `bg-info/20` + `text-info` |
| Stage: Development | `bg-score-high/20` + `text-score-high` |
| Stage: Debugging | `bg-score-medium/20` + `text-score-medium` |
| Stage: Enhancement | `bg-primary/20` + `text-primary` |
| Loop indicator | `bg-score-growth/20` + `text-score-growth` |
| Score high | `bg-score-high` |
| Score medium | `bg-score-medium` |
| Score growth | `bg-score-growth` |

### Typography

| Element | Classes |
|---------|---------|
| Page title | `text-2xl font-semibold` |
| Section title | `text-lg font-medium` |
| Card title | `text-base font-medium` |
| Metadata | `text-sm text-muted-foreground` |
| Badge text | `text-xs font-medium` |

### Spacing

| Element | Classes |
|---------|---------|
| Page padding | `p-6` |
| Section gap | `gap-6` |
| Card padding | `p-4` |
| Badge padding | `px-2 py-0.5` |
| Message gap | `gap-4` |

### Border Radius

| Element | Classes |
|---------|---------|
| Cards | `rounded-lg` |
| Badges | `rounded-md` |
| Message bubbles | `rounded-lg` |
| Pills | `rounded-full` |

---

## Implementation Checklist

### Phase 3a: Core Components (Week 1)

- [ ] Create `components/conversations/` directory
- [ ] Implement `ConversationCard`
- [ ] Implement `MessageBubble`
- [ ] Implement `StageBadge`
- [ ] Implement `LoopIndicator`
- [ ] Implement `PromptTypeBadge`
- [ ] Add unit tests for all components

### Phase 3b: Web Pages (Week 2)

- [ ] Create `/conversations` page route
- [ ] Create `/conversations/[sessionId]` page route
- [ ] Implement `ConversationHeader`
- [ ] Implement `MessageDetail`
- [ ] Implement `ToolExecutionList`
- [ ] Implement `ThinkingSummary`
- [ ] Add E2E tests for conversation flows

### Phase 3c: Import Enhancement (Week 2)

- [ ] Implement `ProjectMappingCard`
- [ ] Implement `ProjectMappingModal`
- [ ] Integrate with existing import flow
- [ ] Add E2E tests for import with mapping

### Phase 3d: Analytics (Week 3)

- [ ] Implement `StageBreakdownChart`
- [ ] Implement `ConversationScoreCard`
- [ ] Create `/team/conversations` page
- [ ] Integrate stage metrics into existing analytics

### Phase 3e: VS Code Extension (Week 3-4)

- [ ] Add Conversations tab to TabNavigation
- [ ] Implement `ConversationsPanel`
- [ ] Implement `ConversationThread`
- [ ] Implement `StageBadge` (webview version)
- [ ] Implement `LoopBadge` (webview version)
- [ ] Implement loop alert notification service
- [ ] Update message protocol types
- [ ] Add extension tests

### Phase 3f: Polish & Testing (Week 4)

- [ ] Visual regression tests
- [ ] Accessibility audit
- [ ] Performance optimization
- [ ] Documentation updates
- [ ] Design review

---

## API Endpoints Required

| Endpoint | Purpose |
|----------|---------|
| `GET /api/conversations` | List conversations with filters |
| `GET /api/conversations/[id]` | Get conversation with messages |
| `GET /api/conversations/[id]/thread` | Get threaded messages |
| `POST /api/project-mappings` | Create/update mappings |
| `GET /api/project-mappings` | List mappings for team |
| `GET /api/team/conversations/metrics` | Team aggregate metrics |

---

## Testing Requirements

### Unit Tests

- All new components have unit tests
- Test prop variations (size, variant, state)
- Test accessibility (keyboard, screen reader)

### E2E Tests

- Conversation list: filter, sort, pagination
- Conversation thread: scroll, expand, navigate
- Import mapping: auto-match, manual map, skip
- VS Code: tab navigation, real-time updates

### Visual Tests

- Storybook stories for all components
- Chromatic visual regression
- Dark mode verification

---

*Document generated for Phase 3 UI Implementation*
*Reference: PRD Phase 3, Architecture Phase 3*
