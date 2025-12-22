# Story 5.7: Command Prompt Classification

Status: Done ✅

## Story
**As a** system,
**I want** to identify and classify slash command prompts,
**So that** they are stored but not analyzed, saving AI costs and keeping analytics focused on actual prompts.

## Background
Users frequently send slash commands like `/commit`, `/review-pr`, `/dev` (BMAD agents), etc. These are not "prompts" in the coaching sense - they're commands to invoke functionality. Analyzing them wastes AI credits and pollutes analytics with non-representative data.

## Acceptance Criteria
1. **Given** a pure command prompt (e.g., `/commit`, `/dev`, `/review-pr 123`)
   **When** it is captured via the API
   **Then** it is stored with `prompt_type = 'command'`
   **And** `analysis_status` is set to `'skipped'`

2. **Given** a command with meaningful text (e.g., `/dev help me implement OAuth`)
   **When** it is captured via the API
   **Then** it is stored with `prompt_type = 'command_with_prompt'`
   **And** the prompt text after the command is extracted for analysis
   **And** `analysis_status` is set to `'pending'` (normal flow)

3. **Given** a regular prompt (no `/` prefix)
   **When** it is captured via the API
   **Then** it is stored with `prompt_type = 'prompt'`
   **And** `analysis_status` is set to `'pending'` (normal flow)

4. **Given** the database trigger for analysis
   **When** a prompt has `analysis_status = 'skipped'`
   **Then** the trigger does NOT invoke the Edge Function

5. **Given** the prompt feed in the dashboard
   **When** displaying pure command prompts
   **Then** they appear with a distinct visual style (muted color, command icon)
   **And** show "Command - not analyzed" instead of scores

6. **Given** the prompt feed in the dashboard
   **When** displaying command_with_prompt entries
   **Then** they show the command as a tag/badge
   **And** display the analysis scores for the prompt portion

7. **Given** the analytics calculations
   **When** computing averages and trends
   **Then** pure command prompts (`prompt_type = 'command'`) are excluded

## Tasks / Subtasks
- [x] **Task 1: Database schema changes** (AC: #1, #2, #3)
  - [x] Create migration to add `prompt_type` column to `prompts` table
  - [x] Add CHECK constraint: `prompt_type IN ('prompt', 'command', 'command_with_prompt')`
  - [x] Add `'skipped'` to `analysis_status` CHECK constraint
  - [x] Add `analyzed_text` column (nullable) - stores extracted prompt portion for command_with_prompt
  - [x] Set default `prompt_type = 'prompt'` for backward compatibility
  - [x] Update existing prompts: classify based on text content

- [x] **Task 2: Capture API classification logic** (AC: #1, #2, #3)
  - [x] Add `classifyPrompt(text: string)` function in `lib/capture/`
  - [x] Implement three-way classification: prompt, command, command_with_prompt
  - [x] Extract prompt portion from command_with_prompt types
  - [x] Update `storePrompt()` to set `prompt_type`, `analyzed_text`, and `analysis_status`
  - [x] Add unit tests for all classification cases (19 tests passing)

- [x] **Task 3: Update Edge Function** (AC: #3)
  - [x] Update Edge Function to use `analyzed_text` for command_with_prompt types
  - [x] Edge Function skips prompts with `analysis_status = 'skipped'`

- [x] **Task 4: Dashboard display changes** (AC: #4, #5, #6)
  - [x] Update `PromptRow` component to handle command prompts
  - [x] Add Terminal icon and muted styling for pure commands
  - [x] Show "Not analyzed" label instead of score for commands
  - [x] Display command badge for both command types
  - [x] Update `ScoreBadge` with 'skipped' status handling
  - [x] Update `AnalysisStatus` with 'skipped' status

- [x] **Task 5: Analytics exclusion** (AC: #7)
  - [x] Update `use-personal-analytics.ts` to filter out commands
  - [x] Update `use-team-analytics.ts` to filter out commands
  - [x] Update `use-team-average.ts` to filter out commands
  - [x] Update `use-member-analytics.ts` to filter out commands

## Technical Notes

### Classification Logic
Commands can have meaningful prompt text after them. We need to distinguish:
1. **Pure commands** - Just the command, skip analysis
2. **Commands with prompts** - Command + meaningful text, analyze the text portion

```typescript
interface PromptClassification {
  type: 'prompt' | 'command' | 'command_with_prompt';
  commandPart?: string;      // e.g., "/dev"
  promptPart?: string;       // e.g., "help me implement auth"
  shouldAnalyze: boolean;
}

function classifyPrompt(text: string): PromptClassification {
  const trimmed = text.trim();

  // Not a command - regular prompt
  if (!trimmed.startsWith('/')) {
    return { type: 'prompt', promptPart: trimmed, shouldAnalyze: true };
  }

  // Extract command and remainder
  const match = trimmed.match(/^(\/[a-zA-Z][a-zA-Z0-9_:-]*)\s*(.*)/);
  if (!match) {
    return { type: 'command', shouldAnalyze: false };
  }

  const [, command, remainder] = match;

  // Pure command or command with just ID/number
  if (!remainder || /^[\d\s-]*$/.test(remainder)) {
    return { type: 'command', commandPart: command, shouldAnalyze: false };
  }

  // Command followed by meaningful prompt text
  return {
    type: 'command_with_prompt',
    commandPart: command,
    promptPart: remainder,
    shouldAnalyze: true
  };
}
```

### Examples - Pure Commands (skip analysis)
- `/commit` - Just the command
- `/dev` - Agent activation
- `/review-pr 123` - Command with ID only
- `/help` - Help command
- `/bmad:bmm:agents:dev` - Full agent path

### Examples - Commands with Prompts (analyze)
- `/commit fix the login validation bug` → analyze "fix the login validation bug"
- `/dev help me implement OAuth` → analyze "help me implement OAuth"
- `/review-pr 123 focus on security` → analyze "focus on security"

### Examples - Regular Prompts (analyze)
- `Help me fix this bug` - No slash prefix
- `What does /api/users do?` - Slash not at start

### Database Schema Consideration
The `prompt_type` column should support three values:
- `'prompt'` - Regular prompt
- `'command'` - Pure command (skip analysis)
- `'command_with_prompt'` - Command + prompt (analyze the prompt part)

For `command_with_prompt`, we might want to store both the original text and the extracted prompt part that was analyzed.

## Dependencies
- Story 5.1 (Analysis Edge Function) - Must be complete
- Story 6.2 (Prompt Feed) - For display changes

## Estimation
- **Complexity:** Medium
- **Tasks:** 5
- **Risk:** Low - isolated changes, backward compatible
