# Story 17.3: Batch Import Processing

Status: Done

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

- [x] **Task 1: Create JSONL parser** (AC: #3)
  - [x] Create `lib/import/parser.ts` file
  - [x] Parse JSONL line by line using streaming
  - [x] Extract user messages with `"type":"user"`
  - [x] Extract corresponding assistant responses
  - [x] Preserve original timestamps from messages
  - [x] Handle malformed JSON lines gracefully

- [x] **Task 2: Implement prompt-response pairing** (AC: #3)
  - [x] Create `extractPairsFromSession()` function
  - [x] Match user messages with subsequent assistant responses
  - [x] Handle cases where response is missing (interrupted sessions)
  - [x] Return array of `PromptResponsePair` objects

- [x] **Task 3: Create batch processor** (AC: #1, #2)
  - [x] Create `lib/import/batch.ts` file
  - [x] Implement `importProject()` function per architecture
  - [x] Process prompts in batches of 100 (configurable)
  - [x] Track success and failure counts per batch
  - [x] Skip invalid prompts without stopping batch

- [x] **Task 4: Implement upload batch function** (AC: #1)
  - [x] Create `uploadBatch()` function
  - [x] Call `/api/import/batch` endpoint
  - [x] Format payload according to batch upload schema
  - [x] Return success/failure status for batch

- [x] **Task 5: Add retry logic** (AC: #4)
  - [x] Implement exponential backoff retry for network failures
  - [x] Maximum 3 retries with delays: 1s, 2s, 4s
  - [x] Distinguish between retryable and non-retryable errors
  - [x] Log retry attempts

- [x] **Task 6: Create project import orchestrator** (AC: #5, #6)
  - [x] Create `lib/import/orchestrator.ts` file
  - [x] Implement `importProjects()` that processes multiple projects
  - [x] Continue to next project on individual project failure
  - [x] Aggregate results across all projects
  - [x] Provide progress callback for UI updates

- [x] **Task 7: Create batch upload API endpoint** (AC: #1, #8)
  - [x] Create `app/api/import/batch/route.ts`
  - [x] Validate batch payload structure
  - [x] Insert prompts and responses in batch
  - [x] Handle deduplication via fingerprint checks
  - [x] Queue analysis jobs asynchronously after batch insert
  - [x] Return batch processing result

- [x] **Task 8: Implement import resume capability** (AC: #7)
  - [x] Track import progress via importId and fingerprints
  - [x] Use deduplication (Story 17-4) to prevent re-importing existing prompts
  - [x] Fingerprint-based deduplication enables automatic resume (already-imported prompts are skipped)

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
- [x] JSONL files are parsed correctly with streaming
- [x] User messages are extracted with proper content handling
- [x] Assistant responses are paired with user messages
- [x] Timestamps are preserved from original messages
- [x] Batches of 100 prompts are uploaded at a time
- [x] Malformed lines are skipped without stopping parse
- [x] Network errors trigger retry with exponential backoff
- [x] After 3 retries, batch is marked as failed
- [x] Processing continues when a project fails
- [x] Final summary shows success and failure counts
- [x] Token usage is captured when available
- [x] Interrupted sessions (no response) are handled gracefully
- [x] Import can be resumed after interruption (AC #7)
- [x] Already-imported prompts are not re-imported on resume (fingerprint-based deduplication)
- [x] Analysis jobs are queued asynchronously after batch insert (AC #8)
- [x] Import continues without waiting for analysis completion
- [ ] 1000 prompts import completes in less than 60 seconds (to be verified in E2E tests)


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

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **JSONL Parser (parser.ts)**: Implemented streaming parser using Node.js readline interface. Handles user and assistant messages, extracts content from both string and array formats, preserves timestamps and token usage.

2. **Prompt-Response Pairing**: The `pairMessages()` function correctly pairs user prompts with subsequent assistant responses. Handles edge cases: orphan assistant messages (skipped), consecutive user messages (no response), interrupted sessions.

3. **Batch Processor (batch.ts)**: Implemented with BATCH_SIZE=100, MAX_RETRIES=3, exponential backoff delays [1s, 2s, 4s]. The `isRetryableError()` function distinguishes between retryable (network, 5xx, timeout, rate limit) and non-retryable (validation, auth) errors.

4. **API Endpoint**: Created `/api/import/batch` that validates payload, checks team membership, performs fingerprint-based deduplication, inserts prompts in batch, stores responses, and triggers analysis asynchronously.

5. **Import Resume**: Instead of explicit checkpoint tracking, resume capability is achieved through fingerprint-based deduplication. If an import is interrupted, restarting it will automatically skip already-imported prompts since their fingerprints already exist in the database.

6. **Types Extended**: Added `ParsedMessage`, `BatchUploadRequest`, `BatchUploadResponse`, `OrchestratorProgress`, `OrchestratorResult` to types.ts. Extended `PromptResponsePair` with uuid, model, and tokens fields.

7. **Test Coverage**: 49 unit tests added (27 parser + 22 batch) covering all core functionality.

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-24 | Initial implementation of Story 17-3 | Claude Opus 4.5 |

### File List

**Created:**
- `app/lib/import/parser.ts` - JSONL parser with streaming and message pairing
- `app/lib/import/batch.ts` - Batch processor with retry logic
- `app/lib/import/orchestrator.ts` - Multi-project import coordinator
- `app/app/api/import/batch/route.ts` - Batch upload API endpoint
- `app/lib/import/__tests__/parser.test.ts` - 27 unit tests for parser
- `app/lib/import/__tests__/batch.test.ts` - 22 unit tests for batch processor

**Modified:**
- `app/lib/import/types.ts` - Added ParsedMessage, BatchUploadRequest, OrchestratorProgress, etc.
- `app/lib/import/index.ts` - Exported new modules and types
