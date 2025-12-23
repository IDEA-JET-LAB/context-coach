# Story 20.1: Blocking Hook Implementation

Status: Ready

## PRD Alignment Note

This story implements **PRD Story 20.2** (Blocking Hook Implementation). The implementation reordered Phase 3 stories for logical dependency flow:
- **Implementation Story 20-1** (this story): Hook infrastructure comes first as the foundation
- **Implementation Story 20-2**: Fast Heuristics Engine (PRD Story 20.1) - depends on hook to invoke it

The VS Code Extension (Epic 19) provides the UI for displaying suggestions. User bypass flow is handled by Story 20-4 (User Override Flow).

## Story
**As a** developer using Claude Code,
**I want** the capture hook to block prompt submission when improvements are suggested,
**So that** I can review and improve my prompt before Claude processes it.

## Dependencies
- **Phase 1 Hook Infrastructure**: Claude Code hook configuration from Epic 3 (prompt capture system)
- **Story 20-2**: Fast Heuristics Engine (provides heuristics analysis)

## Acceptance Criteria

1. **Given** a user submits a prompt in Claude Code
   **When** the `UserPromptSubmit` hook fires
   **Then** the `contextor-coach.sh` script is invoked with the prompt as JSON input
   **And** the hook completes within 100ms for user-perceived responsiveness

2. **Given** the heuristics engine detects improvement opportunities
   **When** the hook script receives suggestions from the heuristics engine
   **Then** the script writes suggestions to `~/.contextor/suggestion.json`
   **And** exits with code 2 (block submission)
   **And** outputs a brief message to stderr: "Contextor has a suggestion. See VS Code panel."

3. **Given** the heuristics engine finds no issues
   **When** the hook script completes analysis
   **Then** the script exits with code 0 (allow submission)
   **And** no suggestion file is written

4. **Given** the user has disabled coaching in preferences
   **When** the hook script starts
   **Then** it reads the config from `~/.contextor/config.json`
   **And** immediately exits with code 0 (bypass all checks)

5. **Given** the heuristics engine fails or times out
   **When** the hook cannot complete analysis
   **Then** it exits with code 0 (fail open - allow submission)
   **And** logs the error to `~/.contextor/coach.log`

## Technical Context

### File Locations
| File | Purpose |
|------|---------|
| `.claude/hooks/contextor-coach.sh` | Blocking hook script (create) |
| `~/.contextor/suggestion.json` | Suggestion output for VS Code extension |
| `~/.contextor/config.json` | User preferences (coaching_enabled, sensitivity) |
| `~/.contextor/coach.log` | Debug log for hook execution |
| `packages/cli/src/lib/hooks.ts` | CLI hook template generator (extend) |

### Hook Script Flow
```
                    ┌─────────────────────────┐
                    │ UserPromptSubmit fires  │
                    └───────────┬─────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │ Read config.json        │
                    │ coaching_enabled?       │
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                                   ▼
        ┌───────────┐                       ┌───────────┐
        │ Disabled  │                       │ Enabled   │
        │ exit 0    │                       │ continue  │
        └───────────┘                       └─────┬─────┘
                                                  │
                                                  ▼
                                    ┌─────────────────────────┐
                                    │ Extract prompt from     │
                                    │ stdin JSON              │
                                    └───────────┬─────────────┘
                                                │
                                                ▼
                                    ┌─────────────────────────┐
                                    │ Call heuristics binary  │
                                    │ contextor-heuristics    │
                                    └───────────┬─────────────┘
                                                │
                          ┌─────────────────────┼─────────────────────┐
                          ▼                                           ▼
                    ┌───────────┐                               ┌───────────┐
                    │ Issues    │                               │ No issues │
                    │ detected  │                               │ exit 0    │
                    └─────┬─────┘                               └───────────┘
                          │
                          ▼
                    ┌─────────────────────────┐
                    │ Write suggestion.json   │
                    │ stderr message          │
                    │ exit 2                  │
                    └─────────────────────────┘
```

### Suggestion File Schema
```typescript
interface SuggestionFile {
  version: "1.0";
  timestamp: string;           // ISO 8601
  original_prompt: string;     // The user's original prompt
  issues: Array<{
    type: 'too_vague' | 'no_context' | 'missing_goal' | 'ambiguous' | 'too_long';
    severity: 'warning' | 'improvement';
    message: string;
  }>;
  suggested_prompt?: string;   // Improved version if available
}
```

### Config File Schema
```typescript
interface CoachingConfig {
  coaching_enabled: boolean;   // Default: true
  sensitivity: 'low' | 'medium' | 'high';  // Default: 'medium'
  show_suggestions_in_terminal: boolean;   // Default: false
}
```

