# Story 17.3: Batch Import Processing

Status: 🔲 Ready

**Dependencies:** Story 17-1 (Transcript Discovery Service), Story 17-4 (Deduplication Logic)

## Story

**As a** user importing historical prompts,
**I want** the import to process transcripts in manageable batches,
**So that** the import completes reliably without timeouts or overwhelming the system.

## Acceptance Criteria

1. **Given** I have selected projects to import
   **When** the import process starts
   **Then** prompts are extracted from JSONL files and uploaded in batches of 100

2. **Given** a batch is being processed
   **When** an individual prompt fails to parse
   **Then** it is logged and skipped
   **And** the batch continues processing remaining prompts

3. **Given** a session JSONL file exists
   **When** it is processed
   **Then** user message + assistant response pairs are extracted correctly
   **And** timestamps are preserved from the original messages

4. **Given** a batch upload fails due to network error
   **When** the error occurs
   **Then** the batch is retried up to 3 times with exponential backoff
   **And** after exhausting retries, the batch is marked as failed

5. **Given** the import is processing multiple projects
   **When** one project fails entirely
   **Then** the failure is logged
   **And** processing continues with the next project

6. **Given** the import completes
   **When** all projects have been processed
   **Then** a summary is returned with:
   - Total prompts imported successfully
   - Total prompts failed
   - List of failed sessions (if any)

7. **Given** an import is interrupted (user closes browser, network error)
   **When** the user returns to the import page
   **Then** they can resume from where the import stopped
   **And** already-imported prompts are not re-imported

8. **Given** prompts are being imported
   **When** a batch is inserted
   **Then** analysis jobs are queued asynchronously
   **And** the import continues without waiting for analysis

## Tasks / Subtasks

