import { describe, it, expect } from 'vitest';
import {
  sanitizePath,
  generateSlug,
  extractSessionMetadata,
  extractStartedAt,
  extractLastMessageTimestamp,
  extractContextFromMessages,
  calculateSessionDuration,
} from '../metadata-extraction';
import type { TranscriptContext, TranscriptMessage } from '../types';

describe('sanitizePath', () => {
  describe('macOS paths', () => {
    it('should replace /Users/username with ~', () => {
      expect(sanitizePath('/Users/john/projects/my-app')).toBe('~/projects/my-app');
    });

    it('should handle nested paths', () => {
      expect(sanitizePath('/Users/jane.doe/code/project/src/file.ts')).toBe(
        '~/code/project/src/file.ts'
      );
    });

    it('should handle username with dots', () => {
      expect(sanitizePath('/Users/first.last/work')).toBe('~/work');
    });

    it('should handle only home directory', () => {
      expect(sanitizePath('/Users/bob')).toBe('~');
    });
  });

  describe('Linux paths', () => {
    it('should replace /home/username with ~', () => {
      expect(sanitizePath('/home/alice/projects/app')).toBe('~/projects/app');
    });

    it('should handle nested paths', () => {
      expect(sanitizePath('/home/dev/work/client/repo')).toBe('~/work/client/repo');
    });
  });

  describe('Windows paths', () => {
    it('should replace C:\\Users\\username with ~', () => {
      expect(sanitizePath('C:\\Users\\john\\Documents\\project')).toBe(
        '~\\Documents\\project'
      );
    });

    it('should handle lowercase drive letter', () => {
      expect(sanitizePath('c:\\Users\\jane\\code')).toBe('~\\code');
    });

    it('should handle D drive', () => {
      expect(sanitizePath('D:\\Users\\dev\\work')).toBe('~\\work');
    });
  });

  describe('edge cases', () => {
    it('should return null for undefined', () => {
      expect(sanitizePath(undefined)).toBe(null);
    });

    it('should return null for empty string', () => {
      expect(sanitizePath('')).toBe(null);
    });

    it('should return null for whitespace only', () => {
      expect(sanitizePath('   ')).toBe(null);
    });

    it('should return path unchanged if no home directory pattern', () => {
      expect(sanitizePath('/var/log/app')).toBe('/var/log/app');
    });

    it('should return path unchanged for relative paths', () => {
      expect(sanitizePath('./src/components')).toBe('./src/components');
    });

    it('should trim whitespace', () => {
      expect(sanitizePath('  /Users/john/code  ')).toBe('~/code');
    });
  });
});

