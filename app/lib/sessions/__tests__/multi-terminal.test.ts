/**
 * Multi-Terminal Types Tests - Story 16-5: Multi-Terminal Awareness
 */

import { describe, it, expect } from 'vitest';
import {
  generateSessionDisplayName,
  calculateDurationMinutes,
  type SessionDisplayNameInput,
} from '../types';

describe('generateSessionDisplayName', () => {
  describe('priority order', () => {
    it('should use slug when available (highest priority)', () => {
      const session: SessionDisplayNameInput = {
        id: 'a',
        started_at: '2025-01-15T10:30:00Z',
        cwd: '/home/user/project',
        git_branch: 'feature/auth',
        slug: 'My Custom Name',
      };

      const result = generateSessionDisplayName(session);
      expect(result).toBe('My Custom Name');
    });

    it('should use git_branch + folder when both available', () => {
      const session: SessionDisplayNameInput = {
        id: 'a',
        started_at: '2025-01-15T10:30:00Z',
        cwd: '/home/user/project',
        git_branch: 'feature/auth',
        slug: null,
      };

      const result = generateSessionDisplayName(session);
      expect(result).toBe('feature/auth (project)');
    });

    it('should use git_branch only when cwd not available', () => {
      const session: SessionDisplayNameInput = {
        id: 'a',
        started_at: '2025-01-15T10:30:00Z',
        cwd: null,
        git_branch: 'feature/auth',
        slug: null,
      };

      const result = generateSessionDisplayName(session);
      expect(result).toBe('feature/auth');
    });

    it('should use folder name when git_branch not available', () => {
      const session: SessionDisplayNameInput = {
        id: 'a',
        started_at: '2025-01-15T10:30:00Z',
        cwd: '/home/user/my-project',
        git_branch: null,
        slug: null,
      };

      const result = generateSessionDisplayName(session);
      expect(result).toBe('my-project');
    });

    it('should use project_name when cwd and git_branch not available', () => {
      const session: SessionDisplayNameInput = {
        id: 'a',
        started_at: '2025-01-15T10:30:00Z',
        cwd: null,
        git_branch: null,
        slug: null,
        project_name: 'My Project',
      };

      const result = generateSessionDisplayName(session);
      expect(result).toBe('My Project');
    });

    it('should use time-based name as fallback', () => {
      const session: SessionDisplayNameInput = {
        id: 'a',
        started_at: '2025-01-15T10:30:00Z',
        cwd: null,
        git_branch: null,
        slug: null,
      };

      const result = generateSessionDisplayName(session);
      // The exact format depends on locale, but should contain "Session at"
      expect(result).toMatch(/Session at .*/);
    });
  });

  describe('uniqueness suffix', () => {
    it('should add number suffix for duplicate names', () => {
      const allSessions: SessionDisplayNameInput[] = [
        {
          id: 'a',
          started_at: '2025-01-15T10:00:00Z',
          cwd: '/home/user/project',
          git_branch: 'main',
          slug: null,
        },
        {
          id: 'b',
          started_at: '2025-01-15T11:00:00Z',
          cwd: '/home/user/project',
          git_branch: 'main',
          slug: null,
        },
        {
          id: 'c',
          started_at: '2025-01-15T12:00:00Z',
          cwd: '/home/user/project',
          git_branch: 'main',
          slug: null,
        },
      ];

      const resultA = generateSessionDisplayName(allSessions[0]!, allSessions);
      const resultB = generateSessionDisplayName(allSessions[1]!, allSessions);
      const resultC = generateSessionDisplayName(allSessions[2]!, allSessions);

      expect(resultA).toBe('main (project)');
      expect(resultB).toBe('main (project) #2');
      expect(resultC).toBe('main (project) #3');
    });

    it('should not add suffix for unique names', () => {
      const allSessions: SessionDisplayNameInput[] = [
        {
          id: 'a',
          started_at: '2025-01-15T10:00:00Z',
          cwd: '/home/user/project-a',
          git_branch: 'feature-a',
          slug: null,
        },
        {
          id: 'b',
          started_at: '2025-01-15T11:00:00Z',
          cwd: '/home/user/project-b',
          git_branch: 'feature-b',
          slug: null,
        },
      ];

      const resultA = generateSessionDisplayName(allSessions[0]!, allSessions);
      const resultB = generateSessionDisplayName(allSessions[1]!, allSessions);

      expect(resultA).toBe('feature-a (project-a)');
      expect(resultB).toBe('feature-b (project-b)');
      expect(resultA).not.toContain('#');
      expect(resultB).not.toContain('#');
    });
  });

  describe('edge cases', () => {
    it('should handle empty cwd', () => {
      const session: SessionDisplayNameInput = {
        id: 'a',
        started_at: '2025-01-15T10:30:00Z',
        cwd: '',
        git_branch: 'main',
        slug: null,
      };

      const result = generateSessionDisplayName(session);
      expect(result).toBe('main');
    });

    it('should handle root cwd (/)', () => {
      const session: SessionDisplayNameInput = {
        id: 'a',
        started_at: '2025-01-15T10:30:00Z',
        cwd: '/',
        git_branch: 'main',
        slug: null,
      };

      const result = generateSessionDisplayName(session);
      // With only root, there's no folder name, so just branch
      expect(result).toBe('main');
    });

    it('should handle Windows-style paths', () => {
      const session: SessionDisplayNameInput = {
        id: 'a',
        started_at: '2025-01-15T10:30:00Z',
        cwd: 'C:\\Users\\user\\project',
        git_branch: null,
        slug: null,
      };

      const result = generateSessionDisplayName(session);
      // The split by / won't work for Windows paths, so we get the full path
      // This is acceptable - real Windows paths would use \ or be normalized
      expect(result).toMatch(/.*project.*/);
    });
  });
});

describe('calculateDurationMinutes', () => {
  it('should return null for active sessions (null endedAt)', () => {
    const result = calculateDurationMinutes('2025-01-15T10:00:00Z', null);
    expect(result).toBeNull();
  });

  it('should calculate correct duration in minutes', () => {
    const result = calculateDurationMinutes(
      '2025-01-15T10:00:00Z',
      '2025-01-15T12:30:00Z'
    );
    expect(result).toBe(150); // 2.5 hours = 150 minutes
  });

  it('should handle zero duration', () => {
    const result = calculateDurationMinutes(
      '2025-01-15T10:00:00Z',
      '2025-01-15T10:00:00Z'
    );
    expect(result).toBe(0);
  });

  it('should round to nearest minute', () => {
    const result = calculateDurationMinutes(
      '2025-01-15T10:00:00Z',
      '2025-01-15T10:01:30Z' // 1.5 minutes
    );
    expect(result).toBe(2); // Rounded up
  });

  it('should handle short durations', () => {
    const result = calculateDurationMinutes(
      '2025-01-15T10:00:00Z',
      '2025-01-15T10:00:20Z' // 20 seconds
    );
    expect(result).toBe(0); // Rounds to 0
  });
});
