#!/bin/bash
# Contextor Capture - Silent background prompt capture
# Errors are logged to debug file if DEBUG_CONTEXTOR=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

USER_CONFIG="${PROJECT_ROOT}/.contextor/.user"
SHARED_CONFIG="${PROJECT_ROOT}/.contextor/config.json"
DEBUG_LOG="${PROJECT_ROOT}/.contextor/.debug.log"

# Debug logging function - only logs if DEBUG_CONTEXTOR=1
debug_log() {
  if [[ "${DEBUG_CONTEXTOR}" == "1" ]]; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $1" >> "${DEBUG_LOG}" 2>/dev/null
  fi
}

# Exit silently if not configured or deps missing
if ! command -v jq >/dev/null 2>&1; then
  debug_log "ERROR: jq not found in PATH"
  exit 0
fi
if ! command -v curl >/dev/null 2>&1; then
  debug_log "ERROR: curl not found in PATH"
  exit 0
fi
if [[ ! -f "${USER_CONFIG}" ]]; then
  debug_log "ERROR: User config not found at ${USER_CONFIG}"
  exit 0
fi
if [[ ! -f "${SHARED_CONFIG}" ]]; then
  debug_log "ERROR: Shared config not found at ${SHARED_CONFIG}"
  exit 0
fi

# Read config
API_KEY=$(jq -r '.api_key // empty' "${USER_CONFIG}" 2>/dev/null)
API_ENDPOINT=$(jq -r '.api_endpoint // empty' "${SHARED_CONFIG}" 2>/dev/null)
PROJECT_ID=$(jq -r '.project_id // empty' "${SHARED_CONFIG}" 2>/dev/null)
USER_ID=$(jq -r '.user_id // empty' "${USER_CONFIG}" 2>/dev/null)

if [[ -z "${API_KEY}" ]]; then
  debug_log "ERROR: api_key is empty or missing from user config"
  exit 0
fi
if [[ -z "${API_ENDPOINT}" ]]; then
  debug_log "ERROR: api_endpoint is empty or missing from shared config"
  exit 0
fi

# Read prompt from stdin
INPUT=$(cat)
PROMPT=$(echo "${INPUT}" | jq -r '.prompt // empty' 2>/dev/null)
if [[ -z "${PROMPT}" ]]; then
  debug_log "ERROR: No prompt found in input JSON"
  exit 0
fi

debug_log "INFO: Capturing prompt (${#PROMPT} chars) to ${API_ENDPOINT}/prompts/capture"

# Send to API in background (non-blocking, 10s timeout)
{
  RESPONSE=$(curl -s --max-time 10 -w "\n%{http_code}" -X POST "${API_ENDPOINT}/prompts/capture" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${API_KEY}" \
    -d "$(jq -n \
      --arg user_id "${USER_ID}" \
      --arg prompt "${PROMPT}" \
      --arg project_id "${PROJECT_ID}" \
      '{user_id:$user_id,prompt:$prompt,timestamp:(now|todate),metadata:{source:"claude-code-hook",project_id:$project_id}}')" 2>&1)

  HTTP_CODE=$(echo "${RESPONSE}" | tail -n1)
  BODY=$(echo "${RESPONSE}" | sed '$d')

  if [[ "${HTTP_CODE}" -ge 200 && "${HTTP_CODE}" -lt 300 ]]; then
    debug_log "INFO: Capture successful (HTTP ${HTTP_CODE})"
  else
    debug_log "ERROR: Capture failed (HTTP ${HTTP_CODE}): ${BODY}"
  fi
} &

exit 0