**PRD 3-Mode Configuration Note:** The PRD specifies "always/low scores/never" modes. This is achieved through the combination of `coaching_enabled` and `sensitivity`:
- **Always mode**: `coaching_enabled: true` with `sensitivity: 'high'` (blocks on any issue)
- **Low scores only**: `coaching_enabled: true` with `sensitivity: 'low'` (blocks only on significant issues)
- **Never mode**: `coaching_enabled: false` (bypasses all checks)

The full `coaching_mode` enum with UI configuration is implemented in Story 20-5 (Coaching Preferences).

## Tasks / Subtasks

- [ ] **Task 1: Create Blocking Hook Script** (AC: #1, #2, #3)
  - [ ] Create `.claude/hooks/contextor-coach.sh` template in CLI package
  - [ ] Parse JSON input from stdin using `jq`
  - [ ] Extract prompt text from `input.prompt` or `input.message`
  - [ ] Implement timeout wrapper (100ms max) for heuristics call
  - [ ] Write suggestion.json with proper schema
  - [ ] Exit with appropriate code (0 = allow, 2 = block)

- [ ] **Task 2: Implement Config Reading** (AC: #4)
  - [ ] Read `~/.contextor/config.json` at hook start
  - [ ] Parse `coaching_enabled` boolean (default: true if missing)
  - [ ] Parse `sensitivity` level for heuristics (default: 'medium')
  - [ ] Early exit if coaching disabled

- [ ] **Task 3: Implement Fail-Open Pattern** (AC: #5)
  - [ ] Wrap heuristics call in timeout handler
  - [ ] Catch any errors during execution
  - [ ] Log errors to `~/.contextor/coach.log` with timestamp
  - [ ] Always exit 0 on failure (never block on errors)

- [ ] **Task 4: Extend CLI Hook Generator** (AC: #1)
  - [ ] Update `packages/cli/src/lib/hooks.ts`
  - [ ] Add separate hook for coaching (different from capture)
  - [ ] Generate `contextor-coach.sh` during `npx @contextor/cli init`
  - [ ] Register hook in `.claude/settings.json` with 100ms timeout
  - [ ] Ensure hook fires BEFORE capture hook in chain

- [ ] **Task 5: Add Hook to Settings** (AC: #1)
  - [ ] Update `.claude/settings.json` structure
  - [ ] Add coaching hook with higher priority than capture
  - [ ] Set appropriate matcher pattern
  - [ ] Configure 100ms timeout for hook

## Dev Notes

### Hook Script Template
```bash
#!/bin/bash

# contextor-coach.sh - Pre-submission coaching hook
# Exit codes: 0 = allow, 2 = block with message

CONFIG_FILE="$HOME/.contextor/config.json"
SUGGESTION_FILE="$HOME/.contextor/suggestion.json"
LOG_FILE="$HOME/.contextor/coach.log"

log() {
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $1" >> "$LOG_FILE"
}

# Ensure directory exists
mkdir -p "$HOME/.contextor"

# Read coaching enabled flag (default: true)
if [ -f "$CONFIG_FILE" ]; then
  COACHING_ENABLED=$(jq -r '.coaching_enabled // true' "$CONFIG_FILE")
  SENSITIVITY=$(jq -r '.sensitivity // "medium"' "$CONFIG_FILE")
else
  COACHING_ENABLED=true
  SENSITIVITY="medium"
fi

# Early exit if coaching disabled
if [ "$COACHING_ENABLED" != "true" ]; then
  exit 0
fi

# Read prompt from stdin (JSON format)
INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // .message // ""')

if [ -z "$PROMPT" ]; then
  log "ERROR: Could not extract prompt from input"
  exit 0  # Fail open
fi

# Run heuristics with timeout (100ms = 0.1s)
SUGGESTION=$(timeout 0.1s contextor-heuristics --sensitivity="$SENSITIVITY" "$PROMPT" 2>/dev/null)
RESULT=$?

if [ $RESULT -eq 124 ]; then
  log "TIMEOUT: Heuristics took too long"
  exit 0  # Fail open
fi

if [ $RESULT -ne 0 ]; then
  log "ERROR: Heuristics failed with code $RESULT"
  exit 0  # Fail open
fi

# Check if suggestion is empty
if [ -z "$SUGGESTION" ] || [ "$SUGGESTION" = "null" ]; then
  exit 0  # No issues found, allow submission
fi

# Write suggestion file for VS Code extension
echo "$SUGGESTION" > "$SUGGESTION_FILE"

# Output message to stderr (visible to user)
echo "Contextor has a suggestion. See VS Code panel." >&2

exit 2  # Block submission
```

### Settings.json Structure
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/contextor-coach.sh",
            "timeout": 100
          },
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

### Testing Approach
- Unit test hook script with mock heuristics binary
- Test timeout behavior with `sleep` mock
- Test config reading with various config states
- Test fail-open on missing dependencies
- Integration test with actual Claude Code hook system

### Performance Requirements
- Total hook execution: < 100ms (critical for UX)
- Config read: < 5ms
- Heuristics call: < 50ms (see Story 20.2)
- File write: < 5ms


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
