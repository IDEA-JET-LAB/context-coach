# Story 21.12: Team Intelligence Analytics

Status: Complete

## Story

**As a** team lead or admin using Contextor,
**I want** aggregated team-level analytics and intelligence,
**So that** I can understand team prompting patterns, identify common struggles, share best practices, and coach team members.

## Acceptance Criteria

1. **Given** a team admin navigates to team analytics
   **When** the page loads
   **Then** team summary shows: team size, active users, total prompts, total sessions, avg prompt score, and week-over-week change

2. **Given** team work style data is aggregated
   **When** displayed
   **Then** a distribution chart shows how the team distributes across 10 work style categories

3. **Given** team member data is analyzed
   **When** persona distribution is calculated
   **Then** a chart shows count of architects, firefighters, craftsmen, and explorers

4. **Given** team sentiment data is aggregated
   **When** displayed
   **Then** team politeness ratio and frustration trend are shown

5. **Given** team session health is calculated
   **When** displayed
   **Then** avg health score, healthy session rate, and context usage are shown

6. **Given** individual member performance data
   **When** top performers are identified
   **Then** up to 5 top performers are shown for metrics: prompt quality, efficiency, session health

7. **Given** team-wide patterns are analyzed
   **When** common struggles are identified
   **Then** issues affecting >20% of team members are listed with suggestions

8. **Given** high-performing patterns are identified
   **When** best practices are extracted
   **Then** patterns used by top performers are highlighted with impact descriptions

9. **Given** team analytics are viewed
   **When** time range is changed
   **Then** all team visualizations update to the selected period (7d, 30d, 90d)

10. **Given** team data is requested
    **When** user is not a team admin
    **Then** they can view team aggregates but not individual member details

## Tasks / Subtasks

