import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  discoverTranscripts,
  getProjectTranscripts,
  denormalizePath,
  normalizePath,
  getClaudeProjectsDir,
  isPathSafe,
  estimatePromptCount,
} from '../discover';

describe('Transcript Discovery - Story 15-1', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'transcript-test-'));
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
  });

  describe('denormalizePath', () => {
    it('should validate path exists for simple cases', async () => {
      // Create a test directory structure
      const testPath = path.join(tempDir, 'Users', 'edgars', 'project');
      await fs.mkdir(testPath, { recursive: true });

      // Create normalized path pointing to temp structure
      const normalizedPath = normalizePath(testPath);

      const result = await denormalizePath(normalizedPath);
      expect(result).toBe(testPath);
    });

    it('should handle paths with hyphens in original name', async () => {
      // Create a test directory with hyphen in name
      const testPath = path.join(tempDir, 'My-projects', 'DEV');
      await fs.mkdir(testPath, { recursive: true });

      // The normalized form would be: path/to/temp-My-projects-DEV
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
  });

  describe('estimatePromptCount', () => {
    it('should count user type messages', async () => {
      // Create a test JSONL file with user messages
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
  });

  describe('discoverTranscripts', () => {
    it('should return empty result when directory does not exist', async () => {
      const nonExistentDir = path.join(tempDir, 'nonexistent');

      const result = await discoverTranscripts({ baseDir: nonExistentDir });

      expect(result.projects).toEqual([]);
      expect(result.totalProjects).toBe(0);
      expect(result.totalSessions).toBe(0);
      expect(result.totalEstimatedPrompts).toBe(0);
      expect(result.oldestSession).toBeNull();
      expect(result.newestSession).toBeNull();
      expect(result.discoveredAt).toBeInstanceOf(Date);
    });

    it('should discover projects with JSONL files', async () => {
      // Create project directory structure
      const projectDir = path.join(tempDir, '-Users-test-project');
      await fs.mkdir(projectDir, { recursive: true });

      // Create some JSONL files
      await fs.writeFile(
        path.join(projectDir, 'session1.jsonl'),
        '{"type":"user","message":"Hello"}\n{"type":"assistant","message":"Hi"}'
      );
      await fs.writeFile(
        path.join(projectDir, 'session2.jsonl'),
        '{"type":"user","message":"Test"}'
      );

      const result = await discoverTranscripts({ baseDir: tempDir });

      expect(result.totalProjects).toBe(1);
      expect(result.totalSessions).toBe(2);
      expect(result.totalEstimatedPrompts).toBe(2);
      expect(result.projects[0].sessionCount).toBe(2);
      expect(result.projects[0].normalizedPath).toBe('-Users-test-project');
    });

    it('should ignore non-JSONL files', async () => {
      const projectDir = path.join(tempDir, '-Users-test-project');
      await fs.mkdir(projectDir, { recursive: true });

      // Create JSONL and other files
      await fs.writeFile(
        path.join(projectDir, 'session.jsonl'),
        '{"type":"user","message":"Hello"}'
      );
      await fs.writeFile(path.join(projectDir, 'config.json'), '{}');
      await fs.writeFile(path.join(projectDir, 'notes.txt'), 'notes');

      const result = await discoverTranscripts({ baseDir: tempDir });

      expect(result.totalSessions).toBe(1);
      expect(result.projects[0].sessionCount).toBe(1);
    });

    it('should skip projects with no JSONL files', async () => {
      // Create project with no JSONL files
      const emptyProject = path.join(tempDir, '-Users-empty');
      await fs.mkdir(emptyProject, { recursive: true });
      await fs.writeFile(path.join(emptyProject, 'readme.txt'), 'hello');

      // Create project with JSONL files
      const validProject = path.join(tempDir, '-Users-valid');
      await fs.mkdir(validProject, { recursive: true });
      await fs.writeFile(
        path.join(validProject, 'session.jsonl'),
        '{"type":"user","message":"Test"}'
      );

      const result = await discoverTranscripts({ baseDir: tempDir });

      expect(result.totalProjects).toBe(1);
      expect(result.projects[0].normalizedPath).toBe('-Users-valid');
    });

    it('should track oldest and newest session dates', async () => {
      const projectDir = path.join(tempDir, '-Users-test-dates');
      await fs.mkdir(projectDir, { recursive: true });

      // Create files with different modification times
      const file1 = path.join(projectDir, 'old.jsonl');
      const file2 = path.join(projectDir, 'new.jsonl');

      await fs.writeFile(file1, '{"type":"user","message":"Old"}');
      await fs.writeFile(file2, '{"type":"user","message":"New"}');

      // Set different mtimes
      const oldDate = new Date('2024-01-01T00:00:00Z');
      const newDate = new Date('2024-12-01T00:00:00Z');

      await fs.utimes(file1, oldDate, oldDate);
      await fs.utimes(file2, newDate, newDate);

      const result = await discoverTranscripts({ baseDir: tempDir });

      expect(result.oldestSession?.getTime()).toBe(oldDate.getTime());
      expect(result.newestSession?.getTime()).toBe(newDate.getTime());
    });

    it('should aggregate totals across multiple projects', async () => {
      // Create multiple projects
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

      const result = await discoverTranscripts({ baseDir: tempDir });

      expect(result.totalProjects).toBe(2);
      expect(result.totalSessions).toBe(3); // 2 + 1
      expect(result.totalEstimatedPrompts).toBe(6); // 2 + 1 + 3
    });

    it('should include discoveredAt timestamp', async () => {
      const before = new Date();
      const result = await discoverTranscripts({ baseDir: tempDir });
      const after = new Date();

      expect(result.discoveredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.discoveredAt.getTime()).toBeLessThanOrEqual(after.getTime());
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

      const files = await getProjectTranscripts('-Users-test-project', {
        baseDir: tempDir,
      });

      expect(files).toHaveLength(2);
      expect(files.map((f) => f.name).sort()).toEqual(['session1.jsonl', 'session2.jsonl']);
    });

    it('should return empty array for non-existent project', async () => {
      const files = await getProjectTranscripts('-nonexistent', {
        baseDir: tempDir,
      });

      expect(files).toEqual([]);
    });

    it('should throw error for unsafe path', async () => {
      await expect(
        getProjectTranscripts('../../../etc', { baseDir: tempDir })
      ).rejects.toThrow('Invalid project path');
    });

    it('should include file info with mtime and size', async () => {
      const projectDir = path.join(tempDir, '-Users-test-info');
      await fs.mkdir(projectDir, { recursive: true });

      const content = '{"type":"user","message":"Test prompt"}\n{"type":"user","message":"Another"}';
      await fs.writeFile(path.join(projectDir, 'session.jsonl'), content);

      const files = await getProjectTranscripts('-Users-test-info', {
        baseDir: tempDir,
      });

      expect(files).toHaveLength(1);
      expect(files[0].name).toBe('session.jsonl');
      expect(files[0].size).toBe(Buffer.byteLength(content));
      expect(files[0].mtime).toBeInstanceOf(Date);
      expect(files[0].estimatedPrompts).toBe(2);
    });
  });

  describe('Edge cases', () => {
    it('should handle hidden directories correctly', async () => {
      // Create a hidden directory that should be skipped
      const hiddenDir = path.join(tempDir, '.hidden');
      await fs.mkdir(hiddenDir, { recursive: true });
      await fs.writeFile(
        path.join(hiddenDir, 'session.jsonl'),
        '{"type":"user","message":"Hidden"}'
      );

      // Create a valid project
      const validDir = path.join(tempDir, '-Users-valid');
      await fs.mkdir(validDir, { recursive: true });
      await fs.writeFile(
        path.join(validDir, 'session.jsonl'),
        '{"type":"user","message":"Valid"}'
      );

      const result = await discoverTranscripts({ baseDir: tempDir });

      expect(result.totalProjects).toBe(1);
      expect(result.projects[0].normalizedPath).toBe('-Users-valid');
    });

    it('should handle files in base directory (not in project subdirs)', async () => {
      // Create a file directly in base dir (should be ignored)
      await fs.writeFile(
        path.join(tempDir, 'orphan.jsonl'),
        '{"type":"user","message":"Orphan"}'
      );

      const result = await discoverTranscripts({ baseDir: tempDir });

      expect(result.totalProjects).toBe(0);
      expect(result.totalSessions).toBe(0);
    });

    it('should handle empty project directories', async () => {
      const emptyDir = path.join(tempDir, '-Users-empty');
      await fs.mkdir(emptyDir, { recursive: true });

      const result = await discoverTranscripts({ baseDir: tempDir });

      expect(result.totalProjects).toBe(0);
    });

    it('should handle projects with only subdirectories', async () => {
      const projectDir = path.join(tempDir, '-Users-project');
      await fs.mkdir(path.join(projectDir, 'subdir'), { recursive: true });

      const result = await discoverTranscripts({ baseDir: tempDir });

      expect(result.totalProjects).toBe(0);
    });
  });
});
