#!/usr/bin/env bash
#
# File: .claude/hooks/contextor-capture.sh
#
# Contextor - Claude Code Prompt Capture Hook
# Version: 0.3.0
#
# This hook captures user prompts and logs them to the Contextor journal.
# Uses deterministic ID so BMAD agent can overwrite with richer metadata.
#

# Fix locale warnings
export LC_ALL=C

# Suppress ALL stderr - Claude Code treats any stderr as hook error
exec 2>/dev/null

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Configuration
CONFIG_FILE="$PROJECT_ROOT/.bmad/context-coach/config.yaml"
JOURNAL_DIR="$PROJECT_ROOT/.bmad/context-coach/journal"

# Check if Contextor is installed and enabled
if [[ ! -f "$CONFIG_FILE" ]]; then
    exit 0
fi

# Simple YAML parsing (check if enabled)
ENABLED=$(grep -E "^enabled:" "$CONFIG_FILE" 2>/dev/null | sed 's/enabled:[[:space:]]*//' | tr -d '"' | tr -d "'")
if [[ "$ENABLED" != "true" ]]; then
    exit 0
fi

# Get user_id from Contextor config first
USER_ID=$(grep -E "^user_id:" "$CONFIG_FILE" 2>/dev/null | sed 's/user_id:[[:space:]]*//' | tr -d '"' | tr -d "'")

# Fallback: read user_name from BMAD core config
if [[ -z "$USER_ID" ]] || [[ "$USER_ID" == "your-name-here" ]]; then
    BMAD_CONFIG="$PROJECT_ROOT/_bmad/core/config.yaml"
    if [[ -f "$BMAD_CONFIG" ]]; then
        USER_ID=$(grep -E "^user_name:" "$BMAD_CONFIG" 2>/dev/null | sed 's/user_name:[[:space:]]*//' | tr -d '"' | tr -d "'")
    fi
fi
USER_ID="${USER_ID:-$USER}"

# Read raw input from stdin (Claude Code passes JSON this way)
RAW_INPUT=""
if [[ ! -t 0 ]]; then
    RAW_INPUT=$(cat)
fi

# Also check environment variable (backup method)
if [[ -z "$RAW_INPUT" ]] && [[ -n "$CLAUDE_USER_MESSAGE" ]]; then
    RAW_INPUT="$CLAUDE_USER_MESSAGE"
fi

# Exit if no input captured
if [[ -z "$RAW_INPUT" ]]; then
    exit 0
fi

# Parse JSON input from Claude Code to extract actual prompt
# Claude Code sends: {"session_id":"...","prompt":"actual user message",...}
PROMPT_TEXT=""
SESSION_ID_FROM_INPUT=""

# Try to extract prompt field from JSON using jq if available
if command -v jq &>/dev/null; then
    PROMPT_TEXT=$(echo "$RAW_INPUT" | jq -r '.prompt // empty' 2>/dev/null)
    SESSION_ID_FROM_INPUT=$(echo "$RAW_INPUT" | jq -r '.session_id // empty' 2>/dev/null)
fi

# Fallback: use grep/sed if jq not available or failed
if [[ -z "$PROMPT_TEXT" ]]; then
    # Try to extract "prompt":"..." from JSON
    if echo "$RAW_INPUT" | grep -q '"prompt"'; then
        # Extract the prompt value - handles escaped quotes within
        PROMPT_TEXT=$(echo "$RAW_INPUT" | sed -n 's/.*"prompt":"\([^"]*\)".*/\1/p' 2>/dev/null)
        # If that didn't work (prompt has quotes), try Python as last resort
        if [[ -z "$PROMPT_TEXT" ]] && command -v python3 &>/dev/null; then
            PROMPT_TEXT=$(python3 -c "import json,sys; d=json.loads(sys.stdin.read()); print(d.get('prompt',''))" <<< "$RAW_INPUT" 2>/dev/null)
        fi
    fi
fi

# If still no prompt extracted, use raw input (plain text case)
if [[ -z "$PROMPT_TEXT" ]]; then
    PROMPT_TEXT="$RAW_INPUT"
fi

# Exit if prompt is empty
if [[ -z "$PROMPT_TEXT" ]]; then
    exit 0
