# Story 21.6: Tool Usage Profiling

Status: Ready

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

- [ ] **Task 1: Database Schema** (AC: #1, #2)
  - [ ] Create `session_tool_usage` table
  - [ ] Add columns: id, session_id, tool_name, usage_count, created_at
  - [ ] Add unique constraint on (session_id, tool_name)
  - [ ] Add indexes for session and tool queries
  - [ ] Enable RLS and create policies

- [ ] **Task 2: Implement Tool Usage Tracker** (AC: #1, #2, #7)
  - [ ] Create `/app/lib/analysis/tool-usage-tracker.ts`
  - [ ] Define `ToolName` type with all Claude Code tools
  - [ ] Define `ToolUsageProfile` interface
  - [ ] Implement `extractToolUsage(responseData)` function
  - [ ] Implement `getToolDistribution(sessionId)` function

- [ ] **Task 3: Implement User Profile Classifier** (AC: #3, #4, #5, #6)
  - [ ] Implement `classifyUserProfile(distribution)` function
  - [ ] Calculate tool category ratios
  - [ ] Apply classification rules based on thresholds
  - [ ] Return profile type with confidence

- [ ] **Task 4: Implement Insights Generator** (AC: #7)
  - [ ] Implement `identifyTopTools(distribution, limit)` function
  - [ ] Implement `identifyUnderutilizedTools(distribution)` function
  - [ ] Compare against baseline usage patterns
  - [ ] Generate personalized recommendations

- [ ] **Task 5: Integration with Response Capture** (AC: #1)
  - [ ] Hook into response capture flow (Epic 15 dependency)
  - [ ] Parse tool calls from assistant responses
  - [ ] Increment usage counts in session_tool_usage table
  - [ ] Handle upsert for existing tool entries

- [ ] **Task 6: RLS Policies** (AC: #2)
  - [ ] Team members can view their team's session tool usage
  - [ ] Service role can manage all records
  - [ ] Users can view their own sessions' tool usage

- [ ] **Task 7: Team Comparison Feature** (AC: #8)
  - [ ] Create `getTeamToolAverages(teamId)` function
  - [ ] Implement `compareToTeamAverages(userDistribution, teamAverages)` function
  - [ ] Calculate percentage differences for each tool category
  - [ ] Generate comparison insights (above/below average indicators)

- [ ] **Task 8: Tool Mastery Profile** (AC: #9)
  - [ ] Create `tool_mastery_snapshots` table for historical tracking
  - [ ] Implement `calculateMasteryLevel(toolUsageHistory)` function
  - [ ] Define mastery levels: beginner, intermediate, advanced, power_user
  - [ ] Track progression over time windows (weekly, monthly)
  - [ ] Generate mastery progression insights

- [ ] **Task 9: Personalized Feedback Messages** (AC: #10)
  - [ ] Create `generateToolFeedback(profile, comparison, mastery)` function
  - [ ] Implement message templates for each profile type
  - [ ] Include actionable suggestions for underutilized tools
  - [ ] Add positive reinforcement for strengths

- [ ] **Task 10: Testing** (AC: #3, #4, #5, #6, #8, #9, #10)
  - [ ] Write unit tests for tool extraction
  - [ ] Write unit tests for profile classification
  - [ ] Write unit tests for distribution edge cases
  - [ ] Write integration tests for database operations
  - [ ] Write unit tests for team comparison calculations
  - [ ] Write unit tests for mastery level progression
  - [ ] Write unit tests for feedback message generation

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
