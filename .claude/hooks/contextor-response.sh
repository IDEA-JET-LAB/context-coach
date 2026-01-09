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

# RACE CONDITION FIX: Wait for transcript to be fully written
# The Stop hook can fire before Claude Code finishes flushing tool_use entries
sleep 0.2

debug_log "INFO: Processing transcript: ${TRANSCRIPT_PATH}"

# Read config
API_KEY=$(jq -r '.api_key // empty' "${USER_CONFIG}")
API_ENDPOINT=$(jq -r '.api_endpoint // empty' "${SHARED_CONFIG}")

[[ -n "${API_KEY}" && -n "${API_ENDPOINT}" ]] || { debug_log "ERROR: config incomplete"; exit 0; }

# Extract session ID from transcript path (filename without .jsonl)
SESSION_ID=$(basename "$TRANSCRIPT_PATH" .jsonl)

# Find the line number of the last user message (marks start of current turn)
LAST_USER_LINE=$(grep -n '"type":"user"' "$TRANSCRIPT_PATH" | tail -1 | cut -d: -f1)

# Get all assistant messages after the last user message (current turn)
# This aggregates text, thinking, and tools from all messages in this turn
if [[ -n "$LAST_USER_LINE" ]]; then
  CURRENT_TURN_MESSAGES=$(tail -n +"$LAST_USER_LINE" "$TRANSCRIPT_PATH" | grep '"type":"assistant"')
else
  # No user message found, use all assistant messages
  CURRENT_TURN_MESSAGES=$(grep '"type":"assistant"' "$TRANSCRIPT_PATH")
fi

if [[ -z "$CURRENT_TURN_MESSAGES" ]]; then
  debug_log "INFO: No assistant messages found in current turn"
  exit 0
fi

# Aggregate response text from ALL messages with text in this turn
RESPONSE_TEXT=""
while IFS= read -r line; do
  TEXT=$(echo "$line" | jq -r '[.message.content[]? | select(.type == "text") | .text] | join("\n")' 2>/dev/null)
  if [[ -n "$TEXT" ]]; then
    RESPONSE_TEXT="${RESPONSE_TEXT}${TEXT}\n"
  fi
done <<< "$CURRENT_TURN_MESSAGES"

# Aggregate thinking text from ALL messages with thinking in this turn
THINKING_TEXT=""
while IFS= read -r line; do
  THINK=$(echo "$line" | jq -r '[.message.content[]? | select(.type == "thinking") | .thinking] | join("\n")' 2>/dev/null)
  if [[ -n "$THINK" ]]; then
    THINKING_TEXT="${THINKING_TEXT}${THINK}\n"
  fi
done <<< "$CURRENT_TURN_MESSAGES"

