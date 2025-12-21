import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { unlink } from 'fs/promises';
import {
  readClaudeSettings,
  writeClaudeSettings,
  removeContextorHook,
  CLAUDE_DIR,
  SETTINGS_FILE,
  HOOKS_DIR,
  CAPTURE_SCRIPT,
  type ClaudeSettings,
  type HookEntry,
} from '../hooks.js';
import { CONTEXTOR_DIR, USER_FILE, CONFIG_FILE } from '../detection.js';

// Helper to create a hook entry in the new format
function createHookEntry(command: string): HookEntry {
  return { matcher: '.*', hooks: [{ type: 'command', command }] };
}

describe('uninstall command operations', () => {
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

  describe('user file deletion', () => {
    it('deletes .user file', async () => {
      const contextorDir = join(testDir, CONTEXTOR_DIR);
      mkdirSync(contextorDir, { recursive: true });
      const userPath = join(contextorDir, USER_FILE);
      writeFileSync(userPath, JSON.stringify({ user_id: 'test' }));

      expect(existsSync(userPath)).toBe(true);
      await unlink(userPath);
      expect(existsSync(userPath)).toBe(false);
    });

    it('preserves config.json after deleting .user', async () => {
      const contextorDir = join(testDir, CONTEXTOR_DIR);
      mkdirSync(contextorDir, { recursive: true });

      const userPath = join(contextorDir, USER_FILE);
      const configPath = join(contextorDir, CONFIG_FILE);

      writeFileSync(userPath, JSON.stringify({ user_id: 'test' }));
      writeFileSync(configPath, JSON.stringify({ project_id: 'test' }));

      await unlink(userPath);

      expect(existsSync(userPath)).toBe(false);
      expect(existsSync(configPath)).toBe(true);
    });
  });

  describe('hook removal from settings', () => {
    it('removes Contextor hook from settings', async () => {
      const settings: ClaudeSettings = {
        hooks: {
          UserPromptSubmit: [
            createHookEntry('./scripts/my-hook.sh'),
            createHookEntry('./.claude/hooks/contextor-capture.sh'),
          ],
        },
      };

      await writeClaudeSettings(settings, testDir);

      // Read, remove hook, write back
      const currentSettings = await readClaudeSettings(testDir);
      const updatedSettings = removeContextorHook(currentSettings);
      await writeClaudeSettings(updatedSettings, testDir);

      // Verify
      const finalSettings = await readClaudeSettings(testDir);
      expect(finalSettings.hooks?.UserPromptSubmit).toHaveLength(1);
      expect(finalSettings.hooks?.UserPromptSubmit?.[0].hooks[0].command).toBe('./scripts/my-hook.sh');
    });

    it('preserves other hooks', async () => {
      const settings: ClaudeSettings = {
        hooks: {
          UserPromptSubmit: [
            createHookEntry('./scripts/hook1.sh'),
            createHookEntry('./.claude/hooks/contextor-capture.sh'),
            createHookEntry('./scripts/hook2.sh'),
          ],
        },
      };

      await writeClaudeSettings(settings, testDir);

      const currentSettings = await readClaudeSettings(testDir);
      const updatedSettings = removeContextorHook(currentSettings);
      await writeClaudeSettings(updatedSettings, testDir);

      const finalSettings = await readClaudeSettings(testDir);
      expect(finalSettings.hooks?.UserPromptSubmit).toHaveLength(2);
      expect(finalSettings.hooks?.UserPromptSubmit?.[0].hooks[0].command).toBe('./scripts/hook1.sh');
      expect(finalSettings.hooks?.UserPromptSubmit?.[1].hooks[0].command).toBe('./scripts/hook2.sh');
    });

    it('cleans up empty hooks object', async () => {
      const settings: ClaudeSettings = {
        hooks: {
          UserPromptSubmit: [
            createHookEntry('./.claude/hooks/contextor-capture.sh'),
          ],
        },
      };

      await writeClaudeSettings(settings, testDir);

      const currentSettings = await readClaudeSettings(testDir);
      const updatedSettings = removeContextorHook(currentSettings);
      await writeClaudeSettings(updatedSettings, testDir);

      const finalSettings = await readClaudeSettings(testDir);
      expect(finalSettings.hooks).toBeUndefined();
    });

    it('handles missing settings file gracefully', async () => {
      const settings = await readClaudeSettings(testDir);
      expect(settings).toEqual({});

      // Can still remove from empty settings
      const updated = removeContextorHook(settings);
      expect(updated).toEqual({});
    });

    it('preserves capture script file', async () => {
      // Create capture script
      const hooksDir = join(testDir, CLAUDE_DIR, HOOKS_DIR);
      mkdirSync(hooksDir, { recursive: true });
      const scriptPath = join(hooksDir, CAPTURE_SCRIPT);
      writeFileSync(scriptPath, '#!/bin/bash\necho "capture"');

      // Create settings with hook
      const settings: ClaudeSettings = {
        hooks: {
          UserPromptSubmit: [
            createHookEntry('./.claude/hooks/contextor-capture.sh'),
          ],
        },
      };
      await writeClaudeSettings(settings, testDir);

      // Remove hook from settings
      const currentSettings = await readClaudeSettings(testDir);
      const updatedSettings = removeContextorHook(currentSettings);
      await writeClaudeSettings(updatedSettings, testDir);

      // Capture script should still exist
      expect(existsSync(scriptPath)).toBe(true);
    });
  });

  describe('full uninstall flow simulation', () => {
    it('removes user file and hook, preserves shared files', async () => {
      // Setup: Create full installation
      const contextorDir = join(testDir, CONTEXTOR_DIR);
      const claudeDir = join(testDir, CLAUDE_DIR);
      const hooksDir = join(claudeDir, HOOKS_DIR);

      mkdirSync(contextorDir, { recursive: true });
      mkdirSync(hooksDir, { recursive: true });

      // User config
      const userPath = join(contextorDir, USER_FILE);
      writeFileSync(userPath, JSON.stringify({ user_id: 'test', user_name: 'Test' }));

      // Shared config
      const configPath = join(contextorDir, CONFIG_FILE);
      writeFileSync(configPath, JSON.stringify({ project_id: 'proj', project_name: 'Test Project' }));

      // Capture script
      const scriptPath = join(hooksDir, CAPTURE_SCRIPT);
      writeFileSync(scriptPath, '#!/bin/bash\necho "capture"');

      // Settings with hook
      const settings: ClaudeSettings = {
        hooks: {
          UserPromptSubmit: [
            createHookEntry('./.claude/hooks/contextor-capture.sh'),
          ],
        },
      };
      await writeClaudeSettings(settings, testDir);

      // Perform uninstall operations
      await unlink(userPath);
      const currentSettings = await readClaudeSettings(testDir);
      const updatedSettings = removeContextorHook(currentSettings);
      await writeClaudeSettings(updatedSettings, testDir);

      // Verify results
      expect(existsSync(userPath)).toBe(false);
      expect(existsSync(configPath)).toBe(true);
      expect(existsSync(scriptPath)).toBe(true);

      const finalSettings = await readClaudeSettings(testDir);
      expect(finalSettings.hooks).toBeUndefined();
    });
  });
});
