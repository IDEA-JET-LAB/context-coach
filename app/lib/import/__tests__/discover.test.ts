import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  discoverProjects,
  getProjectTranscripts,
  getClaudeProjectsDir,
  getDefaultDateRange,
  isWithinDateRange,
  denormalizePath,
  normalizePath,
  isPathSafe,
  validatePathFormat,
  estimatePromptCount,
  claudeProjectsExist,
} from '../discover';

describe('Transcript Discovery Service - Story 17-1', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'import-discover-test-'));
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('getClaudeProjectsDir', () => {
    it('should return default path when no baseDir provided', () => {
      const result = getClaudeProjectsDir();
      expect(result).toBe(path.join(os.homedir(), '.claude/projects'));
    });

    it('should return custom baseDir when provided', () => {
      const customDir = '/custom/path';
      const result = getClaudeProjectsDir(customDir);
      expect(result).toBe(customDir);
    });

    it('should handle empty string as baseDir', () => {
      const result = getClaudeProjectsDir('');
      expect(result).toBe(path.join(os.homedir(), '.claude/projects'));
    });
  });

  describe('getDefaultDateRange', () => {
    it('should return a 30-day window ending today', () => {
      const { startDate, endDate } = getDefaultDateRange();

      const now = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Check end date is today
      expect(endDate.toDateString()).toBe(now.toDateString());

      // Check start date is approximately 30 days ago
      expect(startDate.toDateString()).toBe(thirtyDaysAgo.toDateString());
    });

    it('should set start date to beginning of day', () => {
      const { startDate } = getDefaultDateRange();
      expect(startDate.getHours()).toBe(0);
      expect(startDate.getMinutes()).toBe(0);
      expect(startDate.getSeconds()).toBe(0);
    });

    it('should set end date to end of day', () => {
      const { endDate } = getDefaultDateRange();
      expect(endDate.getHours()).toBe(23);
      expect(endDate.getMinutes()).toBe(59);
      expect(endDate.getSeconds()).toBe(59);
    });
  });

  describe('isWithinDateRange', () => {
    it('should return true for dates within range', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const testDate = new Date('2024-06-15');

      expect(isWithinDateRange(testDate, startDate, endDate)).toBe(true);
    });

    it('should return true for date at start boundary', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      expect(isWithinDateRange(startDate, startDate, endDate)).toBe(true);
    });

    it('should return true for date at end boundary', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      expect(isWithinDateRange(endDate, startDate, endDate)).toBe(true);
    });

    it('should return false for date before range', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const testDate = new Date('2023-12-31');

      expect(isWithinDateRange(testDate, startDate, endDate)).toBe(false);
    });

    it('should return false for date after range', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const testDate = new Date('2025-01-01');

      expect(isWithinDateRange(testDate, startDate, endDate)).toBe(false);
    });
  });

  describe('normalizePath', () => {
    it('should convert absolute path to normalized format', () => {
      const result = normalizePath('/Users/edgars/project');
      expect(result).toBe('-Users-edgars-project');
    });

    it('should handle deep nested paths', () => {
      const result = normalizePath('/Users/edgars/My-projects/DEV/context-coach');
      expect(result).toBe('-Users-edgars-My-projects-DEV-context-coach');
    });

    it('should handle root path', () => {
      const result = normalizePath('/');
      expect(result).toBe('-');
    });

    it('should handle Windows-style paths with forward slashes', () => {
      const result = normalizePath('/c/Users/test/project');
      expect(result).toBe('-c-Users-test-project');
    });
  });

  describe('denormalizePath', () => {
    it('should validate path exists for simple cases', async () => {
      // Create a test directory structure
      const testPath = path.join(tempDir, 'Users', 'edgars', 'project');
      await fs.mkdir(testPath, { recursive: true });

      const normalizedPath = normalizePath(testPath);
      const result = await denormalizePath(normalizedPath);
      expect(result).toBe(testPath);
    });

    it('should handle paths with hyphens in original name', async () => {
      // Create a test directory with hyphen in name
      const testPath = path.join(tempDir, 'My-projects', 'DEV');
      await fs.mkdir(testPath, { recursive: true });

      const normalizedPath = normalizePath(testPath);
      const result = await denormalizePath(normalizedPath);
      expect(result).toBe(testPath);
    });

    it('should return simple denormalized path when validation is disabled', async () => {
      const normalizedPath = '-Users-test-project';
      const result = await denormalizePath(normalizedPath, false);
      expect(result).toBe('/Users/test/project');
    });

    it('should handle complex paths with multiple hyphens', async () => {
      const testPath = path.join(tempDir, 'my-project', 'sub-folder', 'deep-dir');
      await fs.mkdir(testPath, { recursive: true });

      const normalizedPath = normalizePath(testPath);
      const result = await denormalizePath(normalizedPath);
      expect(result).toBe(testPath);
    });
  });

  describe('isPathSafe', () => {
    it('should return true for paths within claudeDir', () => {
      const claudeDir = '/home/user/.claude/projects';
      const filePath = '/home/user/.claude/projects/test/file.jsonl';
      expect(isPathSafe(filePath, claudeDir)).toBe(true);
    });

    it('should return false for paths outside claudeDir', () => {
      const claudeDir = '/home/user/.claude/projects';
      const filePath = '/home/user/.ssh/id_rsa';
      expect(isPathSafe(filePath, claudeDir)).toBe(false);
    });

    it('should handle path traversal attempts', () => {
      const claudeDir = '/home/user/.claude/projects';
      const filePath = '/home/user/.claude/projects/../../../etc/passwd';
      expect(isPathSafe(filePath, claudeDir)).toBe(false);
    });

    it('should return true for exact match of claudeDir', () => {
      const claudeDir = '/home/user/.claude/projects';
      expect(isPathSafe(claudeDir, claudeDir)).toBe(true);
    });

    it('should handle relative paths by resolving them', () => {
      const claudeDir = tempDir;
      const filePath = path.join(tempDir, 'subdir', '..', 'file.jsonl');
      expect(isPathSafe(filePath, claudeDir)).toBe(true);
    });
  });

  describe('validatePathFormat', () => {
    it('should accept valid paths', () => {
      expect(() => validatePathFormat('/Users/test/project')).not.toThrow();
      expect(() => validatePathFormat('-Users-test-project')).not.toThrow();
      expect(() => validatePathFormat('simple-path')).not.toThrow();
    });

    it('should reject paths with null bytes', () => {
      expect(() => validatePathFormat('/test\0/path')).toThrow('null bytes');
    });

    it('should reject extremely long paths', () => {
      const longPath = '/test/' + 'a'.repeat(5000);
      expect(() => validatePathFormat(longPath)).toThrow('too long');
    });

    it('should reject paths with invalid characters', () => {
      expect(() => validatePathFormat('/test/<script>/path')).toThrow('invalid characters');
    });
  });

  describe('estimatePromptCount', () => {
    it('should count user type messages', async () => {
      const testFile = path.join(tempDir, 'test.jsonl');
      const content = [
        '{"type":"user","message":"Hello"}',
        '{"type":"assistant","message":"Hi there"}',
        '{"type":"user","message":"How are you?"}',
        '{"type":"assistant","message":"I am fine"}',
        '{"type":"user","message":"Goodbye"}',
      ].join('\n');

      await fs.writeFile(testFile, content);

      const count = await estimatePromptCount(testFile);
      expect(count).toBe(3);
    });

    it('should return 0 for empty file', async () => {
      const testFile = path.join(tempDir, 'empty.jsonl');
      await fs.writeFile(testFile, '');

      const count = await estimatePromptCount(testFile);
      expect(count).toBe(0);
    });

    it('should return 0 for file with no user messages', async () => {
      const testFile = path.join(tempDir, 'no-users.jsonl');
      const content = [
        '{"type":"assistant","message":"Hello"}',
        '{"type":"system","message":"System message"}',
      ].join('\n');

      await fs.writeFile(testFile, content);

      const count = await estimatePromptCount(testFile);
      expect(count).toBe(0);
    });

    it('should return 0 for non-existent file', async () => {
      const testFile = path.join(tempDir, 'nonexistent.jsonl');
      const count = await estimatePromptCount(testFile);
      expect(count).toBe(0);
    });

    it('should handle multiline JSON entries', async () => {
      const testFile = path.join(tempDir, 'multiline.jsonl');
      const content = [
        '{"type":"user","message":"Line 1"}',
        '{"type": "user", "message": "With spaces"}',
        '{"type":"user","text":"Different field"}',
      ].join('\n');

      await fs.writeFile(testFile, content);

      const count = await estimatePromptCount(testFile);
      expect(count).toBe(3);
    });
  });

  describe('claudeProjectsExist', () => {
    it('should return true when directory exists', async () => {
      await fs.mkdir(tempDir, { recursive: true });
      const result = await claudeProjectsExist(tempDir);
      expect(result).toBe(true);
    });

    it('should return false when directory does not exist', async () => {
      const nonExistentDir = path.join(tempDir, 'nonexistent');
      const result = await claudeProjectsExist(nonExistentDir);
      expect(result).toBe(false);
    });
  });

  describe('discoverProjects', () => {
    it('should return empty result when directory does not exist', async () => {
      const nonExistentDir = path.join(tempDir, 'nonexistent');

      const result = await discoverProjects({ baseDir: nonExistentDir });

      expect(result.projects).toEqual([]);
      expect(result.totalProjects).toBe(0);
      expect(result.totalSessions).toBe(0);
      expect(result.totalPrompts).toBe(0);
      expect(result.skippedDirectories).toEqual([]);
      expect(result.discoveredAt).toBeInstanceOf(Date);
    });

    it('should discover projects with JSONL files', async () => {
      const projectDir = path.join(tempDir, '-Users-test-project');
      await fs.mkdir(projectDir, { recursive: true });

      await fs.writeFile(
        path.join(projectDir, 'session1.jsonl'),
        '{"type":"user","message":"Hello"}\n{"type":"assistant","message":"Hi"}'
      );
      await fs.writeFile(
        path.join(projectDir, 'session2.jsonl'),
        '{"type":"user","message":"Test"}'
      );

      // Set file times to today so they're in the 30-day window
      const now = new Date();
      await fs.utimes(path.join(projectDir, 'session1.jsonl'), now, now);
      await fs.utimes(path.join(projectDir, 'session2.jsonl'), now, now);

      const result = await discoverProjects({ baseDir: tempDir });

      expect(result.totalProjects).toBe(1);
      expect(result.totalSessions).toBe(2);
      expect(result.totalPrompts).toBe(2);
      expect(result.projects[0].sessionCount).toBe(2);
      expect(result.projects[0].normalizedPath).toBe('-Users-test-project');
    });

    it('should filter out files outside date range', async () => {
      const projectDir = path.join(tempDir, '-Users-test-project');
      await fs.mkdir(projectDir, { recursive: true });

      // Create files
      await fs.writeFile(
        path.join(projectDir, 'old.jsonl'),
        '{"type":"user","message":"Old"}'
      );
      await fs.writeFile(
        path.join(projectDir, 'new.jsonl'),
        '{"type":"user","message":"New"}'
      );

      // Set one file to 60 days ago (outside default 30-day window)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);
      await fs.utimes(path.join(projectDir, 'old.jsonl'), oldDate, oldDate);

      // Set other file to today
      const now = new Date();
      await fs.utimes(path.join(projectDir, 'new.jsonl'), now, now);

      const result = await discoverProjects({ baseDir: tempDir });

      expect(result.totalSessions).toBe(1);
      expect(result.totalPrompts).toBe(1);
    });

    it('should respect custom date range options', async () => {
      const projectDir = path.join(tempDir, '-Users-test-project');
      await fs.mkdir(projectDir, { recursive: true });

      await fs.writeFile(
        path.join(projectDir, 'session.jsonl'),
        '{"type":"user","message":"Test"}'
      );

      // Set file to 60 days ago
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);
      await fs.utimes(path.join(projectDir, 'session.jsonl'), oldDate, oldDate);

      // Discovery with 90-day window should include it
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);

      const result = await discoverProjects({
        baseDir: tempDir,
        startDate,
        endDate: new Date(),
      });

      expect(result.totalSessions).toBe(1);
      expect(result.appliedDateRange.startDate.getTime()).toBe(startDate.getTime());
    });

    it('should include appliedDateRange in result', async () => {
      const result = await discoverProjects({ baseDir: tempDir });

      expect(result.appliedDateRange).toBeDefined();
      expect(result.appliedDateRange.startDate).toBeInstanceOf(Date);
      expect(result.appliedDateRange.endDate).toBeInstanceOf(Date);
    });

    it('should ignore non-JSONL files', async () => {
      const projectDir = path.join(tempDir, '-Users-test-project');
      await fs.mkdir(projectDir, { recursive: true });

      await fs.writeFile(
        path.join(projectDir, 'session.jsonl'),
        '{"type":"user","message":"Hello"}'
      );
      await fs.writeFile(path.join(projectDir, 'config.json'), '{}');
      await fs.writeFile(path.join(projectDir, 'notes.txt'), 'notes');

      const now = new Date();
      await fs.utimes(path.join(projectDir, 'session.jsonl'), now, now);

      const result = await discoverProjects({ baseDir: tempDir });

      expect(result.totalSessions).toBe(1);
      expect(result.projects[0].sessionCount).toBe(1);
    });

    it('should skip projects with no JSONL files', async () => {
      const emptyProject = path.join(tempDir, '-Users-empty');
      await fs.mkdir(emptyProject, { recursive: true });
      await fs.writeFile(path.join(emptyProject, 'readme.txt'), 'hello');

      const validProject = path.join(tempDir, '-Users-valid');
      await fs.mkdir(validProject, { recursive: true });
      await fs.writeFile(
        path.join(validProject, 'session.jsonl'),
        '{"type":"user","message":"Test"}'
      );

      const now = new Date();
      await fs.utimes(path.join(validProject, 'session.jsonl'), now, now);

      const result = await discoverProjects({ baseDir: tempDir });

      expect(result.totalProjects).toBe(1);
      expect(result.projects[0].normalizedPath).toBe('-Users-valid');
    });

    it('should track oldest and newest session dates', async () => {
      const projectDir = path.join(tempDir, '-Users-test-dates');
      await fs.mkdir(projectDir, { recursive: true });

      const file1 = path.join(projectDir, 'old.jsonl');
      const file2 = path.join(projectDir, 'new.jsonl');

      await fs.writeFile(file1, '{"type":"user","message":"Old"}');
      await fs.writeFile(file2, '{"type":"user","message":"New"}');

      // Set different mtimes within the 30-day window
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      const newDate = new Date();
      newDate.setDate(newDate.getDate() - 1);

      await fs.utimes(file1, oldDate, oldDate);
      await fs.utimes(file2, newDate, newDate);

      // Use very wide date range to include both
      const result = await discoverProjects({
        baseDir: tempDir,
        startDate: new Date(0),
        endDate: new Date(),
      });

      expect(result.dateRange.oldest.getTime()).toBe(oldDate.getTime());
      expect(result.dateRange.newest.getTime()).toBe(newDate.getTime());
    });

    it('should aggregate totals across multiple projects', async () => {
      const project1 = path.join(tempDir, '-Users-project1');
      const project2 = path.join(tempDir, '-Users-project2');

      await fs.mkdir(project1, { recursive: true });
      await fs.mkdir(project2, { recursive: true });

      await fs.writeFile(
        path.join(project1, 'session1.jsonl'),
        '{"type":"user","message":"A"}\n{"type":"user","message":"B"}'
      );
      await fs.writeFile(
        path.join(project1, 'session2.jsonl'),
        '{"type":"user","message":"C"}'
      );
      await fs.writeFile(
        path.join(project2, 'session1.jsonl'),
        '{"type":"user","message":"D"}\n{"type":"user","message":"E"}\n{"type":"user","message":"F"}'
      );

      // Set all files to today
      const now = new Date();
      await fs.utimes(path.join(project1, 'session1.jsonl'), now, now);
      await fs.utimes(path.join(project1, 'session2.jsonl'), now, now);
      await fs.utimes(path.join(project2, 'session1.jsonl'), now, now);

      const result = await discoverProjects({ baseDir: tempDir });

      expect(result.totalProjects).toBe(2);
      expect(result.totalSessions).toBe(3);
      expect(result.totalPrompts).toBe(6);
    });

    it('should include discoveredAt timestamp', async () => {
      const before = new Date();
      const result = await discoverProjects({ baseDir: tempDir });
      const after = new Date();

      expect(result.discoveredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.discoveredAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should handle hidden directories correctly', async () => {
      const hiddenDir = path.join(tempDir, '.hidden');
      await fs.mkdir(hiddenDir, { recursive: true });
      await fs.writeFile(
        path.join(hiddenDir, 'session.jsonl'),
        '{"type":"user","message":"Hidden"}'
      );

      const validDir = path.join(tempDir, '-Users-valid');
      await fs.mkdir(validDir, { recursive: true });
      await fs.writeFile(
        path.join(validDir, 'session.jsonl'),
        '{"type":"user","message":"Valid"}'
      );

      const now = new Date();
      await fs.utimes(path.join(validDir, 'session.jsonl'), now, now);

      const result = await discoverProjects({ baseDir: tempDir });

      expect(result.totalProjects).toBe(1);
      expect(result.projects[0].normalizedPath).toBe('-Users-valid');
    });

    it('should throw error for invalid base directory format', async () => {
      await expect(
        discoverProjects({ baseDir: '/test\0/invalid' })
      ).rejects.toThrow('Discovery failed');
    });
  });

  describe('getProjectTranscripts', () => {
    it('should return all JSONL files for a project', async () => {
      const projectDir = path.join(tempDir, '-Users-test-project');
      await fs.mkdir(projectDir, { recursive: true });

      await fs.writeFile(
        path.join(projectDir, 'session1.jsonl'),
        '{"type":"user","message":"Hello"}'
      );
      await fs.writeFile(
        path.join(projectDir, 'session2.jsonl'),
        '{"type":"user","message":"World"}'
      );

      const result = await getProjectTranscripts('-Users-test-project', {
        baseDir: tempDir,
      });

      expect(result.files).toHaveLength(2);
      expect(result.files.map((f) => f.name).sort()).toEqual([
        'session1.jsonl',
        'session2.jsonl',
      ]);
    });

    it('should return empty array for non-existent project', async () => {
      const result = await getProjectTranscripts('-nonexistent', {
        baseDir: tempDir,
      });

      expect(result.files).toEqual([]);
      expect(result.totalPrompts).toBe(0);
    });

    it('should throw error for unsafe path', async () => {
      await expect(
        getProjectTranscripts('../../../etc', { baseDir: tempDir })
      ).rejects.toThrow('path traversal');
    });

    it('should include file info with mtime and size', async () => {
      const projectDir = path.join(tempDir, '-Users-test-info');
      await fs.mkdir(projectDir, { recursive: true });

      const content =
        '{"type":"user","message":"Test prompt"}\n{"type":"user","message":"Another"}';
      await fs.writeFile(path.join(projectDir, 'session.jsonl'), content);

      const result = await getProjectTranscripts('-Users-test-info', {
        baseDir: tempDir,
      });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].name).toBe('session.jsonl');
      expect(result.files[0].size).toBe(Buffer.byteLength(content));
      expect(result.files[0].mtime).toBeInstanceOf(Date);
      expect(result.files[0].estimatedPrompts).toBe(2);
    });

    it('should filter files by date range', async () => {
      const projectDir = path.join(tempDir, '-Users-test-dates');
      await fs.mkdir(projectDir, { recursive: true });

      await fs.writeFile(
        path.join(projectDir, 'old.jsonl'),
        '{"type":"user","message":"Old"}'
      );
      await fs.writeFile(
        path.join(projectDir, 'new.jsonl'),
        '{"type":"user","message":"New"}'
      );

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);
      await fs.utimes(path.join(projectDir, 'old.jsonl'), oldDate, oldDate);

      const newDate = new Date();
      await fs.utimes(path.join(projectDir, 'new.jsonl'), newDate, newDate);

      const result = await getProjectTranscripts('-Users-test-dates', {
        baseDir: tempDir,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
      });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].name).toBe('new.jsonl');
    });

    it('should calculate total prompts correctly', async () => {
      const projectDir = path.join(tempDir, '-Users-test-totals');
      await fs.mkdir(projectDir, { recursive: true });

      await fs.writeFile(
        path.join(projectDir, 'session1.jsonl'),
        '{"type":"user","message":"A"}\n{"type":"user","message":"B"}'
      );
      await fs.writeFile(
        path.join(projectDir, 'session2.jsonl'),
        '{"type":"user","message":"C"}'
      );

      const result = await getProjectTranscripts('-Users-test-totals', {
        baseDir: tempDir,
      });

      expect(result.totalPrompts).toBe(3);
    });

    it('should return project path in result', async () => {
      const projectDir = path.join(tempDir, '-Users-myproject');
      await fs.mkdir(projectDir, { recursive: true });
      await fs.writeFile(
        path.join(projectDir, 'session.jsonl'),
        '{"type":"user","message":"Test"}'
      );

      const result = await getProjectTranscripts('-Users-myproject', {
        baseDir: tempDir,
      });

      expect(result.projectPath).toBe('/Users/myproject');
    });
  });

  describe('Edge Cases', () => {
    it('should handle files directly in base directory', async () => {
      await fs.writeFile(
        path.join(tempDir, 'orphan.jsonl'),
        '{"type":"user","message":"Orphan"}'
      );

      const result = await discoverProjects({ baseDir: tempDir });

      expect(result.totalProjects).toBe(0);
      expect(result.totalSessions).toBe(0);
    });

    it('should handle empty project directories', async () => {
      const emptyDir = path.join(tempDir, '-Users-empty');
      await fs.mkdir(emptyDir, { recursive: true });

      const result = await discoverProjects({ baseDir: tempDir });

      expect(result.totalProjects).toBe(0);
    });

    it('should handle projects with only subdirectories', async () => {
      const projectDir = path.join(tempDir, '-Users-project');
      await fs.mkdir(path.join(projectDir, 'subdir'), { recursive: true });

      const result = await discoverProjects({ baseDir: tempDir });

      expect(result.totalProjects).toBe(0);
    });

    it('should exclude all sessions when none are in date range', async () => {
      const projectDir = path.join(tempDir, '-Users-old-project');
      await fs.mkdir(projectDir, { recursive: true });

      await fs.writeFile(
        path.join(projectDir, 'session.jsonl'),
        '{"type":"user","message":"Old"}'
      );

      // Set file to 90 days ago (outside 30-day window)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 90);
      await fs.utimes(path.join(projectDir, 'session.jsonl'), oldDate, oldDate);

      const result = await discoverProjects({ baseDir: tempDir });

      expect(result.totalProjects).toBe(0);
      expect(result.totalSessions).toBe(0);
    });

    it('should handle large number of projects', async () => {
      // Create 10 projects
      const now = new Date();
      for (let i = 0; i < 10; i++) {
        const projectDir = path.join(tempDir, `-Users-project-${i}`);
        await fs.mkdir(projectDir, { recursive: true });
        const filePath = path.join(projectDir, 'session.jsonl');
        await fs.writeFile(filePath, '{"type":"user","message":"Test"}');
        await fs.utimes(filePath, now, now);
      }

      const result = await discoverProjects({ baseDir: tempDir });

      expect(result.totalProjects).toBe(10);
      expect(result.totalSessions).toBe(10);
    });

    it('should handle project with many sessions', async () => {
      const projectDir = path.join(tempDir, '-Users-many-sessions');
      await fs.mkdir(projectDir, { recursive: true });

      const now = new Date();
      for (let i = 0; i < 20; i++) {
        const filePath = path.join(projectDir, `session${i}.jsonl`);
        await fs.writeFile(filePath, '{"type":"user","message":"Test"}');
        await fs.utimes(filePath, now, now);
      }

      const result = await discoverProjects({ baseDir: tempDir });

      expect(result.totalSessions).toBe(20);
      expect(result.projects[0].sessionCount).toBe(20);
    });

    it('should handle malformed JSONL gracefully', async () => {
      const projectDir = path.join(tempDir, '-Users-malformed');
      await fs.mkdir(projectDir, { recursive: true });

      await fs.writeFile(
        path.join(projectDir, 'bad.jsonl'),
        'not valid json\n{broken json\n{"type":"user","message":"Valid"}'
      );

      const now = new Date();
      await fs.utimes(path.join(projectDir, 'bad.jsonl'), now, now);

      const result = await discoverProjects({ baseDir: tempDir });

      // Should still count the valid user message
      expect(result.totalProjects).toBe(1);
      expect(result.totalPrompts).toBe(1);
    });

    it('should discover projects with all history when using epoch start', async () => {
      const projectDir = path.join(tempDir, '-Users-all-history');
      await fs.mkdir(projectDir, { recursive: true });

      await fs.writeFile(
        path.join(projectDir, 'session.jsonl'),
        '{"type":"user","message":"Very old"}'
      );

      // Set to 2 years ago
      const veryOldDate = new Date();
      veryOldDate.setFullYear(veryOldDate.getFullYear() - 2);
      await fs.utimes(path.join(projectDir, 'session.jsonl'), veryOldDate, veryOldDate);

      const result = await discoverProjects({
        baseDir: tempDir,
        startDate: new Date(0),
        endDate: new Date(),
      });

      expect(result.totalProjects).toBe(1);
      expect(result.totalSessions).toBe(1);
    });
  });
});
