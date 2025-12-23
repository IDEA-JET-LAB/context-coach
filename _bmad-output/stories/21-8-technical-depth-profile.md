# Story 21.8: Technical Depth Profile

Status: Ready

## Story

**As a** team lead or developer using Contextor,
**I want** users categorized into technical personas based on their prompting patterns,
**So that** I can understand working styles and provide targeted coaching or self-improvement paths.

## Acceptance Criteria

1. **Given** a user has accumulated work style distribution data
   **When** technical profile is calculated
   **Then** they are assigned one of four personas: architect, firefighter, craftsman, or explorer

2. **Given** a user has >20% architecture questions and <15% debugging
   **When** profile is calculated
   **Then** they are classified as `architect` with 80% confidence

3. **Given** a user has >20% debugging and <10% testing
   **When** profile is calculated
   **Then** they are classified as `firefighter` with 75% confidence

4. **Given** a user has >12% testing and balanced architecture/implementation
   **When** profile is calculated
   **Then** they are classified as `craftsman` with 85% confidence

5. **Given** a user has diverse patterns that don't fit other profiles
   **When** profile is calculated
   **Then** they are classified as `explorer` with 60% confidence

6. **Given** a technical profile
   **When** returned to user
   **Then** it includes a persona description explaining the classification

7. **Given** a user's profile
   **When** returned
   **Then** it includes the breakdown ratios for architecture, debugging, testing, and implementation

8. **Given** a user has work style distribution data
   **When** technical profile is calculated
   **Then** the business/UX focus ratio is calculated as (documentation + refactoring + learning) / total technical prompts

9. **Given** a user has historical profile data spanning multiple weeks
   **When** persona evolution is requested
   **Then** weekly snapshots of persona assignments are returned showing persona changes over time

10. **Given** a user's technical profile
    **When** team distribution comparison is requested
    **Then** the system returns the user's persona compared to team-wide persona distribution percentages

## Tasks / Subtasks

