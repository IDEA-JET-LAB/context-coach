# Story 20.4: User Override Flow

Status: Ready

## Story
**As a** developer using Claude Code,
**I want** to be able to proceed with my original prompt despite suggestions,
**So that** I am not blocked when I intentionally want to submit a short or unconventional prompt.

## Dependencies
- **Story 20.1**: Blocking Hook Implementation (provides hook blocking mechanism)
- **Story 20.3**: Improvement Suggestions Display (provides UI for actions)

## PRD Alignment
This story implements the **user bypass requirement** from the PRD: users must always have the ability to proceed with their original prompt despite coaching suggestions. The coaching system is advisory, not mandatory, ensuring developer autonomy while encouraging better prompting practices.

## Acceptance Criteria

1. **Given** the suggestion panel is displayed
   **When** I click "Skip & Submit Original"
   **Then** the suggestion file is deleted
   **And** my original prompt is resubmitted to Claude Code
   **And** the coaching hook allows it through (bypass mode)

2. **Given** I have dismissed a suggestion
   **When** Claude Code receives the resubmitted prompt
   **Then** the coaching hook recognizes the bypass flag
   **And** exits with code 0 immediately
   **And** does not re-analyze the same prompt

3. **Given** a bypass marker exists
   **When** I submit a NEW prompt (not the bypassed one)
   **Then** the bypass marker is cleared
   **And** the new prompt is analyzed normally

4. **Given** the bypass mechanism
   **When** the prompt is captured for analytics
   **Then** the prompt is still sent to the capture hook
   **And** a `coaching_skipped` flag is included in the capture data
   **And** the dashboard shows this prompt was submitted without coaching

5. **Given** the user clicks "Copy" on the improved prompt
   **When** they paste and submit it
   **Then** the coaching hook analyzes the new (improved) prompt
   **And** may find no issues (allowing normal submission)

6. **Given** keyboard shortcuts are configured
   **When** the suggestion panel is focused
   **Then** pressing "Enter" copies the suggested prompt
   **And** pressing "Escape" skips and submits original

## Technical Context

### File Locations
| File | Purpose |
|------|---------|
| `~/.contextor/bypass.json` | Stores bypass marker for current prompt |
| `.claude/hooks/contextor-coach.sh` | Check bypass before analysis |
| `vscode-extension/src/commands/submitOriginal.ts` | Handle skip action |
| `vscode-extension/src/commands/copyImproved.ts` | Handle copy action |

### Bypass Marker Schema
```typescript
interface BypassMarker {
  prompt_hash: string;  // MD5 hash of original prompt
  created_at: string;   // ISO 8601 timestamp
  expires_at: string;   // 60 seconds TTL
}
```

### Override Flow Diagram
```
User clicks "Skip & Submit"
           │
           ▼
┌─────────────────────────────────┐
│ VS Code Extension               │
│ 1. Write bypass.json            │
│ 2. Delete suggestion.json       │
│ 3. Copy prompt to clipboard     │
│ 4. Show "Paste to resubmit"     │
└─────────────┬───────────────────┘
              │
              ▼
User pastes prompt in Claude Code
              │
              ▼
┌─────────────────────────────────┐
│ UserPromptSubmit hook fires     │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│ contextor-coach.sh              │
│ 1. Read bypass.json             │
│ 2. Hash incoming prompt         │
│ 3. Compare hashes               │
└─────────────┬───────────────────┘
              │
     ┌────────┴────────┐
     ▼                 ▼
┌─────────┐      ┌─────────────┐
│ Match   │      │ No match    │
│ exit 0  │      │ Run normal  │
│ (bypass)│      │ heuristics  │
└─────────┘      └─────────────┘
```

## Tasks / Subtasks

