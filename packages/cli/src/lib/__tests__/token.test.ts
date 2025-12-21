import { describe, it, expect } from 'vitest';
import { parseToken, TokenParseError, isTokenExpired, createTestToken, type InstallToken } from '../token.js';

describe('parseToken', () => {
  it('parses valid token correctly', () => {
    const token = createTestToken();
    const result = parseToken(token);

    expect(result.project_id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.project_name).toBe('Test Project');
    expect(result.team_id).toBe('550e8400-e29b-41d4-a716-446655440001');
    expect(result.team_name).toBe('Test Team');
    expect(result.user_id).toBe('550e8400-e29b-41d4-a716-446655440002');
    expect(result.user_name).toBe('Test User');
    expect(result.api_key).toBe('sk_test_xxxxx');
    expect(result.api_endpoint).toBe('https://api.contextor.co');
  });

  it('parses token with custom values', () => {
    const token = createTestToken({
      project_name: 'Custom Project',
      team_name: 'Custom Team',
    });
    const result = parseToken(token);

    expect(result.project_name).toBe('Custom Project');
    expect(result.team_name).toBe('Custom Team');
  });

  it('throws TokenParseError for missing prefix', () => {
    expect(() => parseToken('invalidtoken')).toThrow(TokenParseError);
    expect(() => parseToken('invalidtoken')).toThrow(
      'Invalid install token. Please copy it again from the dashboard.'
    );
  });

  it('throws TokenParseError for empty string', () => {
    expect(() => parseToken('')).toThrow(TokenParseError);
  });

  it('throws TokenParseError for invalid base64', () => {
    expect(() => parseToken('ctx_!!!invalid-base64!!!')).toThrow(TokenParseError);
  });

  it('throws TokenParseError for invalid JSON', () => {
    const invalidJson = Buffer.from('not-json').toString('base64');
    expect(() => parseToken(`ctx_${invalidJson}`)).toThrow(TokenParseError);
  });

  it('throws TokenParseError for missing required fields', () => {
    const incompletePayload = { project_id: '550e8400-e29b-41d4-a716-446655440000' };
    const token = 'ctx_' + Buffer.from(JSON.stringify(incompletePayload)).toString('base64');
    expect(() => parseToken(token)).toThrow(TokenParseError);
  });

  it('throws TokenParseError for invalid UUID', () => {
    const invalidPayload = {
      project_id: 'not-a-uuid',
      project_name: 'Test',
      team_id: '550e8400-e29b-41d4-a716-446655440001',
      team_name: 'Test Team',
      user_id: '550e8400-e29b-41d4-a716-446655440002',
      user_name: 'Test User',
      api_key: 'sk_test',
      api_endpoint: 'https://api.contextor.co',
    };
    const token = 'ctx_' + Buffer.from(JSON.stringify(invalidPayload)).toString('base64');
    expect(() => parseToken(token)).toThrow(TokenParseError);
  });

  it('throws TokenParseError for invalid URL', () => {
    const invalidPayload = {
      project_id: '550e8400-e29b-41d4-a716-446655440000',
      project_name: 'Test',
      team_id: '550e8400-e29b-41d4-a716-446655440001',
      team_name: 'Test Team',
      user_id: '550e8400-e29b-41d4-a716-446655440002',
      user_name: 'Test User',
      api_key: 'sk_test',
      api_endpoint: 'not-a-url',
    };
    const token = 'ctx_' + Buffer.from(JSON.stringify(invalidPayload)).toString('base64');
    expect(() => parseToken(token)).toThrow(TokenParseError);
  });
});

describe('isTokenExpired', () => {
  it('returns false when no expires_at', () => {
    const token: InstallToken = {
      project_id: '550e8400-e29b-41d4-a716-446655440000',
      project_name: 'Test',
      team_id: '550e8400-e29b-41d4-a716-446655440001',
      team_name: 'Test',
      user_id: '550e8400-e29b-41d4-a716-446655440002',
      user_name: 'Test',
      api_key: 'sk_test',
      api_endpoint: 'https://api.contextor.co',
    };
    expect(isTokenExpired(token)).toBe(false);
  });

  it('returns true for past date', () => {
    const token: InstallToken = {
      project_id: '550e8400-e29b-41d4-a716-446655440000',
      project_name: 'Test',
      team_id: '550e8400-e29b-41d4-a716-446655440001',
      team_name: 'Test',
      user_id: '550e8400-e29b-41d4-a716-446655440002',
      user_name: 'Test',
      api_key: 'sk_test',
      api_endpoint: 'https://api.contextor.co',
      expires_at: '2020-01-01T00:00:00.000Z',
    };
    expect(isTokenExpired(token)).toBe(true);
  });

  it('returns false for future date', () => {
    const token: InstallToken = {
      project_id: '550e8400-e29b-41d4-a716-446655440000',
      project_name: 'Test',
      team_id: '550e8400-e29b-41d4-a716-446655440001',
      team_name: 'Test',
      user_id: '550e8400-e29b-41d4-a716-446655440002',
      user_name: 'Test',
      api_key: 'sk_test',
      api_endpoint: 'https://api.contextor.co',
      expires_at: '2099-01-01T00:00:00.000Z',
    };
    expect(isTokenExpired(token)).toBe(false);
  });
});

describe('createTestToken', () => {
  it('creates a valid token', () => {
    const token = createTestToken();
    expect(token.startsWith('ctx_')).toBe(true);
    // Should be parseable
    const parsed = parseToken(token);
    expect(parsed.project_id).toBeDefined();
  });

  it('applies overrides', () => {
    const token = createTestToken({ project_name: 'Override Project' });
    const parsed = parseToken(token);
    expect(parsed.project_name).toBe('Override Project');
  });
});
