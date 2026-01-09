import { mkdir, readFile, writeFile, chmod, access, unlink, readdir, rmdir } from 'fs/promises';
import { join } from 'path';
import { constants } from 'fs';
import { TIMEOUTS } from './constants.js';

// Path constants
export const CLAUDE_DIR = '.claude';
export const SETTINGS_FILE = 'settings.json';
export const HOOKS_DIR = 'hooks';
export const CAPTURE_SCRIPT = 'contextor-capture.sh';
export const RESPONSE_SCRIPT = 'contextor-response.sh';

/**
 * Individual hook action
 */
export interface HookAction {
  type: 'command';
  command: string;
  timeout?: number;
}

/**
 * Hook entry with optional matcher (Claude Code format)
 * matcher is a regex pattern string (e.g., ".*" for all)
 * NOTE: Stop hooks do NOT support matcher field - it's optional
 */
export interface HookEntry {
  matcher?: string;
  hooks: HookAction[];
}

/**
 * Claude Code settings.json structure (new format)
 */
export interface ClaudeSettings {
  hooks?: {
    UserPromptSubmit?: HookEntry[];
    Stop?: HookEntry[];
    [key: string]: HookEntry[] | undefined;
  };
  [key: string]: unknown;
}

/**
 * Read Claude settings from .claude/settings.json
 * Returns empty object if file doesn't exist or is invalid
 */
export async function readClaudeSettings(cwd: string): Promise<ClaudeSettings> {
  const settingsPath = join(cwd, CLAUDE_DIR, SETTINGS_FILE);
  try {
    await access(settingsPath, constants.F_OK);
    const content = await readFile(settingsPath, 'utf-8');
    return JSON.parse(content) as ClaudeSettings;
  } catch {
    return {}; // Return empty if missing or invalid
  }
}

/**
 * Write Claude settings to .claude/settings.json
 */
export async function writeClaudeSettings(
  settings: ClaudeSettings,
  cwd: string
): Promise<void> {
  const claudeDir = join(cwd, CLAUDE_DIR);
  await mkdir(claudeDir, { recursive: true });
  await writeFile(
    join(claudeDir, SETTINGS_FILE),
    JSON.stringify(settings, null, 2) + '\n',
    'utf-8'
  );
}

/**
 * Configure Contextor hook in settings
 * Preserves existing hooks and updates/adds the Contextor hook
 * Uses the new Claude Code format with matchers
 */
export function configureContextorHook(settings: ClaudeSettings): ClaudeSettings {
  // Use $CLAUDE_PROJECT_DIR for reliable path resolution
  const hookCommand = `bash "$CLAUDE_PROJECT_DIR"/${CLAUDE_DIR}/${HOOKS_DIR}/${CAPTURE_SCRIPT}`;
  const newHookEntry: HookEntry = {
    matcher: '.*',
    hooks: [{ type: 'command', command: hookCommand, timeout: TIMEOUTS.HOOK_EXECUTION_MS }],
  };

  // Initialize hooks structure if needed
  settings.hooks ??= {};
  const existing = settings.hooks.UserPromptSubmit ?? [];

  // Check if Contextor hook already exists (look inside the hooks array)
  const idx = existing.findIndex(entry =>
    entry.hooks?.some(h => h.command.includes('contextor-capture'))
  );

  if (idx >= 0) {
    // Update existing hook entry
    existing[idx] = newHookEntry;
  } else {
    // Add new hook entry
    existing.push(newHookEntry);
  }

  settings.hooks.UserPromptSubmit = existing;
  return settings;
}

/**
 * Remove Contextor hook from settings
 */
export function removeContextorHook(settings: ClaudeSettings): ClaudeSettings {
  if (!settings.hooks?.UserPromptSubmit) {
    return settings;
  }

  settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit.filter(
    (entry) => !entry.hooks?.some(h => h.command.includes('contextor-capture'))
  );

  // Clean up empty arrays/objects
  if (settings.hooks.UserPromptSubmit.length === 0) {
    delete settings.hooks.UserPromptSubmit;
  }
  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  return settings;
}

/**
 * Generate the capture script content
 * Phase 3: Simplified - response capture handled by Stop hook
 */
