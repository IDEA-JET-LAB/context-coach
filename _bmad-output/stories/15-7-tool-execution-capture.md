# Story 15.7: Tool Execution Capture

Status: ✅ COMPLETED (2025-12-23)

**Dependencies:** Story 15-4 (Assistant Response Extraction) - tool executions are extracted from assistant responses

## Story
**As a** Contextor system,
**I want** to store detailed tool execution data from Claude's responses,
**So that** I can analyze tool usage patterns and provide insights on tool effectiveness.

## Acceptance Criteria
1. **Given** an assistant response with tool_use blocks
   **When** storing tool executions
   **Then** each tool call is stored in a `tool_executions` table
   **And** linked to the `prompt_responses` record

2. **Given** a tool execution record
   **When** storing
   **Then** it captures: tool_name, tool_id, input_summary, output_summary, execution_order
   **And** full input is stored (optionally redacted) for debugging

3. **Given** a tool result in the transcript
   **When** matching with tool_use
   **Then** the result is linked via `tool_use_id`
   **And** success/failure status is derived from result content

4. **Given** tool execution queries
   **When** analyzing patterns
   **Then** tools can be grouped by name
   **And** filtered by response or session
   **And** aggregated for usage statistics

5. **Given** privacy requirements
   **When** storing tool inputs
   **Then** sensitive data (file contents, commands) is summarized not stored in full
   **And** paths are optionally anonymized based on privacy settings

6. **Given** a `tool_use` block without a matching `tool_result`
   **When** storing the tool execution
   **Then** the record is stored with `result_matched = false`
   **And** `success = null` (unknown outcome)
   **And** `output_summary = null`