# Aggregate tools from ALL messages with tool_use in this turn
ALL_TOOLS="[]"
while IFS= read -r line; do
  TOOLS=$(echo "$line" | jq -c '[.message.content[]? | select(.type == "tool_use") | {
    name,
    id,
    input_summary: (
      if .name == "Read" then "Read: " + (.input.file_path // "unknown")
      elif .name == "Write" then "Write: " + (.input.file_path // "unknown")
      elif .name == "Edit" then "Edit: " + (.input.file_path // "unknown")
      elif .name == "Bash" then "Bash: " + ((.input.command // "")[0:100])
      elif .name == "Glob" then "Glob: " + (.input.pattern // "unknown")
      elif .name == "Grep" then "Grep: " + (.input.pattern // "unknown")
      elif .name == "Task" then "Task: " + (.input.description // "unknown")
      elif .name == "TodoWrite" then "TodoWrite"
      elif .name == "WebFetch" then "WebFetch: " + (.input.url // "unknown")
      elif .name == "WebSearch" then "WebSearch: " + (.input.query // "unknown")
      else (.input | tostring)[0:200]
      end
    ),
    input_full: .input
  }]' 2>/dev/null)
  if [[ -n "$TOOLS" ]] && [[ "$TOOLS" != "[]" ]] && [[ "$TOOLS" != "null" ]]; then
    ALL_TOOLS=$(echo "$ALL_TOOLS $TOOLS" | jq -s 'add' 2>/dev/null || echo "$ALL_TOOLS")
  fi
done <<< "$CURRENT_TURN_MESSAGES"
TOOLS_USED="$ALL_TOOLS"

# Get metadata from the LAST assistant message (most recent model/usage info)
LAST_ASSISTANT=$(echo "$CURRENT_TURN_MESSAGES" | tail -1)
MODEL=$(echo "$LAST_ASSISTANT" | jq -r '.message.model // empty' 2>/dev/null)
USAGE=$(echo "$LAST_ASSISTANT" | jq -c '.message.usage // {}' 2>/dev/null)
STOP_REASON=$(echo "$LAST_ASSISTANT" | jq -r '.message.stop_reason // empty' 2>/dev/null)
MESSAGE_UUID=$(echo "$LAST_ASSISTANT" | jq -r '.uuid // empty' 2>/dev/null)

# RETRY LOGIC: If stop_reason indicates tool use but no tools found, retry once
# This handles race conditions where transcript isn't fully flushed
if [[ "$STOP_REASON" == "tool_use" ]] && [[ "$TOOLS_USED" == "[]" ]]; then
  debug_log "INFO: stop_reason=tool_use but no tools found, retrying after delay..."
  sleep 0.3

  # Re-read current turn messages
  if [[ -n "$LAST_USER_LINE" ]]; then
    CURRENT_TURN_MESSAGES=$(tail -n +"$LAST_USER_LINE" "$TRANSCRIPT_PATH" | grep '"type":"assistant"')
  else
    CURRENT_TURN_MESSAGES=$(grep '"type":"assistant"' "$TRANSCRIPT_PATH")
  fi

  # Re-extract tools
  ALL_TOOLS="[]"
  while IFS= read -r line; do
    TOOLS=$(echo "$line" | jq -c '[.message.content[]? | select(.type == "tool_use") | {
      name,
      id,
      input_summary: (
        if .name == "Read" then "Read: " + (.input.file_path // "unknown")
        elif .name == "Write" then "Write: " + (.input.file_path // "unknown")
        elif .name == "Edit" then "Edit: " + (.input.file_path // "unknown")
        elif .name == "Bash" then "Bash: " + ((.input.command // "")[0:100])
        elif .name == "Glob" then "Glob: " + (.input.pattern // "unknown")
        elif .name == "Grep" then "Grep: " + (.input.pattern // "unknown")
        elif .name == "Task" then "Task: " + (.input.description // "unknown")
        elif .name == "TodoWrite" then "TodoWrite"
        elif .name == "WebFetch" then "WebFetch: " + (.input.url // "unknown")
        elif .name == "WebSearch" then "WebSearch: " + (.input.query // "unknown")
        else (.input | tostring)[0:200]
        end
      ),
      input_full: .input
    }]' 2>/dev/null)
    if [[ -n "$TOOLS" ]] && [[ "$TOOLS" != "[]" ]] && [[ "$TOOLS" != "null" ]]; then
      ALL_TOOLS=$(echo "$ALL_TOOLS $TOOLS" | jq -s 'add' 2>/dev/null || echo "$ALL_TOOLS")
    fi
  done <<< "$CURRENT_TURN_MESSAGES"
  TOOLS_USED="$ALL_TOOLS"

  # Update metadata from retried messages
  LAST_ASSISTANT=$(echo "$CURRENT_TURN_MESSAGES" | tail -1)
  MESSAGE_UUID=$(echo "$LAST_ASSISTANT" | jq -r '.uuid // empty' 2>/dev/null)
  debug_log "INFO: Retry complete - tools: ${TOOLS_USED}"
fi

# Skip if we have nothing to capture (no text and no tools)
if [[ -z "$RESPONSE_TEXT" ]] && [[ "$TOOLS_USED" == "[]" ]]; then
  debug_log "INFO: No text or tools to capture in current turn"
  exit 0
fi

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
      --argjson thinking_word_count "${THINKING_WORD_COUNT:-0}" \
      --arg thinking_text "$THINKING_TEXT" \
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
        thinking_text: $thinking_text,
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
