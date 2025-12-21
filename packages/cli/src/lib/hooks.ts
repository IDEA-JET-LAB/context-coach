import { mkdir, readFile, writeFile, chmod, access } from 'fs/promises';
import { join } from 'path';
import { constants } from 'fs';

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
  const hookCommand = `./${CLAUDE_DIR}/${HOOKS_DIR}/${CAPTURE_SCRIPT}`;
  const newHookEntry: HookEntry = {
    matcher: '.*',
    hooks: [{ type: 'command', command: hookCommand }],
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
# Errors are suppressed to avoid disrupting Claude Code

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "\${SCRIPT_DIR}/../.." && pwd)"

USER_CONFIG="\${PROJECT_ROOT}/.contextor/.user"
SHARED_CONFIG="\${PROJECT_ROOT}/.contextor/config.json"

# Exit silently if not configured or deps missing
command -v jq >/dev/null 2>&1 || exit 0
command -v curl >/dev/null 2>&1 || exit 0
[[ -f "\${USER_CONFIG}" && -f "\${SHARED_CONFIG}" ]] || exit 0

# Read config
API_KEY=$(jq -r '.api_key // empty' "\${USER_CONFIG}" 2>/dev/null)
API_ENDPOINT=$(jq -r '.api_endpoint // empty' "\${SHARED_CONFIG}" 2>/dev/null)
PROJECT_ID=$(jq -r '.project_id // empty' "\${SHARED_CONFIG}" 2>/dev/null)
USER_ID=$(jq -r '.user_id // empty' "\${USER_CONFIG}" 2>/dev/null)

[[ -n "\${API_KEY}" && -n "\${API_ENDPOINT}" ]] || exit 0

# Read prompt from stdin
INPUT=$(cat)
PROMPT=$(echo "\${INPUT}" | jq -r '.prompt // empty' 2>/dev/null)
[[ -n "\${PROMPT}" ]] || exit 0

# Send to API in background (non-blocking, 10s timeout)
{
  curl -s --max-time 10 -X POST "\${API_ENDPOINT}/prompts/capture" \\
    -H "Content-Type: application/json" \\
    -H "Authorization: Bearer \${API_KEY}" \\
    -d "$(jq -n \\
      --arg user_id "\${USER_ID}" \\
      --arg prompt "\${PROMPT}" \\
      --arg project_id "\${PROJECT_ID}" \\
      '{user_id:$user_id,prompt:$prompt,timestamp:(now|todate),metadata:{source:"claude-code-hook",project_id:$project_id}}')" \\
    >/dev/null 2>&1
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
