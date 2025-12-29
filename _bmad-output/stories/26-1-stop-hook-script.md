# Story 26-1: Stop Hook Script

Status: Complete

## Story

**As a** Contextor system,
**I want** to capture Claude's responses via the Stop hook,
**So that** responses are stored before the next prompt arrives, enabling context-aware analysis.

## Background

Phase 3 introduces a two-hook capture architecture:

1. **Stop hook** (this story) - Fires when Claude finishes responding, captures the response
2. **UserPromptSubmit hook** - Fires when user submits prompt, captures the prompt

This ordering ensures that when a prompt is captured, all preceding responses are already in the database, enabling true conversational context for analysis.

## Acceptance Criteria

1. **Script Creation**
   - [x] **Given** the CLI has installed Contextor
   - [x] **When** the installation completes
   - [x] **Then** `.claude/hooks/contextor-response.sh` is created alongside the existing capture script
   - [x] **And** the script is executable (chmod +x)

2. **Hook Input Parsing**
   - [x] **Given** the Stop hook fires with JSON input `{transcript_path: "/path/to/session.jsonl"}`
   - [x] **When** the script runs
   - [x] **Then** the transcript path is extracted from stdin JSON
   - [x] **And** the script exits silently if transcript_path is missing or file doesn't exist

3. **Last Assistant Message Extraction**
   - [x] **Given** a valid transcript file
   - [x] **When** the script reads the file
   - [x] **Then** it finds the last line where `type === "assistant"`
   - [x] **And** extracts the response data from that message

4. **Response Data Extraction**
   - [x] **Given** the last assistant message
   - [x] **When** parsing the message content
   - [x] **Then** the following are extracted:
     - Response text (from `content[].type === "text"`)
     - Thinking content (from `content[].type === "thinking"`)
     - Tool uses (from `content[].type === "tool_use"`)
     - Model name
     - Usage statistics (input/output tokens)
     - Stop reason
     - Message UUID

5. **API Call**
   - [x] **Given** extracted response data
   - [x] **When** the script has valid configuration
   - [x] **Then** it sends POST to `${API_ENDPOINT}/responses/capture`
   - [x] **And** includes Authorization header with API key
   - [x] **And** runs the curl command in background (non-blocking)
   - [x] **And** uses 10-second timeout

6. **Silent Failure**
   - [x] **Given** any error condition (missing deps, config, file not found)
   - [x] **When** the error occurs
   - [x] **Then** the script exits with code 0 (success)
   - [x] **And** no error output is shown to the user
   - [x] **And** debug logging writes to `.contextor/.debug.log` if `DEBUG_CONTEXTOR=1`

## Tasks / Subtasks

