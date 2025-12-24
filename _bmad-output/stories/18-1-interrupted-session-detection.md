# Story 18.1: Interrupted Session Detection

Status: Done

## Story

**As a** developer using Claude Code,
**I want** the system to automatically detect when my sessions ended abnormally (crash, disconnect, force quit),
**So that** I can be notified and offered assistance to resume my work.

## Acceptance Criteria

1. **Given** the VS Code extension is running
   **When** it scans the `~/.claude/projects` directory
   **Then** it identifies all JSONL session files across all projects
   **And** parses each file to determine session state

2. **Given** a session file was last modified between 15 minutes and 24 hours ago
   **When** the session does not contain a proper end marker (summary or "session ended")
   **And** the session has at least 1 message
   **Then** it is classified as an interrupted session

3. **Given** an interrupted session is detected
   **When** the extension extracts session metadata
   **Then** it captures: sessionPath, sessionId, lastActivity timestamp, lastPrompt text, lastToolUsed (if any), and messageCount

4. **Given** the extension starts up
   **When** it performs initial scan
   **Then** it completes within 2 seconds for up to 100 session files
   **And** does not block the VS Code UI thread

5. **Given** a session file is being actively written to
   **When** the detector scans it
   **Then** it is NOT marked as interrupted (last modified < 15 minutes ago)

6. **Given** the user has no `~/.claude` directory
   **When** session detection runs
   **Then** no interrupted sessions are found
   **And** no error is shown to the user

7. **Given** a transcript file is corrupted or malformed
   **When** session detection attempts to read it
   **Then** the file is skipped with a warning
   **And** detection continues with other files

## Tasks / Subtasks