export function getCaptureScriptContent(): string {
  return `#!/bin/bash
# Contextor Capture - Silent background prompt capture
# Phase 3: Simplified - response capture handled by Stop hook
# Errors are logged to debug file if DEBUG_CONTEXTOR=1

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "\${SCRIPT_DIR}/../.." && pwd)"

USER_CONFIG="\${PROJECT_ROOT}/.contextor/.user"
SHARED_CONFIG="\${PROJECT_ROOT}/.contextor/config.json"
DEBUG_LOG="\${PROJECT_ROOT}/.contextor/.debug.log"

# Debug logging function - only logs if DEBUG_CONTEXTOR=1
debug_log() {
  if [[ "\${DEBUG_CONTEXTOR}" == "1" ]]; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $1" >> "\${DEBUG_LOG}" 2>/dev/null
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
if [[ ! -f "\${USER_CONFIG}" ]]; then
  debug_log "ERROR: User config not found at \${USER_CONFIG}"
  exit 0
fi
if [[ ! -f "\${SHARED_CONFIG}" ]]; then
  debug_log "ERROR: Shared config not found at \${SHARED_CONFIG}"
  exit 0
fi

# Read config
API_KEY=$(jq -r '.api_key // empty' "\${USER_CONFIG}" 2>/dev/null)
API_ENDPOINT=$(jq -r '.api_endpoint // empty' "\${SHARED_CONFIG}" 2>/dev/null)
PROJECT_ID=$(jq -r '.project_id // empty' "\${SHARED_CONFIG}" 2>/dev/null)
USER_ID=$(jq -r '.user_id // empty' "\${USER_CONFIG}" 2>/dev/null)

if [[ -z "\${API_KEY}" ]]; then
  debug_log "ERROR: api_key is empty or missing from user config"
  exit 0
fi
if [[ -z "\${API_ENDPOINT}" ]]; then
  debug_log "ERROR: api_endpoint is empty or missing from shared config"
  exit 0
fi

# Read hook input from stdin
INPUT=$(cat)
PROMPT=$(echo "\${INPUT}" | jq -r '.prompt // empty' 2>/dev/null)
SESSION_ID=$(echo "\${INPUT}" | jq -r '.session_id // empty' 2>/dev/null)
CWD=$(echo "\${INPUT}" | jq -r '.cwd // empty' 2>/dev/null)

if [[ -z "\${PROMPT}" ]]; then
  debug_log "ERROR: No prompt found in input JSON"
  exit 0
fi

# Session ID derivation fallback: if not provided, derive from cwd + date
# This ensures prompts are never orphaned without a session
if [[ -z "\${SESSION_ID}" ]]; then
  DATE_PART=$(date +%Y%m%d)
  # Use md5 on macOS, md5sum on Linux
  if command -v md5 >/dev/null 2>&1; then
    DERIVED_HASH=$(echo -n "\${CWD}\${DATE_PART}" | md5 | cut -c1-16)
  else
    DERIVED_HASH=$(echo -n "\${CWD}\${DATE_PART}" | md5sum | cut -c1-16)
  fi
  SESSION_ID="derived-\${DERIVED_HASH}"
  debug_log "INFO: Derived session_id: \${SESSION_ID} (from cwd + date)"
fi

debug_log "INFO: Capturing prompt (\${#PROMPT} chars) session: \${SESSION_ID}"

# Send to API in background (non-blocking, 10s timeout)
# NOTE: Response data is captured by Stop hook, not here
{
  RESPONSE=$(curl -s --max-time 10 -w "\\n%{http_code}" -X POST "\${API_ENDPOINT}/prompts/capture" \\
    -H "Content-Type: application/json" \\
    -H "Authorization: Bearer \${API_KEY}" \\
    -d "$(jq -n \\
      --arg user_id "\${USER_ID}" \\
      --arg prompt "\${PROMPT}" \\
      --arg project_id "\${PROJECT_ID}" \\
      --arg session_id "\${SESSION_ID}" \\
      --arg cwd "\${CWD}" \\
      '{
        user_id: $user_id,
        prompt: $prompt,
        timestamp: (now | todate),
        metadata: {
          source: "claude-code-hook",
          project_id: $project_id,
          session_id: $session_id,
          cwd: $cwd
        }
      }')" 2>&1)

  HTTP_CODE=$(echo "\${RESPONSE}" | tail -n1)
  BODY=$(echo "\${RESPONSE}" | sed '\$d')

  if [[ "\${HTTP_CODE}" -ge 200 && "\${HTTP_CODE}" -lt 300 ]]; then
    debug_log "INFO: Capture successful (HTTP \${HTTP_CODE})"
  else
    debug_log "ERROR: Capture failed (HTTP \${HTTP_CODE}): \${BODY}"
  fi
} &

exit 0
`;
}

/**
 * Create the capture script at .claude/hooks/contextor-capture.sh
 */
export async function createCaptureScript(cwd: string): Promise<void> {
  const hooksDir = join(cwd, CLAUDE_DIR, HOOKS_DIR);
  const scriptPath = join(hooksDir, CAPTURE_SCRIPT);

  await mkdir(hooksDir, { recursive: true });
  await writeFile(scriptPath, getCaptureScriptContent(), 'utf-8');
  await chmod(scriptPath, 0o755);
}