- [ ] **Task 1: Implement Technical Depth Profiler** (AC: #1, #2, #3, #4, #5)
  - [ ] Create `/app/lib/analysis/technical-depth.ts`
  - [ ] Define `TechnicalPersona` type
  - [ ] Define `TechnicalDepthProfile` interface
  - [ ] Implement `calculateTechnicalProfile(workStyleDistribution)` function
  - [ ] Calculate ratios for each technical area

- [ ] **Task 2: Define Persona Classification Rules** (AC: #2, #3, #4, #5)
  - [ ] Architect: architectureRatio > 0.2 && debuggingRatio < 0.15
  - [ ] Firefighter: debuggingRatio > 0.2 && testingRatio < 0.10
  - [ ] Craftsman: testingRatio > 0.12 && balanced architecture/implementation
  - [ ] Explorer: default when no clear pattern matches

- [ ] **Task 3: Define Persona Descriptions** (AC: #6)
  - [ ] Architect: "High-level thinker focused on design decisions and system structure"
  - [ ] Firefighter: "Reactive problem solver, often in fix-it mode"
  - [ ] Craftsman: "Balanced approach with strong quality focus"
  - [ ] Explorer: "Experimental approach with diverse prompting patterns"

- [ ] **Task 4: Calculate Breakdown Ratios** (AC: #7)
  - [ ] architectureRatio = architecture_questions / total
  - [ ] debuggingRatio = debugging / total
  - [ ] testingRatio = testing / total
  - [ ] implementationRatio = (file_operations + deployment) / total

- [ ] **Task 5: Integrate into Analytics APIs** (AC: #1, #6, #7)
  - [ ] Add technical profile to personal insights API response
  - [ ] Calculate from aggregated work style distribution
  - [ ] Cache profile for performance (update on daily aggregation)

- [ ] **Task 6: Calculate Business/UX Focus Ratio** (AC: #8)
  - [ ] Add `businessUxRatio` to TechnicalDepthProfile breakdown
  - [ ] Calculate as (documentation + refactoring + learning) / total
  - [ ] Include in API response alongside technical ratios

- [ ] **Task 7: Implement Persona Evolution Tracking** (AC: #9)
  - [ ] Create `persona_snapshots` table for weekly persona history
  - [ ] Implement weekly cron job to snapshot current personas
  - [ ] Create `getPersonaEvolution(userId, timeRange)` function
  - [ ] Add `/api/analytics/persona-evolution` endpoint
  - [ ] Return array of weekly snapshots with persona, confidence, and date

- [ ] **Task 8: Implement Team Distribution Comparison** (AC: #10)
  - [ ] Create `calculateTeamPersonaDistribution(teamId)` function
  - [ ] Query all team members' current personas
  - [ ] Calculate percentage for each persona type
  - [ ] Add `teamComparison` field to profile response
  - [ ] Include user's persona rank within team

- [ ] **Task 9: Testing** (AC: #2, #3, #4, #5, #6, #7, #8, #9, #10)
  - [ ] Write unit tests for architect classification
  - [ ] Write unit tests for firefighter classification
  - [ ] Write unit tests for craftsman classification
  - [ ] Write unit tests for explorer fallback
  - [ ] Write unit tests for edge cases (zero totals, missing categories)
  - [ ] Write unit tests for business/UX ratio calculation
  - [ ] Write unit tests for persona evolution snapshots
  - [ ] Write unit tests for team distribution comparison

## Dev Notes

### TechnicalPersona Type

```typescript
export type TechnicalPersona = 'architect' | 'firefighter' | 'craftsman' | 'explorer';
```

### TechnicalDepthProfile Interface

```typescript
export interface TechnicalDepthProfile {
  persona: TechnicalPersona;
  confidence: number;
  breakdown: {
    architectureRatio: number;
    debuggingRatio: number;
    testingRatio: number;
    implementationRatio: number;
  };
  personaDescription: string;
}
```

### Classification Logic

```typescript
export function calculateTechnicalProfile(
  workStyleDistribution: Record<string, number>
): TechnicalDepthProfile {
  const total = Object.values(workStyleDistribution).reduce((a, b) => a + b, 0);

  if (total === 0) {
    return {
      persona: 'explorer',
      confidence: 0.3,
      breakdown: {
        architectureRatio: 0,
        debuggingRatio: 0,
        testingRatio: 0,
        implementationRatio: 0,
      },
      personaDescription: 'Not enough data to determine profile',
    };
  }

  const architectureRatio = (workStyleDistribution['architecture_questions'] || 0) / total;
  const debuggingRatio = (workStyleDistribution['debugging'] || 0) / total;
  const testingRatio = (workStyleDistribution['testing'] || 0) / total;
  const implementationRatio = (
    (workStyleDistribution['file_operations'] || 0) +
    (workStyleDistribution['deployment'] || 0)
  ) / total;

  const breakdown = { architectureRatio, debuggingRatio, testingRatio, implementationRatio };

  // Classification rules
  let persona: TechnicalPersona;
  let confidence: number;
  let personaDescription: string;

  if (architectureRatio > 0.2 && debuggingRatio < 0.15) {
    persona = 'architect';
    confidence = 0.8;
    personaDescription = 'High-level thinker focused on design decisions and system structure';
  } else if (debuggingRatio > 0.2 && testingRatio < 0.10) {
    persona = 'firefighter';
    confidence = 0.75;
    personaDescription = 'Reactive problem solver, often in fix-it mode';
  } else if (testingRatio > 0.12 && Math.abs(architectureRatio - implementationRatio) < 0.1) {
    persona = 'craftsman';
    confidence = 0.85;
    personaDescription = 'Balanced approach with strong quality focus';
  } else {
    persona = 'explorer';
    confidence = 0.6;
    personaDescription = 'Experimental approach with diverse prompting patterns';
  }

  return { persona, confidence, breakdown, personaDescription };
}
```

### Persona Characteristics

| Persona | Key Traits | Typical Patterns | Coaching Opportunity |
|---------|------------|------------------|---------------------|
| Architect | High-level focus | Many "how should" and "best practice" questions | Encourage more hands-on implementation |
| Firefighter | Reactive mode | Lots of "fix", "error", "broken" prompts | Suggest more upfront testing and planning |
| Craftsman | Quality-focused | Regular testing, balanced approach | Share advanced techniques and optimizations |
| Explorer | Diverse patterns | No dominant category | Help focus on systematic workflows |

### API Integration

```typescript
// Part of GET /api/analytics/insights response
interface InsightsResponse {
  // ... other fields
  technicalProfile: {
    persona: TechnicalPersona;
    confidence: number;
    breakdown: {
      architectureRatio: number;
      debuggingRatio: number;
      testingRatio: number;
      implementationRatio: number;
    };
  };
}
```

### Dependencies

- Story 21.2 (Work Style Categorization) - Required for work style distribution data
- Daily analytics aggregation for historical distribution

### Performance Considerations

- Profile calculation is O(n) where n = number of work style categories (10)
- Run during daily aggregation rather than on every query
- Cache profile result in user_daily_analytics or separate column

### Business/UX Focus Ratio Calculation

```typescript
// Add to TechnicalDepthProfile breakdown
interface TechnicalDepthProfile {
  // ... existing fields
  breakdown: {
    architectureRatio: number;
    debuggingRatio: number;
    testingRatio: number;
    implementationRatio: number;
    businessUxRatio: number;  // NEW
  };
}

// Calculation logic
const businessUxRatio = (
  (workStyleDistribution['documentation'] || 0) +
  (workStyleDistribution['refactoring'] || 0) +
  (workStyleDistribution['learning'] || 0)
) / total;
```

### Persona Evolution Schema

```sql
-- Weekly persona snapshots for evolution tracking
CREATE TABLE persona_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  persona TEXT NOT NULL CHECK (persona IN ('architect', 'firefighter', 'craftsman', 'explorer')),
  confidence DECIMAL(3,2) NOT NULL,
  breakdown JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, snapshot_date)
);

-- Index for efficient evolution queries
CREATE INDEX idx_persona_snapshots_user_date ON persona_snapshots(user_id, snapshot_date DESC);
```

### Persona Evolution Query

```typescript
export async function getPersonaEvolution(
  userId: string,
  timeRange: { start: Date; end: Date }
): Promise<PersonaSnapshot[]> {
  const { data } = await supabase
    .from('persona_snapshots')
    .select('snapshot_date, persona, confidence, breakdown')
    .eq('user_id', userId)
    .gte('snapshot_date', timeRange.start.toISOString())
    .lte('snapshot_date', timeRange.end.toISOString())
    .order('snapshot_date', { ascending: true });

  return data || [];
}
```

### Team Distribution Comparison SQL

```sql
-- Get team-wide persona distribution
SELECT
  persona,
  COUNT(*) as count,
  ROUND(COUNT(*)::DECIMAL / SUM(COUNT(*)) OVER () * 100, 1) as percentage
FROM (
  SELECT DISTINCT ON (user_id)
    user_id,
    persona
  FROM persona_snapshots
  WHERE team_id = $1
  ORDER BY user_id, snapshot_date DESC
) latest_personas
GROUP BY persona
ORDER BY count DESC;
```

### Team Comparison Response

```typescript
interface TeamPersonaComparison {
  userPersona: TechnicalPersona;
  teamDistribution: {
    architect: number;    // percentage of team
    firefighter: number;
    craftsman: number;
    explorer: number;
  };
  userRank: {
    samePersonaCount: number;      // how many share this persona
    totalTeamMembers: number;
  };
}

// Add to TechnicalDepthProfile response
interface TechnicalDepthProfile {
  // ... existing fields
  teamComparison?: TeamPersonaComparison;  // Optional, only when team context
}
```


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
