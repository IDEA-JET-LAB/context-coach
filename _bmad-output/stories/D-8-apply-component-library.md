# Story D-8: Apply Component Library to Existing UI

Status: ✅ COMPLETED (2025-12-23)

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

- [x] **Task 1: Refactor Analytics Page** (AC: #1) ✅
  - [x] Replace custom stat cards with `MetricCard`
  - [x] Replace custom charts with `LineChart`/`BarChart`
  - [x] Add `TrendIndicator` to metrics
  - [x] Add `Sparkline` for inline trend display
  - [x] Update empty state to use `NoAnalyticsDataEmptyState`

- [x] **Task 2: Refactor Prompt Detail Page** (AC: #2) ✅
  - [x] Replace coaching feedback display with `InsightCard`
  - [x] Replace dimension score display with `Gauge` components
  - [x] Replace code/prompt display with `CodeBlock`
  - [x] Add `DimensionRadar` for 5-dimension visualization

- [x] **Task 3: Refactor Home/Dashboard Page** (AC: #3) ✅
  - [x] Replace summary stats with `MetricCard`
  - [x] Add `Sparkline` components for recent activity
  - [x] Update onboarding empty state

- [x] **Task 4: Standardize Empty States** (AC: #4) ✅
  - [x] Audit all pages for empty states
  - [x] Replace with appropriate `EmptyState` variants:
    - Feed: `NoPromptsEmptyState`
    - Search results: `NoSearchResultsEmptyState`
    - Team page: `NoTeamMembersEmptyState`
    - Analytics: `NoAnalyticsDataEmptyState`
  - [x] Create any new variants needed

- [x] **Task 5: Standardize Feedback Patterns** (AC: #5) ✅
  - [x] Replace all `toast()` calls with `showToast.*` methods
  - [x] Replace inline error/success messages with `InlineAlert`
  - [x] Audit destructive actions (delete, leave team, etc.)
  - [x] Add `ConfirmationModal` to destructive actions

- [x] **Task 6: Refactor Team Analytics** (AC: #6) ✅
  - [x] Add `ComparisonBar` for user vs team metrics
  - [x] Add `DimensionRadar` for team skill visualization
  - [x] Use `MetricCard` for team KPIs

- [x] **Task 7: Refactor Admin Pages** (AC: #1, #4, #5) ✅
  - [x] Admin dashboard: use `MetricCard` for system stats
  - [x] Admin pages: use `InlineAlert` for status messages
  - [x] Admin actions: use `ConfirmationModal` for destructive ops

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

---

## Implementation Notes (2025-12-23)

### Execution Strategy

Used 5 parallel Opus subagents to complete all 7 tasks simultaneously:
- **Agent 1**: Tasks 1+6 (Analytics + Team Analytics)
- **Agent 2**: Task 2 (Prompt Detail Page)
- **Agent 3**: Task 3 (Home/Dashboard Page)
- **Agent 4**: Tasks 4+5 (Empty States + Feedback Patterns)
- **Agent 5**: Task 7 (Admin Pages)

### Key Files Modified

#### Analytics Components
- `app/components/analytics/summary-stats.tsx` - StatCard → MetricCard
- `app/components/analytics/score-trend-chart.tsx` - Added TrendIndicator
- `app/components/analytics/analytics-dashboard.tsx` - showToast, NoAnalyticsDataEmptyState
- `app/components/analytics/team-admin-analytics.tsx` - MetricCard, ComparisonBar
- `app/components/analytics/team-summary.tsx` - DimensionRadar
- `app/components/analytics/dimension-breakdown.tsx` - Gauge components

#### Prompt Detail Components
- `app/components/prompt-detail/dimension-card.tsx` - Gauge, InsightCard
- `app/components/prompt-detail/prompt-detail-view.tsx` - CodeBlock, DimensionRadar

#### Home Page
- `app/app/(dashboard)/home/page.tsx` - MetricCard for stats

#### Empty States (standardized to use component library)
- `app/components/feed/empty-prompt-feed.tsx` → NoPromptsEmptyState
- `app/components/feed/filtered-empty-state.tsx` → EmptyState (search variant)
- `app/components/feed/empty-feed.tsx` → NoPromptsEmptyState
- `app/components/team/empty-team.tsx` → NoTeamMembersEmptyState
- `app/components/analytics/analytics-empty-state.tsx` → EmptyState (analytics)
- `app/components/analytics/empty-analytics.tsx` → EmptyState (analytics)
- `app/components/projects/empty-projects.tsx` → EmptyState (folder)
- `app/components/admin/config-list.tsx` → EmptyState

#### Toast Migrations (toast → showToast)
- `app/components/settings/email-change-form.tsx`
- `app/components/settings/password-change-form.tsx`
- `app/components/settings/settings-message-handler.tsx`
- `app/components/settings/profile-form.tsx`
- `app/components/marketing/account-deleted-handler.tsx`
- `app/components/onboarding/cli-instructions.tsx`
- `app/components/auth/auth-error-toast.tsx`
- `app/components/auth/access-denied-handler.tsx`
- `app/components/projects/regenerate-key-dialog.tsx`
- `app/components/team-settings/link-invite-form.tsx`
- `app/components/admin/config-version-card.tsx`
- `app/components/admin/dead-letter-queue.tsx`
- `app/components/admin/analysis-config-form.tsx`
- `app/components/admin/config-detail-view.tsx`
- `app/components/feed/analysis-failed.tsx`
- `app/lib/hooks/use-switch-team.ts`
- `app/lib/hooks/use-invitations.ts`
- `app/lib/hooks/use-create-project.ts`
- `app/lib/hooks/use-create-team.ts`
- `app/lib/hooks/use-archive-project.ts`
- `app/lib/hooks/use-update-team.ts`
- `app/lib/hooks/use-team-members.ts`
- `app/lib/hooks/use-update-project.ts`
- `app/app/(auth)/join/[token]/page.tsx`

#### ConfirmationModal Additions
- `app/components/team/team-members-list.tsx` - Member removal
- `app/components/admin/config-version-card.tsx` - Config deletion
- `app/components/admin/user-actions.tsx` - User disable/enable (already had ConfirmationModal)

#### Admin Pages
- `app/app/(dashboard)/admin/users/[id]/page.tsx` - MetricCard
- `app/app/(dashboard)/admin/teams/page.tsx` - InlineAlert
- `app/app/(dashboard)/admin/teams/[id]/page.tsx` - MetricCard
- `app/app/(dashboard)/admin/config/page.tsx` - MetricCard

### Build Status

✅ Build successful - all routes compile without errors
