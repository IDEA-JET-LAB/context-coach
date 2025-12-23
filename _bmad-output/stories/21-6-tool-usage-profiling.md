# Story 21.6: Tool Usage Profiling

Status: Complete

## Story

**As a** developer using Contextor,
**I want** Claude Code tool usage tracked and analyzed per session,
**So that** I can understand which tools I use most and identify opportunities to leverage underutilized tools.

## Acceptance Criteria

1. **Given** a session contains tool calls in assistant responses
   **When** the session is analyzed
   **Then** tool usage counts are stored in `session_tool_usage` table

2. **Given** tool usage data for a session
   **When** queried
   **Then** returns distribution of all Claude Code tools (Bash, Read, Edit, Write, Glob, Grep, TodoWrite, Task, WebFetch, WebSearch, NotebookEdit)

3. **Given** a user's tool usage distribution
   **When** profile is calculated
   **Then** user is classified as one of: terminal_power, code_centric, methodical, or balanced

4. **Given** a user has high Bash usage (>30% of total)
   **When** profile is determined
   **Then** they are classified as `terminal_power`

5. **Given** a user has high file operations (Read+Edit+Write >50%)
   **When** profile is determined
   **Then** they are classified as `code_centric`

6. **Given** a user has notable TodoWrite usage (>10%)
   **When** profile is determined
   **Then** they are classified as `methodical`

7. **Given** session tool usage data
   **When** insights are generated
   **Then** top tools and underutilized tools are identified

8. **Given** a user's tool usage distribution
   **When** compared to team averages
   **Then** shows how their usage differs from team patterns (e.g., "You use Bash 40% more than your team average")

9. **Given** a user's tool usage history over time
   **When** mastery profile is generated
   **Then** shows progression from beginner to power user for each tool category

10. **Given** tool usage analysis results
    **When** feedback is displayed to user
    **Then** includes personalized messages like "You're a power terminal user" or "Try using more file editing tools"

## Tasks / Subtasks

