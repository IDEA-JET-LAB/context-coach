# Story 11.2: Debug Analytics Cards Data Display

Status: review
Estimated Time: 2-4 hours
Priority: P0 (Critical Bug Fix)

## Story

**As a** user viewing my analytics dashboard,
**I want** all analytics cards to display data correctly,
**So that** I can see my average score, improvement percentage, and trends.

## Problem Description

User reports analytics cards show no data (only Total Prompts works).

**Investigation Finding:** Code IS fully implemented for all cards:
- Average Score: `use-personal-analytics.ts:149-152`
- Improvement %: `use-personal-analytics.ts:154-174`
- Score Trend: Chart component working

**Possible Causes (to verify):**
1. No prompts with `analysis_status = 'complete'` in database
2. No `prompt_analyses` records with `overall_score`
3. User ID mismatch between prompts and current user
4. `prompt_type = 'command'` filtering out all prompts

## Acceptance Criteria

1. **Given** I have captured prompts that were analyzed
   **When** I view the Analytics dashboard
   **Then** Average Score card shows my mean score
   **And** Improvement % shows change from previous period
   **And** Score Trend chart displays correctly

2. **Given** I have no analyzed prompts
   **When** I view the Analytics dashboard
   **Then** Cards show appropriate empty states or "No data yet" messages

## Tasks / Subtasks

- [x] **Task 1: Verify data exists in database**
  - [x] Query prompts table for current user
  - [x] Check `analysis_status` distribution (pending/processing/complete/failed)
  - [x] Query `prompt_analyses` table for records with `overall_score`
  - [x] Count prompts by `prompt_type` ('prompt' vs 'command')

- [x] **Task 2: Trace data flow**
  - [x] Add logging to `use-personal-analytics.ts` hook
  - [x] Verify API endpoint returns expected data
  - [x] Check if data transformation is correct
  - [x] Verify component receives data from hook

- [x] **Task 3: Check filtering logic**
  - [x] Review query filtering in analytics hook
  - [x] Ensure `prompt_type = 'command'` prompts are correctly excluded
  - [x] Ensure only `analysis_status = 'complete'` prompts are counted for scores
  - [x] Verify date range filtering (if applicable)

- [x] **Task 4: Test with known data**
  - [x] Create test prompts with known analysis scores
  - [x] Manually insert `prompt_analyses` records if needed
  - [x] Verify calculations match expected values

- [x] **Task 5: Fix identified issue**
  - [x] Implement fix based on diagnosis
  - [x] Add/improve empty state handling
  - [x] Ensure graceful fallback when no data

- [x] **Task 6: Verify fix**
  - [x] Confirm all analytics cards display data
  - [x] Confirm empty states work when no data
  - [x] Test with various data scenarios

## Dev Notes

### Database Queries for Diagnosis

```sql
-- Check prompts for current user
SELECT
  id,
  analysis_status,
  prompt_type,
  created_at
FROM prompts
WHERE user_id = 'your-user-id'
ORDER BY created_at DESC
LIMIT 20;

-- Check if analyses exist
SELECT
  pa.prompt_id,
  pa.overall_score,
  pa.created_at
FROM prompt_analyses pa
JOIN prompts p ON pa.prompt_id = p.id
WHERE p.user_id = 'your-user-id'
ORDER BY pa.created_at DESC;

-- Count by status
SELECT analysis_status, COUNT(*)
FROM prompts
WHERE user_id = 'your-user-id'
GROUP BY analysis_status;

-- Count by type
SELECT prompt_type, COUNT(*)
FROM prompts
WHERE user_id = 'your-user-id'
GROUP BY prompt_type;
```

### Files to Check

| File | Purpose | Key Lines |
|------|---------|-----------|
| `lib/hooks/use-personal-analytics.ts` | Data fetching | 149-174 |
| `components/analytics/summary-stats.tsx` | Card display | All |
| `components/analytics/analytics-dashboard.tsx` | Main component | All |
| `app/api/analytics/personal/route.ts` | API endpoint | If exists |

### Analytics Calculations Reference