## Tasks / Subtasks
- [ ] **Task 1: Create tool_executions table** (AC: #1, #2)
  - [ ] Add migration for `tool_executions` table
  - [ ] Add `id` UUID primary key
  - [ ] Add `response_id` FK to prompt_responses
  - [ ] Add `tool_name` TEXT NOT NULL
  - [ ] Add `tool_id` TEXT for Claude's tool ID
  - [ ] Add `input_summary` TEXT (truncated/summarized)
  - [ ] Add `input_full` JSONB (optional, may be null for privacy)
  - [ ] Add `output_summary` TEXT (from tool_result)
  - [ ] Add `execution_order` INTEGER
  - [ ] Add `success` BOOLEAN

- [ ] **Task 2: Create tool_results matching logic** (AC: #3, #6)
  - [ ] Parse tool_result messages from transcripts
  - [ ] Match tool_result.tool_use_id to tool_use.id
  - [ ] Extract result content/error
  - [ ] Determine success from result using `detectError()` function
  - [ ] Link result to tool execution record
  - [ ] Handle unmatched tool_use blocks (set result_matched=false, success=null)

- [ ] **Task 3: Implement input summarization** (AC: #2, #5)
  - [ ] Create `summarizeToolInput()` function
  - [ ] Handle Read tool: show file path only
  - [ ] Handle Write tool: show file path + content length
  - [ ] Handle Bash tool: show command (truncated)
  - [ ] Handle Edit tool: show file path + old/new length
  - [ ] Redact sensitive paths based on settings

- [ ] **Task 4: Create RLS policies** (AC: #1)
  - [ ] Policy uses response_id -> prompt_id -> team_id chain
  - [ ] Service role has full access
  - [ ] Create indexes for the chain queries

- [ ] **Task 5: Create aggregation queries** (AC: #4)
  - [ ] Create `get_tool_usage_by_name()` function
  - [ ] Create `get_tool_usage_by_session()` function
  - [ ] Create `get_tool_success_rate()` function
  - [ ] Create `get_most_used_tools()` function

- [ ] **Task 6: Add TypeScript interfaces and API** (AC: #1-4)
  - [ ] Add `ToolExecution` interface
  - [ ] Create `storeToolExecutions()` function
  - [ ] Create `getToolExecutionsForResponse()` function
  - [ ] Create `getToolUsageStats()` function

## Dev Notes

### Database Schema

```sql
-- Migration: YYYYMMDDHHMMSS_add_tool_executions.sql

CREATE TABLE IF NOT EXISTS tool_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  response_id UUID NOT NULL REFERENCES prompt_responses(id) ON DELETE CASCADE,

  -- Tool identification
  tool_name TEXT NOT NULL,          -- e.g., 'Read', 'Write', 'Bash'
  tool_id TEXT,                     -- Claude's tool_use ID (toolu_01...)

  -- Input data
  input_summary TEXT NOT NULL,      -- Summarized/truncated input
  input_full JSONB,                 -- Full input (null if privacy restricted)

  -- Output data (from tool_result)
  output_summary TEXT,              -- Summarized output
  result_matched BOOLEAN DEFAULT FALSE,  -- Whether result was found
  success BOOLEAN,                  -- Derived from result content

  -- Ordering
  execution_order INTEGER NOT NULL, -- Order within response (1-indexed)

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tool_exec_response ON tool_executions(response_id);
CREATE INDEX idx_tool_exec_name ON tool_executions(tool_name);
CREATE INDEX idx_tool_exec_order ON tool_executions(response_id, execution_order);

-- RLS
ALTER TABLE tool_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tool_exec_team_access ON tool_executions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM prompt_responses pr
      JOIN prompts p ON p.id = pr.prompt_id
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE pr.id = tool_executions.response_id
        AND tm.user_id = auth.uid()
    )
  );

GRANT ALL ON tool_executions TO service_role;
```

### Tool Input Summarization

```typescript
// lib/transcript/tool-summary.ts

export interface ToolInputSummary {
  summary: string;
  hasRedactions: boolean;
}

const MAX_SUMMARY_LENGTH = 200;

export function summarizeToolInput(
  toolName: string,
  input: Record<string, unknown>,
  options?: { redactPaths?: boolean }
): ToolInputSummary {
  let summary = '';
  let hasRedactions = false;

  switch (toolName.toLowerCase()) {
    case 'read': {
      const filePath = input.file_path as string || 'unknown';
      const displayPath = options?.redactPaths
        ? anonymizePath(filePath)
        : filePath;
      summary = `Read: ${displayPath}`;
      hasRedactions = options?.redactPaths === true;
      break;
    }

    case 'write': {
      const filePath = input.file_path as string || 'unknown';
      const content = input.content as string || '';
      const displayPath = options?.redactPaths
        ? anonymizePath(filePath)
        : filePath;
      summary = `Write: ${displayPath} (${content.length} chars)`;
      hasRedactions = options?.redactPaths === true;
      break;
    }

    case 'edit': {
      const filePath = input.file_path as string || 'unknown';
      const oldStr = input.old_string as string || '';
      const newStr = input.new_string as string || '';
      const displayPath = options?.redactPaths
        ? anonymizePath(filePath)
        : filePath;
      summary = `Edit: ${displayPath} (${oldStr.length} -> ${newStr.length} chars)`;
      hasRedactions = options?.redactPaths === true;
      break;
    }

    case 'bash': {
      const command = input.command as string || '';
      const truncated = command.length > 100
        ? command.slice(0, 100) + '...'
        : command;
      summary = `Bash: ${truncated}`;
      break;
    }

    case 'glob': {
      const pattern = input.pattern as string || '';
      const path = input.path as string || '.';
      summary = `Glob: ${pattern} in ${path}`;
      break;
    }

    case 'grep': {
      const pattern = input.pattern as string || '';
      const path = input.path as string || '.';
      summary = `Grep: "${pattern}" in ${path}`;
      break;
    }

    case 'webfetch': {
      const url = input.url as string || '';
      summary = `WebFetch: ${url}`;
      break;
    }

    case 'websearch': {
      const query = input.query as string || '';
      summary = `WebSearch: "${query}"`;
      break;
    }

    default: {
      // Generic JSON summary
      const json = JSON.stringify(input);
      summary = json.length > MAX_SUMMARY_LENGTH
        ? json.slice(0, MAX_SUMMARY_LENGTH) + '...'
        : json;
    }
  }

  return { summary, hasRedactions };
}

/**
 * Anonymize file path by hashing user-specific parts.
 */
function anonymizePath(filePath: string): string {
  // Replace user home directory with ~
  const homeReplaced = filePath.replace(/^\/Users\/[^\/]+/, '~');
  // Replace project-specific paths with hash
  return homeReplaced.replace(/\/([^\/]+)\/([^\/]+)\//, '/$1/.../');
}
```

### Tool Result Extraction

```typescript
// lib/transcript/extract-tool-results.ts

import { TranscriptMessage, ToolResultBlock } from './parser';

export interface ToolResult {
  toolUseId: string;
  content: string;
  isError: boolean;
  contentLength: number;
}

/**
 * Common error patterns to detect in tool result content.
 * These patterns indicate the tool execution failed.
 */
const ERROR_PATTERNS = [
  /\bError\b/i,           // Generic "Error" (case-insensitive)
  /\bException\b/i,       // Java/Python style exceptions
  /\bfailed\b/i,          // "command failed", "operation failed"
  /\bFAILED\b/,           // Uppercase FAILED (test output)
  /\bdenied\b/i,          // "permission denied"
  /\bno such file\b/i,    // File not found
  /\bcommand not found\b/i,
  /exit code [1-9]/i,     // Non-zero exit codes
  /exited with code [1-9]/i,
];

/**
 * Determine if a tool result indicates an error.
 *
 * Checks in order of priority:
 * 1. Explicit `is_error` field from Claude API (most reliable)
 * 2. Non-zero exit codes in Bash tool results
 * 3. Common error patterns in content
 */
function detectError(resultBlock: ToolResultBlock, content: string): boolean {
  // 1. Check explicit is_error field (if present in the API response)
  if ('is_error' in resultBlock && resultBlock.is_error === true) {
    return true;
  }

  // 2. Check for non-zero exit codes (Bash tool results often include this)
  const exitCodeMatch = content.match(/exit(?:ed with)? code (\d+)/i);
  if (exitCodeMatch && parseInt(exitCodeMatch[1], 10) !== 0) {
    return true;
  }

  // 3. Check for common error patterns
  return ERROR_PATTERNS.some(pattern => pattern.test(content));
}

/**
 * Extract tool results from user messages (which contain tool_result blocks).
 */
export function extractToolResults(messages: TranscriptMessage[]): Map<string, ToolResult> {
  const results = new Map<string, ToolResult>();

  for (const msg of messages) {
    if (msg.type !== 'user' || !msg.message?.content) continue;
    if (!Array.isArray(msg.message.content)) continue;

    for (const block of msg.message.content) {
      if (block.type !== 'tool_result') continue;

      const resultBlock = block as ToolResultBlock;
      const content = typeof resultBlock.content === 'string'
        ? resultBlock.content
        : JSON.stringify(resultBlock.content);

      results.set(resultBlock.tool_use_id, {
        toolUseId: resultBlock.tool_use_id,
        content: content.slice(0, 500), // Truncate for summary
        isError: detectError(resultBlock, content),
        contentLength: content.length,
      });
    }
  }

  return results;
}
```

**Error Detection Notes:**
- The `is_error` field from Claude's API is the most reliable indicator but may not always be present
- Bash tool results should check exit codes - non-zero typically means failure
- Pattern matching is a fallback and may have false positives (e.g., a file named "Error.ts")
- Consider adding tool-specific error detection if needed (e.g., Grep returning empty results is not an error)

### Storage API

```typescript
// lib/api/tool-executions.ts

import { createClient } from '@/lib/supabase/server';
import { ToolExecution as ExtractedToolExecution } from '@/lib/transcript/extract-responses';
import { summarizeToolInput } from '@/lib/transcript/tool-summary';
import { ToolResult, extractToolResults } from '@/lib/transcript/extract-tool-results';

export interface StoredToolExecution {
  id: string;
  response_id: string;
  tool_name: string;
  tool_id: string | null;
  input_summary: string;
  input_full: Record<string, unknown> | null;
  output_summary: string | null;
  result_matched: boolean;
  success: boolean | null;
  execution_order: number;
  created_at: string;
}

/**
 * Store tool executions for a response.
 */
export async function storeToolExecutions(
  responseId: string,
  tools: ExtractedToolExecution[],
  toolResults: Map<string, ToolResult>,
  options?: { storeFullInput?: boolean; redactPaths?: boolean }
): Promise<string[]> {
  const supabase = await createClient();

  const records = tools.map(tool => {
    const { summary } = summarizeToolInput(tool.name, tool.input, {
      redactPaths: options?.redactPaths,
    });

    const result = toolResults.get(tool.toolId);

    return {
      response_id: responseId,
      tool_name: tool.name,
      tool_id: tool.toolId,
      input_summary: summary,
      input_full: options?.storeFullInput ? tool.input : null,
      output_summary: result?.content || null,
      result_matched: !!result,
      success: result ? !result.isError : null,
      execution_order: tool.order,
    };
  });

  const { data, error } = await supabase
    .from('tool_executions')
    .insert(records)
    .select('id');

  if (error) throw error;
  return data.map(d => d.id);
}

/**
 * Get tool usage statistics.
 */
export async function getToolUsageStats(
  teamId: string,
  options?: { since?: Date; limit?: number }
): Promise<{
  byTool: { name: string; count: number; successRate: number }[];
  totalExecutions: number;
  uniqueTools: number;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_tool_usage_stats', {
    p_team_id: teamId,
    p_since: options?.since?.toISOString(),
    p_limit: options?.limit || 20,
  });

  if (error) throw error;

  return {
    byTool: data.by_tool,
    totalExecutions: data.total_executions,
    uniqueTools: data.unique_tools,
  };
}
```

### Aggregation Functions

```sql
-- Add to migration

CREATE OR REPLACE FUNCTION get_tool_usage_stats(
  p_team_id UUID,
  p_since TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'by_tool', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT
          te.tool_name as name,
          COUNT(*) as count,
          ROUND(
            COALESCE(SUM(CASE WHEN te.success THEN 1 ELSE 0 END)::DECIMAL / NULLIF(COUNT(*), 0), 0) * 100,
            1
          ) as success_rate
        FROM tool_executions te
        JOIN prompt_responses pr ON pr.id = te.response_id
        JOIN prompts p ON p.id = pr.prompt_id
        WHERE p.team_id = p_team_id
          AND (p_since IS NULL OR te.created_at >= p_since)
        GROUP BY te.tool_name
        ORDER BY count DESC
        LIMIT p_limit
      ) t
    ),
    'total_executions', (
      SELECT COUNT(*)
      FROM tool_executions te
      JOIN prompt_responses pr ON pr.id = te.response_id
      JOIN prompts p ON p.id = pr.prompt_id
      WHERE p.team_id = p_team_id
        AND (p_since IS NULL OR te.created_at >= p_since)
    ),
    'unique_tools', (
      SELECT COUNT(DISTINCT te.tool_name)
      FROM tool_executions te
      JOIN prompt_responses pr ON pr.id = te.response_id
      JOIN prompts p ON p.id = pr.prompt_id
      WHERE p.team_id = p_team_id
        AND (p_since IS NULL OR te.created_at >= p_since)
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Data Flow

```
Assistant Response
      │
      ▼
┌─────────────────┐
│ Extract tool_use│
│ blocks          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐       ┌─────────────────┐
│ Summarize input │       │ Find tool_result│
│ per tool type   │       │ by tool_use_id  │
└────────┬────────┘       └────────┬────────┘
         │                         │
         └────────────┬────────────┘
                      ▼
           ┌─────────────────┐
           │ Store in        │
           │ tool_executions │
           └─────────────────┘
```

### File Structure

| File | Path |
|------|------|
| Migration | `app/supabase/migrations/YYYYMMDDHHMMSS_add_tool_executions.sql` |
| Tool Summary | `app/lib/transcript/tool-summary.ts` |
| Tool Results | `app/lib/transcript/extract-tool-results.ts` |
| API Functions | `app/lib/api/tool-executions.ts` |
| Tests | `app/lib/transcript/__tests__/tool-summary.test.ts` |

### Common Tools Reference

| Tool | Key Input Fields | Summary Pattern |
|------|------------------|-----------------|
| Read | `file_path` | `Read: {path}` |
| Write | `file_path`, `content` | `Write: {path} ({len} chars)` |
| Edit | `file_path`, `old_string`, `new_string` | `Edit: {path} ({old} -> {new} chars)` |
| Bash | `command` | `Bash: {cmd truncated}` |
| Glob | `pattern`, `path` | `Glob: {pattern} in {path}` |
| Grep | `pattern`, `path` | `Grep: "{pattern}" in {path}` |
| WebFetch | `url` | `WebFetch: {url}` |
| WebSearch | `query` | `WebSearch: "{query}"` |

### Verification Checklist
- [ ] tool_executions table is created correctly
- [ ] Foreign key to prompt_responses works
- [ ] Cascade delete removes tool executions when response deleted
- [ ] Input summarization works for all common tools
- [ ] Tool results are matched by tool_use_id
- [ ] Success is correctly derived from result content (using `detectError()`)
- [ ] Unmatched tool_use blocks (no tool_result) are stored with result_matched=false
- [ ] RLS policies restrict access appropriately
- [ ] Aggregation functions return correct stats
- [ ] Path anonymization works when enabled

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