- [ ] **Task 1: Implement Bypass Marker System** (AC: #1, #2, #3)
  - [ ] Define bypass.json schema with TTL
  - [ ] Create bypass marker when user skips
  - [ ] Include MD5 hash of original prompt
  - [ ] Set 60-second TTL for bypass
  - [ ] Clear bypass after use or expiration

- [ ] **Task 2: Update Hook to Check Bypass** (AC: #2)
  - [ ] Read bypass.json at hook start
  - [ ] Check if marker exists and not expired
  - [ ] Hash incoming prompt
  - [ ] Compare with stored hash
  - [ ] Exit 0 immediately if match

- [ ] **Task 3: Implement Skip Command** (AC: #1)
  - [ ] Create `vscode-extension/src/commands/submitOriginal.ts`
  - [ ] Write bypass marker file
  - [ ] Delete suggestion file
  - [ ] Copy original prompt to clipboard
  - [ ] Show notification with instructions

- [ ] **Task 4: Update Capture Hook for Tracking** (AC: #4)
  - [ ] Check for bypass marker before capture
  - [ ] Add `coaching_skipped: true` to capture payload
  - [ ] Track skipped prompts for analytics
  - [ ] Clear bypass marker after capture

- [ ] **Task 5: Add Keyboard Shortcuts** (AC: #6)
  - [ ] Register keybinding for Enter (copy improved)
  - [ ] Register keybinding for Escape (skip/submit)
  - [ ] Handle focus states in webview
  - [ ] Ensure shortcuts only active when panel focused

- [ ] **Task 6: Handle Copy & Resubmit Flow** (AC: #5)
  - [ ] Implement copy action
  - [ ] Do NOT set bypass marker (new prompt)
  - [ ] Allow normal analysis of improved prompt
  - [ ] Track as `coaching_accepted` in analytics

## Dev Notes

### Bypass Marker Implementation
```bash
# In contextor-coach.sh

BYPASS_FILE="$HOME/.contextor/bypass.json"

# Check for bypass early
if [ -f "$BYPASS_FILE" ]; then
  BYPASS_HASH=$(jq -r '.prompt_hash // ""' "$BYPASS_FILE")
  BYPASS_EXPIRES=$(jq -r '.expires_at // ""' "$BYPASS_FILE")
  CURRENT_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  if [ "$BYPASS_EXPIRES" \> "$CURRENT_TIME" ]; then
    # Calculate hash of incoming prompt
    INCOMING_HASH=$(echo -n "$PROMPT" | md5sum | cut -d' ' -f1)

    if [ "$BYPASS_HASH" = "$INCOMING_HASH" ]; then
      # Bypass - remove marker and exit
      rm -f "$BYPASS_FILE"
      exit 0
    fi
  else
    # Expired, remove marker
    rm -f "$BYPASS_FILE"
  fi
fi
```

### VS Code Skip Command
```typescript
// vscode-extension/src/commands/submitOriginal.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

export async function submitOriginal(originalPrompt: string): Promise<void> {
  const bypassPath = path.join(os.homedir(), '.contextor', 'bypass.json');
  const suggestionPath = path.join(os.homedir(), '.contextor', 'suggestion.json');

  // Calculate hash
  const promptHash = crypto.createHash('md5').update(originalPrompt).digest('hex');

  // Set expiration (60 seconds from now)
  const expiresAt = new Date(Date.now() + 60000).toISOString();

  // Write bypass marker
  const bypassMarker = {
    prompt_hash: promptHash,
    created_at: new Date().toISOString(),
    expires_at: expiresAt
  };

  await fs.promises.writeFile(bypassPath, JSON.stringify(bypassMarker, null, 2));

  // Delete suggestion file
  try {
    await fs.promises.unlink(suggestionPath);
  } catch (e) {
    // File may not exist, ignore
  }

  // Copy to clipboard
  await vscode.env.clipboard.writeText(originalPrompt);

  // Show notification
  vscode.window.showInformationMessage(
    'Prompt copied! Paste in Claude Code to submit.',
    'Got it'
  );
}
```

### Capture Hook Update
```bash
# In contextor-capture.sh

BYPASS_FILE="$HOME/.contextor/bypass.json"
COACHING_SKIPPED=false

# Check if this was a skipped coaching suggestion
if [ -f "$BYPASS_FILE" ]; then
  BYPASS_HASH=$(jq -r '.prompt_hash // ""' "$BYPASS_FILE")
  INCOMING_HASH=$(echo -n "$PROMPT" | md5sum | cut -d' ' -f1)

  if [ "$BYPASS_HASH" = "$INCOMING_HASH" ]; then
    COACHING_SKIPPED=true
    rm -f "$BYPASS_FILE"
  fi
fi

# Include in capture payload
PAYLOAD=$(jq -n \
  --arg prompt "$PROMPT" \
  --argjson coaching_skipped "$COACHING_SKIPPED" \
  '{prompt: $prompt, coaching_skipped: $coaching_skipped}'
)
```

### Analytics Tracking
The capture API should track:
- `coaching_shown: boolean` - Was coaching displayed?
- `coaching_skipped: boolean` - Did user skip the suggestion?
- `coaching_accepted: boolean` - Did user use improved prompt?

Dashboard can show:
- "X% of prompts improved through coaching"
- "Most skipped suggestion types"
- "Average score: coached vs. skipped"

### Keyboard Shortcut Registration
```json
// package.json
{
  "contributes": {
    "keybindings": [
      {
        "command": "contextor.copyImproved",
        "key": "enter",
        "when": "contextor.suggestionPanelFocused"
      },
      {
        "command": "contextor.submitOriginal",
        "key": "escape",
        "when": "contextor.suggestionPanelFocused"
      }
    ]
  }
}
```

### Edge Cases
1. **User modifies prompt before resubmitting**: Hash won't match, analyzed normally
2. **Bypass expires**: Normal analysis, no silent failures
3. **Multiple bypasses**: Only one at a time, newest overwrites
4. **Extension crash before resubmit**: Bypass expires, user resubmits manually


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
