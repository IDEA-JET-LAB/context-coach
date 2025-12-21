import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  detectInstallState,
  InstallState,
  readConfigFile,
  userConfigExists,
  CONTEXTOR_DIR,
  CONFIG_FILE,
  USER_FILE,
  type ProjectConfig,
} from '../detection.js';

describe('detection', () => {
  let testDir: string;

  beforeEach(() => {
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `contextor-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  const validConfig: ProjectConfig = {
    project_id: '550e8400-e29b-41d4-a716-446655440000',
    project_name: 'Test Project',
    team_id: '550e8400-e29b-41d4-a716-446655440001',
    team_name: 'Test Team',
    api_endpoint: 'https://api.contextor.co',
    created_at: '2025-01-01T00:00:00.000Z',
    created_by: 'Test User',
  };

  describe('detectInstallState', () => {
    it('returns FRESH when no .contextor directory exists', async () => {
      const result = await detectInstallState(testDir, validConfig.project_id);
      expect(result.state).toBe(InstallState.FRESH);
      expect(result.existingConfig).toBeUndefined();
      expect(result.warning).toBeUndefined();
    });

    it('returns FRESH with warning when .contextor exists but config.json is missing', async () => {
      mkdirSync(join(testDir, CONTEXTOR_DIR), { recursive: true });

      const result = await detectInstallState(testDir, validConfig.project_id);
      expect(result.state).toBe(InstallState.FRESH);
      expect(result.warning).toContain('invalid config');
    });

    it('returns FRESH with warning when config.json is malformed', async () => {
      const contextorDir = join(testDir, CONTEXTOR_DIR);
      mkdirSync(contextorDir, { recursive: true });
      writeFileSync(join(contextorDir, CONFIG_FILE), 'not-json');

      const result = await detectInstallState(testDir, validConfig.project_id);
      expect(result.state).toBe(InstallState.FRESH);
      expect(result.warning).toContain('invalid config');
    });

    it('returns FRESH with warning when config.json is missing required fields', async () => {
      const contextorDir = join(testDir, CONTEXTOR_DIR);
      mkdirSync(contextorDir, { recursive: true });
      writeFileSync(join(contextorDir, CONFIG_FILE), JSON.stringify({ project_name: 'Test' }));

      const result = await detectInstallState(testDir, validConfig.project_id);
      expect(result.state).toBe(InstallState.FRESH);
      expect(result.warning).toContain('invalid config');
    });

    it('returns JOINING when config.json exists but .user is missing', async () => {
      const contextorDir = join(testDir, CONTEXTOR_DIR);
      mkdirSync(contextorDir, { recursive: true });
      writeFileSync(join(contextorDir, CONFIG_FILE), JSON.stringify(validConfig));

      const result = await detectInstallState(testDir, validConfig.project_id);
      expect(result.state).toBe(InstallState.JOINING);
      expect(result.existingConfig).toEqual(validConfig);
    });

    it('returns CONFIGURED when both config.json and .user exist with matching project', async () => {
      const contextorDir = join(testDir, CONTEXTOR_DIR);
      mkdirSync(contextorDir, { recursive: true });
      writeFileSync(join(contextorDir, CONFIG_FILE), JSON.stringify(validConfig));
      writeFileSync(join(contextorDir, USER_FILE), JSON.stringify({ user_id: 'test' }));

      const result = await detectInstallState(testDir, validConfig.project_id);
      expect(result.state).toBe(InstallState.CONFIGURED);
      expect(result.existingConfig).toEqual(validConfig);
    });

    it('returns MISMATCH when project_id does not match', async () => {
      const contextorDir = join(testDir, CONTEXTOR_DIR);
      mkdirSync(contextorDir, { recursive: true });
      writeFileSync(join(contextorDir, CONFIG_FILE), JSON.stringify(validConfig));

      const differentProjectId = '00000000-0000-0000-0000-000000000000';
      const result = await detectInstallState(testDir, differentProjectId);
      expect(result.state).toBe(InstallState.MISMATCH);
      expect(result.existingConfig).toEqual(validConfig);
    });

    it('returns MISMATCH even when .user exists but project differs', async () => {
      const contextorDir = join(testDir, CONTEXTOR_DIR);
      mkdirSync(contextorDir, { recursive: true });
      writeFileSync(join(contextorDir, CONFIG_FILE), JSON.stringify(validConfig));
      writeFileSync(join(contextorDir, USER_FILE), JSON.stringify({ user_id: 'test' }));

      const differentProjectId = '00000000-0000-0000-0000-000000000000';
      const result = await detectInstallState(testDir, differentProjectId);
      expect(result.state).toBe(InstallState.MISMATCH);
    });
  });

  describe('readConfigFile', () => {
    it('returns null for non-existent file', () => {
      const result = readConfigFile(join(testDir, 'nonexistent.json'));
      expect(result).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      const filePath = join(testDir, 'invalid.json');
      writeFileSync(filePath, 'not-json');
      const result = readConfigFile(filePath);
      expect(result).toBeNull();
    });

    it('returns null for missing project_id', () => {
      const filePath = join(testDir, 'config.json');
      writeFileSync(filePath, JSON.stringify({ team_id: 'test' }));
      const result = readConfigFile(filePath);
      expect(result).toBeNull();
    });

    it('returns null for missing team_id', () => {
      const filePath = join(testDir, 'config.json');
      writeFileSync(filePath, JSON.stringify({ project_id: 'test' }));
      const result = readConfigFile(filePath);
      expect(result).toBeNull();
    });

    it('returns parsed config for valid file', () => {
      const filePath = join(testDir, 'config.json');
      writeFileSync(filePath, JSON.stringify(validConfig));
      const result = readConfigFile(filePath);
      expect(result).toEqual(validConfig);
    });
  });

  describe('userConfigExists', () => {
    it('returns false when .user does not exist', () => {
      expect(userConfigExists(testDir)).toBe(false);
    });

    it('returns false when .contextor does not exist', () => {
      expect(userConfigExists(testDir)).toBe(false);
    });

    it('returns true when .user exists', () => {
      const contextorDir = join(testDir, CONTEXTOR_DIR);
      mkdirSync(contextorDir, { recursive: true });
      writeFileSync(join(contextorDir, USER_FILE), '{}');
      expect(userConfigExists(testDir)).toBe(true);
    });
  });
});