- [x] **Task 1: Database Schema** (AC: #1, #2, #4, #5)
  - [x] Create `team_daily_analytics` table
  - [x] Add columns: team_id, date, total_prompts, total_sessions, avg_prompt_score, avg_session_health, work_style_distribution, sentiment_distribution, active_users
  - [x] Add unique constraint on (team_id, date)
  - [x] Add indexes and enable RLS

- [x] **Task 2: Create Team Aggregation Function** (AC: #1)
  - [x] Create SQL function `aggregate_team_daily_analytics(target_date)`
  - [x] Aggregate from user_daily_analytics for team members
  - [x] Sum counts, average scores
  - [x] Aggregate JSONB distributions
  - [x] Schedule daily cron job (00:10 UTC)

- [x] **Task 3: Create Team Intelligence API** (AC: #1-9)
  - [x] Create `GET /api/analytics/team/:teamId/intelligence` endpoint
  - [x] Accept timeRange query param
  - [x] Return TeamIntelligenceResponse
  - [x] Implement 15-minute cache

- [x] **Task 4: Implement Team Summary Calculation** (AC: #1)
  - [x] Calculate team size from team_members
  - [x] Calculate active users from analytics
  - [x] Sum totals and calculate averages
  - [x] Calculate week-over-week changes

- [x] **Task 5: Implement Style and Persona Distribution** (AC: #2, #3)
  - [x] Aggregate work style counts from team members
  - [x] Calculate persona distribution from individual profiles
  - [x] Return as chart-ready data structures

- [x] **Task 6: Implement Top Performers Identification** (AC: #6)
  - [x] Query user_daily_analytics for team members
  - [x] Rank by prompt quality, efficiency, session health
  - [x] Return top 5 for each metric (with user names)
  - [x] Respect privacy settings (admin only)

- [x] **Task 7: Implement Common Struggles Detection** (AC: #7)
  - [x] Analyze patterns across team members
  - [x] Identify issues affecting >20% of team
  - [x] Generate severity levels (low, medium, high)
  - [x] Provide actionable suggestions

- [x] **Task 8: Implement Best Practices Extraction** (AC: #8)
  - [x] Identify patterns from top performers
  - [x] Correlate patterns with high scores
  - [x] Generate impact descriptions
  - [x] Include example counts

- [x] **Task 9: RLS Policies** (AC: #10)
  - [x] Team members can view aggregated team stats
  - [x] Team admins can view individual member data
  - [x] Non-members cannot access team data
  - [x] Service role bypasses for aggregation

- [x] **Task 10: Create Team Intelligence Dashboard** (AC: #1-9)
  - [x] Integrated into `/app/(dashboard)/team/page.tsx` with view toggle
  - [x] Create team-specific chart components
  - [x] Implement time range filter
  - [x] Handle admin vs member view

- [x] **Task 11: Testing** (AC: #1-10)
  - [x] Write unit tests for aggregation logic (47 tests)
  - [x] Write unit tests for top performers calculation
  - [x] Write unit tests for struggles detection
  - [x] Write E2E tests for dashboard
  - [x] Test RLS policies for different roles

## Dev Notes

### TeamIntelligenceResponse Interface

```typescript
interface TeamIntelligenceResponse {
  summary: {
    teamSize: number;
    activeUsers: number;
    totalPrompts: number;
    totalSessions: number;
    avgPromptScore: number;
    scoreChange: number | null;
  };
  styleDistribution: Record<WorkStyleCategory, number>;
  personaDistribution: Record<TechnicalPersona, number>;
  sentimentHealth: {
    teamPoliteRate: number;
    teamFrustratedRate: number;
    politenessRatio: number;
    trend: 'improving' | 'stable' | 'declining';
  };
  sessionHealth: {
    avgHealthScore: number;
    healthySessionRate: number;
    avgContextUsage: number;
  };
  topPerformers: Array<{
    userId: string;
    userName: string;
    metric: 'prompt_quality' | 'efficiency' | 'session_health';
    value: number;
    rank: number;
  }>;
  commonStruggles: Array<{
    issue: string;
    affectedPercent: number;
    severity: 'low' | 'medium' | 'high';
    suggestion: string;
  }>;
  bestPractices: Array<{
    pattern: string;
    exemplarCount: number;
    impact: string;
    examples: string[];
  }>;
  weekOverWeek: {
    promptScoreChange: number;
    efficiencyChange: number;
    frustrationChange: number;
  };
}
```

### Database Schema

```sql
CREATE TABLE team_daily_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_prompts INTEGER NOT NULL DEFAULT 0,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  avg_prompt_score DECIMAL(4,2),
  avg_session_health DECIMAL(4,2),
  work_style_distribution JSONB,
  sentiment_distribution JSONB,
  active_users INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_team_date UNIQUE (team_id, date)
);

CREATE INDEX idx_team_daily_team ON team_daily_analytics(team_id);
CREATE INDEX idx_team_daily_date ON team_daily_analytics(date);
CREATE INDEX idx_team_daily_team_date ON team_daily_analytics(team_id, date DESC);
```

### Aggregation SQL Function

```sql
CREATE OR REPLACE FUNCTION aggregate_team_daily_analytics(target_date DATE)
RETURNS INTEGER AS $$
DECLARE
  rows_affected INTEGER := 0;
BEGIN
  DELETE FROM team_daily_analytics WHERE date = target_date;

  INSERT INTO team_daily_analytics (
    team_id, date, total_prompts, total_sessions,
    avg_prompt_score, avg_session_health,
    work_style_distribution, sentiment_distribution, active_users
  )
  SELECT
    tm.team_id,
    target_date,
    COALESCE(SUM(uda.total_prompts), 0)::INTEGER,
    COALESCE(SUM(uda.total_sessions), 0)::INTEGER,
    AVG(uda.avg_prompt_score),
    AVG(uda.avg_session_health),
    -- Aggregate work style distributions
    (
      SELECT jsonb_object_agg(key, total)
      FROM (
        SELECT key, SUM(value::INTEGER) as total
        FROM user_daily_analytics u2
        JOIN team_members tm2 ON tm2.user_id::TEXT = u2.user_id
        CROSS JOIN LATERAL jsonb_each_text(u2.work_style_distribution)
        WHERE tm2.team_id = tm.team_id AND u2.date = target_date
        GROUP BY key
      ) sub
    ),
    jsonb_build_object(
      'polite', SUM((uda.sentiment_distribution->>'polite')::INTEGER),
      'frustrated', SUM((uda.sentiment_distribution->>'frustrated')::INTEGER),
      'neutral', SUM((uda.sentiment_distribution->>'neutral')::INTEGER),
      'directive', SUM((uda.sentiment_distribution->>'directive')::INTEGER)
    ),
    COUNT(DISTINCT uda.user_id)::INTEGER
  FROM team_members tm
  LEFT JOIN user_daily_analytics uda ON uda.user_id = tm.user_id::TEXT
    AND uda.date = target_date
  GROUP BY tm.team_id;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### RLS Policies

```sql
ALTER TABLE team_daily_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view team daily analytics" ON team_daily_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_daily_analytics.team_id
        AND tm.user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Service role can manage team daily analytics" ON team_daily_analytics
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
```

### Common Struggles Detection Logic

```typescript
interface StrugglePattern {
  condition: (metrics: UserMetrics) => boolean;
  issue: string;
  suggestion: string;
  severity: 'low' | 'medium' | 'high';
}

const STRUGGLE_PATTERNS: StrugglePattern[] = [
  {
    condition: (m) => m.frustrationRate > 0.1,
    issue: 'High frustration in prompts',
    suggestion: 'Encourage shorter sessions and clearer initial requirements',
    severity: 'high',
  },
  {
    condition: (m) => m.contextExhaustionRate > 0.3,
    issue: 'Frequent context exhaustion',
    suggestion: 'Train team on context management and session planning',
    severity: 'medium',
  },
  // ... more patterns
];
```

### Best Practices Detection Logic

```typescript
interface BestPractice {
  pattern: string;
  detector: (metrics: UserMetrics) => boolean;
  impact: string;
}

const BEST_PRACTICES: BestPractice[] = [
  {
    pattern: 'High prompt clarity scores',
    detector: (m) => m.avgPromptScore > 85,
    impact: 'Leads to 40% fewer follow-up prompts',
  },
  {
    pattern: 'Regular testing prompts',
    detector: (m) => m.testingRatio > 0.15,
    impact: 'Reduces debugging cycles by 50%',
  },
  // ... more practices
];
```

### Caching Strategy

```typescript
const CACHE_CONFIG = {
  teamIntelligence: {
    staleTime: 15 * 60 * 1000,    // 15 minutes
    gcTime: 60 * 60 * 1000,       // 1 hour
  },
};
```

### Privacy Considerations

- Individual member data only visible to admins
- Aggregated team data visible to all members
- Top performers list requires admin role
- User can opt-out of leaderboards (future)

### Dependencies

- Stories 21.1-21.10 for underlying analytics
- Story 21.11 for shared visualization components
- User daily analytics aggregation
- Team membership and roles


## Design System Requirements

**MANDATORY:** This story MUST use existing design system components exclusively.

### Pre-Implementation Checklist
- [x] Reviewed `_bmad-output/DESIGN-SYSTEM-MANDATE.md` for component inventory
- [x] Checked `/design` route for component examples
- [x] Identified required components from the inventory below
- [x] Confirmed no hardcoded colors - using semantic tokens only
- [x] No new UI patterns needed (or Design Epic story created)

### Required Components
- MetricCard from `components/analytics/metric-card`
- TrendIndicator from `components/analytics/trend-indicator`
- Skeleton from `components/ui/skeleton`
- Recharts BarChart, PieChart for visualizations
- Semantic tokens: `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`

### Styling Rules
- [x] NO hardcoded colors (no `bg-zinc-*`, `text-gray-*`, etc.)
- [x] Use existing components from `components/` directory
- [x] Extend existing components before creating new ones

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List
1. Created full team intelligence analytics system with 47 unit tests passing
2. Integrated into team page with view mode toggle (Intelligence vs Standard)
3. Dashboard shows summary stats, work style distribution, persona pie chart, sentiment/session health, top performers (admin only), common struggles, and best practices
4. API endpoint at `/api/analytics/team/[teamId]/intelligence` with 15-minute cache
5. E2E tests created covering view toggle, navigation, API responses, and dashboard content
6. All lint and TypeScript checks pass

### Change Log
| Date | Change | Author |
|------|--------|--------|
| 2025-12-23 | Initial implementation of Story 21-12 | Claude Opus 4.5 |

### File List
**Created:**
- `app/supabase/migrations/20251223200000_create_team_daily_analytics.sql` - Database schema and aggregation functions
- `app/lib/types/team-intelligence.ts` - TypeScript interfaces
- `app/lib/analytics/team-intelligence.ts` - Service functions for team intelligence
- `app/app/api/analytics/team/[teamId]/intelligence/route.ts` - API endpoint
- `app/lib/hooks/use-team-intelligence.ts` - React Query hook
- `app/components/analytics/team-intelligence-dashboard.tsx` - Dashboard component
- `app/lib/analytics/__tests__/team-intelligence.test.ts` - Unit tests (47 tests)
- `app/e2e/team-intelligence.spec.ts` - E2E tests

**Modified:**
- `app/app/(dashboard)/team/page.tsx` - Added view mode toggle for Intelligence/Standard
- `app/components/analytics/index.ts` - Added TeamIntelligenceDashboard export
