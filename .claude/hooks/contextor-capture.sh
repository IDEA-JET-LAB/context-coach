#!/bin/bash
# Contextor Capture - Silent background prompt capture
# Errors are suppressed to avoid disrupting Claude Code

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

USER_CONFIG="${PROJECT_ROOT}/.contextor/.user"
SHARED_CONFIG="${PROJECT_ROOT}/.contextor/config.json"

# Exit silently if not configured or deps missing
command -v jq >/dev/null 2>&1 || exit 0
command -v curl >/dev/null 2>&1 || exit 0
[[ -f "${USER_CONFIG}" && -f "${SHARED_CONFIG}" ]] || exit 0

# Read config
API_KEY=$(jq -r '.api_key // empty' "${USER_CONFIG}" 2>/dev/null)
API_ENDPOINT=$(jq -r '.api_endpoint // empty' "${SHARED_CONFIG}" 2>/dev/null)
PROJECT_ID=$(jq -r '.project_id // empty' "${SHARED_CONFIG}" 2>/dev/null)
USER_ID=$(jq -r '.user_id // empty' "${USER_CONFIG}" 2>/dev/null)

[[ -n "${API_KEY}" && -n "${API_ENDPOINT}" ]] || exit 0

# Read prompt from stdin
INPUT=$(cat)
PROMPT=$(echo "${INPUT}" | jq -r '.prompt // empty' 2>/dev/null)
[[ -n "${PROMPT}" ]] || exit 0

# Send to API in background (non-blocking, 10s timeout)
{
  curl -s --max-time 10 -X POST "${API_ENDPOINT}/prompts/capture" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${API_KEY}" \
    -d "$(jq -n \
      --arg user_id "${USER_ID}" \
      --arg prompt "${PROMPT}" \
      --arg project_id "${PROJECT_ID}" \
      '{user_id:$user_id,prompt:$prompt,timestamp:(now|todate),metadata:{source:"claude-code-hook",project_id:$project_id}}')" \
    >/dev/null 2>&1
} &

exit 0