- [x] **Task 1: Database Schema** (AC: #1, #2)
  - [x] Create `session_tool_usage` table
  - [x] Add columns: id, session_id, tool_name, usage_count, created_at
  - [x] Add unique constraint on (session_id, tool_name)
  - [x] Add indexes for session and tool queries
  - [x] Enable RLS and create policies

- [x] **Task 2: Implement Tool Usage Tracker** (AC: #1, #2, #7)
  - [x] Create `/app/lib/analysis/tool-usage-tracker.ts`
  - [x] Define `ToolName` type with all Claude Code tools
  - [x] Define `ToolUsageProfile` interface
  - [x] Implement `extractToolUsage(responseData)` function
  - [x] Implement `getToolDistribution(sessionId)` function

- [x] **Task 3: Implement User Profile Classifier** (AC: #3, #4, #5, #6)
  - [x] Implement `classifyUserProfile(distribution)` function
  - [x] Calculate tool category ratios
  - [x] Apply classification rules based on thresholds
  - [x] Return profile type with confidence

- [x] **Task 4: Implement Insights Generator** (AC: #7)
  - [x] Implement `identifyTopTools(distribution, limit)` function
  - [x] Implement `identifyUnderutilizedTools(distribution)` function
  - [x] Compare against baseline usage patterns
  - [x] Generate personalized recommendations

- [x] **Task 5: Integration with Response Capture** (AC: #1)
  - [x] Hook into response capture flow (Epic 15 dependency)
  - [x] Parse tool calls from assistant responses
  - [x] Increment usage counts in session_tool_usage table
  - [x] Handle upsert for existing tool entries

- [x] **Task 6: RLS Policies** (AC: #2)
  - [x] Team members can view their team's session tool usage
  - [x] Service role can manage all records
  - [x] Users can view their own sessions' tool usage

- [x] **Task 7: Team Comparison Feature** (AC: #8)
  - [x] Create `getTeamToolAverages(teamId)` function
  - [x] Implement `compareToTeamAverages(userDistribution, teamAverages)` function
  - [x] Calculate percentage differences for each tool category
  - [x] Generate comparison insights (above/below average indicators)

- [x] **Task 8: Tool Mastery Profile** (AC: #9)
  - [x] Create `tool_mastery_snapshots` table for historical tracking
  - [x] Implement `calculateMasteryLevel(toolUsageHistory)` function
  - [x] Define mastery levels: beginner, intermediate, advanced, power_user
  - [x] Track progression over time windows (weekly, monthly)
  - [x] Generate mastery progression insights

- [x] **Task 9: Personalized Feedback Messages** (AC: #10)
  - [x] Create `generateToolFeedback(profile, comparison, mastery)` function
  - [x] Implement message templates for each profile type
  - [x] Include actionable suggestions for underutilized tools
  - [x] Add positive reinforcement for strengths

- [x] **Task 10: Testing** (AC: #3, #4, #5, #6, #8, #9, #10)
  - [x] Write unit tests for tool extraction
  - [x] Write unit tests for profile classification
  - [x] Write unit tests for distribution edge cases
  - [x] Write integration tests for database operations
  - [x] Write unit tests for team comparison calculations
  - [x] Write unit tests for mastery level progression
  - [x] Write unit tests for feedback message generation

## Dev Notes

### Tool Types

```typescript
export type ToolName =
  | 'Bash'
  | 'Read'
  | 'Edit'
  | 'Write'
  | 'Glob'
  | 'Grep'
  | 'TodoWrite'
  | 'Task'
  | 'WebFetch'
  | 'WebSearch'
  | 'NotebookEdit';

export type ToolUserProfile =
  | 'terminal_power'
  | 'code_centric'
  | 'methodical'
  | 'balanced';
```

### Profile Classification Logic

```typescript
export function classifyUserProfile(distribution: Record<string, number>): string {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  if (total === 0) return 'balanced';

  const bashRatio = (distribution['Bash'] || 0) / total;
  const fileOpsRatio = (
    (distribution['Read'] || 0) +
    (distribution['Edit'] || 0) +
    (distribution['Write'] || 0)
  ) / total;
  const todoRatio = (distribution['TodoWrite'] || 0) / total;

  if (bashRatio > 0.3) return 'terminal_power';
  if (fileOpsRatio > 0.5) return 'code_centric';
  if (todoRatio > 0.1) return 'methodical';
  return 'balanced';
}
```

### Database Schema

```sql
CREATE TABLE session_tool_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  tool_name VARCHAR(50) NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_session_tool UNIQUE (session_id, tool_name)
);

CREATE INDEX idx_session_tool_usage_session ON session_tool_usage(session_id);
CREATE INDEX idx_session_tool_usage_tool ON session_tool_usage(tool_name);

COMMENT ON TABLE session_tool_usage IS 'Tracks Claude Code tool usage per session';

-- Tool mastery snapshots for tracking progression over time
CREATE TABLE tool_mastery_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_name VARCHAR(50) NOT NULL,
  mastery_level VARCHAR(20) NOT NULL CHECK (mastery_level IN ('beginner', 'intermediate', 'advanced', 'power_user')),
  total_usage_count INTEGER NOT NULL DEFAULT 0,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_tool_date UNIQUE (user_id, tool_name, snapshot_date)
);

CREATE INDEX idx_tool_mastery_user ON tool_mastery_snapshots(user_id);
CREATE INDEX idx_tool_mastery_date ON tool_mastery_snapshots(snapshot_date);

COMMENT ON TABLE tool_mastery_snapshots IS 'Weekly/monthly snapshots of user tool mastery levels';
```

### RLS Policies

```sql
ALTER TABLE session_tool_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view session tool usage" ON session_tool_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN team_members tm ON tm.team_id = s.team_id
      WHERE s.id = session_tool_usage.session_id
        AND tm.user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Service role can manage session tool usage" ON session_tool_usage
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
```

### Tool Usage Profile Interface

```typescript
export interface ToolUsageProfile {
  toolDistribution: Record<ToolName, number>;
  totalToolCalls: number;
  topTools: ToolName[];
  underutilizedTools: ToolName[];
  userProfile: ToolUserProfile;
}
```

### Team Comparison Interface

```typescript
export interface TeamComparison {
  toolName: ToolName;
  userPercentage: number;
  teamAveragePercentage: number;
  differencePercent: number; // positive = above average
  insight: string;
}
```

### Mastery Level Types

```typescript
export type MasteryLevel = 'beginner' | 'intermediate' | 'advanced' | 'power_user';

export interface ToolMasteryProfile {
  tool: ToolName;
  currentLevel: MasteryLevel;
  usageCount: number;
  firstUsed: Date;
  progressionHistory: { date: Date; level: MasteryLevel }[];
}
```

### Sample Feedback Messages

Profile-based messages:
- **terminal_power**: "You're a power terminal user! Your command-line skills are impressive."
- **code_centric**: "You're deeply focused on code - great attention to file operations!"
- **methodical**: "Your organized approach with TodoWrite shows strong planning skills."
- **balanced**: "You have a well-rounded tool usage pattern across all categories."

Comparison-based messages:
- "You use Bash 40% more than your team average - you're the terminal expert!"
- "Your Edit tool usage is 25% below team average - try using more inline edits."
- "You're leading your team in search tool usage (Glob + Grep)."

Improvement suggestions:
- "Try using more file editing tools to speed up your workflow."
- "Consider using TodoWrite to organize complex multi-step tasks."
- "WebSearch could help you find solutions faster - give it a try!"
- "Grep is underutilized - it's great for finding patterns across your codebase."

Mastery progression messages:
- "Congratulations! You've reached power_user level with Bash!"
- "Your Read tool mastery has improved from beginner to intermediate this month."
- "You're on track to reach advanced level with Edit next week."

### Dependencies

- Epic 15 (Response Context) - Required for extracting tool calls from responses
- Epic 16 (Sessions) - Required for session_id foreign key

### Performance Considerations

- Tool extraction happens during response processing
- Profile classification is O(1) with fixed tool set
- Distribution queries use indexed session_id


## Design System Requirements

**MANDATORY:** This story MUST use existing design system components exclusively.

### Pre-Implementation Checklist
- [x] Reviewed `_bmad-output/DESIGN-SYSTEM-MANDATE.md` for component inventory
- [x] Checked `/design` route for component examples
- [x] Identified required components from the inventory below
- [x] Confirmed no hardcoded colors - using semantic tokens only
- [x] No new UI patterns needed (or Design Epic story created)

### Required Components
This is a backend-only story (no UI components). The data and APIs created here will be consumed by future UI stories for the analytics dashboard.

### Styling Rules
- NO hardcoded colors (no `bg-zinc-*`, `text-gray-*`, etc.)
- Use existing components from `components/` directory
- Extend existing components before creating new ones

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List
1. Created comprehensive database schema with two tables: `session_tool_usage` and `tool_mastery_snapshots`
2. Implemented full tool usage tracker with extraction, classification, and insights generation
3. All 46 unit tests passing covering profile classification, team comparison, mastery levels, and feedback
4. Database functions created for efficient aggregation queries
5. Integration service created for session-level tool usage recording
6. RLS policies implemented for team-based and user-based access control

### Change Log
| Date | Change | Author |
|------|--------|--------|
| 2025-12-23 | Initial implementation of Story 21-6 | Claude Opus 4.5 |

### File List
**Created:**
- `/Users/edgars/My-projects/2025-projects/DEV/context-coach/app/supabase/migrations/20251223210000_create_tool_usage_profiling.sql` - Database migration with tables, indexes, RLS policies, and functions
- `/Users/edgars/My-projects/2025-projects/DEV/context-coach/app/lib/analysis/tool-usage-tracker.ts` - Main tool usage tracker with types, extraction, classification, comparison, mastery, and feedback
- `/Users/edgars/My-projects/2025-projects/DEV/context-coach/app/lib/analysis/__tests__/tool-usage-tracker.test.ts` - 46 unit tests
- `/Users/edgars/My-projects/2025-projects/DEV/context-coach/app/lib/sessions/tool-usage.ts` - Session integration service for recording and querying tool usage

**Modified:**
- `/Users/edgars/My-projects/2025-projects/DEV/context-coach/app/lib/analysis/index.ts` - Added tool-usage-tracker exports
- `/Users/edgars/My-projects/2025-projects/DEV/context-coach/app/lib/sessions/index.ts` - Added tool-usage service exports
