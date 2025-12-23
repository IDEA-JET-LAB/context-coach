# Story 18.2: Session State Snapshot

Status: Ready

## PRD Alignment Note

The PRD Epic 18 story "AI-Powered Context Summarization" has been decomposed into focused implementation stories:
- **Story 18-1:** Interrupted Session Detection - Detects when sessions end abnormally
- **Story 18-2:** Session State Snapshot (this story) - Captures raw session state data
- **Story 18-3:** Recovery Prompt Generator - Applies AI summarization to generate recovery prompts

This story focuses on the data capture aspect; AI-powered summarization is handled in Story 18-3.

## Story

**As a** developer resuming work after a crash,
**I want** the system to capture a comprehensive snapshot of my last session state,
**So that** I have full context about what I was working on, including files touched, tools used, and conversation flow.

## Acceptance Criteria

1. **Given** an interrupted session has been detected
   **When** the system captures the session state
   **Then** it extracts the last 20 messages from the transcript
   **And** identifies all files that were read, written, or modified

2. **Given** the session transcript contains tool invocations
   **When** extracting session state
   **Then** it builds a list of unique tools used with their last invocation context
   **And** identifies any pending or in-progress tool operations

3. **Given** the session contains conversation context
   **When** building the snapshot
   **Then** it identifies the main task/goal from the conversation
   **And** captures any error messages or blockers encountered

4. **Given** a session with git operations
   **When** extracting state
   **Then** it captures the branch name from transcript or local git state
   **And** includes any uncommitted changes context if mentioned

5. **Given** the snapshot is created
   **When** stored for recovery
   **Then** it is persisted in extension state with session ID as key
   **And** expires after 7 days if not used
   **And** user can manually clear stored snapshots via extension command

## Tasks / Subtasks

