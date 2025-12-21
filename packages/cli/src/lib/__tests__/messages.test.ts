import { describe, it, expect } from 'vitest';
import {
  formatSuccessMessage,
  formatFailureMessage,
  formatInstallationSummary,
  formatTimeAgo,
  formatDate,
} from '../messages.js';
import type { SharedConfig, UserConfig } from '../config.js';
import type { TestError } from '../api-client.js';

describe('messages', () => {
  const sharedConfig: SharedConfig = {
    project_id: '550e8400-e29b-41d4-a716-446655440000',
    project_name: 'Test Project',
    team_id: '550e8400-e29b-41d4-a716-446655440001',
    team_name: 'Test Team',
    api_endpoint: 'https://api.contextor.co',
    created_at: '2025-01-01T00:00:00.000Z',
    created_by: 'Test Creator',
  };

  const userConfig: UserConfig = {
    user_id: '550e8400-e29b-41d4-a716-446655440002',
    user_name: 'Test User',
    api_key: 'sk_test_xxxxx',
    configured_at: '2025-01-01T00:00:00.000Z',
  };

  describe('formatSuccessMessage', () => {
    it('includes project name', () => {
      const message = formatSuccessMessage(sharedConfig, userConfig);
      expect(message).toContain('Test Project');
    });

    it('includes team name', () => {
      const message = formatSuccessMessage(sharedConfig, userConfig);
      expect(message).toContain('Test Team');
    });

    it('includes user name', () => {
      const message = formatSuccessMessage(sharedConfig, userConfig);
      expect(message).toContain('Test User');
    });

    it('includes dashboard URL with project ID', () => {
      const message = formatSuccessMessage(sharedConfig, userConfig);
      expect(message).toContain('https://app.contextor.co/projects/550e8400-e29b-41d4-a716-446655440000');
    });

    it('includes coaching-positive message', () => {
      const message = formatSuccessMessage(sharedConfig, userConfig);
      expect(message).toContain('Your prompts will appear there');
    });

    it('includes success indication', () => {
      const message = formatSuccessMessage(sharedConfig, userConfig);
      expect(message).toContain('Success');
    });
  });

  describe('formatFailureMessage', () => {
    it('includes error message', () => {
      const error: TestError = { code: 'AUTH_FAILED', message: 'Authentication failed.' };
      const message = formatFailureMessage(error);
      expect(message).toContain('Authentication failed');
    });

    it('includes troubleshooting steps for AUTH_FAILED', () => {
      const error: TestError = { code: 'AUTH_FAILED', message: 'Auth error' };
      const message = formatFailureMessage(error);
      expect(message).toContain('Regenerate');
      expect(message).toContain('init');
    });

    it('includes troubleshooting steps for TIMEOUT', () => {
      const error: TestError = { code: 'TIMEOUT', message: 'Timeout' };
      const message = formatFailureMessage(error);
      expect(message).toContain('internet connection');
    });

    it('includes documentation link', () => {
      const error: TestError = { code: 'SERVER_ERROR', message: 'Error' };
      const message = formatFailureMessage(error);
      expect(message).toContain('https://docs.contextor.co/troubleshooting');
    });

    it('handles unknown error codes with default steps', () => {
      const error = { code: 'UNKNOWN' as TestError['code'], message: 'Unknown error' };
      const message = formatFailureMessage(error);
      expect(message).toContain('Troubleshooting steps');
    });
  });

  describe('formatInstallationSummary', () => {
    const files = ['.contextor/config.json', '.contextor/.user'];

    it('includes files created', () => {
      const message = formatInstallationSummary(sharedConfig, files);
      expect(message).toContain('.contextor/config.json');
      expect(message).toContain('.contextor/.user');
    });

    it('includes project ID', () => {
      const message = formatInstallationSummary(sharedConfig, files);
      expect(message).toContain(sharedConfig.project_id);
    });

    it('includes API endpoint', () => {
      const message = formatInstallationSummary(sharedConfig, files);
      expect(message).toContain(sharedConfig.api_endpoint);
    });
  });

  describe('formatTimeAgo', () => {
    it('returns "Just now" for recent times', () => {
      const result = formatTimeAgo(new Date());
      expect(result).toBe('Just now');
    });

    it('returns minutes ago', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const result = formatTimeAgo(fiveMinutesAgo);
      expect(result).toBe('5 minutes ago');
    });

    it('returns hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const result = formatTimeAgo(twoHoursAgo);
      expect(result).toBe('2 hours ago');
    });

    it('returns days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const result = formatTimeAgo(threeDaysAgo);
      expect(result).toBe('3 days ago');
    });
  });

  describe('formatDate', () => {
    it('formats ISO date string', () => {
      const result = formatDate('2025-01-15T10:30:00.000Z');
      // Result will vary by timezone, but should contain the date components
      expect(result).toMatch(/Jan.*15.*2025/);
    });
  });
});
