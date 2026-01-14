/**
 * Unit tests for Stage Summary Service - Story 31-4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildStageSummary,
  determinePrimaryStage,
  createBreakdownFromTimeResult,
  type StageSummaryInput,
  type SessionStageBreakdown,
} from '../stage-summary';
import type { StageDetectionResult } from '../stage-detector';
import type { SessionTimeResult } from '../active-time-calculator';

// Mock the Supabase admin client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  })),
}));

// Mock the logger
vi.mock('@/lib/utils/logger', () => ({
  createScopedLogger: vi.fn(() => ({
    debug: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

describe('Stage Summary Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildStageSummary', () => {
    it('should build summary from detection results and prompts', () => {
      const now = new Date();
      const prompts = [
        { id: 'p1', created_at: now.toISOString() },
        { id: 'p2', created_at: new Date(now.getTime() + 5 * 60000).toISOString() },
        { id: 'p3', created_at: new Date(now.getTime() + 10 * 60000).toISOString() },
      ];

      const detectionResults: StageDetectionResult[] = [
        {
          promptId: 'p1',
          detectedStage: 'planning',
          confidence: 0.9,
          matchedPatterns: ['plan'],
          isTransitionPoint: false,
          previousStage: null,
        },
        {
          promptId: 'p2',
          detectedStage: 'planning',
          confidence: 0.9,
          matchedPatterns: [],
          isTransitionPoint: false,
          previousStage: 'planning',
        },
        {
          promptId: 'p3',
          detectedStage: 'development',
          confidence: 0.85,
          matchedPatterns: ['implement'],
          isTransitionPoint: true,
          previousStage: 'planning',
        },
      ];

      const input: StageSummaryInput = {
        sessionId: 'test-session-1',
        detectionResults,
        prompts,
      };

      const result = buildStageSummary(input);

      expect(result).toHaveProperty('stages');
      expect(result).toHaveProperty('totalActiveMinutes');
      expect(result).toHaveProperty('totalPrompts');
      expect(result).toHaveProperty('transitionCount');
      expect(result).toHaveProperty('gapsExcluded');
      expect(result).toHaveProperty('analyzedAt');

      // Check total prompts
      expect(result.totalPrompts).toBe(3);

      // Check transition count (only p3 has isTransitionPoint: true)
      expect(result.transitionCount).toBe(1);

      // Check stages are present
      expect(result.stages).toHaveProperty('planning');
      expect(result.stages).toHaveProperty('development');

      // Check analyzedAt is a valid ISO string
      expect(new Date(result.analyzedAt).toISOString()).toBe(result.analyzedAt);
    });

    it('should handle empty detection results', () => {
      const input: StageSummaryInput = {
        sessionId: 'test-session-2',
        detectionResults: [],
        prompts: [],
      };

      const result = buildStageSummary(input);

      expect(result.totalPrompts).toBe(0);
      expect(result.totalActiveMinutes).toBe(0);
      expect(result.transitionCount).toBe(0);
      expect(result.gapsExcluded).toBe(0);
      expect(Object.keys(result.stages)).toHaveLength(0);
    });

    it('should handle single prompt', () => {
      const now = new Date();
      const prompts = [{ id: 'p1', created_at: now.toISOString() }];

      const detectionResults: StageDetectionResult[] = [
        {
          promptId: 'p1',
          detectedStage: 'debugging',
          confidence: 0.85,
          matchedPatterns: ['fix'],
          isTransitionPoint: false,
          previousStage: null,
        },
      ];

      const input: StageSummaryInput = {
        sessionId: 'test-session-3',
        detectionResults,
        prompts,
      };

      const result = buildStageSummary(input);

      expect(result.totalPrompts).toBe(1);
      expect(result.totalActiveMinutes).toBeGreaterThan(0); // At least min prompt time
      expect(result.transitionCount).toBe(0);
      expect(result.stages).toHaveProperty('debugging');
    });

    it('should count multiple transitions correctly', () => {
      const now = new Date();
      const prompts = [
        { id: 'p1', created_at: now.toISOString() },
        { id: 'p2', created_at: new Date(now.getTime() + 5 * 60000).toISOString() },
        { id: 'p3', created_at: new Date(now.getTime() + 10 * 60000).toISOString() },
        { id: 'p4', created_at: new Date(now.getTime() + 15 * 60000).toISOString() },
      ];

      const detectionResults: StageDetectionResult[] = [
        {
          promptId: 'p1',
          detectedStage: 'planning',
          confidence: 0.9,
          matchedPatterns: ['plan'],
          isTransitionPoint: false,
          previousStage: null,
        },
        {
          promptId: 'p2',
          detectedStage: 'development',
          confidence: 0.85,
          matchedPatterns: ['implement'],
          isTransitionPoint: true,
          previousStage: 'planning',
        },
        {
          promptId: 'p3',
          detectedStage: 'testing',
          confidence: 0.9,
          matchedPatterns: ['test'],
          isTransitionPoint: true,
          previousStage: 'development',
        },
        {
          promptId: 'p4',
          detectedStage: 'debugging',
          confidence: 0.85,
          matchedPatterns: ['fix'],
          isTransitionPoint: true,
          previousStage: 'testing',
        },
      ];

      const input: StageSummaryInput = {
        sessionId: 'test-session-4',
        detectionResults,
        prompts,
      };

      const result = buildStageSummary(input);

      expect(result.transitionCount).toBe(3);
      expect(Object.keys(result.stages)).toHaveLength(4);
    });

    it('should handle prompts with missing timestamps gracefully', () => {
      const detectionResults: StageDetectionResult[] = [
        {
          promptId: 'p1',
          detectedStage: 'development',
          confidence: 0.85,
          matchedPatterns: ['implement'],
          isTransitionPoint: false,
          previousStage: null,
        },
      ];

      const input: StageSummaryInput = {
        sessionId: 'test-session-5',
        detectionResults,
        prompts: [{ id: 'p1', created_at: '' }], // Empty timestamp
      };

      // Should not throw
      const result = buildStageSummary(input);
      expect(result.totalPrompts).toBe(1);
    });
  });

  describe('determinePrimaryStage', () => {
    it('should return stage with most active minutes', () => {
      const breakdown: SessionStageBreakdown = {
        stages: {
          planning: { promptCount: 5, activeMinutes: 10, percentage: 20 },
          development: { promptCount: 10, activeMinutes: 30, percentage: 60 },
          debugging: { promptCount: 3, activeMinutes: 10, percentage: 20 },
        },
        totalActiveMinutes: 50,
        totalPrompts: 18,
        transitionCount: 2,
        gapsExcluded: 0,
        analyzedAt: new Date().toISOString(),
      };

      const primaryStage = determinePrimaryStage(breakdown);
      expect(primaryStage).toBe('development');
    });

    it('should return unknown for empty breakdown', () => {
      const breakdown: SessionStageBreakdown = {
        stages: {},
        totalActiveMinutes: 0,
        totalPrompts: 0,
        transitionCount: 0,
        gapsExcluded: 0,
        analyzedAt: new Date().toISOString(),
      };

      const primaryStage = determinePrimaryStage(breakdown);
      expect(primaryStage).toBe('unknown');
    });

    it('should handle tie by returning first highest', () => {
      const breakdown: SessionStageBreakdown = {
        stages: {
          planning: { promptCount: 5, activeMinutes: 20, percentage: 50 },
          development: { promptCount: 5, activeMinutes: 20, percentage: 50 },
        },
        totalActiveMinutes: 40,
        totalPrompts: 10,
        transitionCount: 1,
        gapsExcluded: 0,
        analyzedAt: new Date().toISOString(),
      };

      const primaryStage = determinePrimaryStage(breakdown);
      // One of them - depends on iteration order
      expect(['planning', 'development']).toContain(primaryStage);
    });

    it('should handle single stage', () => {
      const breakdown: SessionStageBreakdown = {
        stages: {
          debugging: { promptCount: 20, activeMinutes: 45, percentage: 100 },
        },
        totalActiveMinutes: 45,
        totalPrompts: 20,
        transitionCount: 0,
        gapsExcluded: 0,
        analyzedAt: new Date().toISOString(),
      };

      const primaryStage = determinePrimaryStage(breakdown);
      expect(primaryStage).toBe('debugging');
    });
  });

  describe('createBreakdownFromTimeResult', () => {
    it('should create breakdown from time result', () => {
      const timeResult: SessionTimeResult = {
        sessionId: 'test-session',
        totalActiveMinutes: 45,
        totalPrompts: 15,
        gapsExcluded: 1,
        totalGapMinutes: 35,
        stages: [
          { stage: 'development', activeMinutes: 30, promptCount: 10, percentage: 67, gapsExcluded: 1 },
          { stage: 'testing', activeMinutes: 15, promptCount: 5, percentage: 33, gapsExcluded: 0 },
        ],
        segments: [],
      };

      const breakdown = createBreakdownFromTimeResult(timeResult, 2);

      expect(breakdown.totalActiveMinutes).toBe(45);
      expect(breakdown.totalPrompts).toBe(15);
      expect(breakdown.transitionCount).toBe(2);
      expect(breakdown.gapsExcluded).toBe(1);
      expect(breakdown.stages).toHaveProperty('development');
      expect(breakdown.stages).toHaveProperty('testing');
      expect(breakdown.stages.development.activeMinutes).toBe(30);
      expect(breakdown.stages.testing.activeMinutes).toBe(15);
    });

    it('should handle empty time result', () => {
      const timeResult: SessionTimeResult = {
        sessionId: 'test-session',
        totalActiveMinutes: 0,
        totalPrompts: 0,
        gapsExcluded: 0,
        totalGapMinutes: 0,
        stages: [],
        segments: [],
      };

      const breakdown = createBreakdownFromTimeResult(timeResult, 0);

      expect(breakdown.totalActiveMinutes).toBe(0);
      expect(breakdown.totalPrompts).toBe(0);
      expect(breakdown.transitionCount).toBe(0);
      expect(Object.keys(breakdown.stages)).toHaveLength(0);
    });

    it('should include analyzedAt timestamp', () => {
      const timeResult: SessionTimeResult = {
        sessionId: 'test-session',
        totalActiveMinutes: 10,
        totalPrompts: 5,
        gapsExcluded: 0,
        totalGapMinutes: 0,
        stages: [
          { stage: 'planning', activeMinutes: 10, promptCount: 5, percentage: 100, gapsExcluded: 0 },
        ],
        segments: [],
      };

      const before = new Date().toISOString();
      const breakdown = createBreakdownFromTimeResult(timeResult, 0);
      const after = new Date().toISOString();

      expect(breakdown.analyzedAt).toBeDefined();
      expect(breakdown.analyzedAt >= before).toBe(true);
      expect(breakdown.analyzedAt <= after).toBe(true);
    });
  });

  describe('stage data percentages', () => {
    it('should include correct percentages in stage data', () => {
      const now = new Date();
      const prompts = [
        { id: 'p1', created_at: now.toISOString() },
        { id: 'p2', created_at: new Date(now.getTime() + 10 * 60000).toISOString() },
        { id: 'p3', created_at: new Date(now.getTime() + 20 * 60000).toISOString() },
      ];

      const detectionResults: StageDetectionResult[] = [
        {
          promptId: 'p1',
          detectedStage: 'development',
          confidence: 0.85,
          matchedPatterns: ['implement'],
          isTransitionPoint: false,
          previousStage: null,
        },
        {
          promptId: 'p2',
          detectedStage: 'development',
          confidence: 0.85,
          matchedPatterns: [],
          isTransitionPoint: false,
          previousStage: 'development',
        },
        {
          promptId: 'p3',
          detectedStage: 'development',
          confidence: 0.85,
          matchedPatterns: [],
          isTransitionPoint: false,
          previousStage: 'development',
        },
      ];

      const input: StageSummaryInput = {
        sessionId: 'test-session',
        detectionResults,
        prompts,
      };

      const result = buildStageSummary(input);

      // Single stage should have 100% percentage
      expect(result.stages.development.percentage).toBe(100);
    });
  });
});
