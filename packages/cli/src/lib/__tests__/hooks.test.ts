import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  readClaudeSettings,
  writeClaudeSettings,
  configureContextorHook,
  removeContextorHook,
  configureStopHook,
  removeStopHook,
  getCaptureScriptContent,
  getResponseScriptContent,
  createCaptureScript,
  createResponseScript,
  setupClaudeHooks,
  cleanupClaudeHooks,
  CLAUDE_DIR,
  SETTINGS_FILE,
  HOOKS_DIR,
  CAPTURE_SCRIPT,
  RESPONSE_SCRIPT,
  type ClaudeSettings,
  type HookEntry,
} from '../hooks.js';

// Helper to create a hook entry in the new format
function createHookEntry(command: string, timeout?: number): HookEntry {
  const hook: { type: 'command'; command: string; timeout?: number } = { type: 'command', command };
  if (timeout) hook.timeout = timeout;
  return { matcher: '.*', hooks: [hook] };
}

describe('hooks', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `contextor-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('readClaudeSettings', () => {
    it('returns empty object when file does not exist', async () => {
      const result = await readClaudeSettings(testDir);
      expect(result).toEqual({});
    });

    it('returns empty object when JSON is invalid', async () => {
      const claudeDir = join(testDir, CLAUDE_DIR);
      mkdirSync(claudeDir, { recursive: true });
      writeFileSync(join(claudeDir, SETTINGS_FILE), 'not-json');

      const result = await readClaudeSettings(testDir);
      expect(result).toEqual({});
    });

    it('returns parsed settings', async () => {
      const claudeDir = join(testDir, CLAUDE_DIR);
      mkdirSync(claudeDir, { recursive: true });
      const settings = { hooks: { UserPromptSubmit: [createHookEntry('test')] } };
      writeFileSync(join(claudeDir, SETTINGS_FILE), JSON.stringify(settings));

      const result = await readClaudeSettings(testDir);
      expect(result).toEqual(settings);
    });
  });

  describe('writeClaudeSettings', () => {
    it('creates .claude directory if not exists', async () => {
      await writeClaudeSettings({}, testDir);
      expect(existsSync(join(testDir, CLAUDE_DIR))).toBe(true);
    });

    it('writes valid JSON with 2-space indent', async () => {
      const settings: ClaudeSettings = { hooks: { UserPromptSubmit: [createHookEntry('test')] } };
      await writeClaudeSettings(settings, testDir);

      const content = readFileSync(join(testDir, CLAUDE_DIR, SETTINGS_FILE), 'utf-8');
      expect(content).toContain('  "hooks"');
      expect(JSON.parse(content)).toEqual(settings);
    });

    it('file ends with newline', async () => {
      await writeClaudeSettings({}, testDir);
      const content = readFileSync(join(testDir, CLAUDE_DIR, SETTINGS_FILE), 'utf-8');
      expect(content.endsWith('\n')).toBe(true);
    });
  });

  describe('configureContextorHook', () => {
    it('adds hook to empty settings', () => {
      const settings: ClaudeSettings = {};
      const result = configureContextorHook(settings);

      expect(result.hooks?.UserPromptSubmit).toHaveLength(1);
      expect(result.hooks?.UserPromptSubmit?.[0].hooks[0].command).toContain('contextor-capture');
    });

    it('preserves existing hooks', () => {
      const settings: ClaudeSettings = {
        hooks: {
          UserPromptSubmit: [createHookEntry('./scripts/my-hook.sh')],
        },
      };
      const result = configureContextorHook(settings);

      expect(result.hooks?.UserPromptSubmit).toHaveLength(2);
      expect(result.hooks?.UserPromptSubmit?.[0].hooks[0].command).toBe('./scripts/my-hook.sh');
      expect(result.hooks?.UserPromptSubmit?.[1].hooks[0].command).toContain('contextor-capture');
    });

    it('updates existing Contextor hook', () => {
      const settings: ClaudeSettings = {
        hooks: {
          UserPromptSubmit: [
            createHookEntry('./scripts/my-hook.sh'),
            createHookEntry('./old/contextor-capture.sh'),
          ],
        },
      };
      const result = configureContextorHook(settings);

      expect(result.hooks?.UserPromptSubmit).toHaveLength(2);
      expect(result.hooks?.UserPromptSubmit?.[1].hooks[0].command).toBe(`bash "$CLAUDE_PROJECT_DIR"/${CLAUDE_DIR}/${HOOKS_DIR}/${CAPTURE_SCRIPT}`);
    });

    it('preserves other hook types', () => {
      const settings: ClaudeSettings = {
        hooks: {
          SomeOtherHook: [createHookEntry('test')],
        },
      };
      const result = configureContextorHook(settings);

      expect(result.hooks?.SomeOtherHook).toHaveLength(1);
      expect(result.hooks?.UserPromptSubmit).toHaveLength(1);
    });
  });

  describe('removeContextorHook', () => {
    it('removes Contextor hook', () => {
      const settings: ClaudeSettings = {
        hooks: {
          UserPromptSubmit: [
            createHookEntry('./scripts/my-hook.sh'),
            createHookEntry('./.claude/hooks/contextor-capture.sh'),
          ],
        },
      };
      const result = removeContextorHook(settings);

      expect(result.hooks?.UserPromptSubmit).toHaveLength(1);
      expect(result.hooks?.UserPromptSubmit?.[0].hooks[0].command).toBe('./scripts/my-hook.sh');
    });

    it('cleans up empty UserPromptSubmit array', () => {
      const settings: ClaudeSettings = {
        hooks: {
          UserPromptSubmit: [createHookEntry('./.claude/hooks/contextor-capture.sh')],
        },
      };
      const result = removeContextorHook(settings);

      expect(result.hooks?.UserPromptSubmit).toBeUndefined();
    });

    it('cleans up empty hooks object', () => {
      const settings: ClaudeSettings = {
        hooks: {
          UserPromptSubmit: [createHookEntry('./.claude/hooks/contextor-capture.sh')],
        },
      };
      const result = removeContextorHook(settings);

      expect(result.hooks).toBeUndefined();
    });

    it('handles missing hooks gracefully', () => {
      const settings: ClaudeSettings = {};
      const result = removeContextorHook(settings);
      expect(result).toEqual({});
    });
  });

  describe('getCaptureScriptContent', () => {
    it('returns a bash script', () => {
      const content = getCaptureScriptContent();
      expect(content.startsWith('#!/bin/bash')).toBe(true);
    });

    it('contains curl command for API call', () => {
      const content = getCaptureScriptContent();
      expect(content).toContain('curl');
      expect(content).toContain('/prompts/capture');
    });

    it('reads from config files', () => {
      const content = getCaptureScriptContent();
      expect(content).toContain('.contextor/.user');
      expect(content).toContain('.contextor/config.json');
    });

    it('contains Phase 3 header comment', () => {
      const content = getCaptureScriptContent();
      expect(content).toContain('Phase 3: Simplified - response capture handled by Stop hook');
    });

    // Session ID extraction tests
    describe('session_id handling', () => {
      it('extracts session_id from input JSON', () => {
        const content = getCaptureScriptContent();
        expect(content).toContain("SESSION_ID=$(echo \"${INPUT}\" | jq -r '.session_id // empty' 2>/dev/null)");
      });

      it('extracts cwd from input JSON', () => {
        const content = getCaptureScriptContent();
        expect(content).toContain("CWD=$(echo \"${INPUT}\" | jq -r '.cwd // empty' 2>/dev/null)");
      });

      it('contains session_id derivation fallback logic', () => {
        const content = getCaptureScriptContent();
        // Check for the fallback condition
        expect(content).toContain('if [[ -z "${SESSION_ID}" ]]');
        // Check for date-based derivation
        expect(content).toContain('DATE_PART=$(date +%Y%m%d)');
        // Check for derived- prefix
        expect(content).toContain('SESSION_ID="derived-${DERIVED_HASH}"');
      });

      it('supports both macOS (md5) and Linux (md5sum) for hash derivation', () => {
        const content = getCaptureScriptContent();
        // Check for macOS md5 command
        expect(content).toContain('if command -v md5 >/dev/null 2>&1');
        expect(content).toContain('| md5 | cut -c1-16');
        // Check for Linux md5sum fallback
        expect(content).toContain('| md5sum | cut -c1-16');
      });

      it('derives session_id from cwd and date', () => {
        const content = getCaptureScriptContent();
        expect(content).toContain('echo -n "${CWD}${DATE_PART}"');
      });

      it('logs session_id derivation in debug mode', () => {
        const content = getCaptureScriptContent();
        expect(content).toContain('debug_log "INFO: Derived session_id: ${SESSION_ID} (from cwd + date)"');
      });
    });

    // Payload structure tests
    describe('API payload structure', () => {
      it('includes session_id in metadata', () => {
        const content = getCaptureScriptContent();
        expect(content).toContain('--arg session_id "${SESSION_ID}"');
        expect(content).toContain('session_id: $session_id');
      });

      it('includes cwd in metadata', () => {
        const content = getCaptureScriptContent();
        expect(content).toContain('--arg cwd "${CWD}"');
        expect(content).toContain('cwd: $cwd');
      });

      it('includes source as claude-code-hook', () => {
        const content = getCaptureScriptContent();
        expect(content).toContain('source: "claude-code-hook"');
      });

      it('includes project_id in metadata', () => {
        const content = getCaptureScriptContent();
        expect(content).toContain('--arg project_id "${PROJECT_ID}"');
        expect(content).toContain('project_id: $project_id');
      });

      it('does not include response_text in payload', () => {
        const content = getCaptureScriptContent();
        expect(content).not.toContain('response_text');
      });

      it('does not include thinking in payload', () => {
        const content = getCaptureScriptContent();
        expect(content).not.toContain('thinking');
      });

      it('does not include tools_used in payload', () => {
        const content = getCaptureScriptContent();
        expect(content).not.toContain('tools_used');
      });
    });

    // Debug logging tests
    describe('debug logging', () => {
      it('logs prompt capture with session_id', () => {
        const content = getCaptureScriptContent();
        expect(content).toContain('debug_log "INFO: Capturing prompt (${#PROMPT} chars) session: ${SESSION_ID}"');
      });

      it('includes comment about Stop hook handling responses', () => {
        const content = getCaptureScriptContent();
        expect(content).toContain('NOTE: Response data is captured by Stop hook, not here');
      });
    });

    // Backward compatibility tests
    describe('backward compatibility', () => {
      it('still reads prompt from input JSON', () => {
        const content = getCaptureScriptContent();
        expect(content).toContain("PROMPT=$(echo \"${INPUT}\" | jq -r '.prompt // empty' 2>/dev/null)");
      });

      it('includes user_id, prompt, and timestamp in payload', () => {
        const content = getCaptureScriptContent();
        expect(content).toContain('--arg user_id "${USER_ID}"');
        expect(content).toContain('--arg prompt "${PROMPT}"');
        expect(content).toContain('timestamp: (now | todate)');
      });

      it('uses Bearer token authentication', () => {
        const content = getCaptureScriptContent();
        expect(content).toContain('-H "Authorization: Bearer ${API_KEY}"');
      });
    });
  });

  describe('createCaptureScript', () => {
    it('creates hooks directory', async () => {
      await createCaptureScript(testDir);
      expect(existsSync(join(testDir, CLAUDE_DIR, HOOKS_DIR))).toBe(true);
    });

    it('creates capture script', async () => {
      await createCaptureScript(testDir);
      const scriptPath = join(testDir, CLAUDE_DIR, HOOKS_DIR, CAPTURE_SCRIPT);
      expect(existsSync(scriptPath)).toBe(true);
    });

    it('makes script executable', async () => {
      await createCaptureScript(testDir);
      const scriptPath = join(testDir, CLAUDE_DIR, HOOKS_DIR, CAPTURE_SCRIPT);
      const stats = statSync(scriptPath);
      // Check executable bit (0o755 = 493 in decimal)
      expect(stats.mode & 0o755).toBe(0o755);
    });
  });

  describe('configureStopHook', () => {
    it('adds Stop hook to empty settings', () => {
      const settings: ClaudeSettings = {};
      const result = configureStopHook(settings);

      expect(result.hooks?.Stop).toHaveLength(1);
      expect(result.hooks?.Stop?.[0].hooks[0].command).toContain('contextor-response');
    });

    it('preserves existing Stop hooks', () => {
      const settings: ClaudeSettings = {
        hooks: {
          Stop: [createHookEntry('./scripts/my-stop-hook.sh')],
        },
      };
      const result = configureStopHook(settings);

      expect(result.hooks?.Stop).toHaveLength(2);
      expect(result.hooks?.Stop?.[0].hooks[0].command).toBe('./scripts/my-stop-hook.sh');
      expect(result.hooks?.Stop?.[1].hooks[0].command).toContain('contextor-response');
    });

    it('updates existing Contextor Stop hook (idempotent)', () => {
      const settings: ClaudeSettings = {
        hooks: {
          Stop: [
            createHookEntry('./scripts/my-hook.sh'),
            createHookEntry('./old/contextor-response.sh'),
          ],
        },
      };
      const result = configureStopHook(settings);

      expect(result.hooks?.Stop).toHaveLength(2);
      expect(result.hooks?.Stop?.[1].hooks[0].command).toBe(`bash "$CLAUDE_PROJECT_DIR"/${CLAUDE_DIR}/${HOOKS_DIR}/${RESPONSE_SCRIPT}`);
    });

    it('preserves UserPromptSubmit hooks when adding Stop hook', () => {
      const settings: ClaudeSettings = {
        hooks: {
          UserPromptSubmit: [createHookEntry('test')],
        },
      };
      const result = configureStopHook(settings);

      expect(result.hooks?.UserPromptSubmit).toHaveLength(1);
      expect(result.hooks?.Stop).toHaveLength(1);
    });

    it('uses correct matcher pattern', () => {
      const settings: ClaudeSettings = {};
      const result = configureStopHook(settings);

      expect(result.hooks?.Stop?.[0].matcher).toBe('.*');
    });

    it('sets timeout on hook action', () => {
      const settings: ClaudeSettings = {};
      const result = configureStopHook(settings);

      expect(result.hooks?.Stop?.[0].hooks[0].timeout).toBeDefined();
      expect(typeof result.hooks?.Stop?.[0].hooks[0].timeout).toBe('number');
    });
  });

  describe('removeStopHook', () => {
    it('removes Contextor Stop hook', () => {
      const settings: ClaudeSettings = {
        hooks: {
          Stop: [
            createHookEntry('./scripts/my-hook.sh'),
            createHookEntry('./.claude/hooks/contextor-response.sh'),
          ],
        },
      };
      const result = removeStopHook(settings);

      expect(result.hooks?.Stop).toHaveLength(1);
      expect(result.hooks?.Stop?.[0].hooks[0].command).toBe('./scripts/my-hook.sh');
    });

    it('cleans up empty Stop array', () => {
      const settings: ClaudeSettings = {
        hooks: {
          Stop: [createHookEntry('./.claude/hooks/contextor-response.sh')],
        },
      };
      const result = removeStopHook(settings);

      expect(result.hooks?.Stop).toBeUndefined();
    });

    it('cleans up empty hooks object', () => {
      const settings: ClaudeSettings = {
        hooks: {
          Stop: [createHookEntry('./.claude/hooks/contextor-response.sh')],
        },
      };
      const result = removeStopHook(settings);

      expect(result.hooks).toBeUndefined();
    });

    it('preserves UserPromptSubmit when removing Stop hook', () => {
      const settings: ClaudeSettings = {
        hooks: {
          UserPromptSubmit: [createHookEntry('test')],
          Stop: [createHookEntry('./.claude/hooks/contextor-response.sh')],
        },
      };
      const result = removeStopHook(settings);

      expect(result.hooks?.UserPromptSubmit).toHaveLength(1);
      expect(result.hooks?.Stop).toBeUndefined();
    });

    it('handles missing hooks gracefully', () => {
      const settings: ClaudeSettings = {};
      const result = removeStopHook(settings);
      expect(result).toEqual({});
    });

    it('handles missing Stop array gracefully', () => {
      const settings: ClaudeSettings = {
        hooks: {
          UserPromptSubmit: [createHookEntry('test')],
        },
      };
      const result = removeStopHook(settings);
      expect(result.hooks?.UserPromptSubmit).toHaveLength(1);
    });
  });

  describe('getResponseScriptContent', () => {
    it('returns a bash script', () => {
      const content = getResponseScriptContent();
      expect(content.startsWith('#!/bin/bash')).toBe(true);
    });

    it('contains curl command for API call', () => {
      const content = getResponseScriptContent();
      expect(content).toContain('curl');
      expect(content).toContain('/responses/capture');
    });

    it('reads from config files', () => {
      const content = getResponseScriptContent();
      expect(content).toContain('.contextor/.user');
      expect(content).toContain('.contextor/config.json');
    });

    it('extracts transcript_path from hook input', () => {
      const content = getResponseScriptContent();
      expect(content).toContain('transcript_path');
    });

    it('extracts response data from transcript', () => {
      const content = getResponseScriptContent();
      expect(content).toContain('RESPONSE_TEXT');
      expect(content).toContain('THINKING_TEXT');
      expect(content).toContain('TOOLS_USED');
      expect(content).toContain('MODEL');
    });

    it('uses Bearer token authentication', () => {
      const content = getResponseScriptContent();
      expect(content).toContain('-H "Authorization: Bearer ${API_KEY}"');
    });

    it('includes debug logging', () => {
      const content = getResponseScriptContent();
      expect(content).toContain('debug_log');
      expect(content).toContain('DEBUG_CONTEXTOR');
    });
  });

  describe('createResponseScript', () => {
    it('creates hooks directory', async () => {
      await createResponseScript(testDir);
      expect(existsSync(join(testDir, CLAUDE_DIR, HOOKS_DIR))).toBe(true);
    });

    it('creates response script', async () => {
      await createResponseScript(testDir);
      const scriptPath = join(testDir, CLAUDE_DIR, HOOKS_DIR, RESPONSE_SCRIPT);
      expect(existsSync(scriptPath)).toBe(true);
    });

    it('makes script executable', async () => {
      await createResponseScript(testDir);
      const scriptPath = join(testDir, CLAUDE_DIR, HOOKS_DIR, RESPONSE_SCRIPT);
      const stats = statSync(scriptPath);
      // Check executable bit (0o755 = 493 in decimal)
      expect(stats.mode & 0o755).toBe(0o755);
    });

    it('writes correct content', async () => {
      await createResponseScript(testDir);
      const scriptPath = join(testDir, CLAUDE_DIR, HOOKS_DIR, RESPONSE_SCRIPT);
      const content = readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('#!/bin/bash');
      expect(content).toContain('/responses/capture');
    });
  });

  describe('setupClaudeHooks', () => {
    it('creates settings.json and both scripts', async () => {
      await setupClaudeHooks(testDir);

      expect(existsSync(join(testDir, CLAUDE_DIR, SETTINGS_FILE))).toBe(true);
      expect(existsSync(join(testDir, CLAUDE_DIR, HOOKS_DIR, CAPTURE_SCRIPT))).toBe(true);
      expect(existsSync(join(testDir, CLAUDE_DIR, HOOKS_DIR, RESPONSE_SCRIPT))).toBe(true);
    });

    it('configures both UserPromptSubmit and Stop hooks', async () => {
      await setupClaudeHooks(testDir);

      const content = readFileSync(join(testDir, CLAUDE_DIR, SETTINGS_FILE), 'utf-8');
      const settings = JSON.parse(content) as ClaudeSettings;

      expect(settings.hooks?.UserPromptSubmit).toHaveLength(1);
      expect(settings.hooks?.UserPromptSubmit?.[0].hooks[0].command).toContain('contextor-capture');
      expect(settings.hooks?.Stop).toHaveLength(1);
      expect(settings.hooks?.Stop?.[0].hooks[0].command).toContain('contextor-response');
    });

    it('adds hooks to existing settings without duplicating', async () => {
      const claudeDir = join(testDir, CLAUDE_DIR);
      mkdirSync(claudeDir, { recursive: true });
      writeFileSync(
        join(claudeDir, SETTINGS_FILE),
        JSON.stringify({ hooks: { UserPromptSubmit: [createHookEntry('existing')] } })
      );

      await setupClaudeHooks(testDir);

      const content = readFileSync(join(claudeDir, SETTINGS_FILE), 'utf-8');
      const settings = JSON.parse(content) as ClaudeSettings;
      expect(settings.hooks?.UserPromptSubmit).toHaveLength(2);
      expect(settings.hooks?.Stop).toHaveLength(1);
    });

    it('is idempotent - running twice does not duplicate hooks', async () => {
      await setupClaudeHooks(testDir);
      await setupClaudeHooks(testDir);

      const content = readFileSync(join(testDir, CLAUDE_DIR, SETTINGS_FILE), 'utf-8');
      const settings = JSON.parse(content) as ClaudeSettings;

      expect(settings.hooks?.UserPromptSubmit).toHaveLength(1);
      expect(settings.hooks?.Stop).toHaveLength(1);
    });

    it('preserves existing third-party hooks', async () => {
      const claudeDir = join(testDir, CLAUDE_DIR);
      mkdirSync(claudeDir, { recursive: true });
      writeFileSync(
        join(claudeDir, SETTINGS_FILE),
        JSON.stringify({
          hooks: {
            UserPromptSubmit: [createHookEntry('./scripts/my-hook.sh')],
            Stop: [createHookEntry('./scripts/my-stop-hook.sh')],
            SomeOtherHook: [createHookEntry('other')],
          },
        })
      );

      await setupClaudeHooks(testDir);

      const content = readFileSync(join(claudeDir, SETTINGS_FILE), 'utf-8');
      const settings = JSON.parse(content) as ClaudeSettings;

      expect(settings.hooks?.UserPromptSubmit).toHaveLength(2);
      expect(settings.hooks?.Stop).toHaveLength(2);
      expect(settings.hooks?.SomeOtherHook).toHaveLength(1);
    });

    it('preserves non-hook settings', async () => {
      const claudeDir = join(testDir, CLAUDE_DIR);
      mkdirSync(claudeDir, { recursive: true });
      writeFileSync(
        join(claudeDir, SETTINGS_FILE),
        JSON.stringify({ apiKey: 'test-key', theme: 'dark' })
      );

      await setupClaudeHooks(testDir);

      const content = readFileSync(join(claudeDir, SETTINGS_FILE), 'utf-8');
      const settings = JSON.parse(content);

      expect(settings.apiKey).toBe('test-key');
      expect(settings.theme).toBe('dark');
    });
  });

  describe('cleanupClaudeHooks', () => {
    it('removes both Contextor hooks from settings', async () => {
      // Setup first
      await setupClaudeHooks(testDir);

      // Cleanup
      await cleanupClaudeHooks(testDir);

      const content = readFileSync(join(testDir, CLAUDE_DIR, SETTINGS_FILE), 'utf-8');
      const settings = JSON.parse(content) as ClaudeSettings;

      expect(settings.hooks).toBeUndefined();
    });

    it('deletes both capture scripts', async () => {
      // Setup first
      await setupClaudeHooks(testDir);

      // Verify scripts exist
      expect(existsSync(join(testDir, CLAUDE_DIR, HOOKS_DIR, CAPTURE_SCRIPT))).toBe(true);
      expect(existsSync(join(testDir, CLAUDE_DIR, HOOKS_DIR, RESPONSE_SCRIPT))).toBe(true);

      // Cleanup
      await cleanupClaudeHooks(testDir);

      expect(existsSync(join(testDir, CLAUDE_DIR, HOOKS_DIR, CAPTURE_SCRIPT))).toBe(false);
      expect(existsSync(join(testDir, CLAUDE_DIR, HOOKS_DIR, RESPONSE_SCRIPT))).toBe(false);
    });

    it('preserves third-party hooks', async () => {
      const claudeDir = join(testDir, CLAUDE_DIR);
      mkdirSync(claudeDir, { recursive: true });
      writeFileSync(
        join(claudeDir, SETTINGS_FILE),
        JSON.stringify({
          hooks: {
            UserPromptSubmit: [
              createHookEntry('./scripts/my-hook.sh'),
              createHookEntry('./.claude/hooks/contextor-capture.sh'),
            ],
            Stop: [
              createHookEntry('./scripts/my-stop-hook.sh'),
              createHookEntry('./.claude/hooks/contextor-response.sh'),
            ],
          },
        })
      );

      await cleanupClaudeHooks(testDir);

      const content = readFileSync(join(claudeDir, SETTINGS_FILE), 'utf-8');
      const settings = JSON.parse(content) as ClaudeSettings;

      expect(settings.hooks?.UserPromptSubmit).toHaveLength(1);
      expect(settings.hooks?.UserPromptSubmit?.[0].hooks[0].command).toBe('./scripts/my-hook.sh');
      expect(settings.hooks?.Stop).toHaveLength(1);
      expect(settings.hooks?.Stop?.[0].hooks[0].command).toBe('./scripts/my-stop-hook.sh');
    });

    it('preserves non-hook settings', async () => {
      const claudeDir = join(testDir, CLAUDE_DIR);
      mkdirSync(claudeDir, { recursive: true });
      writeFileSync(
        join(claudeDir, SETTINGS_FILE),
        JSON.stringify({
          apiKey: 'test-key',
          theme: 'dark',
          hooks: {
            UserPromptSubmit: [createHookEntry('./.claude/hooks/contextor-capture.sh')],
            Stop: [createHookEntry('./.claude/hooks/contextor-response.sh')],
          },
        })
      );

      await cleanupClaudeHooks(testDir);

      const content = readFileSync(join(claudeDir, SETTINGS_FILE), 'utf-8');
      const settings = JSON.parse(content);

      expect(settings.apiKey).toBe('test-key');
      expect(settings.theme).toBe('dark');
    });

    it('handles missing settings file gracefully', async () => {
      // Should not throw when settings file doesn't exist
      await expect(cleanupClaudeHooks(testDir)).resolves.not.toThrow();
    });

    it('handles missing scripts gracefully', async () => {
      const claudeDir = join(testDir, CLAUDE_DIR);
      mkdirSync(claudeDir, { recursive: true });
      writeFileSync(
        join(claudeDir, SETTINGS_FILE),
        JSON.stringify({
          hooks: {
            UserPromptSubmit: [createHookEntry('./.claude/hooks/contextor-capture.sh')],
          },
        })
      );

      // Should not throw when script files don't exist
      await expect(cleanupClaudeHooks(testDir)).resolves.not.toThrow();
    });

    it('removes hooks directory if empty after cleanup', async () => {
      // Setup first
      await setupClaudeHooks(testDir);

      // Cleanup
      await cleanupClaudeHooks(testDir);

      // Hooks directory should be removed if empty
      expect(existsSync(join(testDir, CLAUDE_DIR, HOOKS_DIR))).toBe(false);
    });

    it('preserves hooks directory if it contains other files', async () => {
      // Setup first
      await setupClaudeHooks(testDir);

      // Add another file to hooks directory
      const hooksDir = join(testDir, CLAUDE_DIR, HOOKS_DIR);
      writeFileSync(join(hooksDir, 'other-hook.sh'), '#!/bin/bash\necho test');

      // Cleanup
      await cleanupClaudeHooks(testDir);

      // Hooks directory should be preserved
      expect(existsSync(hooksDir)).toBe(true);
      expect(existsSync(join(hooksDir, 'other-hook.sh'))).toBe(true);
    });
  });
});
