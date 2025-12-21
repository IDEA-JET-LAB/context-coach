import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  createSharedConfig,
  createUserConfig,
  writeSharedConfig,
  writeUserConfig,
  readUserConfig,
  getFileErrorMessage,
  CONTEXTOR_DIR,
  CONFIG_FILE,
  USER_FILE,
} from '../config.js';
import type { InstallToken } from '../token.js';

describe('config', () => {
  let testDir: string;

  const mockToken: InstallToken = {
    project_id: '550e8400-e29b-41d4-a716-446655440000',
    project_name: 'Test Project',
    team_id: '550e8400-e29b-41d4-a716-446655440001',
    team_name: 'Test Team',
    user_id: '550e8400-e29b-41d4-a716-446655440002',
    user_name: 'Test User',
    api_key: 'sk_test_xxxxx',
    api_endpoint: 'https://api.contextor.co',
  };

  beforeEach(() => {
    testDir = join(tmpdir(), `contextor-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('createSharedConfig', () => {
    it('creates config with correct fields from token', () => {
      const config = createSharedConfig(mockToken);

      expect(config.project_id).toBe(mockToken.project_id);
      expect(config.project_name).toBe(mockToken.project_name);
      expect(config.team_id).toBe(mockToken.team_id);
      expect(config.team_name).toBe(mockToken.team_name);
      expect(config.api_endpoint).toBe(mockToken.api_endpoint);
      expect(config.created_by).toBe(mockToken.user_name);
      expect(config.created_at).toBeDefined();
    });

    it('generates valid ISO timestamp', () => {
      const config = createSharedConfig(mockToken);
      const date = new Date(config.created_at);
      expect(date.toISOString()).toBe(config.created_at);
    });
  });

  describe('createUserConfig', () => {
    it('creates config with correct fields from token', () => {
      const config = createUserConfig(mockToken);

      expect(config.user_id).toBe(mockToken.user_id);
      expect(config.user_name).toBe(mockToken.user_name);
      expect(config.api_key).toBe(mockToken.api_key);
      expect(config.configured_at).toBeDefined();
    });
  });

  describe('writeSharedConfig', () => {
    it('creates .contextor directory if not exists', async () => {
      const config = createSharedConfig(mockToken);
      await writeSharedConfig(config, testDir);

      expect(existsSync(join(testDir, CONTEXTOR_DIR))).toBe(true);
    });

    it('writes valid JSON with 2-space indent', async () => {
      const config = createSharedConfig(mockToken);
      await writeSharedConfig(config, testDir);

      const content = readFileSync(join(testDir, CONTEXTOR_DIR, CONFIG_FILE), 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.project_id).toBe(config.project_id);
      // Check formatting (2-space indent)
      expect(content).toContain('  "project_id"');
    });

    it('file ends with newline', async () => {
      const config = createSharedConfig(mockToken);
      await writeSharedConfig(config, testDir);

      const content = readFileSync(join(testDir, CONTEXTOR_DIR, CONFIG_FILE), 'utf-8');
      expect(content.endsWith('\n')).toBe(true);
    });
  });

  describe('writeUserConfig', () => {
    it('creates .contextor directory if not exists', async () => {
      const config = createUserConfig(mockToken);
      await writeUserConfig(config, testDir);

      expect(existsSync(join(testDir, CONTEXTOR_DIR))).toBe(true);
    });

    it('writes valid JSON', async () => {
      const config = createUserConfig(mockToken);
      await writeUserConfig(config, testDir);

      const content = readFileSync(join(testDir, CONTEXTOR_DIR, USER_FILE), 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.user_id).toBe(config.user_id);
      expect(parsed.api_key).toBe(config.api_key);
    });
  });

  describe('readUserConfig', () => {
    it('returns null for non-existent file', async () => {
      const result = await readUserConfig(join(testDir, 'nonexistent'));
      expect(result).toBeNull();
    });

    it('returns null for invalid JSON', async () => {
      const filePath = join(testDir, 'invalid');
      writeFileSync(filePath, 'not-json');
      const result = await readUserConfig(filePath);
      expect(result).toBeNull();
    });

    it('returns null for missing required fields', async () => {
      const filePath = join(testDir, 'config');
      writeFileSync(filePath, JSON.stringify({ user_name: 'Test' }));
      const result = await readUserConfig(filePath);
      expect(result).toBeNull();
    });

    it('returns parsed config for valid file', async () => {
      const config = createUserConfig(mockToken);
      const filePath = join(testDir, CONTEXTOR_DIR, USER_FILE);
      mkdirSync(join(testDir, CONTEXTOR_DIR), { recursive: true });
      writeFileSync(filePath, JSON.stringify(config));

      const result = await readUserConfig(filePath);
      expect(result).toEqual(config);
    });
  });

  describe('getFileErrorMessage', () => {
    it('returns permission denied message for EACCES', () => {
      const error = Object.assign(new Error('test'), { code: 'EACCES' });
      expect(getFileErrorMessage(error)).toContain('Permission denied');
    });

    it('returns disk full message for ENOSPC', () => {
      const error = Object.assign(new Error('test'), { code: 'ENOSPC' });
      expect(getFileErrorMessage(error)).toContain('Disk full');
    });

    it('returns read-only message for EROFS', () => {
      const error = Object.assign(new Error('test'), { code: 'EROFS' });
      expect(getFileErrorMessage(error)).toContain('Read-only');
    });

    it('returns generic message for unknown error', () => {
      const error = new Error('test');
      expect(getFileErrorMessage(error)).toContain('Failed to create');
    });
  });
});
