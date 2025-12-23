# Story 21.12: Team Intelligence Analytics

Status: Ready

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

- [ ] **Task 1: Database Schema** (AC: #1, #2, #4, #5)
  - [ ] Create `team_daily_analytics` table
  - [ ] Add columns: team_id, date, total_prompts, total_sessions, avg_prompt_score, avg_session_health, work_style_distribution, sentiment_distribution, active_users
  - [ ] Add unique constraint on (team_id, date)
  - [ ] Add indexes and enable RLS

- [ ] **Task 2: Create Team Aggregation Function** (AC: #1)
  - [ ] Create SQL function `aggregate_team_daily_analytics(target_date)`
  - [ ] Aggregate from user_daily_analytics for team members
  - [ ] Sum counts, average scores
  - [ ] Aggregate JSONB distributions
  - [ ] Schedule daily cron job (00:10 UTC)

- [ ] **Task 3: Create Team Intelligence API** (AC: #1-9)
  - [ ] Create `GET /api/analytics/team/:teamId/intelligence` endpoint
  - [ ] Accept timeRange query param
  - [ ] Return TeamIntelligenceResponse
  - [ ] Implement 15-minute cache

- [ ] **Task 4: Implement Team Summary Calculation** (AC: #1)
  - [ ] Calculate team size from team_members
  - [ ] Calculate active users from analytics
  - [ ] Sum totals and calculate averages
  - [ ] Calculate week-over-week changes

- [ ] **Task 5: Implement Style and Persona Distribution** (AC: #2, #3)
  - [ ] Aggregate work style counts from team members
  - [ ] Calculate persona distribution from individual profiles
  - [ ] Return as chart-ready data structures

- [ ] **Task 6: Implement Top Performers Identification** (AC: #6)
  - [ ] Query user_daily_analytics for team members
  - [ ] Rank by prompt quality, efficiency, session health
  - [ ] Return top 5 for each metric (with user names)
  - [ ] Respect privacy settings (admin only)

- [ ] **Task 7: Implement Common Struggles Detection** (AC: #7)
  - [ ] Analyze patterns across team members
  - [ ] Identify issues affecting >20% of team
  - [ ] Generate severity levels (low, medium, high)
  - [ ] Provide actionable suggestions

- [ ] **Task 8: Implement Best Practices Extraction** (AC: #8)
  - [ ] Identify patterns from top performers
  - [ ] Correlate patterns with high scores
  - [ ] Generate impact descriptions
  - [ ] Include example counts

- [ ] **Task 9: RLS Policies** (AC: #10)
  - [ ] Team members can view aggregated team stats
  - [ ] Team admins can view individual member data
  - [ ] Non-members cannot access team data
  - [ ] Service role bypasses for aggregation

- [ ] **Task 10: Create Team Intelligence Dashboard** (AC: #1-9)
  - [ ] Create `/app/app/(app)/team/[teamId]/analytics/page.tsx`
  - [ ] Create team-specific chart components
  - [ ] Implement time range filter
  - [ ] Handle admin vs member view

- [ ] **Task 11: Testing** (AC: #1-10)
  - [ ] Write unit tests for aggregation logic
  - [ ] Write unit tests for top performers calculation
  - [ ] Write unit tests for struggles detection
  - [ ] Write E2E tests for dashboard
  - [ ] Test RLS policies for different roles

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