/**
 * Set up Claude Code hooks for Contextor
 * Configures both UserPromptSubmit (for prompt capture) and Stop (for response capture) hooks
 */
export async function setupClaudeHooks(cwd: string): Promise<void> {
  // Read existing settings
  let settings = await readClaudeSettings(cwd);

  // Add/update both Contextor hooks
  settings = configureContextorHook(settings);
  settings = configureStopHook(settings);

  // Write updated settings
  await writeClaudeSettings(settings, cwd);

  // Create both capture scripts
  await createCaptureScript(cwd);
  await createResponseScript(cwd);
}

/**
 * Generate the response capture script content for Stop hook
 * Phase 3: Captures LLM responses via Stop hook
 * Aggregates text, thinking, and tools from ALL assistant messages in the current turn
 */
export function getResponseScriptContent(): string {
  return `#!/bin/bash
# Contextor Response Capture - Captures LLM responses via Stop hook
# Aggregates text, thinking, and tools from all messages in the current turn
# Errors are logged to debug file if DEBUG_CONTEXTOR=1

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "\${SCRIPT_DIR}/../.." && pwd)"

USER_CONFIG="\${PROJECT_ROOT}/.contextor/.user"
SHARED_CONFIG="\${PROJECT_ROOT}/.contextor/config.json"
DEBUG_LOG="\${PROJECT_ROOT}/.contextor/.debug.log"

# Debug logging function
debug_log() {
  if [[ "\${DEBUG_CONTEXTOR}" == "1" ]]; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $1" >> "\${DEBUG_LOG}" 2>/dev/null
  fi
}

# Exit silently if deps missing
command -v jq >/dev/null 2>&1 || { debug_log "ERROR: jq not found"; exit 0; }
command -v curl >/dev/null 2>&1 || { debug_log "ERROR: curl not found"; exit 0; }

# Exit silently if not configured
[[ -f "\${USER_CONFIG}" && -f "\${SHARED_CONFIG}" ]] || { debug_log "ERROR: config missing"; exit 0; }

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

debug_log "INFO: Processing transcript: \${TRANSCRIPT_PATH}"

# Read config
API_KEY=$(jq -r '.api_key // empty' "\${USER_CONFIG}")
API_ENDPOINT=$(jq -r '.api_endpoint // empty' "\${SHARED_CONFIG}")

[[ -n "\${API_KEY}" && -n "\${API_ENDPOINT}" ]] || { debug_log "ERROR: config incomplete"; exit 0; }

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
  TEXT=$(echo "$line" | jq -r '[.message.content[]? | select(.type == "text") | .text] | join("\\n")' 2>/dev/null)
  if [[ -n "$TEXT" ]]; then
    RESPONSE_TEXT="\${RESPONSE_TEXT}\${TEXT}\\n"
  fi
done <<< "$CURRENT_TURN_MESSAGES"

# Aggregate thinking text from ALL messages with thinking in this turn
THINKING_TEXT=""
while IFS= read -r line; do
  THINK=$(echo "$line" | jq -r '[.message.content[]? | select(.type == "thinking") | .thinking] | join("\\n")' 2>/dev/null)
  if [[ -n "$THINK" ]]; then
    THINKING_TEXT="\${THINKING_TEXT}\${THINK}\\n"
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
  debug_log "INFO: Retry complete - tools: \${TOOLS_USED}"
fi

# Skip if we have nothing to capture (no text and no tools)
if [[ -z "$RESPONSE_TEXT" ]] && [[ "$TOOLS_USED" == "[]" ]]; then
  debug_log "INFO: No text or tools to capture in current turn"
  exit 0
fi

# Calculate thinking summary (first 500 chars)
THINKING_SUMMARY="\${THINKING_TEXT:0:500}"
THINKING_WORD_COUNT=$(echo "$THINKING_TEXT" | wc -w | tr -d ' ')

debug_log "INFO: Extracted response - model: \${MODEL}, stop_reason: \${STOP_REASON}, tools: \${TOOLS_USED}"

# Send to API in background (non-blocking, 10s timeout)
{
  RESPONSE=$(curl -s --max-time 10 -w "\\n%{http_code}" -X POST "\${API_ENDPOINT}/responses/capture" \\
    -H "Content-Type: application/json" \\
    -H "Authorization: Bearer \${API_KEY}" \\
    -d "$(jq -n \\
      --arg session_id "$SESSION_ID" \\
      --arg message_uuid "$MESSAGE_UUID" \\
      --arg response_text "$RESPONSE_TEXT" \\
      --arg thinking_summary "$THINKING_SUMMARY" \\
      --argjson thinking_word_count "\${THINKING_WORD_COUNT:-0}" \\
      --arg thinking_text "$THINKING_TEXT" \\
      --argjson tools_used "$TOOLS_USED" \\
      --arg model "$MODEL" \\
      --argjson usage "$USAGE" \\
      --arg stop_reason "$STOP_REASON" \\
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

  HTTP_CODE=$(echo "\${RESPONSE}" | tail -n1)
  BODY=$(echo "\${RESPONSE}" | sed '\$d')

  if [[ "\${HTTP_CODE}" -ge 200 && "\${HTTP_CODE}" -lt 300 ]]; then
    debug_log "INFO: Response captured successfully (HTTP \${HTTP_CODE})"
  else
    debug_log "ERROR: Response capture failed (HTTP \${HTTP_CODE}): \${BODY}"
  fi
} &

exit 0
`;
}

