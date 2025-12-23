# Story D-8: Apply Component Library to Existing UI

Status: Ready for Dev

## Story

**As a** user of the Contextor platform,
**I want** a consistent, polished interface across all screens,
**So that** I have a cohesive experience and can easily learn the UI patterns.

## Background

Story D-3 created 30+ reusable components for Phase 2 features. However, existing screens (built before the component library) use ad-hoc implementations. This story refactors existing pages to use the standardized component library, ensuring visual consistency and reducing code duplication.

## Acceptance Criteria

1. **Given** the analytics page
   **When** this story is complete
   **Then** it uses `MetricCard` for KPI display
   **And** it uses `LineChart`/`BarChart` for data visualization
   **And** it uses `TrendIndicator` for trend arrows
   **And** it uses `Sparkline` for inline trends

2. **Given** the prompt detail page
   **When** this story is complete
   **Then** it uses `InsightCard` for coaching feedback
   **And** it uses `Gauge` for dimension scores
   **And** it uses `CodeBlock` for prompt/response display

3. **Given** the home/dashboard page
   **When** this story is complete
   **Then** it uses `MetricCard` for summary stats
   **And** it uses `Sparkline` for quick trends
   **And** empty states use `EmptyState` variants

4. **Given** all pages with empty states
   **When** this story is complete
   **Then** they use appropriate `EmptyState` variants
   **And** empty states are consistent across the app

5. **Given** all pages with user feedback
   **When** this story is complete
   **Then** toast notifications use `showToast` utility
   **And** inline messages use `InlineAlert`
   **And** destructive actions use `ConfirmationModal`

6. **Given** the team analytics page
   **When** this story is complete
   **Then** it uses `ComparisonBar` for user vs team comparisons
   **And** it uses `DimensionRadar` for team skill profiles

## Tasks / Subtasks

- [ ] **Task 1: Refactor Analytics Page** (AC: #1)
  - [ ] Replace custom stat cards with `MetricCard`
  - [ ] Replace custom charts with `LineChart`/`BarChart`
  - [ ] Add `TrendIndicator` to metrics
  - [ ] Add `Sparkline` for inline trend display
  - [ ] Update empty state to use `NoAnalyticsDataEmptyState`

- [ ] **Task 2: Refactor Prompt Detail Page** (AC: #2)
  - [ ] Replace coaching feedback display with `InsightCard`
  - [ ] Replace dimension score display with `Gauge` components
  - [ ] Replace code/prompt display with `CodeBlock`
  - [ ] Add `DimensionRadar` for 5-dimension visualization

- [ ] **Task 3: Refactor Home/Dashboard Page** (AC: #3)
  - [ ] Replace summary stats with `MetricCard`
  - [ ] Add `Sparkline` components for recent activity
  - [ ] Update onboarding empty state

- [ ] **Task 4: Standardize Empty States** (AC: #4)
  - [ ] Audit all pages for empty states
  - [ ] Replace with appropriate `EmptyState` variants:
    - Feed: `NoPromptsEmptyState`
    - Search results: `NoSearchResultsEmptyState`
    - Team page: `NoTeamMembersEmptyState`
    - Analytics: `NoAnalyticsDataEmptyState`
  - [ ] Create any new variants needed

- [ ] **Task 5: Standardize Feedback Patterns** (AC: #5)
  - [ ] Replace all `toast()` calls with `showToast.*` methods
  - [ ] Replace inline error/success messages with `InlineAlert`
  - [ ] Audit destructive actions (delete, leave team, etc.)
  - [ ] Add `ConfirmationModal` to destructive actions

- [ ] **Task 6: Refactor Team Analytics** (AC: #6)
  - [ ] Add `ComparisonBar` for user vs team metrics
  - [ ] Add `DimensionRadar` for team skill visualization
  - [ ] Use `MetricCard` for team KPIs

- [ ] **Task 7: Refactor Admin Pages** (AC: #1, #4, #5)
  - [ ] Admin dashboard: use `MetricCard` for system stats
  - [ ] Admin pages: use `InlineAlert` for status messages
  - [ ] Admin actions: use `ConfirmationModal` for destructive ops

## Pages to Refactor

| Page | Key Components to Apply |
|------|------------------------|
| `/home` | MetricCard, Sparkline, EmptyState |
| `/analytics` | MetricCard, LineChart, BarChart, TrendIndicator, Sparkline |
| `/prompts` | EmptyState (NoPromptsEmptyState) |
| `/prompts/[id]` | InsightCard, Gauge, CodeBlock, DimensionRadar |
| `/team` | EmptyState (NoTeamMembersEmptyState), ConfirmationModal |
| `/teams/[id]/settings` | InlineAlert, ConfirmationModal |
| `/projects` | EmptyState |
| `/projects/[id]` | MetricCard, Sparkline |
| `/settings` | InlineAlert, ConfirmationModal |
| `/admin` | MetricCard, InlineAlert |
| `/admin/users` | ConfirmationModal |
| `/admin/teams` | ConfirmationModal |
| `/admin/system` | MetricCard, InlineAlert |

## Component Mapping

| Current Pattern | Replace With |
|-----------------|--------------|
| Custom stat card with icon | `MetricCard` |
| Hardcoded trend arrows | `TrendIndicator` |
| Custom mini charts | `Sparkline` |
| recharts direct usage | `LineChart`, `BarChart` |
| Custom score display | `Gauge` |
| Custom feedback cards | `InsightCard` |
| Custom code display | `CodeBlock` |
| Custom empty states | `EmptyState` variants |
| `toast()` from sonner | `showToast.*` methods |
| Custom alert boxes | `InlineAlert` |
| Custom confirm dialogs | `ConfirmationModal` |
| Custom comparison bars | `ComparisonBar` |
| Custom radar charts | `DimensionRadar` |

## Dev Notes

### Import Pattern

```typescript
// Charts
import { LineChart, BarChart, Gauge, Sparkline, Heatmap } from '@/components/charts';

// Analytics
import { MetricCard, TrendIndicator, ComparisonBar, InsightCard, DimensionRadar } from '@/components/analytics';

// Feedback
import {
  showToast,
  InlineAlert,
  ConfirmationModal,
  EmptyState,
  NoPromptsEmptyState,
  NoAnalyticsDataEmptyState
} from '@/components/feedback';

// Forms (if needed)
import { CodeBlock } from '@/components/forms';
```

### Migration Strategy

1. Start with high-traffic pages (analytics, prompt detail)
2. Work through each page systematically
3. Test each page after refactoring
4. Keep functionality identical - only change presentation

### Testing Checklist

For each refactored page:
- [ ] Visual appearance matches or improves on original
- [ ] All data displays correctly
- [ ] Interactive elements work (clicks, hovers)
- [ ] Empty states render correctly
- [ ] Loading states work
- [ ] Error states work
- [ ] Mobile/responsive layout works
- [ ] Accessibility (keyboard nav, screen reader)

## Dependencies

- **Depends on:** D-3 (Component Library) - COMPLETED
- **Blocks:** None (this is polish/consistency work)

## Estimated Effort

- **Total:** 8-12 hours
- Task 1 (Analytics): 2-3 hours
- Task 2 (Prompt Detail): 2 hours
- Task 3 (Home): 1 hour
- Task 4 (Empty States): 1 hour
- Task 5 (Feedback): 1-2 hours
- Task 6 (Team Analytics): 1-2 hours
- Task 7 (Admin): 1-2 hours

## References

- Story D-3: Component Library Expansion (components created)
- Component showcase: `/design` route
- Design tokens: `tailwind.config.ts`