- [x] **Task 1: Create response script template** (AC: #1, #2, #3, #4)
  - [x] Create `getResponseScriptContent()` function in `packages/cli/src/lib/hooks.ts`
  - [x] Define script constants (paths, config locations)
  - [x] Implement JSON input parsing from stdin
  - [x] Extract transcript_path from input
  - [x] Validate transcript file exists

- [x] **Task 2: Implement last assistant message detection** (AC: #3)
  - [x] Use `grep '"type":"assistant"'` to filter transcript
  - [x] Use `tail -1` to get last matching line
  - [x] Handle empty result gracefully

- [x] **Task 3: Implement response data extraction** (AC: #4)
  - [x] Extract text content with jq: `[.message.content[]? | select(.type == "text") | .text]`
  - [x] Extract thinking content: `[.message.content[]? | select(.type == "thinking") | .thinking]`
  - [x] Extract tool uses: `[.message.content[]? | select(.type == "tool_use") | {name, id}]`
  - [x] Extract model from `.message.model`
  - [x] Extract usage from `.message.usage`
  - [x] Extract stop_reason from `.message.stop_reason`
  - [x] Extract message UUID from `.uuid`

- [x] **Task 4: Implement API call** (AC: #5)
  - [x] Build JSON payload with jq
  - [x] Send POST request with curl
  - [x] Include Bearer token authentication
  - [x] Run in background with `&`
  - [x] Use `--max-time 10` for timeout

- [x] **Task 5: Implement debug logging** (AC: #6)
  - [x] Create `debug_log()` function
  - [x] Check `DEBUG_CONTEXTOR` environment variable
  - [x] Write timestamped entries to `.contextor/.debug.log`
  - [x] Log key operations: input parsing, extraction, API call

- [x] **Task 6: Add script export function** (AC: #1)
  - [x] Add `createResponseScript(cwd: string)` function
  - [x] Export alongside `createCaptureScript`
  - [x] Set executable permissions (mode 0o755)

- [x] **Task 7: Write unit tests**
  - [x] Create `packages/cli/src/lib/__tests__/hooks-response.test.ts`
  - [x] Test `getResponseScriptContent()` returns valid bash
  - [x] Test `createResponseScript()` sets correct permissions
  - [x] Test script handles missing transcript file
  - [x] Test script parses valid hook input

## Dev Notes

### Stop Hook Input Format

Claude Code's Stop hook provides JSON via stdin:

```json
{
  "transcript_path": "/Users/user/.claude/projects/abc123/sessions/xyz789.jsonl"
}
```

### Transcript JSONL Format

Each line in the transcript is a JSON object. Assistant messages look like:

```json
{
  "uuid": "msg_01ABC...",
  "type": "assistant",
  "message": {
    "id": "msg_01ABC...",
    "type": "message",
    "role": "assistant",
    "model": "claude-sonnet-4-20250514",
    "content": [
      { "type": "thinking", "thinking": "Let me analyze..." },
      { "type": "text", "text": "Here's the solution..." },
      { "type": "tool_use", "id": "toolu_01...", "name": "Read", "input": {...} }
    ],
    "stop_reason": "end_turn",
    "usage": {
      "input_tokens": 1234,
      "output_tokens": 567,
      "cache_creation_input_tokens": 0,
      "cache_read_input_tokens": 500
    }
  },
  "timestamp": "2025-12-25T10:30:00Z"
}
```

### Response Script Template

```bash
#!/bin/bash
# Contextor Response Capture - Captures LLM responses via Stop hook
# Errors are logged to debug file if DEBUG_CONTEXTOR=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

USER_CONFIG="${PROJECT_ROOT}/.contextor/.user"
SHARED_CONFIG="${PROJECT_ROOT}/.contextor/config.json"
DEBUG_LOG="${PROJECT_ROOT}/.contextor/.debug.log"

# Debug logging function
debug_log() {
  if [[ "${DEBUG_CONTEXTOR}" == "1" ]]; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $1" >> "${DEBUG_LOG}" 2>/dev/null
  fi
}

# Exit silently if deps missing
command -v jq >/dev/null 2>&1 || { debug_log "ERROR: jq not found"; exit 0; }
command -v curl >/dev/null 2>&1 || { debug_log "ERROR: curl not found"; exit 0; }

# Exit silently if not configured
[[ -f "${USER_CONFIG}" && -f "${SHARED_CONFIG}" ]] || { debug_log "ERROR: config missing"; exit 0; }

# Read hook input from stdin
HOOK_INPUT=$(cat)
TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // empty')

if [[ -z "$TRANSCRIPT_PATH" ]] || [[ ! -f "$TRANSCRIPT_PATH" ]]; then
  debug_log "ERROR: transcript_path missing or file not found"
  exit 0
fi

debug_log "INFO: Processing transcript: ${TRANSCRIPT_PATH}"

# Read config
API_KEY=$(jq -r '.api_key // empty' "${USER_CONFIG}")
API_ENDPOINT=$(jq -r '.api_endpoint // empty' "${SHARED_CONFIG}")

[[ -n "${API_KEY}" && -n "${API_ENDPOINT}" ]] || { debug_log "ERROR: config incomplete"; exit 0; }

# Extract session ID from transcript path (filename without .jsonl)
SESSION_ID=$(basename "$TRANSCRIPT_PATH" .jsonl)

# Find last assistant message in transcript
LAST_ASSISTANT=$(grep '"type":"assistant"' "$TRANSCRIPT_PATH" | tail -1)

if [[ -z "$LAST_ASSISTANT" ]]; then
  debug_log "INFO: No assistant message found"
  exit 0
fi

# Extract response data using jq
RESPONSE_TEXT=$(echo "$LAST_ASSISTANT" | jq -r '
  [.message.content[]? | select(.type == "text") | .text] | join("\n")
')
THINKING_TEXT=$(echo "$LAST_ASSISTANT" | jq -r '
  [.message.content[]? | select(.type == "thinking") | .thinking] | join("\n")
')
TOOLS_USED=$(echo "$LAST_ASSISTANT" | jq -c '
  [.message.content[]? | select(.type == "tool_use") | {name, id}]
')
MODEL=$(echo "$LAST_ASSISTANT" | jq -r '.message.model // empty')
USAGE=$(echo "$LAST_ASSISTANT" | jq -c '.message.usage // {}')
STOP_REASON=$(echo "$LAST_ASSISTANT" | jq -r '.message.stop_reason // empty')
MESSAGE_UUID=$(echo "$LAST_ASSISTANT" | jq -r '.uuid // empty')

# Calculate thinking summary (first 500 chars)
THINKING_SUMMARY="${THINKING_TEXT:0:500}"
THINKING_WORD_COUNT=$(echo "$THINKING_TEXT" | wc -w | tr -d ' ')

debug_log "INFO: Extracted response - model: ${MODEL}, stop_reason: ${STOP_REASON}, tools: ${TOOLS_USED}"

# Send to API in background (non-blocking, 10s timeout)
{
  RESPONSE=$(curl -s --max-time 10 -w "\n%{http_code}" -X POST "${API_ENDPOINT}/responses/capture" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${API_KEY}" \
    -d "$(jq -n \
      --arg session_id "$SESSION_ID" \
      --arg message_uuid "$MESSAGE_UUID" \
      --arg response_text "$RESPONSE_TEXT" \
      --arg thinking_summary "$THINKING_SUMMARY" \
      --argjson thinking_word_count "$THINKING_WORD_COUNT" \
      --argjson tools_used "$TOOLS_USED" \
      --arg model "$MODEL" \
      --argjson usage "$USAGE" \
      --arg stop_reason "$STOP_REASON" \
      '{
        session_id: $session_id,
        message_uuid: $message_uuid,
        response_text: $response_text,
        thinking_summary: $thinking_summary,
        thinking_word_count: $thinking_word_count,
        tools_used: $tools_used,
        model: $model,
        usage: $usage,
        stop_reason: $stop_reason
      }')" 2>&1)

  HTTP_CODE=$(echo "${RESPONSE}" | tail -n1)
  BODY=$(echo "${RESPONSE}" | sed '$d')

  if [[ "${HTTP_CODE}" -ge 200 && "${HTTP_CODE}" -lt 300 ]]; then
    debug_log "INFO: Response captured successfully (HTTP ${HTTP_CODE})"
  else
    debug_log "ERROR: Response capture failed (HTTP ${HTTP_CODE}): ${BODY}"
  fi
} &

exit 0
```

### File Locations

| Component | Path |
|-----------|------|
| Response Script Template | `packages/cli/src/lib/hooks.ts` (getResponseScriptContent) |
| Response Script Output | `.claude/hooks/contextor-response.sh` |
| Debug Log | `.contextor/.debug.log` |

### Dependencies

- **jq**: JSON parsing (required)
- **curl**: HTTP requests (required)
- **grep**: Finding assistant messages (standard)
- **bash**: Script interpreter (standard)

### Critical Constraints

1. **Non-blocking**: Script must run curl in background
2. **Silent failure**: Never show errors to user
3. **Fast execution**: Keep parsing minimal
4. **Session ID**: Extract from transcript filename
5. **Background curl**: Use `&` to not block Claude Code

### Extraction Architecture: Bash vs TypeScript

**This bash extraction is for client-side processing in the hook script.** It runs locally on the user's machine when the Stop hook fires, extracting response data from the transcript file before sending to the API.

The TypeScript extraction in Story 26-4 serves as a **server-side validation layer**. It can:
1. Re-extract from raw_message if provided by the client
2. Validate pre-extracted data sent from this bash hook
3. Provide a consistent extraction implementation for other server-side consumers

This dual-layer approach allows for:
- Fast client-side extraction (bash) that doesn't block Claude Code
- Robust server-side validation (TypeScript) with proper error handling
- Future flexibility to send raw_message instead of pre-extracted fields

### Concurrent Execution Handling

**Handle concurrent executions:** If multiple Stop hooks fire rapidly (e.g., Claude generates multiple responses in quick succession), each hook execution should capture independently. The API endpoint handles idempotency via `message_uuid` - duplicate submissions with the same UUID are safely ignored or updated.

### API Payload Schema

```typescript
interface ResponseCaptureRequest {
  session_id: string;        // From transcript filename
  message_uuid: string;      // From .uuid field
  response_text: string;     // Concatenated text content
  thinking_summary: string;  // First 500 chars of thinking
  thinking_word_count: number; // Original thinking length
  tools_used: Array<{name: string; id: string}>;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  stop_reason: string;
}
```

### Test Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| Missing transcript_path in input | Exit 0, log error if DEBUG |
| Transcript file doesn't exist | Exit 0, log error if DEBUG |
| No assistant messages in transcript | Exit 0, log info if DEBUG |
| Valid transcript with response | Extract data, call API |
| API returns error | Log error if DEBUG, exit 0 |
| Missing jq dependency | Exit 0, log error if DEBUG |
| API timeout (>10s) | curl terminates, exit 0 |
| Concurrent hook executions | Each captures independently, API deduplicates via message_uuid |

### Verification Checklist

- [x] Script created at `.claude/hooks/contextor-response.sh`
- [x] Script is executable (chmod +x)
- [x] Script parses hook input JSON correctly
- [x] Script reads transcript file
- [x] Script finds last assistant message
- [x] Script extracts all response fields
- [x] Script builds correct API payload
- [x] Script calls API with correct headers
- [x] Script runs curl in background
- [x] Script exits 0 on all error paths
- [x] Debug logging works when DEBUG_CONTEXTOR=1

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. Created `getResponseScriptContent()` function returning a complete bash script for response capture
2. Implemented `createResponseScript()` to write the script with executable permissions (0o755)
3. Added `configureStopHook()` to configure the Stop hook in Claude settings.json
4. Added `removeStopHook()` for clean uninstallation
5. Added `RESPONSE_SCRIPT` constant for the script filename
6. All functions follow the same patterns as existing prompt capture hook
7. Script extracts session ID from transcript filename (e.g., `xyz789.jsonl` -> `xyz789`)
8. Thinking summary is first 500 chars with word count preserved for API
9. Tools are extracted with name and id only for minimal payload size

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-25 | Story created | PM Agent |
| 2025-12-26 | Implementation complete - 46 unit tests passing | Claude Opus 4.5 |

### File List

**Created:**
- `packages/cli/src/lib/__tests__/hooks-response.test.ts` - 46 unit tests for response hook

**Modified:**
- `packages/cli/src/lib/hooks.ts` - Added getResponseScriptContent, createResponseScript, configureStopHook, removeStopHook, RESPONSE_SCRIPT constant