- [ ] **Task 1: Define session state snapshot interface** (AC: #1, #2, #3, #4)
  - [ ] Create `packages/vscode-extension/src/types/sessionState.ts`
  - [ ] Define `SessionStateSnapshot` interface:
    ```typescript
    interface SessionStateSnapshot {
      sessionId: string;
      capturedAt: Date;
      recentMessages: TranscriptMessage[];
      filesAffected: FileOperation[];
      toolsUsed: ToolUsageSummary[];
      pendingOperations: PendingOperation[];
      conversationContext: ConversationContext;
      gitContext: GitContext | null;
    }
    ```
  - [ ] Define supporting interfaces for file operations, tools, etc.

- [ ] **Task 2: Extract recent messages with context** (AC: #1)
  - [ ] Create `extractRecentMessages(messages, count)` function
  - [ ] Get last N messages (default 20)
  - [ ] Preserve message order and relationships (parentUuid)
  - [ ] Include both user prompts and assistant responses
  - [ ] Truncate very long messages (> 2000 chars) for storage efficiency

- [ ] **Task 3: Build file operation summary** (AC: #1)
  - [ ] Create `extractFileOperations(messages)` function
  - [ ] Parse tool_use messages for file-related tools: Read, Write, Edit, Glob, Grep
  - [ ] Track file paths from tool arguments
  - [ ] Categorize by operation type: read, write, edit, search
  - [ ] Deduplicate paths (keep last operation type per file)
  - [ ] Resolve relative paths to absolute where possible

- [ ] **Task 4: Summarize tool usage** (AC: #2)
  - [ ] Create `extractToolUsage(messages)` function
  - [ ] Iterate through all assistant messages
  - [ ] Extract tool_use blocks from message content
  - [ ] Build map of tool name -> usage count, last args
  - [ ] Identify any tool calls without corresponding tool_result (pending)
  - [ ] Return sorted by recency

- [ ] **Task 5: Extract conversation context** (AC: #3)
  - [ ] Create `extractConversationContext(messages)` function
  - [ ] Find first user message for initial task description
  - [ ] Track topic changes based on message content
  - [ ] Identify error messages (type: 'error' or error keywords in content)
  - [ ] Summarize current state: "Was working on X, last action was Y"
  - [ ] Return structured context object

- [ ] **Task 6: Capture git context** (AC: #4)
  - [ ] Create `extractGitContext(messages, projectPath)` function
  - [ ] Parse messages for git-related tool calls (Bash with git commands)
  - [ ] Extract branch name from `git branch`, `git status`, or `git checkout` outputs
  - [ ] Check for uncommitted changes mentions
  - [ ] Optionally read local `.git/HEAD` for current branch as fallback
  - [ ] Handle missing git context gracefully (return null)

- [ ] **Task 7: Implement snapshot persistence** (AC: #5)
  - [ ] Create `snapshotStore` service using VS Code globalState
  - [ ] Implement `saveSnapshot(snapshot)` function
  - [ ] Implement `getSnapshot(sessionId)` function
  - [ ] Implement `cleanExpiredSnapshots()` function (> 7 days old)
  - [ ] Implement `clearAllSnapshots()` function for user-triggered cleanup
  - [ ] Register `contextor.clearSnapshots` VS Code command
  - [ ] Run cleanup on extension activation
  - [ ] Key format: `contextor.snapshot.{sessionId}`

- [ ] **Task 8: Create main snapshot builder** (AC: #1-5)
  - [ ] Create `packages/vscode-extension/src/services/snapshotBuilder.ts`
  - [ ] Implement `buildSessionSnapshot(interruptedSession)` main function
  - [ ] Orchestrate all extraction functions
  - [ ] Handle partial failures (continue with available data)
  - [ ] Return complete SessionStateSnapshot

## Dev Notes

### Session State Snapshot Interface

```typescript
// packages/vscode-extension/src/types/sessionState.ts

export interface SessionStateSnapshot {
  sessionId: string;
  capturedAt: Date;
  recentMessages: SummarizedMessage[];
  filesAffected: FileOperation[];
  toolsUsed: ToolUsageSummary[];
  pendingOperations: PendingOperation[];
  conversationContext: ConversationContext;
  gitContext: GitContext | null;
  expiresAt: Date;
}

export interface SummarizedMessage {
  uuid: string;
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result';
  content: string;  // Truncated if > 2000 chars
  timestamp?: Date;
}

export interface FileOperation {
  path: string;
  operation: 'read' | 'write' | 'edit' | 'search';
  lastAccessed: Date;
}

export interface ToolUsageSummary {
  name: string;
  count: number;
  lastArgs: Record<string, unknown>;
  lastInvokedAt: Date;
}

export interface PendingOperation {
  toolName: string;
  args: Record<string, unknown>;
  startedAt: Date;
}

export interface ConversationContext {
  initialTask: string;
  currentTask: string;
  lastAction: string;
  errors: string[];
  blockers: string[];
}

export interface GitContext {
  branch: string;
  hasUncommittedChanges: boolean;
  lastGitOperation: string | null;
}
```

### File Operations Extraction

```typescript
const FILE_TOOLS = {
  'Read': 'read',
  'Write': 'write',
  'Edit': 'edit',
  'Glob': 'search',
  'Grep': 'search',
} as const;

function extractFileOperations(messages: TranscriptMessage[]): FileOperation[] {
  const fileOps = new Map<string, FileOperation>();

  for (const msg of messages) {
    if (msg.type !== 'assistant') continue;

    const content = msg.message?.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (block.type !== 'tool_use') continue;

      const opType = FILE_TOOLS[block.name as keyof typeof FILE_TOOLS];
      if (!opType) continue;

      const path = block.input?.file_path || block.input?.path;
      if (!path) continue;

      fileOps.set(path, {
        path,
        operation: opType,
        lastAccessed: new Date(msg.timestamp || Date.now()),
      });
    }
  }

  return Array.from(fileOps.values());
}
```

### Pending Operations Detection

A tool_use is "pending" if there's no matching tool_result with the same id:

```typescript
function findPendingOperations(messages: TranscriptMessage[]): PendingOperation[] {
  const toolCalls = new Map<string, { name: string; args: unknown; timestamp: Date }>();
  const completedIds = new Set<string>();

  for (const msg of messages) {
    if (msg.type === 'tool_result') {
      completedIds.add(msg.tool_use_id);
    }

    if (msg.type === 'assistant') {
      const content = msg.message?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'tool_use') {
            toolCalls.set(block.id, {
              name: block.name,
              args: block.input,
              timestamp: new Date(msg.timestamp || Date.now()),
            });
          }
        }
      }
    }
  }

  // Find uncompleted tool calls
  const pending: PendingOperation[] = [];
  for (const [id, call] of toolCalls) {
    if (!completedIds.has(id)) {
      pending.push({
        toolName: call.name,
        args: call.args as Record<string, unknown>,
        startedAt: call.timestamp,
      });
    }
  }

  return pending;
}
```

### Conversation Context Extraction

```typescript
function extractConversationContext(messages: TranscriptMessage[]): ConversationContext {
  const userMessages = messages.filter(m =>
    m.type === 'user' && typeof m.message?.content === 'string'
  );
  const errorMessages = messages.filter(m =>
    m.type === 'error' ||
    (typeof m.message?.content === 'string' &&
     m.message.content.toLowerCase().includes('error'))
  );

  const initialTask = userMessages[0]?.message?.content?.slice(0, 200) || 'Unknown';
  const lastUserMsg = userMessages[userMessages.length - 1];
  const currentTask = lastUserMsg?.message?.content?.slice(0, 200) || initialTask;

  // Find last action from assistant
  const lastAssistant = [...messages].reverse().find(m => m.type === 'assistant');
  const lastAction = summarizeAssistantAction(lastAssistant);

  return {
    initialTask,
    currentTask,
    lastAction,
    errors: errorMessages.map(m => m.message?.content?.slice(0, 100) || 'Error'),
    blockers: [],  // Could be enhanced with AI analysis
  };
}
```

### Storage in VS Code Extension State

```typescript
// packages/vscode-extension/src/services/snapshotStore.ts

import * as vscode from 'vscode';

const SNAPSHOT_PREFIX = 'contextor.snapshot.';
const EXPIRY_DAYS = 7;

export class SnapshotStore {
  constructor(private context: vscode.ExtensionContext) {}

  async saveSnapshot(snapshot: SessionStateSnapshot): Promise<void> {
    snapshot.expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const key = SNAPSHOT_PREFIX + snapshot.sessionId;
    await this.context.globalState.update(key, JSON.stringify(snapshot));
  }

  getSnapshot(sessionId: string): SessionStateSnapshot | null {
    const key = SNAPSHOT_PREFIX + sessionId;
    const data = this.context.globalState.get<string>(key);
    if (!data) return null;

    const snapshot = JSON.parse(data) as SessionStateSnapshot;
    if (new Date(snapshot.expiresAt) < new Date()) {
      this.context.globalState.update(key, undefined);
      return null;
    }

    return snapshot;
  }

  async cleanExpiredSnapshots(): Promise<number> {
    const keys = this.context.globalState.keys();
    let cleaned = 0;

    for (const key of keys) {
      if (!key.startsWith(SNAPSHOT_PREFIX)) continue;

      const data = this.context.globalState.get<string>(key);
      if (!data) continue;

      try {
        const snapshot = JSON.parse(data);
        if (new Date(snapshot.expiresAt) < new Date()) {
          await this.context.globalState.update(key, undefined);
          cleaned++;
        }
      } catch {
        // Invalid data, clean it up
        await this.context.globalState.update(key, undefined);
        cleaned++;
      }
    }

    return cleaned;
  }

  async clearAllSnapshots(): Promise<number> {
    const keys = this.context.globalState.keys();
    let cleared = 0;

    for (const key of keys) {
      if (!key.startsWith(SNAPSHOT_PREFIX)) continue;
      await this.context.globalState.update(key, undefined);
      cleared++;
    }

    return cleared;
  }
}
```

### Performance Considerations

1. **Message truncation**: Limit content to 2000 chars to reduce storage
2. **Lazy extraction**: Only build full snapshot when recovery is triggered
3. **Incremental updates**: Update snapshot as new messages arrive (if monitoring)
4. **Memory limits**: Cap total snapshot size at 1MB

### Test Scenarios

1. Session with only user messages - should capture basic context
2. Session with file operations - should list affected files
3. Session with pending tool call - should identify as pending
4. Session with git commands - should extract branch info
5. Session with errors - should capture error messages
6. Expired snapshot - should return null and clean up
7. Very long messages - should truncate properly
8. Corrupted stored snapshot - should handle gracefully
9. User clears all snapshots - should remove all stored snapshots and return count

## Dependencies

- **Depends on:** Story 18-1 (Interrupted Session Detection)
- **Blocks:** Story 18-3 (Recovery Prompt Generator)


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