describe('generateSlug', () => {
  describe('from custom conversation title', () => {
    it('should prioritize custom conversation title', () => {
      const context: TranscriptContext = {
        sessionId: 'abc123',
        timestamp: '2025-01-15T10:30:00Z',
        customConversationTitle: 'Fix Login Bug',
        gitBranch: 'feature/auth',
        cwd: '/Users/john/projects/app',
      };
      expect(generateSlug(context)).toBe('fix-login-bug');
    });

    it('should convert to lowercase and replace spaces', () => {
      const context: TranscriptContext = {
        sessionId: 'abc123',
        timestamp: '2025-01-15T10:30:00Z',
        customConversationTitle: 'Implement User Authentication',
      };
      expect(generateSlug(context)).toBe('implement-user-authentication');
    });

    it('should remove special characters', () => {
      const context: TranscriptContext = {
        sessionId: 'abc123',
        timestamp: '2025-01-15T10:30:00Z',
        customConversationTitle: "Fix bug #123: User's profile!",
      };
      expect(generateSlug(context)).toBe('fix-bug-123-users-profile');
    });
  });

  describe('from git branch', () => {
    it('should use git branch when no custom title', () => {
      const context: TranscriptContext = {
        sessionId: 'abc123',
        timestamp: '2025-01-15T10:30:00Z',
        gitBranch: 'feature/user-auth',
      };
      expect(generateSlug(context)).toBe('feature-user-auth');
    });

    it('should strip origin/ prefix', () => {
      const context: TranscriptContext = {
        sessionId: 'abc123',
        timestamp: '2025-01-15T10:30:00Z',
        gitBranch: 'origin/main',
      };
      expect(generateSlug(context)).toBe('main');
    });

    it('should strip refs/heads/ prefix', () => {
      const context: TranscriptContext = {
        sessionId: 'abc123',
        timestamp: '2025-01-15T10:30:00Z',
        gitBranch: 'refs/heads/develop',
      };
      expect(generateSlug(context)).toBe('develop');
    });

    it('should handle branch with slashes', () => {
      const context: TranscriptContext = {
        sessionId: 'abc123',
        timestamp: '2025-01-15T10:30:00Z',
        gitBranch: 'feature/epic-1/story-2',
      };
      expect(generateSlug(context)).toBe('feature-epic-1-story-2');
    });
  });

  describe('from cwd', () => {
    it('should use folder name when no title or branch', () => {
      const context: TranscriptContext = {
        sessionId: 'abc123',
        timestamp: '2025-01-15T10:30:00Z',
        cwd: '/Users/john/projects/my-awesome-app',
      };
      expect(generateSlug(context)).toBe('my-awesome-app');
    });

    it('should handle Windows paths', () => {
      const context: TranscriptContext = {
        sessionId: 'abc123',
        timestamp: '2025-01-15T10:30:00Z',
        cwd: 'C:\\Users\\john\\code\\MyProject',
      };
      expect(generateSlug(context)).toBe('myproject');
    });
  });

  describe('timestamp fallback', () => {
    it('should use timestamp when no other options', () => {
      const context: TranscriptContext = {
        sessionId: 'abc123',
        timestamp: '2025-01-15T10:30:00Z',
      };
      const slug = generateSlug(context);
      expect(slug).toMatch(/^session-\d{12}$/);
      expect(slug).toContain('202501151030');
    });

    it('should return null for invalid timestamp', () => {
      const context: TranscriptContext = {
        sessionId: 'abc123',
        timestamp: 'invalid-date',
      };
      expect(generateSlug(context)).toBe(null);
    });
  });

  describe('edge cases', () => {
    it('should limit slug length to 64 characters', () => {
      const context: TranscriptContext = {
        sessionId: 'abc123',
        timestamp: '2025-01-15T10:30:00Z',
        customConversationTitle: 'This is a very long conversation title that should be truncated to fit within the maximum allowed length',
      };
      const slug = generateSlug(context);
      expect(slug!.length).toBeLessThanOrEqual(64);
    });

    it('should collapse multiple hyphens', () => {
      const context: TranscriptContext = {
        sessionId: 'abc123',
        timestamp: '2025-01-15T10:30:00Z',
        customConversationTitle: 'Test   ---   Multiple   Spaces',
      };
      expect(generateSlug(context)).toBe('test-multiple-spaces');
    });

    it('should remove leading/trailing hyphens', () => {
      const context: TranscriptContext = {
        sessionId: 'abc123',
        timestamp: '2025-01-15T10:30:00Z',
        customConversationTitle: '---Fix Bug---',
      };
      expect(generateSlug(context)).toBe('fix-bug');
    });
  });
});

describe('extractSessionMetadata', () => {
  it('should extract all metadata fields', () => {
    const context: TranscriptContext = {
      sessionId: 'abc123',
      timestamp: '2025-01-15T10:30:00Z',
      cwd: '/Users/john/projects/my-app',
      gitBranch: 'feature/auth',
      claudeCodeVersion: '1.2.3',
      customConversationTitle: 'Implement Login',
    };

    const metadata = extractSessionMetadata(context);

    expect(metadata).toEqual({
      cwd: '~/projects/my-app',
      git_branch: 'feature/auth',
      claude_code_version: '1.2.3',
      slug: 'implement-login',
    });
  });

  it('should handle missing optional fields', () => {
    const context: TranscriptContext = {
      sessionId: 'abc123',
      timestamp: '2025-01-15T10:30:00Z',
    };

    const metadata = extractSessionMetadata(context);

    expect(metadata.cwd).toBe(null);
    expect(metadata.git_branch).toBe(null);
    expect(metadata.claude_code_version).toBe(null);
    expect(metadata.slug).toMatch(/^session-\d+$/);
  });

  it('should handle empty strings as null', () => {
    const context: TranscriptContext = {
      sessionId: 'abc123',
      timestamp: '2025-01-15T10:30:00Z',
      cwd: '',
      gitBranch: '  ',
      claudeCodeVersion: '',
    };

    const metadata = extractSessionMetadata(context);

    expect(metadata.cwd).toBe(null);
    expect(metadata.git_branch).toBe(null);
    expect(metadata.claude_code_version).toBe(null);
  });
});

