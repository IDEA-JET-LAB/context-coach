# Story 30-2: Deterministic Stats Service

## Story Info
- **Epic:** 30 - Conversation Analysis
- **Priority:** P0 (Foundation)
- **Points:** 3
- **Status:** Done
- **Completed:** 2026-01-10

## Description

Create a service that calculates instant, free statistics for any conversation without LLM calls. These stats appear immediately when a user views a conversation and provide baseline metrics.

## Acceptance Criteria

- [x] Create `lib/analysis/conversation-stats.ts`
- [x] Calculate all metrics from existing database data
- [x] Return results in <100ms for typical conversations
- [x] Handle edge cases (empty conversations, missing data, ongoing sessions)
- [x] Create API endpoint `GET /api/conversations/[sessionId]/stats`

## Technical Details

### Metrics to Calculate

| Metric | Source | Calculation |
|--------|--------|-------------|
| Turn count | prompts table | Count prompts for session |
| Duration | sessions table | `ended_at - started_at` or time since start if ongoing |
| Total tokens in | responses table | `SUM(input_tokens)` |
| Total tokens out | responses table | `SUM(output_tokens)` |
| Tool usage breakdown | responses table | Parse `tool_calls` JSON, group by tool name |
| Agent usage | responses table | Parse Task tool calls, extract `subagent_type` |
| Context window peak % | Cumulative calculation | Max cumulative tokens / 200,000 |
| Outcome | Heuristics | Detect git commit, file writes, errors |
| Category | sessions/prompts table | Primary detected stage or "unknown" |

### Response Type

```typescript
// lib/analysis/conversation-stats.ts

export interface ConversationStats {
  sessionId: string;

  // Basic metrics
  turnCount: number;
  durationMinutes: number | null;
  isOngoing: boolean;

  // Token usage
  tokens: {
    input: number;
    output: number;
    total: number;
  };

  // Tool breakdown
  tools: Array<{
    name: string;
    count: number;
  }>;

  // Agent breakdown (from Task tool usage)
  agents: Array<{
    type: string;
    count: number;
  }>;

  // Context window analysis
  contextWindow: {
    peakPercentage: number;  // 0-100
    peakTurn: number;        // Which turn hit peak
    avgPercentage: number;   // Average utilization
  };

  // Outcome detection
  outcome: {
    status: 'completed' | 'abandoned' | 'ongoing' | 'error' | 'unknown';
    indicators: string[];    // e.g., ["git commit", "test passed"]
  };

  // Category
  category: string | null;   // "development", "debugging", "planning", etc.
}
```

### Tool Parsing

```typescript
interface ToolCall {
  name: string;
  // ... other fields
}

function parseToolUsage(responses: Response[]): Map<string, number> {
  const toolCounts = new Map<string, number>();

  for (const response of responses) {
    if (!response.tool_calls) continue;

    const tools = JSON.parse(response.tool_calls) as ToolCall[];
    for (const tool of tools) {
      toolCounts.set(tool.name, (toolCounts.get(tool.name) || 0) + 1);
    }
  }

  return toolCounts;
}
```

### Agent Detection

```typescript
function parseAgentUsage(responses: Response[]): Map<string, number> {
  const agentCounts = new Map<string, number>();

  for (const response of responses) {
    if (!response.tool_calls) continue;

    const tools = JSON.parse(response.tool_calls) as ToolCall[];
    for (const tool of tools) {
      if (tool.name === 'Task' && tool.input?.subagent_type) {
        const agentType = tool.input.subagent_type;
        agentCounts.set(agentType, (agentCounts.get(agentType) || 0) + 1);
      }
    }
  }

  return agentCounts;
}
```

### Outcome Detection Heuristics

```typescript
function detectOutcome(responses: Response[], session: Session): OutcomeInfo {
  const indicators: string[] = [];

  // Check for git commits
  const hasGitCommit = responses.some(r =>
    r.tool_calls?.includes('"git commit"') ||
    r.response_text?.includes('committed')
  );
  if (hasGitCommit) indicators.push('git commit');

  // Check for test runs
  const hasTestRun = responses.some(r =>
    r.tool_calls?.includes('"npm test"') ||
    r.tool_calls?.includes('"pytest"')
  );
  if (hasTestRun) indicators.push('tests run');

  // Check for errors in last response
  const lastResponse = responses[responses.length - 1];
  const hasError = lastResponse?.response_text?.toLowerCase().includes('error');

  // Determine status
  let status: 'completed' | 'abandoned' | 'ongoing' | 'error' | 'unknown';

  if (!session.ended_at) {
    status = 'ongoing';
  } else if (hasError && indicators.length === 0) {
    status = 'error';
  } else if (indicators.length > 0) {
    status = 'completed';
  } else if (session.duration && session.duration < 5) {
    status = 'abandoned';
  } else {
    status = 'unknown';
  }

  return { status, indicators };
}
```

### API Endpoint

```typescript
// app/api/conversations/[sessionId]/stats/route.ts

export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = params;

  // Verify user has access to this session's team
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  await requireTeamAccess(session.team_id);

  const stats = await calculateConversationStats(sessionId);

  return NextResponse.json({ data: stats });
}
```

### Database Query

Single efficient query to get all needed data:

```sql
SELECT
  s.session_id,
  s.started_at,
  s.ended_at,
  s.primary_stage,
  COUNT(DISTINCT p.id) as prompt_count,
  COALESCE(SUM(r.input_tokens), 0) as total_input_tokens,
  COALESCE(SUM(r.output_tokens), 0) as total_output_tokens,
  json_agg(r.tool_calls) FILTER (WHERE r.tool_calls IS NOT NULL) as all_tool_calls
FROM sessions s
LEFT JOIN prompts p ON p.session_id = s.session_id
LEFT JOIN responses r ON r.prompt_id = p.id
WHERE s.session_id = $1
GROUP BY s.id;
```

## Tests

### Unit Tests

```typescript
describe('ConversationStats', () => {
  describe('calculateConversationStats', () => {
    it('should calculate turn count correctly');
    it('should calculate duration for completed sessions');
    it('should return null duration for ongoing sessions');
    it('should aggregate token counts');
    it('should parse tool usage from responses');
    it('should detect agent usage from Task tool calls');
    it('should calculate context window peak percentage');
    it('should detect completed outcome with git commit');
    it('should detect ongoing sessions');
    it('should handle empty conversations');
    it('should handle missing response data');
  });

  describe('performance', () => {
    it('should return within 100ms for 50-message conversation');
    it('should return within 200ms for 200-message conversation');
  });
});
```

### Integration Tests

```typescript
describe('GET /api/conversations/[sessionId]/stats', () => {
  it('should return stats for valid session');
  it('should return 404 for non-existent session');
  it('should return 403 for session in different team');
});
```

## Dependencies

- Existing sessions table
- Existing prompts table
- Existing responses table

## Out of Scope

- LLM-powered analysis (Story 30-7)
- UI display (Story 30-6)
- Historical trends

## Definition of Done

- [ ] Service implemented with TypeScript types
- [ ] API endpoint created and documented
- [ ] Unit tests passing (>90% coverage)
- [ ] Performance requirement met (<100ms typical)
- [ ] Edge cases handled gracefully
