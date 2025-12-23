# Story 19.5: Quick Coaching Tips

Status: Done

## Story

**As a** developer using the VS Code extension,
**I want** to see improvement suggestions for my recent prompts,
**So that** I can learn to write better prompts over time.

## Acceptance Criteria

1. **Given** I have recent analyzed prompts
   **When** viewing the coaching section
   **Then** I see personalized improvement tips based on my prompt patterns
   **And** tips are specific and actionable

2. **Given** I view a prompt's detail
   **When** the prompt has suggestions
   **Then** I see the AI-generated improvement suggestions
   **And** each suggestion is clearly explained

3. **Given** I have a pattern of low scores in a dimension
   **When** the coaching section loads
   **Then** I see targeted tips for improving that dimension
   **And** example improved prompt patterns are shown

4. **Given** I dismiss a coaching tip
   **When** viewing tips later
   **Then** the dismissed tip doesn't reappear
   **And** new tips continue to show

5. **Given** there are no prompts or suggestions
   **When** viewing the coaching section
   **Then** I see a helpful empty state with getting started tips

## Tasks / Subtasks

- [x] **Task 1: Create coaching API endpoints** (AC: #1, #2, #3)
  - [x] Add `getCoachingTips(userId, teamId)` to API
  - [x] Return personalized tips based on weak dimensions
  - [x] Include example patterns for improvement
  - [x] Add `dismissTip(tipId)` endpoint
  - [x] Store dismissed tips per user

- [x] **Task 2: Extend ContextorAPI client** (AC: #1, #2)
  - [x] Add `getCoachingTips()` method
  - [x] Add `dismissTip(tipId)` method
  - [x] Add response types for coaching data
  - [x] Handle caching to reduce API calls

- [x] **Task 3: Create CoachingSection component** (AC: #1, #3)
  - [x] Create `CoachingSection.tsx` in webviews
  - [x] Display personalized tips with icons
  - [x] Group tips by dimension if multiple
  - [x] Add dismiss button for each tip
  - [x] Show "Pro tip" styling for emphasis

- [x] **Task 4: Create TipCard component** (AC: #1, #4)
  - [x] Create `TipCard.tsx` component
  - [x] Display tip title and description
  - [x] Show related dimension badge
  - [x] Add example before/after if available
  - [x] Add dismiss (X) button
  - [x] Animate dismissal

- [x] **Task 5: Display prompt-specific suggestions** (AC: #2)
  - [x] Enhance `PromptDetail.tsx` with suggestions section
  - [x] Display each suggestion with explanation
  - [x] Group suggestions by dimension
  - [x] Show improved prompt example if available
  - [x] Add visual hierarchy for readability

- [x] **Task 6: Implement pattern detection display** (AC: #3)
  - [x] Create `WeakDimensionAlert.tsx` component
  - [x] Show when a dimension consistently scores low
  - [x] Display specific improvement strategies
  - [x] Link to resources or examples
  - [x] Update when pattern changes

- [x] **Task 7: Create empty state** (AC: #5)
  - [x] Create `EmptyCoaching.tsx` component
  - [x] Display friendly message for new users
  - [x] Show "getting started" tips
  - [x] Explain how coaching tips work
  - [x] Encourage submitting prompts

- [x] **Task 8: Implement tip dismissal persistence** (AC: #4)
  - [x] Store dismissed tip IDs in extension state
  - [x] Sync dismissals to server API
  - [x] Filter out dismissed tips from display
  - [x] Handle offline dismissals gracefully

- [x] **Task 9: Add coaching to sidebar panel** (AC: #1)
  - [x] Add CoachingSection to Dashboard
  - [x] Place below analytics or in separate tab
  - [x] Update on analytics refresh
  - [x] Show coaching tip count badge

## PRD Alignment Note

This story (19-5) was added to Epic 19 to provide lightweight coaching features within the VS Code extension. While not explicitly listed in the original PRD's 4 stories for Epic 19, this addition is justified because:

1. **Bridges Extension and Coaching Epics** - Epic 20 covers full pre-submission coaching, but basic coaching tips naturally enhance the extension UX without requiring the blocking hook infrastructure
2. **Incremental Value Delivery** - Users benefit from coaching insights immediately within the extension, creating a "preview" of the deeper coaching features in Epic 20
3. **Logical Feature Progression** - After viewing analytics (Story 19-4), showing improvement tips is the natural next step in the user journey
4. **Lower Technical Complexity** - Unlike Epic 20's blocking hooks, this story uses passive display of tips, making it a lower-risk addition

Consider this story a bridge between Epic 19 (VS Code Extension) and Epic 20 (Pre-Submission Coaching).

## API Endpoint Alignment

The architecture document specifies `/api/coaching/heuristics` as the backend endpoint for coaching data. This story uses that endpoint as follows:

- **Backend Endpoint:** `GET /api/coaching/heuristics` - Returns personalized coaching tips based on user patterns
- **Client Function:** `getCoachingTips(userId, teamId)` - The VS Code extension API client method that calls the above endpoint
- **Dismiss Endpoint:** `POST /api/coaching/tips/:tipId/dismiss` - Marks a tip as dismissed for the user

The `getCoachingTips` function name is the client-side abstraction; it internally calls `/api/coaching/heuristics` on the server.

## Dev Notes

### Coaching Data Types

```typescript
// src/types/coaching.ts
export interface CoachingTip {
  id: string;
  dimension: 'clarity' | 'context' | 'specificity' | 'actionability' | 'efficiency';
  title: string;
  description: string;
  example?: {
    before: string;
    after: string;
  };
  priority: 'high' | 'medium' | 'low';
  source: 'pattern' | 'recent' | 'general';
}

export interface PromptSuggestion {
  dimension: string;
  issue: string;
  improvement: string;
  improvedExample?: string;
}

export interface CoachingResponse {
  tips: CoachingTip[];
  weakDimensions: {
    dimension: string;
    averageScore: number;
    promptCount: number;
  }[];
  lastUpdated: string;
}
```

### CoachingSection Component Reference

```tsx
// webviews/analytics/src/components/CoachingSection.tsx
import React from 'react';
import { TipCard } from './TipCard';
import { WeakDimensionAlert } from './WeakDimensionAlert';
import { EmptyCoaching } from './EmptyCoaching';
import { CoachingTip } from '../types';

interface CoachingSectionProps {
  tips: CoachingTip[];
  weakDimensions: WeakDimension[];
  onDismiss: (tipId: string) => void;
}

export function CoachingSection({ tips, weakDimensions, onDismiss }: CoachingSectionProps) {
  if (tips.length === 0 && weakDimensions.length === 0) {
    return <EmptyCoaching />;
  }

  return (
    <section className="coaching-section">
      <h3>Coaching Tips</h3>

      {weakDimensions.length > 0 && (
        <div className="weak-dimensions">
          {weakDimensions.map((wd) => (
            <WeakDimensionAlert key={wd.dimension} {...wd} />
          ))}
        </div>
      )}

      <div className="tips-list">
        {tips.map((tip) => (
          <TipCard
            key={tip.id}
            tip={tip}
            onDismiss={() => onDismiss(tip.id)}
          />
        ))}
      </div>
    </section>
  );
}
```

### TipCard Component Reference

```tsx
// webviews/analytics/src/components/TipCard.tsx
import React from 'react';
import { CoachingTip } from '../types';

interface TipCardProps {
  tip: CoachingTip;
  onDismiss: () => void;
}

export function TipCard({ tip, onDismiss }: TipCardProps) {
  return (
    <div className={`tip-card priority-${tip.priority}`}>
      <div className="tip-header">
        <span className={`dimension-badge ${tip.dimension}`}>
          {tip.dimension}
        </span>
        <button className="dismiss-btn" onClick={onDismiss} aria-label="Dismiss tip">
          x
        </button>
      </div>

      <h4>{tip.title}</h4>
      <p>{tip.description}</p>

      {tip.example && (
        <div className="example">
          <div className="before">
            <span className="label">Before:</span>
            <code>{tip.example.before}</code>
          </div>
          <div className="after">
            <span className="label">After:</span>
            <code>{tip.example.after}</code>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Prompt Detail Suggestions

```tsx
// In PromptDetail.tsx
{prompt.suggestions && prompt.suggestions.length > 0 && (
  <section className="suggestions">
    <h4>Improvement Suggestions</h4>
    {prompt.suggestions.map((suggestion, i) => (
      <div key={i} className="suggestion-item">
        <span className={`dimension-badge ${suggestion.dimension}`}>
          {suggestion.dimension}
        </span>
        <p className="issue">{suggestion.issue}</p>
        <p className="improvement">{suggestion.improvement}</p>
        {suggestion.improvedExample && (
          <code className="improved-example">
            {suggestion.improvedExample}
          </code>
        )}
      </div>
    ))}
  </section>
)}
```

### Empty State Reference

```tsx
// webviews/analytics/src/components/EmptyCoaching.tsx
import React from 'react';

export function EmptyCoaching() {
  return (
    <div className="empty-coaching">
      <span className="icon">lightbulb</span>
      <h4>No tips yet</h4>
      <p>
        Submit a few prompts and we'll analyze your patterns to provide
        personalized coaching tips.
      </p>
      <div className="getting-started">
        <h5>Getting Started Tips:</h5>
        <ul>
          <li>Be specific about what you want</li>
          <li>Provide relevant context</li>
          <li>Define the expected output format</li>
          <li>Break complex tasks into steps</li>
        </ul>
      </div>
    </div>
  );
}
```

### Tip Dismissal Persistence

```typescript
// In extension.ts or dedicated storage service
async function dismissTip(tipId: string): Promise<void> {
  // Get existing dismissed tips
  const dismissed = context.globalState.get<string[]>('dismissedTips', []);

  // Add new tip
  if (!dismissed.includes(tipId)) {
    dismissed.push(tipId);
    await context.globalState.update('dismissedTips', dismissed);

    // Sync to server (fire and forget)
    try {
      const api = new ContextorAPI(await authService.getAccessToken()!);
      await api.dismissTip(tipId);
    } catch {
      // Will sync on next opportunity
    }
  }
}
```

### Styling for Priorities

```css
.tip-card {
  border-left: 3px solid var(--vscode-panel-border);
  padding: 12px;
  margin: 8px 0;
  background: var(--vscode-editor-background);
}

.tip-card.priority-high {
  border-left-color: var(--vscode-inputValidation-errorBorder);
}

.tip-card.priority-medium {
  border-left-color: var(--vscode-inputValidation-warningBorder);
}

.tip-card.priority-low {
  border-left-color: var(--vscode-inputValidation-infoBorder);
}

.dimension-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 2px;
  text-transform: uppercase;
}

.dimension-badge.clarity { background: #3b82f6; }
.dimension-badge.context { background: #8b5cf6; }
.dimension-badge.specificity { background: #10b981; }
.dimension-badge.actionability { background: #f59e0b; }
.dimension-badge.efficiency { background: #ef4444; }
```

### Anti-Patterns to Avoid

1. **DO NOT** show too many tips at once - prioritize and limit to 3-5
2. **DO NOT** repeat dismissed tips - persist dismissals
3. **DO NOT** show generic tips - always personalize based on data
4. **DO NOT** overwhelm with text - keep tips concise
5. **DO NOT** forget empty states - always guide new users

### Story Dependencies

- **Depends on:**
  - Story 19-1 (Extension Scaffold) - Required extension infrastructure
  - Story 19-2 (Authentication Flow) - Required for API access
  - Story 19-3 (Sidebar Panel) - UI container for coaching section
  - Story 19-4 (Real-time Analytics Display) - Analytics data used to generate tips
- **Blocks:** None (can be enhanced independently)

### References

- Phase 2 Architecture: Pre-Submission Coaching section
- Coaching heuristics in `services/heuristics.ts`


## Design System Requirements

**MANDATORY:** This story MUST use existing design system components exclusively.

### Pre-Implementation Checklist
- [x] Reviewed `_bmad-output/DESIGN-SYSTEM-MANDATE.md` for component inventory
- [x] Checked `/design` route for component examples
- [x] Identified required components from the inventory below
- [x] Confirmed no hardcoded colors - using semantic tokens only (CSS variables)
- [x] No new UI patterns needed (or Design Epic story created)

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

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Coaching Types Created**: Implemented comprehensive type definitions in `src/types/coaching.ts` including:
   - `DimensionName`, `TipPriority`, `TipSource` type aliases
   - `CoachingTip`, `WeakDimension`, `CoachingResponse` interfaces
   - `DismissTipRequest`, `CachedCoaching` for persistence
   - `COACHING_STORAGE_KEYS` constants and `DIMENSION_CONFIG` for display
   - `DEFAULT_GETTING_STARTED_TIPS` for new users

2. **API Client Extended**: Added `getCoachingTips()` and `dismissTip()` methods to `ContextorAPI` class with:
   - Authenticated fetch to `/coaching/heuristics` endpoint
   - Response transformation for tips and weak dimensions
   - Fire-and-forget dismiss endpoint calls

3. **React Components Created**: Four new components in `webviews/components/`:
   - `TipCard`: Displays individual tips with dimension badge, title, description, optional before/after example, and dismiss animation
   - `WeakDimensionAlert`: Expandable alert for dimensions with consistently low scores, showing trend and improvement strategies
   - `EmptyCoaching`: Empty state with animated icon and default "Getting Started" tips for new users
   - `CoachingSection`: Main container that combines all coaching components with loading skeleton and history

4. **PromptDetail Enhanced**: Enhanced suggestions section with:
   - Grouped suggestions by type (reinforcements vs improvements)
   - Expandable examples with improved prompt patterns
   - Dimension color badges consistent with design system

5. **State Management**: Implemented tip dismissal persistence in `AnalyticsPanelProvider`:
   - Local storage via VS Code `globalState` (Memento)
   - Optimistic UI updates (immediate local state change, async server sync)
   - Coaching cache for offline mode support
   - Message handlers for coaching refresh and tip dismissal

6. **Sidebar Integration**: Updated `SidebarLayout` and `CoachingPanel` to:
   - Pass coaching tips and weak dimensions to CoachingSection
   - Calculate badge count including new coaching format
   - Support both legacy `Suggestion` format and new `CoachingTip` format for backward compatibility

7. **Type Export Resolution**: Resolved TypeScript conflicts:
   - Renamed `PromptSuggestion` to `CoachingPromptSuggestion` in coaching.ts to avoid conflict with analytics
   - Removed old `CoachingTip` interface from index.ts (kept new detailed version from coaching.ts)

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-24 | Implemented Story 19-5: Quick Coaching Tips | Claude Opus 4.5 |

### File List

**Created:**
- `packages/vscode-extension/src/types/coaching.ts` - Core coaching type definitions
- `packages/vscode-extension/webviews/components/tip-card.tsx` - Individual tip card component
- `packages/vscode-extension/webviews/components/weak-dimension-alert.tsx` - Weak dimension alert component
- `packages/vscode-extension/webviews/components/empty-coaching.tsx` - Empty state component
- `packages/vscode-extension/webviews/components/coaching-section.tsx` - Main coaching section container

**Modified:**
- `packages/vscode-extension/src/types/index.ts` - Added coaching type exports
- `packages/vscode-extension/src/types/messages.ts` - Added coaching message types
- `packages/vscode-extension/src/services/api.ts` - Added getCoachingTips and dismissTip methods
- `packages/vscode-extension/src/providers/analyticsPanel.ts` - Added coaching state and handlers
- `packages/vscode-extension/webviews/components/index.ts` - Exported new coaching components
- `packages/vscode-extension/webviews/components/prompt-detail.tsx` - Enhanced suggestions display
- `packages/vscode-extension/webviews/sidebar/coaching-panel.tsx` - Added coaching tips support
- `packages/vscode-extension/webviews/sidebar/layout.tsx` - Added coaching props and handlers