fi

# SECURITY: Redact secrets and sensitive data from prompts
# This runs BEFORE storage to prevent secrets from being saved
redact_secrets() {
    local text="$1"

    # OpenAI/Anthropic API keys: sk-... or sk-proj-...
    text=$(echo "$text" | sed -E 's/sk-[a-zA-Z0-9_-]{20,}/[REDACTED:api_key]/g')

    # AWS Access Keys: AKIA...
    text=$(echo "$text" | sed -E 's/AKIA[0-9A-Z]{16}/[REDACTED:aws_key]/g')

    # AWS Secret Keys (40 char base64-ish after = or :)
    text=$(echo "$text" | sed -E 's/(aws_secret_access_key|secret_key)[=:][[:space:]]*[A-Za-z0-9\/+=]{40}/\1=[REDACTED:aws_secret]/gi')

    # Generic passwords in assignments
    text=$(echo "$text" | sed -E 's/(password|passwd|pwd|secret|token|api_key|apikey|auth_token)[=:][[:space:]]*[^[:space:]"'\'']{8,}/\1=[REDACTED:secret]/gi')

    # Private keys (BEGIN ... PRIVATE KEY)
    text=$(echo "$text" | sed -E 's/-----BEGIN [A-Z ]+ PRIVATE KEY-----[^-]+-----END [A-Z ]+ PRIVATE KEY-----/[REDACTED:private_key]/g')

    # Connection strings with passwords: protocol://user:pass@host
    text=$(echo "$text" | sed -E 's/([a-z]+:\/\/[^:]+:)[^@]+(@)/\1[REDACTED]\2/g')

    # JWT tokens (three base64 segments separated by dots)
    text=$(echo "$text" | sed -E 's/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/[REDACTED:jwt_token]/g')

    # GitHub tokens: ghp_, gho_, ghu_, ghs_, ghr_
    text=$(echo "$text" | sed -E 's/gh[pousr]_[a-zA-Z0-9]{36,}/[REDACTED:github_token]/g')

    # Supabase keys
    text=$(echo "$text" | sed -E 's/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/[REDACTED:supabase_key]/g')

    # Generic long hex strings (likely secrets) - 32+ chars
    text=$(echo "$text" | sed -E 's/[0-9a-f]{32,}/[REDACTED:hex_secret]/g')

    echo "$text"
}

# Redact secrets BEFORE storing
PROMPT_TEXT=$(redact_secrets "$PROMPT_TEXT")

# Create journal directory if needed
mkdir -p "$JOURNAL_DIR"

# Generate DETERMINISTIC ID from prompt content
# This allows BMAD agent to overwrite with same ID
generate_deterministic_id() {
    local prompt="$1"
    local timestamp_minute=$(date +"%Y%m%d%H%M")
    # Use first 200 chars of prompt + minute timestamp for hash
    local hash_input="${timestamp_minute}:${prompt:0:200}"
    # Generate short hash (first 12 chars of md5)
    local hash=$(echo -n "$hash_input" | /sbin/md5 2>/dev/null || echo -n "$hash_input" | md5sum 2>/dev/null | cut -d' ' -f1)
    echo "cc-${hash:0:12}"
}