- [ ] **Task 1: Create crash detector service** (AC: #1, #2, #3, #6)
  - [ ] Create `packages/vscode-extension/src/services/crashDetector.ts`
  - [ ] Define `InterruptedSession` interface matching architecture spec
  - [ ] Implement `detectInterruptedSessions()` async function
  - [ ] Use `fs.readdir` to enumerate project directories
  - [ ] Use `fs.stat` to check file modification times
  - [ ] Implement STALE_THRESHOLD of 15 minutes (configurable via settings)
  - [ ] Implement MAX_AGE of 24 hours (don't detect very old sessions)

- [ ] **Task 2: Implement transcript parsing for end detection** (AC: #2, #7)
  - [ ] Create or reuse `parseTranscript(sessionPath)` utility
  - [ ] Parse JSONL line-by-line (handle large files efficiently)
  - [ ] Check for `type: 'summary'` message as proper end marker
  - [ ] Check for content containing "session ended" as alternative marker
  - [ ] Handle malformed JSON lines gracefully (skip, don't crash)

- [ ] **Task 3: Extract session metadata from interrupted sessions** (AC: #3)
  - [ ] Find last user message by reversing through messages
  - [ ] Extract prompt text from `message.content` (handle string vs object)
  - [ ] Find last assistant message to extract tool usage
  - [ ] Implement `extractLastTool()` helper to identify last tool used
  - [ ] Count total messages for `messageCount` field

- [ ] **Task 4: Optimize for performance** (AC: #4)
  - [ ] Use async/await throughout (no sync fs operations)
  - [ ] Implement early bailout for active sessions (modified < 15 min)
  - [ ] Consider parallel processing of multiple session files
  - [ ] Add timeout for individual file parsing (5 seconds max)
  - [ ] Test with 100+ session files to verify < 2 second completion

- [ ] **Task 5: Add protection for active sessions** (AC: #5)
  - [ ] Calculate `now - lastModified` for each session
  - [ ] Skip sessions where delta is less than STALE_THRESHOLD
  - [ ] Log skipped active sessions at debug level
  - [ ] Add option to manually trigger scan for specific session

- [ ] **Task 6: Integrate with extension lifecycle** (AC: #1, #4)
  - [ ] Export singleton `crashDetector` instance
  - [ ] Call `detectInterruptedSessions()` on extension activation
  - [ ] Store results in extension state for UI components to access
  - [ ] Emit event when interrupted sessions are found
  - [ ] Add command `contextor.scanForInterruptedSessions` for manual trigger

## Dev Notes

### Architecture Reference

From `architecture-phase2.md` (Lines 892-955):

```typescript
export interface InterruptedSession {
  sessionPath: string;
  sessionId: string;
  lastActivity: Date;
  lastPrompt: string;
  lastToolUsed: string | null;
  messageCount: number;
}

export async function detectInterruptedSessions(): Promise<InterruptedSession[]> {
  const claudeDir = path.join(os.homedir(), '.claude', 'projects');
  const interrupted: InterruptedSession[] = [];
  const now = Date.now();
  const STALE_THRESHOLD = 15 * 60 * 1000; // 15 minutes

  for (const project of await fs.readdir(claudeDir)) {
    const projectPath = path.join(claudeDir, project);
    const sessions = await fs.readdir(projectPath);

    for (const sessionFile of sessions.filter(f => f.endsWith('.jsonl'))) {
      const sessionPath = path.join(projectPath, sessionFile);
      const stat = await fs.stat(sessionPath);
      const lastModified = stat.mtime.getTime();

      // Session is stale if modified recently but not ended properly
      if (now - lastModified > STALE_THRESHOLD && now - lastModified < 24 * 60 * 60 * 1000) {
        const messages = await parseTranscript(sessionPath);
        const hasEnd = messages.some(m =>
          m.type === 'summary' ||
          (m.message?.content && typeof m.message.content === 'string' &&
           m.message.content.includes('session ended'))
        );

        if (!hasEnd && messages.length > 0) {
          const lastUserMsg = [...messages].reverse().find(m =>
            m.type === 'user' && typeof m.message?.content === 'string'
          );
          const lastAssistantMsg = [...messages].reverse().find(m =>
            m.type === 'assistant'
          );

          interrupted.push({
            sessionPath,
            sessionId: sessionFile.replace('.jsonl', ''),
            lastActivity: stat.mtime,
            lastPrompt: lastUserMsg?.message?.content as string || '',
            lastToolUsed: extractLastTool(lastAssistantMsg),
            messageCount: messages.length
          });
        }
      }
    }
  }

  return interrupted;
}
```

### Session File Location

Claude Code stores session transcripts at:
```
~/.claude/projects/{project-path-normalized}/{session-id}.jsonl
```

Where `{project-path-normalized}` is the path with `/` replaced by `-`, e.g.:
- `/Users/edgars/my-project` becomes `-Users-edgars-my-project`

### JSONL Message Types

From architecture, there are 8 message types:
- `user` - User prompts
- `assistant` - Claude responses
- `tool_use` - Tool invocations
- `tool_result` - Tool outputs
- `summary` - Session summaries (indicates proper end)
- `system` - System messages
- `error` - Error messages
- `init` - Session initialization

### Tool Extraction Logic

```typescript
function extractLastTool(assistantMsg: TranscriptMessage | undefined): string | null {
  if (!assistantMsg) return null;

  // Check for tool_use in message content
  const content = assistantMsg.message?.content;
  if (Array.isArray(content)) {
    const toolUse = content.find(block => block.type === 'tool_use');
    if (toolUse) {
      return toolUse.name || null;
    }
  }

  return null;
}
```

### Configuration Options

Add to VS Code extension settings:
```json
{
  "contextor.crashDetection.staleThreshold": 15,
  "contextor.crashDetection.maxAge": 1440,
  "contextor.crashDetection.autoScan": true
}
```

### Performance Considerations

1. **Streaming JSONL parsing**: Don't load entire file into memory
2. **Early termination**: Stop parsing once we find a summary message
3. **Parallel scanning**: Use `Promise.all` with concurrency limit
4. **Debounced rescanning**: Don't rescan too frequently

### Error Handling

- Handle missing `~/.claude` directory gracefully
- Handle permission errors on individual files
- Handle corrupted JSONL (invalid JSON lines)
- Log errors but continue processing other sessions

### Test Scenarios

1. No Claude directory exists - should return empty array
2. Empty projects directory - should return empty array
3. Only active sessions (< 15 min old) - should return empty array
4. Only old sessions (> 24 hours) - should return empty array
5. Session with summary message - should NOT be flagged
6. Session with "session ended" in content - should NOT be flagged
7. Interrupted session (no end marker, 15min-24hr old) - should be flagged
8. Corrupted JSONL file - should skip gracefully
9. 100 session files - should complete in < 2 seconds

## Dependencies

- **Depends on:** Epic 17 (Historical Import) for transcript access, Story 19-1 (VS Code Extension Scaffold) for extension foundation
- **Blocks:** Story 18-2 (Session State Snapshot), Story 18-4 (Recovery Notification UI)


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

- Created CrashDetector service with singleton pattern
- Implemented streaming JSONL parsing for memory efficiency
- Added parallel file scanning with configurable concurrency limit
- Early termination on proper end markers (summary, isConversationEnd)
- Event emission when interrupted sessions are detected
- Added VS Code configuration options (staleThreshold, maxAge, autoScan)
- 34 unit tests covering all edge cases

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-24 | Initial implementation | Claude Opus 4.5 |

### File List

- `packages/vscode-extension/src/types/interruptedSession.ts` (created)
- `packages/vscode-extension/src/services/crashDetector.ts` (created)
- `packages/vscode-extension/src/services/__tests__/crashDetector.test.ts` (created)
- `packages/vscode-extension/src/extension.ts` (modified)
- `packages/vscode-extension/src/types/index.ts` (modified)
- `packages/vscode-extension/package.json` (modified)
