#!/usr/bin/env bash
#
# File: .claude/hooks/context-coach-capture.sh
#
# Context Coach - Claude Code Prompt Capture Hook
# Version: 0.2.0
#
# This hook captures user prompts and logs them to the Context Coach journal.
# Uses deterministic ID so BMAD agent can overwrite with richer metadata.
#

# Fix locale warnings
export LC_ALL=C

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Configuration
CONFIG_FILE="$PROJECT_ROOT/.bmad/context-coach/config.yaml"
JOURNAL_DIR="$PROJECT_ROOT/.bmad/context-coach/journal"

# Check if Context Coach is installed and enabled
if [[ ! -f "$CONFIG_FILE" ]]; then
    exit 0
fi

# Simple YAML parsing (check if enabled)
ENABLED=$(grep -E "^enabled:" "$CONFIG_FILE" 2>/dev/null | sed 's/enabled:[[:space:]]*//' | tr -d '"' | tr -d "'")
if [[ "$ENABLED" != "true" ]]; then
    exit 0
fi

# Get user_id from config
USER_ID=$(grep -E "^user_id:" "$CONFIG_FILE" 2>/dev/null | sed 's/user_id:[[:space:]]*//' | tr -d '"' | tr -d "'")
USER_ID="${USER_ID:-$USER}"

# Read prompt from stdin (Claude Code passes it this way)
PROMPT_TEXT=""
if [[ ! -t 0 ]]; then
    PROMPT_TEXT=$(cat)
fi

# Also check environment variable (backup method)
if [[ -z "$PROMPT_TEXT" ]] && [[ -n "$CLAUDE_USER_MESSAGE" ]]; then
    PROMPT_TEXT="$CLAUDE_USER_MESSAGE"
fi

# Exit if no prompt captured
if [[ -z "$PROMPT_TEXT" ]]; then
    exit 0
fi

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
    local hash=$(echo -n "$hash_input" | md5 2>/dev/null || echo -n "$hash_input" | md5sum | cut -d' ' -f1)
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

# Build JSON entry (single line for JSONL)
JSON_ENTRY="{\"id\":\"$ENTRY_ID\",\"version\":\"1.1\",\"timestamp\":\"$TIMESTAMP\",\"user_id\":\"$USER_ID\",\"source\":\"claude-code-hook\",\"project\":{\"path\":\"$ESCAPED_PATH\",\"name\":\"$PROJECT_NAME\",\"git_branch\":\"$GIT_BRANCH\"},\"prompt\":{\"text\":\"$ESCAPED_PROMPT\",\"char_count\":$CHAR_COUNT,\"word_count\":$WORD_COUNT,\"has_images\":$HAS_IMAGES,\"referenced_files\":$REFERENCED_FILES},\"context\":{\"agent_id\":null,\"agent_name\":null,\"session_id\":\"${CLAUDE_SESSION_ID:-}\"}}"

# Append to journal file
echo "$JSON_ENTRY" >> "$JOURNAL_FILE"

exit 0
