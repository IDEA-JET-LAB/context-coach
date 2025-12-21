import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { CONTEXTOR_DIR, CONFIG_FILE, USER_FILE, readConfigFile, userConfigExists } from '../detection.js';
import type { SharedConfig, UserConfig } from '../config.js';

describe('status command helpers', () => {
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

  describe('installation detection', () => {
    it('returns null for non-existent config', () => {
      const configPath = join(testDir, CONTEXTOR_DIR, CONFIG_FILE);
      const result = readConfigFile(configPath);
      expect(result).toBeNull();
    });

    it('returns null for corrupted JSON config', () => {
      const contextorDir = join(testDir, CONTEXTOR_DIR);
      mkdirSync(contextorDir, { recursive: true });
      const configPath = join(contextorDir, CONFIG_FILE);
      writeFileSync(configPath, 'not-valid-json{');

      const result = readConfigFile(configPath);
      expect(result).toBeNull();
    });

    it('reads valid shared config', () => {
      const contextorDir = join(testDir, CONTEXTOR_DIR);
      mkdirSync(contextorDir, { recursive: true });
      const configPath = join(contextorDir, CONFIG_FILE);
      const config: SharedConfig = {
        project_id: 'test-project-id',
        project_name: 'Test Project',
        team_id: 'test-team-id',
        team_name: 'Test Team',
        api_endpoint: 'https://api.contextor.co',
        created_at: '2025-01-01T00:00:00.000Z',
        created_by: 'Test User',
      };
      writeFileSync(configPath, JSON.stringify(config));

      const result = readConfigFile(configPath);
      expect(result).toEqual(config);
    });

    it('detects missing user config', () => {
      const result = userConfigExists(testDir);
      expect(result).toBe(false);
    });

    it('detects existing user config', () => {
      const contextorDir = join(testDir, CONTEXTOR_DIR);
      mkdirSync(contextorDir, { recursive: true });
      const userConfig: UserConfig = {
        user_id: 'test-user-id',
        user_name: 'Test User',
        api_key: 'sk_test_xxxxx',
        configured_at: '2025-01-01T00:00:00.000Z',
      };
      writeFileSync(join(contextorDir, USER_FILE), JSON.stringify(userConfig));

      const result = userConfigExists(testDir);
      expect(result).toBe(true);
    });
  });

  describe('config file parsing', () => {
    it('handles empty config file', () => {
      const contextorDir = join(testDir, CONTEXTOR_DIR);
      mkdirSync(contextorDir, { recursive: true });
      const configPath = join(contextorDir, CONFIG_FILE);
      writeFileSync(configPath, '');

      const result = readConfigFile(configPath);
      expect(result).toBeNull();
    });

    it('handles config with missing required fields', () => {
      const contextorDir = join(testDir, CONTEXTOR_DIR);
      mkdirSync(contextorDir, { recursive: true });
      const configPath = join(contextorDir, CONFIG_FILE);
      // Missing project_name and other required fields
      writeFileSync(configPath, JSON.stringify({ project_id: 'only-id' }));

      const result = readConfigFile(configPath);
      // readConfigFile validates with Zod schema and returns null for invalid
      expect(result).toBeNull();
    });
  });
});