- [ ] **Task 1: Create JSONL parser** (AC: #3)
  - [ ] Create `lib/import/parser.ts` file
  - [ ] Parse JSONL line by line using streaming
  - [ ] Extract user messages with `"type":"user"`
  - [ ] Extract corresponding assistant responses
  - [ ] Preserve original timestamps from messages
  - [ ] Handle malformed JSON lines gracefully

- [ ] **Task 2: Implement prompt-response pairing** (AC: #3)
  - [ ] Create `extractPairsFromSession()` function
  - [ ] Match user messages with subsequent assistant responses
  - [ ] Handle cases where response is missing (interrupted sessions)
  - [ ] Return array of `PromptResponsePair` objects

- [ ] **Task 3: Create batch processor** (AC: #1, #2)
  - [ ] Create `lib/import/batch.ts` file
  - [ ] Implement `importProject()` function per architecture
  - [ ] Process prompts in batches of 100 (configurable)
  - [ ] Track success and failure counts per batch
  - [ ] Skip invalid prompts without stopping batch

- [ ] **Task 4: Implement upload batch function** (AC: #1)
  - [ ] Create `uploadBatch()` function
  - [ ] Call `/api/prompts/batch` endpoint
  - [ ] Format payload according to batch upload schema
  - [ ] Return success/failure status for batch

- [ ] **Task 5: Add retry logic** (AC: #4)
  - [ ] Implement exponential backoff retry for network failures
  - [ ] Maximum 3 retries with delays: 1s, 2s, 4s
  - [ ] Distinguish between retryable and non-retryable errors
  - [ ] Log retry attempts

- [ ] **Task 6: Create project import orchestrator** (AC: #5, #6)
  - [ ] Create `lib/import/orchestrator.ts` file
  - [ ] Implement `importProjects()` that processes multiple projects
  - [ ] Continue to next project on individual project failure
  - [ ] Aggregate results across all projects
  - [ ] Provide progress callback for UI updates

- [ ] **Task 7: Create batch upload API endpoint** (AC: #1, #8)
  - [ ] Create `app/api/import/batch/route.ts`
  - [ ] Validate batch payload structure
  - [ ] Insert prompts and responses in transaction
  - [ ] Handle deduplication (defer to Story 17-4)
  - [ ] Queue analysis jobs asynchronously after batch insert
  - [ ] Return batch processing result

- [ ] **Task 8: Implement import resume capability** (AC: #7)
  - [ ] Track import progress in database (import_id, last_completed_batch)
  - [ ] Create `getImportState()` function to check for incomplete imports
  - [ ] Implement `resumeImport()` function to continue from last checkpoint
  - [ ] Use deduplication (Story 17-4) to prevent re-importing existing prompts
  - [ ] Add UI state to show "Resume Import" option when incomplete import exists

## Dev Notes

### Critical Architecture Constraints

**Batch Size:** 100 prompts per batch (PRD requirement)
**Retry Strategy:** Exponential backoff with 3 max retries
**Processing Location:** Parser runs locally, upload goes to server

### Performance Target

**Requirement:** Import 1000 prompts in less than 60 seconds (PRD non-functional requirement)

This target assumes:
- Reasonable network latency
- Batches of 100 prompts = 10 API calls for 1000 prompts
- Each batch should complete in ~5-6 seconds including parsing and upload

### Batch Processing Implementation

From `_bmad-output/architecture-phase2.md` (Line 775-808):

```typescript
// lib/import/batch.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { extractPairsFromSession } from './parser';
import type { PromptResponsePair, ImportResult } from './types';

const BATCH_SIZE = 100;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

export async function importProject(
  projectPath: string,
  onProgress: (count: number, total: number) => void
): Promise<ImportResult> {
  const sessions = await listSessions(projectPath);
  let success = 0;
  let failed = 0;
  let processed = 0;
  const failedSessions: string[] = [];

  for (const session of sessions) {
    try {
      const pairs = await extractPairsFromSession(session);

      // Process in batches
      for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
        const batch = pairs.slice(i, i + BATCH_SIZE);
        const result = await uploadBatchWithRetry(batch);

        if (result.success) {
          success += batch.length;
        } else {
          failed += batch.length;
        }
      }
    } catch (e) {
      const error = e as Error;
      console.error(`Failed to process session ${session}:`, error.message);
      failedSessions.push(session);
      failed += 1;
    }

    processed += 1;
    onProgress(processed, sessions.length);
  }

  return { success, failed, failedSessions };
}

async function listSessions(projectPath: string): Promise<string[]> {
  const entries = await fs.readdir(projectPath);
  return entries
    .filter(f => f.endsWith('.jsonl'))
    .map(f => path.join(projectPath, f));
}

async function uploadBatchWithRetry(
  batch: PromptResponsePair[]
): Promise<{ success: boolean; error?: string }> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await uploadBatch(batch);
      return { success: true };
    } catch (e) {
      const error = e as Error;

      // Non-retryable errors
      if (error.message.includes('validation') || error.message.includes('401')) {
        return { success: false, error: error.message };
      }

      // Last attempt failed
      if (attempt === MAX_RETRIES) {
        return { success: false, error: `Failed after ${MAX_RETRIES} retries: ${error.message}` };
      }

      // Wait before retry
      await sleep(RETRY_DELAYS[attempt]);
    }
  }

  return { success: false, error: 'Unknown error' };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### JSONL Parser Implementation

From architecture (Line 455-522):

```typescript
// lib/import/parser.ts
import * as readline from 'readline';
import * as fs from 'fs';
import type { PromptResponsePair, ParsedMessage } from './types';

export async function extractPairsFromSession(
  sessionPath: string
): Promise<PromptResponsePair[]> {
  const messages = await parseJsonlFile(sessionPath);
  return pairMessages(messages);
}

async function parseJsonlFile(filePath: string): Promise<ParsedMessage[]> {
  return new Promise((resolve, reject) => {
    const messages: ParsedMessage[] = [];
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      if (!line.trim()) return;

      try {
        const msg = JSON.parse(line);

        if (msg.type === 'user') {
          messages.push({
            type: 'user',
            content: extractUserContent(msg),
            timestamp: msg.timestamp,
            uuid: msg.uuid,
          });
        } else if (msg.type === 'assistant') {
          messages.push({
            type: 'assistant',
            content: extractAssistantContent(msg),
            timestamp: msg.timestamp,
            model: msg.message?.model,
            tokens: extractTokens(msg),
          });
        }
      } catch (e) {
        // Log and skip malformed lines
        console.warn(`Skipping malformed line in ${filePath}:`, line.substring(0, 100));
      }
    });

    rl.on('close', () => resolve(messages));
    rl.on('error', reject);
  });
}

function extractUserContent(msg: any): string {
  // Handle nested content structure
  if (typeof msg.message?.content === 'string') {
    return msg.message.content;
  }
  if (Array.isArray(msg.message?.content)) {
    return msg.message.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('\n');
  }
  return '';
}

function extractAssistantContent(msg: any): string {
  if (typeof msg.message?.content === 'string') {
    return msg.message.content;
  }
  if (Array.isArray(msg.message?.content)) {
    return msg.message.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('\n');
  }
  return '';
}

function extractTokens(msg: any): { input: number; output: number } | undefined {
  const usage = msg.message?.usage;
  if (!usage) return undefined;
  return {
    input: usage.input_tokens || 0,
    output: usage.output_tokens || 0,
  };
}

function pairMessages(messages: ParsedMessage[]): PromptResponsePair[] {
  const pairs: PromptResponsePair[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (msg.type === 'user') {
      // Find next assistant message
      const response = messages[i + 1]?.type === 'assistant' ? messages[i + 1] : null;

      pairs.push({
        prompt: {
          text: msg.content,
          timestamp: msg.timestamp,
        },
        response: response
          ? {
              text: response.content,
              model: response.model || 'unknown',
              tokens: response.tokens,
            }
          : null, // No response (interrupted session)
      });
    }
  }

  return pairs;
}
```

### Import Types

```typescript
// lib/import/types.ts (additions)
export interface ParsedMessage {
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  uuid?: string;
  model?: string;
  tokens?: { input: number; output: number };
}

export interface PromptResponsePair {
  prompt: {
    text: string;
    timestamp: string;
  };
  response: {
    text: string;
    model: string;
    tokens?: { input: number; output: number };
  } | null;
}

export interface ImportResult {
  success: number;
  failed: number;
  failedSessions: string[];
}

export interface BatchUploadRequest {
  pairs: Array<{
    prompt: {
      text: string;
      timestamp: string;
      session_id?: string;
    };
    response: {
      text: string;
      model: string;
      tokens?: { input: number; output: number };
    } | null;
  }>;
  projectPath: string;
  importId: string;
}
```

### Batch Upload API Endpoint

```typescript
// app/api/import/batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { BatchUploadRequest } from '@/lib/import/types';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: BatchUploadRequest = await request.json();

    // Validate required fields
    if (!body.pairs || !Array.isArray(body.pairs)) {
      return NextResponse.json(
        { error: 'Invalid batch format: pairs array required' },
        { status: 400 }
      );
    }

    // Get user's default team and project
    const { data: membership } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'No team found' }, { status: 400 });
    }

    // Insert prompts in a batch
    const promptsToInsert = body.pairs.map(pair => ({
      team_id: membership.team_id,
      user_id: user.id,
      text: pair.prompt.text,
      char_count: pair.prompt.text.length,
      word_count: pair.prompt.text.split(/\s+/).length,
      created_at: pair.prompt.timestamp,
      analysis_status: 'pending',
      source: 'historical_import',
      import_id: body.importId,
    }));

    const { data: insertedPrompts, error: insertError } = await supabase
      .from('prompts')
      .insert(promptsToInsert)
      .select('id');

    if (insertError) {
      console.error('Batch insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to insert prompts', details: insertError.message },
        { status: 500 }
      );
    }

    // Insert responses for prompts that have them
    const responsesToInsert = body.pairs
      .map((pair, index) => {
        if (!pair.response || !insertedPrompts?.[index]) return null;
        return {
          prompt_id: insertedPrompts[index].id,
          text: pair.response.text,
          model: pair.response.model,
          input_tokens: pair.response.tokens?.input || 0,
          output_tokens: pair.response.tokens?.output || 0,
        };
      })
      .filter(Boolean);

    if (responsesToInsert.length > 0) {
      const { error: responseError } = await supabase
        .from('prompt_responses')
        .insert(responsesToInsert);

      if (responseError) {
        console.warn('Response insert error (non-fatal):', responseError);
      }
    }

    return NextResponse.json({
      success: true,
      imported: insertedPrompts?.length || 0,
    });
  } catch (error) {
    console.error('Batch upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Project Import Orchestrator

```typescript
// lib/import/orchestrator.ts
import { importProject } from './batch';
import type { DiscoveredProject, ImportResult } from './types';

export interface OrchestratorProgress {
  currentProject: string;
  projectIndex: number;
  totalProjects: number;
  sessionProgress: number;
  totalSessions: number;
}

export interface OrchestratorResult {
  totalImported: number;
  totalFailed: number;
  projectResults: Map<string, ImportResult>;
}

export async function importProjects(
  projects: DiscoveredProject[],
  onProgress: (progress: OrchestratorProgress) => void
): Promise<OrchestratorResult> {
  const projectResults = new Map<string, ImportResult>();
  let totalImported = 0;
  let totalFailed = 0;

  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];

    try {
      const result = await importProject(
        project.normalizedPath,
        (sessionProgress, totalSessions) => {
          onProgress({
            currentProject: project.path,
            projectIndex: i,
            totalProjects: projects.length,
            sessionProgress,
            totalSessions,
          });
        }
      );

      projectResults.set(project.normalizedPath, result);
      totalImported += result.success;
      totalFailed += result.failed;
    } catch (e) {
      const error = e as Error;
      console.error(`Failed to import project ${project.path}:`, error.message);

      projectResults.set(project.normalizedPath, {
        success: 0,
        failed: project.totalPrompts, // Mark all as failed
        failedSessions: [],
      });
      totalFailed += project.totalPrompts;
    }
  }

  return { totalImported, totalFailed, projectResults };
}
```

### File Locations

| File | Purpose |
|------|---------|
| `lib/import/parser.ts` | JSONL parsing and message extraction |
| `lib/import/batch.ts` | Batch processing with retry logic |
| `lib/import/orchestrator.ts` | Multi-project import coordination |
| `lib/import/types.ts` | TypeScript interfaces |
| `app/api/import/batch/route.ts` | Batch upload API endpoint |

### JSONL Message Schema Reference

From architecture (Line 407-425):

```typescript
// User message structure in JSONL
{
  "type": "user",
  "uuid": "abc123",
  "timestamp": "2025-01-15T10:30:00Z",
  "message": {
    "content": [
      { "type": "text", "text": "User's prompt text here" }
    ]
  }
}

// Assistant message structure in JSONL
{
  "type": "assistant",
  "uuid": "def456",
  "timestamp": "2025-01-15T10:30:05Z",
  "message": {
    "model": "claude-3-sonnet",
    "content": [
      { "type": "text", "text": "Assistant's response here" }
    ],
    "usage": {
      "input_tokens": 150,
      "output_tokens": 500
    }
  }
}
```

### Error Handling Strategy

| Error Type | Behavior |
|------------|----------|
| Malformed JSON line | Log warning, skip line, continue |
| Parse error in session | Log error, skip session, continue |
| Network error (batch) | Retry with exponential backoff (3x) |
| Auth error (401) | Stop immediately, return error |
| Project failure | Log error, continue to next project |

### Common Pitfalls to Avoid

1. **DO NOT** load entire JSONL file into memory - use streaming
2. **DO NOT** retry non-retryable errors (validation, auth)
3. **DO NOT** stop all imports when one project fails
4. **DO NOT** forget to handle interrupted sessions (no response)
5. **DO NOT** use fixed delays - implement exponential backoff
6. **DO NOT** ignore token usage data from responses
7. **DO NOT** batch more than 100 prompts at once

### Verification Checklist

After completing this story, verify:
- [ ] JSONL files are parsed correctly with streaming
- [ ] User messages are extracted with proper content handling
- [ ] Assistant responses are paired with user messages
- [ ] Timestamps are preserved from original messages
- [ ] Batches of 100 prompts are uploaded at a time
- [ ] Malformed lines are skipped without stopping parse
- [ ] Network errors trigger retry with exponential backoff
- [ ] After 3 retries, batch is marked as failed
- [ ] Processing continues when a project fails
- [ ] Final summary shows success and failure counts
- [ ] Token usage is captured when available
- [ ] Interrupted sessions (no response) are handled gracefully
- [ ] Import can be resumed after interruption (AC #7)
- [ ] Already-imported prompts are not re-imported on resume
- [ ] Analysis jobs are queued asynchronously after batch insert (AC #8)
- [ ] Import continues without waiting for analysis completion
- [ ] 1000 prompts import completes in less than 60 seconds


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
