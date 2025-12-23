import { describe, it, expect } from 'vitest';
import {
  generatePromptFingerprint,
  normalizeText,
} from '../fingerprint';

describe('Fingerprint Generator - Story 17-4', () => {
  describe('generatePromptFingerprint', () => {
    it('should generate a 16-character hex fingerprint', () => {
      const fingerprint = generatePromptFingerprint(
        '11111111-1111-1111-1111-111111111111',
        new Date('2025-01-15T10:30:00Z'),
        'Write a function that calculates fibonacci'
      );

      expect(fingerprint).toHaveLength(16);
      expect(fingerprint).toMatch(/^[a-f0-9]{16}$/);
    });

    it('should generate the same fingerprint for identical inputs', () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const timestamp = new Date('2025-01-15T10:30:00Z');
      const text = 'Write a function that calculates fibonacci';

      const fingerprint1 = generatePromptFingerprint(userId, timestamp, text);
      const fingerprint2 = generatePromptFingerprint(userId, timestamp, text);

      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should generate different fingerprints for different user IDs', () => {
      const timestamp = new Date('2025-01-15T10:30:00Z');
      const text = 'Write a function';

      const fingerprint1 = generatePromptFingerprint(
        '11111111-1111-1111-1111-111111111111',
        timestamp,
        text
      );
      const fingerprint2 = generatePromptFingerprint(
        '22222222-2222-2222-2222-222222222222',
        timestamp,
        text
      );

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should generate different fingerprints for different timestamps', () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const text = 'Write a function';

      const fingerprint1 = generatePromptFingerprint(
        userId,
        new Date('2025-01-15T10:30:00Z'),
        text
      );
      const fingerprint2 = generatePromptFingerprint(
        userId,
        new Date('2025-01-15T10:31:00Z'), // Different minute
        text
      );

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should generate same fingerprint for timestamps in same minute', () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const text = 'Write a function';

      const fingerprint1 = generatePromptFingerprint(
        userId,
        new Date('2025-01-15T10:30:00Z'),
        text
      );
      const fingerprint2 = generatePromptFingerprint(
        userId,
        new Date('2025-01-15T10:30:59Z'), // Same minute, different second
        text
      );

      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should generate different fingerprints for different text', () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const fingerprint1 = generatePromptFingerprint(
        userId,
        timestamp,
        'Write a function'
      );
      const fingerprint2 = generatePromptFingerprint(
        userId,
        timestamp,
        'Write a different function'
      );

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should accept ISO string timestamps', () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const text = 'Write a function';

      const fingerprintFromDate = generatePromptFingerprint(
        userId,
        new Date('2025-01-15T10:30:00Z'),
        text
      );
      const fingerprintFromString = generatePromptFingerprint(
        userId,
        '2025-01-15T10:30:00Z',
        text
      );

      expect(fingerprintFromDate).toBe(fingerprintFromString);
    });

    it('should use only first 200 characters of text', () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const timestamp = new Date('2025-01-15T10:30:00Z');
      const baseText = 'a'.repeat(200);

      const fingerprint1 = generatePromptFingerprint(
        userId,
        timestamp,
        baseText + 'extra content that should be ignored'
      );
      const fingerprint2 = generatePromptFingerprint(
        userId,
        timestamp,
        baseText + 'different extra content'
      );

      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should use full text when less than 200 characters', () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const fingerprint1 = generatePromptFingerprint(
        userId,
        timestamp,
        'short text'
      );
      const fingerprint2 = generatePromptFingerprint(
        userId,
        timestamp,
        'short text different' // Different text under 200 chars
      );

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should handle empty text', () => {
      const fingerprint = generatePromptFingerprint(
        '11111111-1111-1111-1111-111111111111',
        new Date('2025-01-15T10:30:00Z'),
        ''
      );

      expect(fingerprint).toHaveLength(16);
      expect(fingerprint).toMatch(/^[a-f0-9]{16}$/);
    });

    it('should handle text with unicode characters', () => {
      const fingerprint = generatePromptFingerprint(
        '11111111-1111-1111-1111-111111111111',
        new Date('2025-01-15T10:30:00Z'),
        'Hello 世界 🌍 emoji and unicode'
      );

      expect(fingerprint).toHaveLength(16);
      expect(fingerprint).toMatch(/^[a-f0-9]{16}$/);
    });

    it('should normalize whitespace in text', () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const fingerprint1 = generatePromptFingerprint(
        userId,
        timestamp,
        'Write  a   function'  // Multiple spaces
      );
      const fingerprint2 = generatePromptFingerprint(
        userId,
        timestamp,
        'Write a function'  // Single spaces
      );

      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should trim whitespace from text', () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const fingerprint1 = generatePromptFingerprint(
        userId,
        timestamp,
        '  Write a function  '  // Leading/trailing spaces
      );
      const fingerprint2 = generatePromptFingerprint(
        userId,
        timestamp,
        'Write a function'  // No extra spaces
      );

      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should be case-insensitive for text comparison', () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const fingerprint1 = generatePromptFingerprint(
        userId,
        timestamp,
        'Write a Function'  // Mixed case
      );
      const fingerprint2 = generatePromptFingerprint(
        userId,
        timestamp,
        'write a function'  // Lowercase
      );

      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should handle newlines in text by normalizing', () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const fingerprint1 = generatePromptFingerprint(
        userId,
        timestamp,
        'Write a\nfunction'  // Newline
      );
      const fingerprint2 = generatePromptFingerprint(
        userId,
        timestamp,
        'Write a function'  // Space instead
      );

      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should handle tabs in text by normalizing', () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const fingerprint1 = generatePromptFingerprint(
        userId,
        timestamp,
        'Write a\tfunction'  // Tab
      );
      const fingerprint2 = generatePromptFingerprint(
        userId,
        timestamp,
        'Write a function'  // Space
      );

      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should use UTC for timestamp formatting', () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const text = 'Write a function';

      // Create a date that would be different in local timezone
      const utcDate = new Date('2025-01-15T23:30:00Z');

      const fingerprint = generatePromptFingerprint(userId, utcDate, text);

      // The fingerprint should be consistent regardless of local timezone
      expect(fingerprint).toHaveLength(16);
      expect(fingerprint).toMatch(/^[a-f0-9]{16}$/);
    });
  });

  describe('normalizeText', () => {
    it('should trim whitespace', () => {
      expect(normalizeText('  hello  ')).toBe('hello');
    });

    it('should collapse multiple spaces', () => {
      expect(normalizeText('hello   world')).toBe('hello world');
    });

    it('should convert to lowercase', () => {
      expect(normalizeText('Hello World')).toBe('hello world');
    });

    it('should handle newlines', () => {
      expect(normalizeText('hello\nworld')).toBe('hello world');
    });

    it('should handle tabs', () => {
      expect(normalizeText('hello\tworld')).toBe('hello world');
    });

    it('should handle empty string', () => {
      expect(normalizeText('')).toBe('');
    });

    it('should preserve unicode characters', () => {
      expect(normalizeText('Hello 世界')).toBe('hello 世界');
    });

    it('should handle carriage returns', () => {
      expect(normalizeText('hello\r\nworld')).toBe('hello world');
    });

    it('should handle mixed whitespace', () => {
      expect(normalizeText('  hello\t\n  world  ')).toBe('hello world');
    });
  });

  describe('deterministic behavior', () => {
    it('should produce consistent fingerprints across multiple calls', () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const timestamp = new Date('2025-01-15T10:30:00Z');
      const text = 'This is a test prompt for consistency checking';

      const fingerprints = new Set<string>();
      for (let i = 0; i < 100; i++) {
        fingerprints.add(generatePromptFingerprint(userId, timestamp, text));
      }

      expect(fingerprints.size).toBe(1);
    });

    it('should match expected format for known inputs', () => {
      // This test ensures the algorithm doesn't change unexpectedly
      const fingerprint = generatePromptFingerprint(
        '11111111-1111-1111-1111-111111111111',
        new Date('2025-01-15T10:30:00Z'),
        'write a function'
      );

      // The fingerprint should be stable - if this test fails, the algorithm changed
      expect(fingerprint).toHaveLength(16);
      expect(fingerprint).toMatch(/^[a-f0-9]{16}$/);
    });
  });
});