```typescript
// Average Score calculation
const averageScore = analyzedPrompts.length > 0
  ? analyzedPrompts.reduce((sum, p) => sum + p.analysis.overall_score, 0) / analyzedPrompts.length
  : null;

// Improvement % calculation
const improvement = previousPeriodAvg > 0
  ? ((currentPeriodAvg - previousPeriodAvg) / previousPeriodAvg) * 100
  : null;
```

### Common Issues

1. **No analyses:** Analysis Edge Function may not be running
2. **All commands:** User only sends slash commands, not prompts
3. **Wrong user:** User ID mismatch between auth and prompts table
4. **Date range:** Default filter may exclude old data

### References

- [Source: _bmad-output/epics.md#Story-11.2]
- [Source: _bmad-output/project-context.md#Analysis-Engine]

## Verification Checklist

- [x] Average Score card displays correct value
- [x] Improvement % card shows trend correctly
- [x] Score Trend chart renders with data points
- [x] Total Prompts card still works
- [x] Empty states display when no data
- [x] No console errors

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

**Root Cause Analysis:**
The investigation revealed that the analytics code was correctly implemented. The issue was that the user had no prompts with `analysis_status = 'complete'` in the database. The analytics hook correctly queries only complete prompts with their analyses, so if no such data exists, the cards appeared empty.

**Key Findings:**
1. **No bug in the code** - The analytics hook (`use-personal-analytics.ts`) correctly:
   - Queries prompts with `analysis_status = 'complete'`
   - Excludes `prompt_type = 'command'`
   - Joins with `prompt_analyses` table for scores
   - Calculates averages and improvements correctly

2. **Test environment issue** - The E2E test helpers were using production Supabase service key (from `.env.local`) when running against local Supabase, causing test data creation to fail silently.

3. **UX improvement needed** - When prompts exist but no analyses are complete, the cards showed "0.00/10" which was confusing to users.

**Fixes Implemented:**

1. **Fixed E2E test helpers** (`e2e/helpers/api.ts`):
   - Added `getServiceRoleKey()` function that uses local Supabase key for local dev
   - Replaced all `process.env.SUPABASE_SERVICE_ROLE_KEY` usages with the helper
   - Tests now work correctly against local Supabase

2. **Improved analytics data interface** (`lib/hooks/use-personal-analytics.ts`):
   - Added `analyzedPrompts` count to distinguish between total prompts and analyzed prompts
   - Changed `avgScore` to return `null` when no analyses exist (instead of 0)
   - Changed `improvement` to return `null` when insufficient data (need 2+ data points)
   - Improvement calculation now requires at least 2 scores for meaningful comparison

3. **Improved analytics cards UI** (`components/analytics/summary-stats.tsx`):
   - Cards now show "N/A" when no data available (instead of "0.00/10")
   - Added contextual hints:
     - "awaiting analysis" - when prompts captured but none analyzed yet
     - "analysis in progress" - when analysis is pending
     - "need more data" - when not enough data points for improvement calculation
   - Trend indicator only shows when improvement is calculable

### Change Log

Files modified:

1. `/Users/edgars/My-projects/2025-projects/DEV/context-coach/app/e2e/helpers/api.ts`
   - Added local Supabase configuration constants
   - Added `getServiceRoleKey()` helper function
   - Updated all API helper functions to use the new helper

2. `/Users/edgars/My-projects/2025-projects/DEV/context-coach/app/lib/hooks/use-personal-analytics.ts`
   - Added `analyzedPrompts` field to `PersonalAnalyticsData` interface
   - Changed `avgScore` type to `number | null`
   - Changed `improvement` type to `number | null`
   - Updated `processAnalyticsData` to return null values when data insufficient

3. `/Users/edgars/My-projects/2025-projects/DEV/context-coach/app/components/analytics/summary-stats.tsx`
   - Updated props interface to accept null values
   - Added logic to display "N/A" for unavailable data
   - Added contextual hints for different data states

4. `/Users/edgars/My-projects/2025-projects/DEV/context-coach/app/components/analytics/analytics-dashboard.tsx`
   - Updated to pass `analyzedPrompts` to `SummaryStats`
