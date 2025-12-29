# Story 26-2: CLI Hook Configuration

Status: Complete

## Story

**As a** developer installing Contextor,
**I want** the CLI to configure both Stop and UserPromptSubmit hooks,
**So that** both responses and prompts are automatically captured for context-aware analysis.

## Background

Phase 3 requires two hooks working together:

| Hook | Trigger | Purpose |
|------|---------|---------|
| Stop | Claude finishes responding | Capture response data |
| UserPromptSubmit | User submits prompt | Capture prompt text |

The CLI must configure both hooks during installation while preserving any existing hooks from other tools.

## Acceptance Criteria

1. **Stop Hook Added to Settings**
   - [x] **Given** a fresh Contextor installation
   - [x] **When** the CLI init command completes
   - [x] **Then** `.claude/settings.json` contains a Stop hook entry
   - [x] **And** the hook command points to `contextor-response.sh`
   - [x] **And** the hook has a 5000ms timeout

2. **UserPromptSubmit Hook Preserved**
   - [x] **Given** existing Contextor installation with UserPromptSubmit hook
   - [x] **When** the CLI re-runs init
   - [x] **Then** the existing UserPromptSubmit hook remains configured
   - [x] **And** the Stop hook is added without duplication

3. **Both Scripts Created**
   - [x] **Given** a fresh installation
   - [x] **When** the CLI init completes
   - [x] **Then** `.claude/hooks/contextor-capture.sh` exists (prompt capture)
   - [x] **And** `.claude/hooks/contextor-response.sh` exists (response capture)
   - [x] **And** both scripts are executable

4. **Existing Hooks Preserved**
   - [x] **Given** settings.json has hooks from other tools
   - [x] **When** the CLI runs
   - [x] **Then** all existing hooks are preserved
   - [x] **And** Contextor hooks are added to the arrays

5. **Idempotent Installation**
   - [x] **Given** Contextor hooks already exist in settings.json
   - [x] **When** the CLI runs again
   - [x] **Then** duplicate hooks are NOT created
   - [x] **And** existing Contextor hooks are updated in place

6. **Uninstall Removes Both Hooks**
   - [x] **Given** a complete Contextor installation
   - [x] **When** the CLI uninstall command runs
   - [x] **Then** both UserPromptSubmit and Stop Contextor hooks are removed
   - [x] **And** both capture scripts are deleted
   - [x] **And** other hooks remain untouched

## Tasks / Subtasks

