import { mkdir, readFile, writeFile, chmod, access } from 'fs/promises';
import { join } from 'path';
import { constants } from 'fs';
import { TIMEOUTS } from './constants.js';

// Path constants
export const CLAUDE_DIR = '.claude';
export const SETTINGS_FILE = 'settings.json';
export const HOOKS_DIR = 'hooks';
export const CAPTURE_SCRIPT = 'contextor-capture.sh';

/**
 * Individual hook action
 */
export interface HookAction {
  type: 'command';
  command: string;
  timeout?: number;
}

/**
 * Hook entry with matcher (new Claude Code format)
 * matcher is a regex pattern string (e.g., ".*" for all)
 */
export interface HookEntry {
  matcher: string;
  hooks: HookAction[];
}

/**
 * Claude Code settings.json structure (new format)
 */
export interface ClaudeSettings {
  hooks?: {
    UserPromptSubmit?: HookEntry[];
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
 */
export function getCaptureScriptContent(): string {
  return `#!/bin/bash
# Contextor Capture - Silent background prompt capture
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

# Read prompt from stdin
INPUT=$(cat)
PROMPT=$(echo "\${INPUT}" | jq -r '.prompt // empty' 2>/dev/null)
if [[ -z "\${PROMPT}" ]]; then
  debug_log "ERROR: No prompt found in input JSON"
  exit 0
fi

debug_log "INFO: Capturing prompt (\${#PROMPT} chars) to \${API_ENDPOINT}/prompts/capture"

# Send to API in background (non-blocking, 10s timeout)
{
  RESPONSE=$(curl -s --max-time 10 -w "\\n%{http_code}" -X POST "\${API_ENDPOINT}/prompts/capture" \\
    -H "Content-Type: application/json" \\
    -H "Authorization: Bearer \${API_KEY}" \\
    -d "$(jq -n \\
      --arg user_id "\${USER_ID}" \\
      --arg prompt "\${PROMPT}" \\
      --arg project_id "\${PROJECT_ID}" \\
      '{user_id:$user_id,prompt:$prompt,timestamp:(now|todate),metadata:{source:"claude-code-hook",project_id:$project_id}}')" 2>&1)

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
 */
export async function setupClaudeHooks(cwd: string): Promise<void> {
  // Read existing settings
  let settings = await readClaudeSettings(cwd);

  // Add/update Contextor hook
  settings = configureContextorHook(settings);

  // Write updated settings
  await writeClaudeSettings(settings, cwd);

  // Create capture script
  await createCaptureScript(cwd);
}