describe('extractStartedAt', () => {
  it('should return first message timestamp', () => {
    const messages = [
      { timestamp: '2025-01-15T10:30:00Z' },
      { timestamp: '2025-01-15T10:31:00Z' },
      { timestamp: '2025-01-15T10:32:00Z' },
    ];

    const startedAt = extractStartedAt(messages);

    expect(startedAt.toISOString()).toBe('2025-01-15T10:30:00.000Z');
  });

  it('should skip messages without timestamps', () => {
    const messages = [
      { content: 'no timestamp' },
      { timestamp: '2025-01-15T10:31:00Z' },
    ];

    const startedAt = extractStartedAt(messages);

    expect(startedAt.toISOString()).toBe('2025-01-15T10:31:00.000Z');
  });

  it('should skip invalid timestamps', () => {
    const messages = [
      { timestamp: 'invalid' },
      { timestamp: '2025-01-15T10:31:00Z' },
    ];

    const startedAt = extractStartedAt(messages);

    expect(startedAt.toISOString()).toBe('2025-01-15T10:31:00.000Z');
  });

  it('should return current date if no valid timestamps', () => {
    const before = new Date();
    const startedAt = extractStartedAt([{ timestamp: undefined }]);
    const after = new Date();

    expect(startedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(startedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('should return current date for empty array', () => {
    const before = new Date();
    const startedAt = extractStartedAt([]);
    const after = new Date();

    expect(startedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(startedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

describe('extractLastMessageTimestamp', () => {
  it('should return last message timestamp', () => {
    const messages = [
      { timestamp: '2025-01-15T10:30:00Z' },
      { timestamp: '2025-01-15T10:31:00Z' },
      { timestamp: '2025-01-15T10:32:00Z' },
    ];

    const lastTimestamp = extractLastMessageTimestamp(messages);

    expect(lastTimestamp!.toISOString()).toBe('2025-01-15T10:32:00.000Z');
  });

  it('should skip messages without timestamps from end', () => {
    const messages = [
      { timestamp: '2025-01-15T10:30:00Z' },
      { timestamp: '2025-01-15T10:31:00Z' },
      { content: 'no timestamp' },
    ];

    const lastTimestamp = extractLastMessageTimestamp(messages);

    expect(lastTimestamp!.toISOString()).toBe('2025-01-15T10:31:00.000Z');
  });

  it('should return null if no valid timestamps', () => {
    const messages = [{ timestamp: undefined }, { timestamp: undefined }];

    expect(extractLastMessageTimestamp(messages)).toBe(null);
  });

  it('should return null for empty array', () => {
    expect(extractLastMessageTimestamp([])).toBe(null);
  });
});

describe('extractContextFromMessages', () => {
  it('should return first context found', () => {
    const messages: TranscriptMessage[] = [
      {
        role: 'user',
        content: 'Hello',
        context: {
          sessionId: 'abc123',
          timestamp: '2025-01-15T10:30:00Z',
          cwd: '/Users/john/project',
        },
      },
      {
        role: 'assistant',
        content: 'Hi!',
      },
    ];

    const context = extractContextFromMessages(messages);

    expect(context).toEqual({
      sessionId: 'abc123',
      timestamp: '2025-01-15T10:30:00Z',
      cwd: '/Users/john/project',
    });
  });

  it('should return null if no context found', () => {
    const messages: TranscriptMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
    ];

    expect(extractContextFromMessages(messages)).toBe(null);
  });

  it('should return null for empty array', () => {
    expect(extractContextFromMessages([])).toBe(null);
  });
});

describe('calculateSessionDuration', () => {
  it('should calculate duration in seconds', () => {
    const startedAt = new Date('2025-01-15T10:00:00Z');
    const endedAt = new Date('2025-01-15T10:30:00Z');

    expect(calculateSessionDuration(startedAt, endedAt)).toBe(1800); // 30 minutes
  });

  it('should handle sub-second durations', () => {
    const startedAt = new Date('2025-01-15T10:00:00.500Z');
    const endedAt = new Date('2025-01-15T10:00:01.200Z');

    // 700ms = 0 seconds (floored)
    expect(calculateSessionDuration(startedAt, endedAt)).toBe(0);
  });

  it('should use current time if endedAt is null', () => {
    const startedAt = new Date(Date.now() - 60000); // 1 minute ago
    const duration = calculateSessionDuration(startedAt, null);

    // Should be approximately 60 seconds
    expect(duration).toBeGreaterThanOrEqual(59);
    expect(duration).toBeLessThanOrEqual(61);
  });

  it('should return 0 for negative durations', () => {
    const startedAt = new Date('2025-01-15T10:30:00Z');
    const endedAt = new Date('2025-01-15T10:00:00Z'); // Before start

    expect(calculateSessionDuration(startedAt, endedAt)).toBe(0);
  });
});