- [x] **Task 1: Define Stop hook constants** (AC: #1)
  - [x] Add `RESPONSE_SCRIPT = 'contextor-response.sh'` to `hooks.ts`
  - [x] Add `STOP_HOOK_TIMEOUT = 5000` constant (uses TIMEOUTS.HOOK_EXECUTION_MS)
  - [x] Update type definitions for Stop hook support

- [x] **Task 2: Extend ClaudeSettings interface** (AC: #1, #4)
  - [x] Add `Stop?: HookEntry[]` to hooks type
  - [x] Update interface documentation

- [x] **Task 3: Implement configureStopHook function** (AC: #1, #5)
  - [x] Create `configureStopHook(settings: ClaudeSettings): ClaudeSettings`
  - [x] Build Stop hook entry with matcher ".*"
  - [x] Point command to `contextor-response.sh` using `$CLAUDE_PROJECT_DIR`
  - [x] Check for existing Contextor Stop hook
  - [x] Update existing or append new hook

- [x] **Task 4: Update setupClaudeHooks function** (AC: #2, #3)
  - [x] Add call to `configureStopHook(settings)`
  - [x] Add call to `createResponseScript(cwd)`
  - [x] Maintain existing UserPromptSubmit configuration

- [x] **Task 5: Implement removeStopHook function** (AC: #6)
  - [x] Create `removeStopHook(settings: ClaudeSettings): ClaudeSettings`
  - [x] Filter out Contextor entries from Stop hook array
  - [x] Clean up empty arrays/objects

- [x] **Task 6: Update cleanupClaudeHooks function** (AC: #6)
  - [x] Add call to `removeStopHook(settings)`
  - [x] Add deletion of `contextor-response.sh`
  - [x] Maintain existing UserPromptSubmit cleanup

- [x] **Task 7: Update init command output** (AC: #1, #2, #3)
  - [x] Add spinner message for both hooks
  - [x] Log "UserPromptSubmit hook configured"
  - [x] Log "Stop hook configured"
  - [x] Update success message to mention both hooks

- [x] **Task 8: Write unit tests**
  - [x] Test `configureStopHook` adds Stop hook correctly
  - [x] Test `configureStopHook` preserves existing hooks
  - [x] Test `configureStopHook` is idempotent
  - [x] Test `removeStopHook` removes only Contextor hooks
  - [x] Test `setupClaudeHooks` creates both scripts
  - [x] Test `cleanupClaudeHooks` removes both scripts

## Dev Notes

### Updated Settings.json Structure

**Before (Phase 2):**
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/contextor-capture.sh",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
```

**After (Phase 3):**
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/contextor-capture.sh",
            "timeout": 5000
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/contextor-response.sh",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
```

### Updated TypeScript Interface

```typescript
// packages/cli/src/lib/hooks.ts

export const RESPONSE_SCRIPT = 'contextor-response.sh';
export const STOP_HOOK_TIMEOUT = 5000;

export interface ClaudeSettings {
  hooks?: {
    UserPromptSubmit?: HookEntry[];
    Stop?: HookEntry[];  // NEW: Stop hook for response capture
    [key: string]: HookEntry[] | undefined;
  };
  [key: string]: unknown;
}
```

### configureStopHook Implementation

```typescript
/**
 * Configure Contextor Stop hook for response capture
 * Preserves existing hooks and updates/adds the Contextor hook
 */
export function configureStopHook(settings: ClaudeSettings): ClaudeSettings {
  const hookCommand = `bash "$CLAUDE_PROJECT_DIR"/${CLAUDE_DIR}/${HOOKS_DIR}/${RESPONSE_SCRIPT}`;
  const newHookEntry: HookEntry = {
    matcher: '.*',
    hooks: [{ type: 'command', command: hookCommand, timeout: STOP_HOOK_TIMEOUT }],
  };

  settings.hooks ??= {};
  const existing = settings.hooks.Stop ?? [];

  // Check if Contextor Stop hook already exists
  const idx = existing.findIndex(entry =>
    entry.hooks?.some(h => h.command.includes('contextor-response'))
  );

  if (idx >= 0) {
    existing[idx] = newHookEntry;
  } else {
    existing.push(newHookEntry);
  }

  settings.hooks.Stop = existing;
  return settings;
}
```

### removeStopHook Implementation

```typescript
/**
 * Remove Contextor Stop hook from settings
 */
export function removeStopHook(settings: ClaudeSettings): ClaudeSettings {
  if (!settings.hooks?.Stop) {
    return settings;
  }

  settings.hooks.Stop = settings.hooks.Stop.filter(
    (entry) => !entry.hooks?.some(h => h.command.includes('contextor-response'))
  );

  // Clean up empty arrays/objects
  if (settings.hooks.Stop.length === 0) {
    delete settings.hooks.Stop;
  }
  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  return settings;
}
```

### Updated setupClaudeHooks

```typescript
/**
 * Set up Claude Code hooks for Contextor (both prompt and response capture)
 */
export async function setupClaudeHooks(cwd: string): Promise<void> {
  // Read existing settings
  let settings = await readClaudeSettings(cwd);

  // Configure both hooks
  settings = configureContextorHook(settings);  // UserPromptSubmit
  settings = configureStopHook(settings);       // Stop (NEW)

  // Write updated settings
  await writeClaudeSettings(settings, cwd);

  // Create both capture scripts
  await createCaptureScript(cwd);   // contextor-capture.sh
  await createResponseScript(cwd);  // contextor-response.sh (NEW)
}
```

### Updated cleanupClaudeHooks

```typescript
/**
 * Remove Contextor hooks from Claude Code settings
 */
export async function cleanupClaudeHooks(cwd: string): Promise<void> {
  // Read and update settings
  let settings = await readClaudeSettings(cwd);
  settings = removeContextorHook(settings);  // UserPromptSubmit
  settings = removeStopHook(settings);       // Stop (NEW)
  await writeClaudeSettings(settings, cwd);

  // Remove both scripts
  const captureScript = join(cwd, CLAUDE_DIR, HOOKS_DIR, CAPTURE_SCRIPT);
  const responseScript = join(cwd, CLAUDE_DIR, HOOKS_DIR, RESPONSE_SCRIPT);

  await unlink(captureScript).catch(() => {});
  await unlink(responseScript).catch(() => {});

  // Try to remove hooks directory if empty
  const hooksDir = join(cwd, CLAUDE_DIR, HOOKS_DIR);
  await rmdir(hooksDir).catch(() => {});
}
```

### Directory Structure After Installation

```
target-project/
├── .claude/
│   ├── settings.json     # Contains both UserPromptSubmit and Stop hooks
│   └── hooks/
│       ├── contextor-capture.sh   # Prompt capture (UserPromptSubmit)
│       └── contextor-response.sh  # Response capture (Stop)
└── .contextor/
    ├── config.json
    └── .user
```

### CLI Output Updates

```
$ npx @contextor/cli init <token>

Contextor CLI v2.0.0

Parsing installation token... done
Verifying connection... done
Writing configuration... done
Configuring Claude Code hooks... done

  UserPromptSubmit hook: ✓ Configured
  Stop hook: ✓ Configured

Installation complete!

Both prompt and response capture are now active.
Claude Code will automatically send data to Contextor.
```

### Test Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| Fresh install | Both hooks added, both scripts created |
| Re-run on existing install | Hooks updated, scripts recreated |
| Other Stop hooks exist | Contextor added, others preserved |
| Only UserPromptSubmit exists | Stop hook added |
| Uninstall | Both hooks removed, both scripts deleted |
| Settings has no hooks object | hooks object created with both hooks |

### Verification Checklist

- [x] `configureStopHook` adds Stop hook to settings
- [x] `configureStopHook` preserves existing Stop hooks
- [x] `configureStopHook` is idempotent
- [x] `removeStopHook` removes only Contextor hook
- [x] `removeStopHook` preserves other Stop hooks
- [x] `setupClaudeHooks` creates both scripts
- [x] `setupClaudeHooks` configures both hooks
- [x] `cleanupClaudeHooks` removes both hooks
- [x] `cleanupClaudeHooks` deletes both scripts
- [x] Init command shows both hooks configured
- [x] Uninstall command mentions both hooks removed

### Dependencies

- Story 26-1: Provides `getResponseScriptContent()` and `createResponseScript()`

### Breaking Changes

None. This is additive - existing UserPromptSubmit configuration is preserved.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. Implemented alongside Story 26-1 as the functions are tightly coupled
2. `RESPONSE_SCRIPT` constant added at line 11
3. `Stop?: HookEntry[]` added to ClaudeSettings interface at line 37
4. `configureStopHook()` implemented at lines 421-448
5. `removeStopHook()` implemented at lines 453-471
6. `setupClaudeHooks()` updated to call both hook configurations and create both scripts
7. `cleanupClaudeHooks()` updated to remove both hooks and delete both scripts
8. 122 total hook-related tests passing (76 in hooks.test.ts + 46 in hooks-response.test.ts)

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-25 | Story created | PM Agent |
| 2025-12-26 | Implementation complete - verified by Amelia (Dev Agent) | Claude Opus 4.5 |

### File List

**Modified:**
- `packages/cli/src/lib/hooks.ts` - Added configureStopHook, removeStopHook, updated setupClaudeHooks and cleanupClaudeHooks

**Tests:**
- `packages/cli/src/lib/__tests__/hooks.test.ts` - 76 tests covering both prompt and response hooks
- `packages/cli/src/lib/__tests__/hooks-response.test.ts` - 46 tests for response hook specifically
