# Story 19.4: Real-time Analytics Display

Status: Done

## PRD Alignment Note

PRD 19.4 is titled "Contextor Cloud API Integration" and covers WebSocket communication, offline mode, and sync status. This story implements the **real-time display component** of that requirement:

- **Real-time updates:** Implemented via polling (30-second refresh interval) rather than WebSocket. Polling is simpler for MVP and sufficient for analytics that don't require sub-second updates. WebSocket can be added in a future iteration if needed.
- **Offline mode:** Included in this story (AC #7) - cached data is displayed when network is unavailable.
- **Sync status:** Included in this story (AC #8) - sync indicator shows last sync time and current sync state.

**API Method Naming:** The story uses `getAnalytics()`, `getRecentPrompts()`, and `getPromptDetail()` method names. The architecture document may reference different names (e.g., `fetchAnalytics`). The implementation should follow the naming conventions established in Story 19-2 (Authentication Flow) for consistency within the extension codebase.

## Dependencies

- **Depends on:** Story 19-3 (Sidebar Panel) - provides the container for analytics display
- **Blocks:** Story 19-5 (Quick Coaching Tips)

## Story

**As a** developer using the VS Code extension,
**I want** to see my prompt analytics in real-time,
**So that** I can track my prompting improvement without switching to the browser.

## Acceptance Criteria

1. **Given** I am authenticated and have the sidebar open
   **When** analytics data loads
   **Then** I see my overall prompt score (average)
   **And** I see scores for all 5 dimensions (clarity, context, specificity, actionability, efficiency)
   **And** I see my prompt count for the selected time period

2. **Given** analytics are displayed
   **When** I submit a new prompt in my project
   **Then** the analytics refresh automatically within 30 seconds
   **And** I see a subtle refresh indicator

3. **Given** the analytics panel
   **When** I click a time period selector
   **Then** I can choose: Today, 7 Days, 30 Days
   **And** the analytics update to reflect the selected period

4. **Given** I have recent prompts
   **When** viewing the analytics panel
   **Then** I see my last 5 prompts with their scores
   **And** I can click a prompt to see its full analysis

5. **Given** the analytics are loading or refreshing
   **When** viewing the panel
   **Then** I see a loading state that doesn't block existing content
   **And** the panel remains usable during refresh

6. **Given** there is a network error
   **When** trying to load analytics
   **Then** I see a clear error message
   **And** I can retry with a button click

7. **Given** the network is unavailable
   **When** viewing the analytics panel
   **Then** cached data is displayed with an "Offline" indicator
   **And** the last successful sync time is shown
   **And** auto-refresh is paused until connectivity is restored

8. **Given** data is syncing with the Contextor Cloud
   **When** viewing the panel
   **Then** a sync status indicator shows the current state (syncing/synced)
   **And** the last sync timestamp is displayed
   **And** I can manually trigger a sync with a refresh button

## Tasks / Subtasks

- [x] **Task 1: Create API client methods for analytics** (AC: #1, #3)
  - [x] Add `getAnalytics(timeRange)` to `ContextorAPI`
  - [x] Add `getRecentPrompts(limit)` to `ContextorAPI`
  - [x] Add `getPromptDetail(promptId)` to `ContextorAPI`
  - [x] Handle API errors with proper error types
  - [x] Add response type definitions

- [x] **Task 2: Build Dashboard component** (AC: #1)
  - [x] Enhanced `AnalyticsPanel.tsx` in webviews/sidebar
  - [x] Display overall score prominently
  - [x] Create score breakdown for 5 dimensions
  - [x] Display total prompt count
  - [x] Use visual indicators (colors, icons) for score ranges
  - [x] Apply Contextor brand colors

- [x] **Task 3: Build ScoreCard component** (AC: #1)
  - [x] Create `DimensionScoreCard.tsx` with dimension name and score
  - [x] Add color coding: red (<60), yellow (60-79), green (>=80)
  - [x] Add trend indicator (up/down/neutral) if available
  - [x] Make scores accessible (aria labels)
  - [x] Compact design for sidebar width

- [x] **Task 4: Build RecentPrompts component** (AC: #4)
  - [x] Uses existing `PromptCard.tsx` showing last 5 prompts
  - [x] Display prompt preview (first 100 chars)
  - [x] Display score and timestamp
  - [x] Add click handler to show detail
  - [x] Handle empty state (no prompts yet)

- [x] **Task 5: Build PromptDetail modal/view** (AC: #4)
  - [x] Create `PromptDetail.tsx` component
  - [x] Display full prompt text
  - [x] Display all dimension scores
  - [x] Display improvement suggestions
  - [x] Add back/close button
  - [x] Scroll handling for long prompts

- [x] **Task 6: Implement time period selector** (AC: #3)
  - [x] Create `TimeRangeSelector.tsx` component
  - [x] Add options: Today, 7 Days, 30 Days
  - [x] Persist selection in extension state
  - [x] Trigger data refresh on change
  - [x] Style as segmented control

- [x] **Task 7: Implement auto-refresh mechanism** (AC: #2)
  - [x] Set up configurable refresh interval (default 30 seconds)
  - [x] Only refresh when panel is visible
  - [x] Show subtle refresh indicator (spinner)
  - [x] Don't replace existing data during refresh
  - [x] Update data only after successful fetch

- [x] **Task 8: Implement loading and error states** (AC: #5, #6)
  - [x] Create loading skeleton component
  - [x] Create `ErrorState.tsx` with retry button
  - [x] Show skeleton on initial load
  - [x] Show inline spinner on refresh
  - [x] Handle and display network errors
  - [x] Add "Retry" functionality

- [x] **Task 9: Wire up messaging between extension and webview** (AC: #1, #2)
  - [x] Send analytics data from extension to webview
  - [x] Handle time range change requests from webview
  - [x] Handle prompt detail requests from webview
  - [x] Handle retry requests from webview
  - [x] Send refresh notifications to webview

- [x] **Task 10: Implement offline mode** (AC: #7)
  - [x] Add local cache for analytics data using VS Code globalState
  - [x] Detect network connectivity status
  - [x] Display cached data when offline
  - [x] Show last successful sync timestamp
  - [x] Pause auto-refresh when offline
  - [x] Resume auto-refresh when connectivity restored

- [x] **Task 11: Implement sync status indicator** (AC: #8)
  - [x] Create `SyncStatus.tsx` component
  - [x] Track sync state: idle, syncing, synced, error, offline
  - [x] Display last sync timestamp
  - [x] Add manual refresh button
  - [x] Show visual feedback during sync (spinner)
  - [x] Handle sync errors gracefully

## Dev Notes

### Analytics Data Types

```typescript
// src/types/analytics.ts
export interface AnalyticsData {
  summary: {
    overallScore: number;
    promptCount: number;
    timeRange: '1d' | '7d' | '30d';
  };
  dimensions: {
    clarity: DimensionScore;
    context: DimensionScore;
    specificity: DimensionScore;
    actionability: DimensionScore;
    efficiency: DimensionScore;
  };
  trends: {
    scoreChange: number; // vs previous period
    countChange: number;
  };
}

export interface DimensionScore {
  score: number;
  trend: 'up' | 'down' | 'stable';
}

export interface RecentPrompt {
  id: string;
  text: string;
  score: number;
  timestamp: string;
  dimensions: Record<string, number>;
  suggestions: string[];
}
```

### Dashboard Component Reference

```tsx
// webviews/analytics/src/components/Dashboard.tsx
import React from 'react';
import { ScoreCard } from './ScoreCard';
import { RecentPrompts } from './RecentPrompts';
import { TimeRangeSelector } from './TimeRangeSelector';
import { AnalyticsData, RecentPrompt } from '../types';

interface DashboardProps {
  analytics: AnalyticsData;
  recentPrompts: RecentPrompt[];
  timeRange: string;
  onTimeRangeChange: (range: string) => void;
  onPromptClick: (promptId: string) => void;
  isRefreshing: boolean;
}

export function Dashboard({
  analytics,
  recentPrompts,
  timeRange,
  onTimeRangeChange,
  onPromptClick,
  isRefreshing
}: DashboardProps) {
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h2>Your Analytics</h2>
        <TimeRangeSelector value={timeRange} onChange={onTimeRangeChange} />
        {isRefreshing && <span className="refresh-indicator" />}
      </header>

      <section className="overall-score">
        <div className="score-circle">
          <span className="score-value">{analytics.summary.overallScore}</span>
          <span className="score-label">Overall</span>
        </div>
        <div className="prompt-count">
          {analytics.summary.promptCount} prompts
        </div>
      </section>

      <section className="dimensions">
        <h3>Score Breakdown</h3>
        {Object.entries(analytics.dimensions).map(([name, data]) => (
          <ScoreCard
            key={name}
            name={name}
            score={data.score}
            trend={data.trend}
          />
        ))}
      </section>

      <section className="recent-prompts">
        <h3>Recent Prompts</h3>
        <RecentPrompts
          prompts={recentPrompts}
          onPromptClick={onPromptClick}
        />
      </section>
    </div>
  );
}
```

### VS Code API Hook

```tsx
// webviews/analytics/src/hooks/useVSCodeApi.ts
import { useState, useEffect } from 'react';

declare global {
  interface Window {
    acquireVsCodeApi: () => VSCodeApi;
  }
}

interface VSCodeApi {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

let vscodeApi: VSCodeApi | undefined;

export function useVSCodeApi() {
  if (!vscodeApi) {
    vscodeApi = window.acquireVsCodeApi();
  }
  return vscodeApi;
}

export function useVSCodeMessage<T>(onMessage: (message: T) => void) {
  useEffect(() => {
    const handler = (event: MessageEvent<T>) => {
      onMessage(event.data);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onMessage]);
}
```

### Score Color Logic

```typescript
export function getScoreColor(score: number): string {
  if (score >= 80) return 'var(--vscode-charts-green)';
  if (score >= 60) return 'var(--vscode-charts-yellow)';
  return 'var(--vscode-charts-red)';
}
```

### Auto-Refresh Implementation

```typescript
// In extension.ts or analyticsPanel.ts
private startAutoRefresh(): void {
  this.refreshInterval = setInterval(() => {
    if (this._view?.visible) {
      this.sendAnalytics();
    }
  }, 30000); // 30 seconds
}

private stopAutoRefresh(): void {
  if (this.refreshInterval) {
    clearInterval(this.refreshInterval);
    this.refreshInterval = undefined;
  }
}
```

### CSS Variables for Theming

```css
/* Use VS Code theme variables */
.dashboard {
  color: var(--vscode-foreground);
  background: var(--vscode-sideBar-background);
}

.score-value {
  color: var(--vscode-foreground);
  font-size: 2rem;
  font-weight: bold;
}

.dimension-card {
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  padding: 8px 12px;
  margin: 4px 0;
}
```

### Anti-Patterns to Avoid

1. **DO NOT** block UI during refresh - show existing data
2. **DO NOT** refresh when panel is hidden - waste of resources
3. **DO NOT** hardcode colors - use VS Code theme variables
4. **DO NOT** ignore error states - always provide retry option
5. **DO NOT** fetch all prompts - paginate with limit
6. **DO NOT** store sensitive data in webview state

### References

- [VS Code Webview Message Passing](https://code.visualstudio.com/api/extension-guides/webview#passing-messages-from-an-extension-to-a-webview)
- [VS Code Theme Colors](https://code.visualstudio.com/api/references/theme-color)


## Design System Requirements

**MANDATORY:** This story MUST use existing design system components exclusively.

### Pre-Implementation Checklist
- [x] Reviewed `_bmad-output/DESIGN-SYSTEM-MANDATE.md` for component inventory
- [x] Checked `/design` route for component examples
- [x] Identified required components from the inventory below
- [x] Confirmed no hardcoded colors - using semantic tokens only
- [x] No new UI patterns needed (or Design Epic story created)

### Required Components
- Existing `Gauge`, `ScoreBadge`, `PromptCard`, `Sparkline` components
- New components use CSS variables that map to VS Code theme colors
- Semantic tokens: `--ctx-background`, `--ctx-foreground`, `--ctx-surface-*`, etc.

### Styling Rules
- NO hardcoded colors (no `bg-zinc-*`, `text-gray-*`, etc.)
- Use existing components from `components/` directory
- Extend existing components before creating new ones

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **API Client Implementation**: Created `ContextorAPI` service class (`src/services/api.ts`) with methods `getAnalytics()`, `getRecentPrompts()`, and `getPromptDetail()`. Includes proper error handling, response type transformations, and connectivity checking.

2. **Type Definitions**: Added comprehensive analytics types (`src/types/analytics.ts`) including `TimeRange`, `SyncState`, `AnalyticsData`, `RecentPrompt`, `PromptDetail`, and `CachedAnalytics`.

3. **Message Types**: Enhanced messaging protocol (`src/types/messages.ts`) with full state management types and bidirectional message types for extension-webview communication.

4. **Dashboard Components**: Updated `AnalyticsPanel.tsx` with dimension breakdown, time range selector, sync status, and prompt detail views. Integrated all new components.

5. **New Components Created**:
   - `DimensionScoreCard.tsx` - Score card with color coding and trend indicators
   - `TimeRangeSelector.tsx` - Segmented control for Today/7 Days/30 Days
   - `SyncStatus.tsx` - Sync state indicator with manual refresh
   - `PromptDetail.tsx` - Full prompt analysis view with suggestions
   - `ErrorState.tsx` - Error display with retry functionality

6. **Icon Additions**: Added `TrendUpIcon`, `TrendDownIcon`, `CalendarIcon`, `SyncIcon`, `AlertCircleIcon`, `ChevronLeftIcon`, `XIcon`, `CheckCircleIcon` to icons library.

7. **Extension Provider Updates**: Enhanced `AnalyticsPanelProvider` with:
   - API client integration
   - Auto-refresh with configurable interval
   - Offline mode with globalState caching
   - Time range persistence
   - Full message handling for all new message types
   - Panel visibility handling for auto-refresh

8. **Offline Support**: Implemented local caching using VS Code's `globalState.update()` API. Analytics data is cached and restored when offline.

9. **Theme Integration**: All components use VS Code CSS variables (`--vscode-*`) mapped through Contextor semantic tokens (`--ctx-*`).

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2024-12-24 | Initial implementation of Story 19-4 | Claude Opus 4.5 |

### File List

**New Files Created:**
- `/packages/vscode-extension/src/services/api.ts` - API client service
- `/packages/vscode-extension/src/types/analytics.ts` - Analytics type definitions
- `/packages/vscode-extension/webviews/components/dimension-score-card.tsx` - Dimension score component
- `/packages/vscode-extension/webviews/components/time-range-selector.tsx` - Time range selector component
- `/packages/vscode-extension/webviews/components/sync-status.tsx` - Sync status indicator component
- `/packages/vscode-extension/webviews/components/prompt-detail.tsx` - Prompt detail view component
- `/packages/vscode-extension/webviews/components/error-state.tsx` - Error state component

**Modified Files:**
- `/packages/vscode-extension/src/types/index.ts` - Added analytics exports
- `/packages/vscode-extension/src/types/messages.ts` - Enhanced message types
- `/packages/vscode-extension/src/providers/analyticsPanel.ts` - Full enhancement with API, caching, and messaging
- `/packages/vscode-extension/src/extension.ts` - Added globalState setup
- `/packages/vscode-extension/webviews/sidebar/analytics-panel.tsx` - Complete rewrite with all new features
- `/packages/vscode-extension/webviews/components/icons.tsx` - Added 8 new icons
- `/packages/vscode-extension/webviews/components/index.ts` - Added component exports
