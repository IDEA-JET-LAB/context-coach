#!/usr/bin/env bash
#
# File: contextor-bmad-capture.sh
#
# Contextor - BMAD Agent Prompt Capture Script
# Version: 0.3.0
#
# Called by BMAD agents to log prompts with agent metadata.
# Overwrites Claude Code hook entries (same ID) to add richer data.
#
# Usage:
#   contextor-bmad-capture.sh "prompt text" "agent-id" "agent-name"
#
# Example:
#   .bmad/contextor/capture.sh "Help me refactor auth" "bmad-master" "BMad Master"
#

# Fix locale warnings
export LC_ALL=C

# Get arguments
PROMPT_TEXT="$1"
AGENT_ID="$2"
AGENT_NAME="$3"

# Exit if no prompt provided
if [[ -z "$PROMPT_TEXT" ]]; then
    exit 0
fi

# Get project root
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Configuration paths
CONFIG_FILE="$PROJECT_ROOT/.bmad/contextor/config.yaml"
BMAD_CONFIG="$PROJECT_ROOT/_bmad/core/config.yaml"
JOURNAL_DIR="$PROJECT_ROOT/.bmad/contextor/journal"

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
    if [[ -f "$BMAD_CONFIG" ]]; then
        USER_ID=$(grep -E "^user_name:" "$BMAD_CONFIG" 2>/dev/null | sed 's/user_name:[[:space:]]*//' | tr -d '"' | tr -d "'")
    fi
fi
USER_ID="${USER_ID:-$USER}"

# Create journal directory if needed
mkdir -p "$JOURNAL_DIR"

# Generate DETERMINISTIC ID from prompt content (must match hook!)
generate_deterministic_id() {
    local prompt="$1"
    local timestamp_minute=$(date +"%Y%m%d%H%M")
    local hash_input="${timestamp_minute}:${prompt:0:200}"
    local hash=$(echo -n "$hash_input" | md5 2>/dev/null || echo -n "$hash_input" | md5sum | cut -d' ' -f1)
    echo "cc-${hash:0:12}"
}

# Extract file references from prompt text
extract_file_references() {
    local prompt="$1"
    local files=()

    while IFS= read -r match; do
        [[ -n "$match" ]] && files+=("$match")
    done < <(echo "$prompt" | grep -oE '(src|lib|app|components|pages|public|assets|test|tests|spec|docs)/[a-zA-Z0-9_./-]+\.[a-zA-Z]+' | sort -u)

    while IFS= read -r match; do
        [[ -n "$match" ]] && files+=("$match")
    done < <(echo "$prompt" | grep -oE '\./[a-zA-Z0-9_./-]+\.[a-zA-Z]+' | sort -u)

    while IFS= read -r match; do
        [[ -n "$match" ]] && files+=("$match")
    done < <(echo "$prompt" | grep -oE '`[a-zA-Z0-9_.-]+\.[a-zA-Z]+`' | tr -d '`' | sort -u)

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
ESCAPED_AGENT_ID=$(escape_json "$AGENT_ID")
ESCAPED_AGENT_NAME=$(escape_json "$AGENT_NAME")

# Journal file path
JOURNAL_FILE="$JOURNAL_DIR/${DATE_ONLY}.jsonl"

# BMAD overwrites hook entries - remove existing entry with same ID
if [[ -f "$JOURNAL_FILE" ]]; then
    # Create temp file without the matching entry
    grep -v "\"id\":\"$ENTRY_ID\"" "$JOURNAL_FILE" > "${JOURNAL_FILE}.tmp" 2>/dev/null || true
    mv "${JOURNAL_FILE}.tmp" "$JOURNAL_FILE"
fi

# Build JSON entry (single line for JSONL) - source is "bmad-agent"
JSON_ENTRY="{\"id\":\"$ENTRY_ID\",\"version\":\"1.1\",\"timestamp\":\"$TIMESTAMP\",\"user_id\":\"$USER_ID\",\"source\":\"bmad-agent\",\"project\":{\"path\":\"$ESCAPED_PATH\",\"name\":\"$PROJECT_NAME\",\"git_branch\":\"$GIT_BRANCH\"},\"prompt\":{\"text\":\"$ESCAPED_PROMPT\",\"char_count\":$CHAR_COUNT,\"word_count\":$WORD_COUNT,\"has_images\":$HAS_IMAGES,\"referenced_files\":$REFERENCED_FILES},\"context\":{\"agent_id\":\"$ESCAPED_AGENT_ID\",\"agent_name\":\"$ESCAPED_AGENT_NAME\",\"session_id\":\"${CLAUDE_SESSION_ID:-}\"}}"

# Append to journal file
echo "$JSON_ENTRY" >> "$JOURNAL_FILE"

exit 0