/**
 * Create the response script at .claude/hooks/contextor-response.sh
 */
export async function createResponseScript(cwd: string): Promise<void> {
  const hooksDir = join(cwd, CLAUDE_DIR, HOOKS_DIR);
  const scriptPath = join(hooksDir, RESPONSE_SCRIPT);

  await mkdir(hooksDir, { recursive: true });
  await writeFile(scriptPath, getResponseScriptContent(), 'utf-8');
  await chmod(scriptPath, 0o755);
}

/**
 * Configure Contextor Stop hook in settings
 * Preserves existing hooks and updates/adds the Contextor hook
 *
 * NOTE: Stop hooks do NOT support the matcher field (unlike PreToolUse, PostToolUse).
 * The Stop hook fires globally when Claude Code finishes responding.
 */
export function configureStopHook(settings: ClaudeSettings): ClaudeSettings {
  // Use $CLAUDE_PROJECT_DIR for reliable path resolution
  const hookCommand = `bash "$CLAUDE_PROJECT_DIR"/${CLAUDE_DIR}/${HOOKS_DIR}/${RESPONSE_SCRIPT}`;
  // IMPORTANT: Stop hooks must NOT have a matcher field - they are global events
  const newHookEntry: HookEntry = {
    hooks: [{ type: 'command', command: hookCommand, timeout: TIMEOUTS.HOOK_EXECUTION_MS }],
  };

  // Initialize hooks structure if needed
  settings.hooks ??= {};
  const existing = settings.hooks.Stop ?? [];

  // Check if Contextor hook already exists (look inside the hooks array)
  const idx = existing.findIndex(entry =>
    entry.hooks?.some(h => h.command.includes('contextor-response'))
  );

  if (idx >= 0) {
    // Update existing hook entry
    existing[idx] = newHookEntry;
  } else {
    // Add new hook entry
    existing.push(newHookEntry);
  }

  settings.hooks.Stop = existing;
  return settings;
}

/**
 * Remove Contextor Stop hook from settings
 */
export function removeStopHook(settings: ClaudeSettings): ClaudeSettings {
  if (!settings.hooks?.Stop) {
    return settings;
  }

  settings.hooks.Stop = settings.hooks.Stop.filter(
    (entry) => !entry.hooks?.some(h => h.command.includes('contextor-response'))
  );

  // Clean up empty arrays/objects
  if (settings.hooks.Stop.length === 0) {
    delete settings.hooks.Stop;
  }
  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  return settings;
}

/**
 * Clean up Claude Code hooks for Contextor
 * Removes both UserPromptSubmit and Stop hooks, and deletes both capture scripts
 */
export async function cleanupClaudeHooks(cwd: string): Promise<void> {
  // Read existing settings
  let settings = await readClaudeSettings(cwd);

  // Remove both Contextor hooks
  settings = removeContextorHook(settings);
  settings = removeStopHook(settings);

  // Write updated settings (only if there was a settings file)
  const settingsPath = join(cwd, CLAUDE_DIR, SETTINGS_FILE);
  try {
    await access(settingsPath, constants.F_OK);
    await writeClaudeSettings(settings, cwd);
  } catch {
    // Settings file doesn't exist, nothing to write
  }

  // Delete capture scripts (silently ignore if they don't exist)
  const hooksDir = join(cwd, CLAUDE_DIR, HOOKS_DIR);
  const captureScriptPath = join(hooksDir, CAPTURE_SCRIPT);
  const responseScriptPath = join(hooksDir, RESPONSE_SCRIPT);

  try {
    await unlink(captureScriptPath);
  } catch {
    // Script doesn't exist, ignore
  }

  try {
    await unlink(responseScriptPath);
  } catch {
    // Script doesn't exist, ignore
  }

  // Try to remove hooks directory if it's empty
  try {
    const files = await readdir(hooksDir);
    if (files.length === 0) {
      await rmdir(hooksDir);
    }
  } catch {
    // Directory doesn't exist or not empty, ignore
  }
}
