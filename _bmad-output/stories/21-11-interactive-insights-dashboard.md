# Story 21.11: Interactive Insights Dashboard

Status: Ready

## Story

**As a** developer using Contextor,
**I want** an interactive dashboard displaying all my enhanced analytics,
**So that** I can visualize my prompting patterns, track progress, and receive personalized recommendations.

## Acceptance Criteria

1. **Given** a user navigates to the insights dashboard
   **When** the page loads
   **Then** summary cards show: total prompts, total sessions, avg session duration, and overall score with change indicator

2. **Given** the dashboard is loaded
   **When** work style data is available
   **Then** a radar chart displays distribution across 10 work style categories

3. **Given** sentiment data is available
   **When** displayed
   **Then** a timeline chart shows polite/frustrated/neutral sentiment trends over time

4. **Given** session health data is available
   **When** displayed
   **Then** a trend chart shows health score over sessions with healthy/warning/critical indicators

5. **Given** tool usage data is available
   **When** displayed
   **Then** a bar chart shows tool distribution with top tools and underutilized tools highlighted

6. **Given** learning progression data is available
   **When** displayed
   **Then** a week-over-week chart shows improvements and achievements are displayed

7. **Given** efficiency metrics are calculated
   **When** displayed
   **Then** a comparison panel shows current week vs previous week with benchmark indicators

8. **Given** all analytics are processed
   **When** tips are generated
   **Then** personalized improvement suggestions are shown based on user patterns

9. **Given** any analytics section
   **When** a time range filter is changed (7d, 30d, 90d)
   **Then** all visualizations update to reflect the selected period

10. **Given** the dashboard loads
    **When** data is fetched
    **Then** initial load completes within 300ms with appropriate loading states

11. **Given** activity timing data is available
    **When** displayed
    **Then** a heat map visualization shows prompt activity by hour-of-day (rows) vs day-of-week (columns) with color intensity indicating activity level

12. **Given** a user is part of a team
    **When** viewing the dashboard
    **Then** a team comparison visualization shows individual metrics alongside team averages with clear visual indicators for above/below average performance

13. **Given** the dashboard is accessed
    **When** weekly data is available
    **Then** a weekly insights report summary section displays key highlights, notable changes, and achievements from the past 7 days in a digestible format

## Tasks / Subtasks