# Extract file references from prompt text
extract_file_references() {
    local prompt="$1"
    local files=()

    # Pattern 1: Explicit paths (src/..., ./..., /path/to/...)
    while IFS= read -r match; do
        [[ -n "$match" ]] && files+=("$match")
    done < <(echo "$prompt" | grep -oE '(src|lib|app|components|pages|public|assets|test|tests|spec|docs)/[a-zA-Z0-9_./-]+\.[a-zA-Z]+' | sort -u)

    # Pattern 2: Relative paths with ./
    while IFS= read -r match; do
        [[ -n "$match" ]] && files+=("$match")
    done < <(echo "$prompt" | grep -oE '\./[a-zA-Z0-9_./-]+\.[a-zA-Z]+' | sort -u)

    # Pattern 3: Absolute paths
    while IFS= read -r match; do
        [[ -n "$match" ]] && files+=("$match")
    done < <(echo "$prompt" | grep -oE '/[a-zA-Z0-9_.-]+(/[a-zA-Z0-9_.-]+)+\.[a-zA-Z]+' | head -10 | sort -u)

    # Pattern 4: Backtick file references like `filename.ts`
    while IFS= read -r match; do
        [[ -n "$match" ]] && files+=("$match")
    done < <(echo "$prompt" | grep -oE '`[a-zA-Z0-9_.-]+\.[a-zA-Z]+`' | tr -d '`' | sort -u)

    # Remove duplicates and format as JSON array
    local unique_files=($(printf '%s\n' "${files[@]}" | sort -u))

    if [[ ${#unique_files[@]} -eq 0 ]]; then
        echo "[]"
    else
        local json="["
        local first=true
        for f in "${unique_files[@]}"; do
            if [[ "$first" == "true" ]]; then
                first=false
            else
                json+=","
            fi
            json+="\"$f\""
        done
        json+="]"
        echo "$json"
    fi
}

# Check if prompt mentions images
has_image_references() {
    local prompt="$1"
    if echo "$prompt" | grep -qiE '(screenshot|image|picture|photo|png|jpg|jpeg|gif|svg|look at this|attached|see the)'; then
        echo "true"
    else
        echo "false"
    fi
}

# Generate entry data
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
DATE_ONLY=$(date +"%Y-%m-%d")
ENTRY_ID=$(generate_deterministic_id "$PROMPT_TEXT")

# Get project info
PROJECT_NAME=$(basename "$PROJECT_ROOT")

# Get git branch (if in git repo)
GIT_BRANCH=""
if git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree &>/dev/null; then
    GIT_BRANCH=$(git -C "$PROJECT_ROOT" branch --show-current 2>/dev/null || echo "")
fi

# Calculate counts
CHAR_COUNT=${#PROMPT_TEXT}
WORD_COUNT=$(echo "$PROMPT_TEXT" | wc -w | tr -d ' ')

# Extract file references
REFERENCED_FILES=$(extract_file_references "$PROMPT_TEXT")
HAS_IMAGES=$(has_image_references "$PROMPT_TEXT")

# Escape special characters for JSON
escape_json() {
    local text="$1"
    text="${text//\\/\\\\}"
    text="${text//\"/\\\"}"
    text="${text//$'\n'/\\n}"
    text="${text//$'\r'/\\r}"
    text="${text//$'\t'/\\t}"
    echo "$text"
}

ESCAPED_PROMPT=$(escape_json "$PROMPT_TEXT")
ESCAPED_PATH=$(escape_json "$PROJECT_ROOT")

# Journal file path
JOURNAL_FILE="$JOURNAL_DIR/${DATE_ONLY}.jsonl"

# Check if entry with this ID already exists (BMAD may have written first)
if [[ -f "$JOURNAL_FILE" ]] && grep -q "\"id\":\"$ENTRY_ID\"" "$JOURNAL_FILE"; then
    # Entry exists - don't overwrite (BMAD has priority)
    exit 0
fi

# Use session ID from input JSON if available, fallback to environment variable
FINAL_SESSION_ID="${SESSION_ID_FROM_INPUT:-${CLAUDE_SESSION_ID:-}}"

# Build JSON entry (single line for JSONL)
JSON_ENTRY="{\"id\":\"$ENTRY_ID\",\"version\":\"1.1\",\"timestamp\":\"$TIMESTAMP\",\"user_id\":\"$USER_ID\",\"source\":\"claude-code-hook\",\"project\":{\"path\":\"$ESCAPED_PATH\",\"name\":\"$PROJECT_NAME\",\"git_branch\":\"$GIT_BRANCH\"},\"prompt\":{\"text\":\"$ESCAPED_PROMPT\",\"char_count\":$CHAR_COUNT,\"word_count\":$WORD_COUNT,\"has_images\":$HAS_IMAGES,\"referenced_files\":$REFERENCED_FILES},\"context\":{\"agent_id\":null,\"agent_name\":null,\"session_id\":\"$FINAL_SESSION_ID\"}}"

# Append to journal file
echo "$JSON_ENTRY" >> "$JOURNAL_FILE"

exit 0
