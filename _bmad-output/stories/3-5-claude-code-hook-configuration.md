# Story 3.5: Claude Code Hook Configuration

Status: ready-for-dev

## Story

**As a** developer,
**I want** the CLI to configure the Claude Code hook,
**So that** my prompts are automatically captured.

## Acceptance Criteria

1. **Given** a fresh install
   **When** the CLI completes
   **Then** `.claude/settings.json` is created or updated with the UserPromptSubmit hook
   **And** `.claude/hooks/contextor-capture.sh` is created with the capture script
   **And** the capture script is executable (chmod +x)

2. **Given** `.claude/settings.json` already has other hooks
   **When** the CLI runs
   **Then** the Contextor hook is added without removing existing hooks

3. **Given** the capture script
   **When** it receives a prompt via stdin
   **Then** it sends the prompt to the capture API with the API key from `.contextor/.user`

## Tasks / Subtasks

- [ ] **Task 1: Create hooks module** (AC: #1, #2)
  - [ ] Create `packages/cli/src/lib/hooks.ts`
  - [ ] Define `ClaudeSettings` interface for settings.json structure
  - [ ] Define `Hook` interface for hook configuration
  - [ ] Export path constants for .claude directory structure

- [ ] **Task 2: Implement settings.json management** (AC: #1, #2)
  - [ ] Implement `readClaudeSettings(cwd: string): Promise<ClaudeSettings>`
  - [ ] Implement `writeClaudeSettings(settings: ClaudeSettings, cwd: string): Promise<void>`
  - [ ] Handle missing .claude directory (create if needed)
  - [ ] Handle malformed settings.json gracefully (log warning, return empty)

- [ ] **Task 3: Implement hook configuration** (AC: #1, #2)
  - [ ] Create function `configureContextorHook(settings: ClaudeSettings): ClaudeSettings`
  - [ ] Add or update `hooks.UserPromptSubmit` array
  - [ ] Configure hook type as "command"
  - [ ] Set command to run the capture script
  - [ ] Preserve existing hooks in the array

- [ ] **Task 4: Create capture script template** (AC: #1, #3)
  - [ ] Create capture script content as embedded string
  - [ ] Script reads prompt from stdin (JSON with `prompt` field)
  - [ ] Script reads API key from `.contextor/.user`
  - [ ] Script sends prompt to API endpoint with 10s timeout
  - [ ] Script runs in background (non-blocking)
  - [ ] Script handles errors silently (no user disruption)
  - [ ] Script exits gracefully if jq/curl unavailable

- [ ] **Task 5: Implement capture script creation** (AC: #1)
  - [ ] Implement `createCaptureScript(cwd: string): Promise<void>`
  - [ ] Create `.claude/hooks/` directory if not exists
  - [ ] Write `contextor-capture.sh` file
  - [ ] Set executable permissions (mode 0o755)

- [ ] **Task 6: Implement existing hooks preservation** (AC: #2)
  - [ ] Read existing hooks array if present
  - [ ] Check if Contextor hook already exists (by command path)
  - [ ] Update existing Contextor hook if present
  - [ ] Append new hook if not present
  - [ ] Never remove or modify other hooks

- [ ] **Task 7: Integrate hook setup into init command** (AC: #1, #2, #3)
  - [ ] Import hooks module in init command
  - [ ] Call hook configuration after config file creation
  - [ ] Display progress spinner for hook setup
  - [ ] Handle errors with user-friendly messages
  - [ ] Log hook setup: `[CLI] hooks: configured UserPromptSubmit hook`

- [ ] **Task 8: Write unit tests** (AC: #1, #2, #3)
  - [ ] Create `packages/cli/src/lib/__tests__/hooks.test.ts`
  - [ ] Test readClaudeSettings with missing file
  - [ ] Test readClaudeSettings with malformed JSON
  - [ ] Test writeClaudeSettings creates directory
  - [ ] Test configureContextorHook adds new hook
  - [ ] Test configureContextorHook preserves existing hooks
  - [ ] Test configureContextorHook updates existing Contextor hook
  - [ ] Test createCaptureScript sets executable permissions

## Dev Notes

### Claude Settings Structure

```typescript
// packages/cli/src/lib/hooks.ts
import { mkdir, readFile, writeFile, chmod, access } from 'fs/promises';
import { join } from 'path';
import { constants } from 'fs';

export interface ClaudeSettings {
  hooks?: {
    UserPromptSubmit?: Hook[];
    [key: string]: Hook[] | undefined;
  };
  [key: string]: unknown;
}

export interface Hook {
  type: 'command';
  command: string;
}

// Path constants
export const CLAUDE_DIR = '.claude';
export const SETTINGS_FILE = 'settings.json';
export const HOOKS_DIR = 'hooks';
export const CAPTURE_SCRIPT = 'contextor-capture.sh';
```

### Settings Management

```typescript
export async function readClaudeSettings(cwd: string): Promise<ClaudeSettings> {
  const settingsPath = join(cwd, CLAUDE_DIR, SETTINGS_FILE);
  try {
    await access(settingsPath, constants.F_OK);
    const content = await readFile(settingsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {}; // Return empty if missing or invalid
  }
}

export async function writeClaudeSettings(
  settings: ClaudeSettings,
  cwd: string
): Promise<void> {
  const claudeDir = join(cwd, CLAUDE_DIR);
  await mkdir(claudeDir, { recursive: true });
  await writeFile(
    join(claudeDir, SETTINGS_FILE),
    JSON.stringify(settings, null, 2) + '\n',
    'utf-8'
  );
}

export function configureContextorHook(settings: ClaudeSettings): ClaudeSettings {
  const hookCommand = `./${CLAUDE_DIR}/${HOOKS_DIR}/${CAPTURE_SCRIPT}`;
  const newHook: Hook = { type: 'command', command: hookCommand };

  settings.hooks ??= {};
  const existing = settings.hooks.UserPromptSubmit ?? [];
  const idx = existing.findIndex(h => h.command.includes('contextor-capture'));

  if (idx >= 0) {
    existing[idx] = newHook;
  } else {
    existing.push(newHook);
  }

  settings.hooks.UserPromptSubmit = existing;
  return settings;
}
```

### Capture Script Template

```typescript
export function getCaptureScriptContent(): string {
  return `#!/bin/bash
# Contextor Capture - Silent background prompt capture
# Errors are suppressed to avoid disrupting Claude Code

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "\${SCRIPT_DIR}/../.." && pwd)"

USER_CONFIG="\${PROJECT_ROOT}/.contextor/.user"
SHARED_CONFIG="\${PROJECT_ROOT}/.contextor/config.json"

# Exit silently if not configured or deps missing
command -v jq >/dev/null 2>&1 || exit 0
command -v curl >/dev/null 2>&1 || exit 0
[[ -f "\${USER_CONFIG}" && -f "\${SHARED_CONFIG}" ]] || exit 0

# Read config
API_KEY=$(jq -r '.api_key // empty' "\${USER_CONFIG}" 2>/dev/null)
API_ENDPOINT=$(jq -r '.api_endpoint // empty' "\${SHARED_CONFIG}" 2>/dev/null)
PROJECT_ID=$(jq -r '.project_id // empty' "\${SHARED_CONFIG}" 2>/dev/null)
USER_ID=$(jq -r '.user_id // empty' "\${USER_CONFIG}" 2>/dev/null)

[[ -n "\${API_KEY}" && -n "\${API_ENDPOINT}" ]] || exit 0

# Read prompt from stdin
INPUT=$(cat)
PROMPT=$(echo "\${INPUT}" | jq -r '.prompt // empty' 2>/dev/null)
[[ -n "\${PROMPT}" ]] || exit 0

# Send to API in background (non-blocking, 10s timeout)
{
  curl -s --max-time 10 -X POST "\${API_ENDPOINT}/api/prompts/capture" \\
    -H "Content-Type: application/json" \\
    -H "Authorization: Bearer \${API_KEY}" \\
    -d "$(jq -n \\
      --arg project_id "\${PROJECT_ID}" \\
      --arg user_id "\${USER_ID}" \\
      --arg prompt "\${PROMPT}" \\
      --arg source "claude-code-hook" \\
      '{project_id:$project_id,user_id:$user_id,prompt:$prompt,source:$source,captured_at:(now|todate)}')" \\
    >/dev/null 2>&1
} &

exit 0
`;
}

export async function createCaptureScript(cwd: string): Promise<void> {
  const hooksDir = join(cwd, CLAUDE_DIR, HOOKS_DIR);
  const scriptPath = join(hooksDir, CAPTURE_SCRIPT);

  await mkdir(hooksDir, { recursive: true });
  await writeFile(scriptPath, getCaptureScriptContent(), 'utf-8');
  await chmod(scriptPath, 0o755);
}
```

### Init Command Integration

```typescript
// packages/cli/src/commands/init.ts
import {
  readClaudeSettings,
  writeClaudeSettings,
  configureContextorHook,
  createCaptureScript
} from '../lib/hooks.js';

// After config file creation:
const hookSpinner = ora('Configuring Claude Code hook...').start();

try {
  let settings = await readClaudeSettings(cwd);
  settings = configureContextorHook(settings);
  await writeClaudeSettings(settings, cwd);

  hookSpinner.text = 'Creating capture script...';
  await createCaptureScript(cwd);

  hookSpinner.succeed('Claude Code hook configured');
  console.log('[CLI] hooks: configured UserPromptSubmit hook');
} catch (error) {
  hookSpinner.fail('Failed to configure Claude Code hook');
  console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
  process.exit(1);
}
```

### Example settings.json

**Before:**
```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "type": "command", "command": "./scripts/my-hook.sh" }
    ]
  }
}
```

**After:**
```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "type": "command", "command": "./scripts/my-hook.sh" },
      { "type": "command", "command": "./.claude/hooks/contextor-capture.sh" }
    ]
  }
}
```

### Directory Structure After This Story

```
packages/cli/src/lib/
├── hooks.ts              # NEW: Hook management
└── __tests__/
    └── hooks.test.ts     # NEW: Unit tests

# Files created in target project:
target-project/
├── .claude/
│   ├── settings.json     # NEW or UPDATED
│   └── hooks/
│       └── contextor-capture.sh  # NEW (executable)
└── .contextor/
    ├── config.json
    └── .user
```

### Script Dependencies

The capture script requires `bash`, `jq`, and `curl`. These are standard on macOS/Linux. The script exits silently if dependencies are missing.

### Critical Constraints

From architecture and project-context:
- Hook config in `.claude/settings.json`
- Capture script at `.claude/hooks/contextor-capture.sh`
- Script reads API key from `.contextor/.user`
- Script must run in background (non-blocking)
- Must preserve existing hooks
- Script must be silent on errors

### Pitfalls to Avoid

1. DO NOT remove or modify existing hooks
2. DO NOT block on API call - run curl in background with timeout
3. DO NOT display errors to user - script must be silent
4. DO NOT forget executable permissions
5. DO NOT hardcode paths - use relative paths from script location
6. DO NOT fail if jq/curl missing - exit silently

### Test Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| Fresh install, no .claude dir | Create .claude/settings.json and hooks/ |
| Existing settings.json, no hooks | Add hooks.UserPromptSubmit array |
| Existing hooks from other tools | Preserve and append Contextor hook |
| Contextor hook already exists | Update existing hook entry |
| Malformed settings.json | Log warning, create new valid settings |
| Missing jq on system | Script exits 0, no error output |
| API timeout | curl --max-time prevents hanging |

### Verification Checklist

After implementation, verify:
- [ ] .claude/settings.json created if missing
- [ ] .claude/settings.json updated with Contextor hook
- [ ] Existing hooks preserved
- [ ] .claude/hooks/contextor-capture.sh created
- [ ] Capture script is executable (`ls -la`)
- [ ] Script reads config files correctly
- [ ] Script sends prompt to API
- [ ] Script runs in background (non-blocking)
- [ ] Script exits silently on errors
- [ ] Duplicate hook detection works

### References

- Epic 3.5 in epics.md
- CLI Package section in architecture.md
- Local Files Created in project-context.md

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

| Date | Change | Author |
|------|--------|--------|
| | | |

### File List

*To be filled by dev agent - list all files created/modified*