- [ ] **Task 1: Create Insights API Endpoint** (AC: #1, #10)
  - [ ] Create `GET /api/analytics/insights` endpoint
  - [ ] Accept query params: userId, timeRange (7d, 30d, 90d, all)
  - [ ] Return comprehensive InsightsResponse object
  - [ ] Implement caching with 5-minute stale time
  - [ ] Target <200ms response time

- [ ] **Task 2: Create Summary Cards Component** (AC: #1)
  - [ ] Create `/app/components/analytics/insights/summary-cards.tsx`
  - [ ] Display total prompts, sessions, avg duration, overall score
  - [ ] Show change indicators (up/down arrows with percentages)
  - [ ] Use skeleton loading states

- [ ] **Task 3: Create Work Style Radar Chart** (AC: #2)
  - [ ] Create `/app/components/analytics/insights/work-style-radar.tsx`
  - [ ] Use Recharts RadarChart component
  - [ ] Display all 10 work style categories
  - [ ] Highlight primary and secondary styles
  - [ ] Include persona badge

- [ ] **Task 4: Create Sentiment Timeline** (AC: #3)
  - [ ] Create `/app/components/analytics/insights/sentiment-timeline.tsx`
  - [ ] Use Recharts LineChart or AreaChart
  - [ ] Show polite, frustrated, neutral trends over time
  - [ ] Color code by sentiment (green, red, gray)
  - [ ] Include trend direction indicator

- [ ] **Task 5: Create Session Health Trend** (AC: #4)
  - [ ] Create `/app/components/analytics/insights/session-health-trend.tsx`
  - [ ] Use Recharts AreaChart with gradient fill
  - [ ] Show health score progression
  - [ ] Add reference lines at 75 (healthy) and 50 (warning)
  - [ ] Color zones for healthy/warning/critical

- [ ] **Task 6: Create Tool Usage Chart** (AC: #5)
  - [ ] Create `/app/components/analytics/insights/tool-usage-chart.tsx`
  - [ ] Use Recharts BarChart (horizontal)
  - [ ] Sort by usage count
  - [ ] Highlight top 3 tools
  - [ ] Mark underutilized tools with icon
  - [ ] Show user profile classification

- [ ] **Task 7: Create Learning Progression Chart** (AC: #6)
  - [ ] Create `/app/components/analytics/insights/learning-progression.tsx`
  - [ ] Use Recharts LineChart for weekly trends
  - [ ] Display achievements as badges/cards
  - [ ] Show improvement percentages
  - [ ] Include 12-week history

- [ ] **Task 8: Create Comparison Panel** (AC: #7)
  - [ ] Create `/app/components/analytics/insights/comparison-panel.tsx`
  - [ ] Side-by-side current vs previous week
  - [ ] Show efficiency metrics with benchmark indicators
  - [ ] Color code improvements (green) and declines (red)

- [ ] **Task 9: Create Personalized Tips Component** (AC: #8)
  - [ ] Create `/app/components/analytics/insights/personalized-tips.tsx`
  - [ ] Display up to 5 prioritized suggestions
  - [ ] Base tips on current weaknesses
  - [ ] Include actionable advice
  - [ ] Add "dismiss" functionality (optional)

- [ ] **Task 10: Create Time Range Filter** (AC: #9)
  - [ ] Create `/app/components/analytics/insights/time-range-filter.tsx`
  - [ ] Options: 7d, 30d, 90d, All time
  - [ ] Persist selection in URL params
  - [ ] Trigger data refetch on change

- [ ] **Task 11: Create Main Dashboard Page** (AC: #1-13)
  - [ ] Create `/app/app/(app)/analytics/insights/page.tsx`
  - [ ] Use React Query with useEnhancedPersonalAnalytics hook
  - [ ] Implement responsive grid layout
  - [ ] Include all visualization components (summary, charts, heat map, team comparison, weekly report)
  - [ ] Handle loading and error states
  - [ ] Add page title and description

- [ ] **Task 12: Create React Query Hook** (AC: #10)
  - [ ] Create `/app/lib/hooks/use-enhanced-analytics.ts`
  - [ ] Implement `useEnhancedPersonalAnalytics(timeRange)` hook
  - [ ] Configure cache with 5-minute stale time
  - [ ] Handle error states and retries

- [ ] **Task 13: Create Activity Heat Map Component** (AC: #11)
  - [ ] Create `/app/components/analytics/insights/activity-heat-map.tsx`
  - [ ] Display 7 columns (Mon-Sun) by 24 rows (hours)
  - [ ] Use color intensity scale (light to dark) based on activity count
  - [ ] Include axis labels for days and hours
  - [ ] Add tooltip showing exact count on hover
  - [ ] Handle empty cells gracefully

- [ ] **Task 14: Create Team Comparison Visualization** (AC: #12)
  - [ ] Create `/app/components/analytics/insights/team-comparison.tsx`
  - [ ] Fetch team averages from `/api/analytics/team-averages` endpoint
  - [ ] Display side-by-side comparison for key metrics
  - [ ] Use visual indicators (arrows, colors) for above/below average
  - [ ] Show percentile rank within team
  - [ ] Handle non-team users (hide or show placeholder)

- [ ] **Task 15: Create Weekly Insights Report Summary** (AC: #13)
  - [ ] Create `/app/components/analytics/insights/weekly-report-summary.tsx`
  - [ ] Display top 3-5 highlights from the past week
  - [ ] Show notable changes (biggest improvements, declines)
  - [ ] List achievements unlocked during the week
  - [ ] Include quick comparison to previous week
  - [ ] Format as easily scannable cards or bullet points

- [ ] **Task 16: Testing** (AC: #1-13)
  - [ ] Write Playwright E2E tests for dashboard load
  - [ ] Test time range filter changes
  - [ ] Test loading states
  - [ ] Test empty data states
  - [ ] Test responsiveness on mobile/tablet
  - [ ] Test heat map interactions
  - [ ] Test team comparison with/without team membership
  - [ ] Test weekly report summary content

## Dev Notes

### InsightsResponse Interface

```typescript
interface InsightsResponse {
  summary: {
    totalPrompts: number;
    totalSessions: number;
    avgSessionDurationMinutes: number;
    avgPromptScore: number | null;
    scoreChange: number | null;
  };
  workStyle: {
    distribution: Record<WorkStyleCategory, number>;
    primaryStyle: WorkStyleCategory;
    secondaryStyle: WorkStyleCategory | null;
  };
  technicalProfile: {
    persona: TechnicalPersona;
    confidence: number;
    breakdown: { ... };
  };
  sentiment: {
    overallPoliteRate: number;
    overallFrustratedRate: number;
    politenessRatio: number;  // Ratio of polite to total prompts
    trend: 'improving' | 'stable' | 'declining';
    byWorkStyle: Record<WorkStyleCategory, { politeRate: number; frustratedRate: number }>;
  };
  sessionHealth: {
    avgHealthScore: number;
    healthDistribution: { healthy: number; warning: number; critical: number };
    avgSessionDuration: number;
    contextExhaustionRate: number;
  };
  complexity: {
    avgComplexity: number;
    avgCharsPerPrompt: number;  // Average character count per prompt
    distribution: { simple: number; moderate: number; complex: number };
    codeInclusionRate: number;
  };
  timing: {
    rapidFireRate: number;
    longPauseRate: number;
    followUpRate: number;
    avgGapSeconds: number;
    medianGapSeconds: number;  // Median gap between prompts (less skewed by outliers)
  };
  toolUsage: {
    distribution: Record<string, number>;
    topTools: string[];
    underutilized: string[];
    userProfile: string;
  };
  learning: LearningProgression;
  efficiency: EfficiencyMetrics;
  personalizedTips: string[];
  activityHeatMap: {
    // 2D array: [dayOfWeek 0-6][hourOfDay 0-23] = count
    data: number[][];
    maxCount: number;  // For color scale normalization
    totalActiveHours: number;
    peakHour: number;
    peakDay: number;
  };
  teamComparison: {
    isTeamMember: boolean;
    teamAverages: {
      avgPromptScore: number;
      avgSessionDuration: number;
      avgPromptsPerSession: number;
      avgComplexity: number;
    } | null;
    userPercentiles: {
      promptScore: number;  // 0-100 percentile rank
      sessionDuration: number;
      promptsPerSession: number;
      complexity: number;
    } | null;
    comparison: {
      metric: string;
      userValue: number;
      teamAverage: number;
      difference: number;
      isAboveAverage: boolean;
    }[] | null;
  };
  weeklyReport: {
    weekStartDate: string;
    weekEndDate: string;
    highlights: string[];
    notableChanges: {
      metric: string;
      previousValue: number;
      currentValue: number;
      changePercent: number;
      isImprovement: boolean;
    }[];
    achievementsUnlocked: {
      id: string;
      name: string;
      description: string;
      unlockedAt: string;
    }[];
    comparisonToPreviousWeek: {
      totalPrompts: { current: number; previous: number; change: number };
      avgScore: { current: number; previous: number; change: number };
      sessionCount: { current: number; previous: number; change: number };
    };
  };
}
```

### Component Layout

```
+------------------------------------------+
|  Weekly Insights Report Summary          |
+------------------------------------------+
|  Summary Cards (4 cards in row)          |
+------------------------------------------+
|  Time Range Filter                       |
+------------------------------------------+
|  Work Style Radar   |  Sentiment Timeline|
|                     |                    |
+---------------------+--------------------+
|  Session Health     |  Tool Usage        |
|  Trend              |  Chart             |
+---------------------+--------------------+
|  Activity Heat Map  |  Team Comparison   |
|  (Hour x Day)       |  (vs Team Avg)     |
+---------------------+--------------------+
|  Learning Progression Chart              |
+------------------------------------------+
|  Comparison Panel (This Week vs Last)    |
+------------------------------------------+
|  Personalized Tips                       |
+------------------------------------------+
```

### React Query Configuration

```typescript
const CACHE_CONFIG = {
  personalInsights: {
    staleTime: 5 * 60 * 1000,     // 5 minutes
    gcTime: 30 * 60 * 1000,       // 30 minutes
  },
};

export function useEnhancedPersonalAnalytics(timeRange: TimeRange) {
  return useQuery({
    queryKey: ['analytics', 'insights', timeRange],
    queryFn: () => fetchInsights(timeRange),
    staleTime: CACHE_CONFIG.personalInsights.staleTime,
    gcTime: CACHE_CONFIG.personalInsights.gcTime,
  });
}
```

### Charting Library

Using Recharts (already likely in project dependencies):
- RadarChart for work styles
- LineChart for trends
- BarChart for tool usage
- AreaChart for session health

### Performance Requirements

- Initial dashboard load: <300ms
- Chart animations: 60fps
- Filter changes: <100ms perceived
- Mobile responsive breakpoints: 640px, 768px, 1024px

### Dependencies

- Stories 21.1-21.10 for data availability
- Story 21.5 (Interaction Timing Analysis) for heat map data
- Story 21.12 (Team Intelligence Analytics) for team comparison data
- Recharts for visualizations
- React Query for data fetching
- Tailwind CSS for styling

### Accessibility

- All charts have aria-labels
- Color contrast meets WCAG AA
- Keyboard navigation for filters
- Screen reader announcements for data changes


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
{{agent_model_name_version}}

### Completion Notes List
*To be filled by dev agent after implementation*

### Change Log
| Date | Change | Author |
|------|--------|--------|

### File List
*To be filled by dev agent - list all files created/modified*
