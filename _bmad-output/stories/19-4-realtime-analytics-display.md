# Story 19.4: Real-time Analytics Display

Status: Ready

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

- [ ] **Task 1: Create API client methods for analytics** (AC: #1, #3)
  - [ ] Add `getAnalytics(teamId, timeRange)` to `ContextorAPI`
  - [ ] Add `getRecentPrompts(teamId, limit)` to `ContextorAPI`
  - [ ] Add `getPromptDetail(promptId)` to `ContextorAPI`
  - [ ] Handle API errors with proper error types
  - [ ] Add response type definitions

- [ ] **Task 2: Build Dashboard component** (AC: #1)
  - [ ] Create `Dashboard.tsx` in webviews/analytics/src/components
  - [ ] Display overall score prominently
  - [ ] Create score breakdown for 5 dimensions
  - [ ] Display total prompt count
  - [ ] Use visual indicators (colors, icons) for score ranges
  - [ ] Apply Contextor brand colors

- [ ] **Task 3: Build ScoreCard component** (AC: #1)
  - [ ] Create `ScoreCard.tsx` with dimension name and score
  - [ ] Add color coding: red (<60), yellow (60-79), green (>=80)
  - [ ] Add trend indicator (up/down/neutral) if available
  - [ ] Make scores accessible (aria labels)
  - [ ] Compact design for sidebar width

- [ ] **Task 4: Build RecentPrompts component** (AC: #4)
  - [ ] Create `RecentPrompts.tsx` showing last 5 prompts
  - [ ] Display prompt preview (first 50 chars)
  - [ ] Display score and timestamp
  - [ ] Add click handler to show detail
  - [ ] Handle empty state (no prompts yet)

- [ ] **Task 5: Build PromptDetail modal/view** (AC: #4)
  - [ ] Create `PromptDetail.tsx` component
  - [ ] Display full prompt text
  - [ ] Display all dimension scores
  - [ ] Display improvement suggestions
  - [ ] Add back/close button
  - [ ] Scroll handling for long prompts

- [ ] **Task 6: Implement time period selector** (AC: #3)
  - [ ] Create `TimeRangeSelector.tsx` component
  - [ ] Add options: Today, 7 Days, 30 Days
  - [ ] Persist selection in extension state
  - [ ] Trigger data refresh on change
  - [ ] Style as dropdown or segmented control

- [ ] **Task 7: Implement auto-refresh mechanism** (AC: #2)
  - [ ] Set up 30-second refresh interval
  - [ ] Only refresh when panel is visible
  - [ ] Show subtle refresh indicator (spinner in corner)
  - [ ] Don't replace existing data during refresh
  - [ ] Update data only after successful fetch

- [ ] **Task 8: Implement loading and error states** (AC: #5, #6)
  - [ ] Create `Loading.tsx` skeleton component
  - [ ] Create `ErrorState.tsx` with retry button
  - [ ] Show skeleton on initial load
  - [ ] Show inline spinner on refresh
  - [ ] Handle and display network errors
  - [ ] Add "Retry" functionality

- [ ] **Task 9: Wire up messaging between extension and webview** (AC: #1, #2)
  - [ ] Send analytics data from extension to webview
  - [ ] Handle time range change requests from webview
  - [ ] Handle prompt detail requests from webview
  - [ ] Handle retry requests from webview
  - [ ] Send refresh notifications to webview

- [ ] **Task 10: Implement offline mode** (AC: #7)
  - [ ] Add local cache for analytics data using VS Code globalState
  - [ ] Detect network connectivity status
  - [ ] Create `OfflineIndicator.tsx` component
  - [ ] Display cached data when offline
  - [ ] Show last successful sync timestamp
  - [ ] Pause auto-refresh when offline
  - [ ] Resume auto-refresh when connectivity restored

- [ ] **Task 11: Implement sync status indicator** (AC: #8)
  - [ ] Create `SyncStatus.tsx` component
  - [ ] Track sync state: idle, syncing, synced, error
  - [ ] Display last sync timestamp
  - [ ] Add manual refresh button
  - [ ] Show visual feedback during sync (spinner)
  - [ ] Handle sync errors gracefully

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
- [ ] Reviewed `_bmad-output/DESIGN-SYSTEM-MANDATE.md` for component inventory
- [ ] Checked `/design` route for component examples
- [ ] Identified required components from the inventory below
- [ ] Confirmed no hardcoded colors - using semantic tokens only
- [ ] No new UI patterns needed (or Design Epic story created)

### Required Components
<!-- Dev agent: Fill in specific components needed from DESIGN-SYSTEM-MANDATE.md -->
- Review `/design` route and `components/` directory before implementation
- Use semantic tokens: `bg-surface-*`, `text-content-*`, `border-border-*`

### Styling Rules
- NO hardcoded colors (no `bg-zinc-*`, `text-gray-*`, etc.)
- Use existing components from `components/` directory
- Extend existing components before creating new ones

## Dev Agent Record

### Agent Model Used

<!-- To be filled by implementing agent -->

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

| Date | Change | Author |
|------|--------|--------|

### File List

*To be filled by dev agent - list all files created/modified*
