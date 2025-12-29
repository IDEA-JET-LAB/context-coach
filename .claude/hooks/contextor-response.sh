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
      --argjson thinking_word_count "${THINKING_WORD_COUNT:-0}" \
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
