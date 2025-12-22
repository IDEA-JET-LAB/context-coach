import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  readClaudeSettings,
  writeClaudeSettings,
  configureContextorHook,
  removeContextorHook,
  getCaptureScriptContent,
  createCaptureScript,
  setupClaudeHooks,
  CLAUDE_DIR,
  SETTINGS_FILE,
  HOOKS_DIR,
  CAPTURE_SCRIPT,
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

  describe('setupClaudeHooks', () => {
    it('creates settings.json and capture script', async () => {
      await setupClaudeHooks(testDir);

      expect(existsSync(join(testDir, CLAUDE_DIR, SETTINGS_FILE))).toBe(true);
      expect(existsSync(join(testDir, CLAUDE_DIR, HOOKS_DIR, CAPTURE_SCRIPT))).toBe(true);
    });

    it('adds hook to existing settings', async () => {
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
    });
  });
});
