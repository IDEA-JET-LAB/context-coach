/**
 * Active Time Calculator Tests - Story 31-3
 */

import { describe, it, expect } from 'vitest';
import {
  calculateSessionActiveTime,
  calculateProjectActiveTime,
  getStageTimeMap,
  findDominantStage,
  calculatePromptsPerHour,
  DEFAULT_GAP_THRESHOLD_MINUTES,
  DEFAULT_MIN_PROMPT_MINUTES,
  type PromptWithStage,
  type SessionTimeResult,
} from '../active-time-calculator';
import type { ProjectStage } from '@/lib/types/conversations';

describe('active-time-calculator', () => {
  // Helper to create test prompts with timestamps
  function createPrompt(
    id: string,
    stage: ProjectStage,
    minutesFromStart: number,
    baseTime = new Date('2025-01-14T10:00:00Z')
  ): PromptWithStage {
    const timestamp = new Date(
      baseTime.getTime() + minutesFromStart * 60 * 1000
    );
    return {
      id,
      timestamp: timestamp.toISOString(),
      detectedStage: stage,
    };
  }

  // Helper to create prompts with specific timestamps
  function createPromptAt(
    id: string,
    stage: ProjectStage,
    isoTimestamp: string
  ): PromptWithStage {
    return {
      id,
      timestamp: isoTimestamp,
      detectedStage: stage,
    };
  }

  describe('calculateSessionActiveTime', () => {
    describe('edge cases', () => {
      it('should return empty result for empty input', () => {
        const result = calculateSessionActiveTime('session-1', []);

        expect(result.sessionId).toBe('session-1');
        expect(result.totalActiveMinutes).toBe(0);
        expect(result.totalPrompts).toBe(0);
        expect(result.gapsExcluded).toBe(0);
        expect(result.totalGapMinutes).toBe(0);
        expect(result.stages).toEqual([]);
        expect(result.segments).toEqual([]);
      });

      it('should return empty result for null input', () => {
        const result = calculateSessionActiveTime('session-1', null as any);

        expect(result.totalActiveMinutes).toBe(0);
        expect(result.totalPrompts).toBe(0);
      });

      it('should return empty result for undefined input', () => {
        const result = calculateSessionActiveTime('session-1', undefined as any);

        expect(result.totalActiveMinutes).toBe(0);
        expect(result.totalPrompts).toBe(0);
      });

      it('should handle single prompt with minimum time', () => {
        const prompts = [createPrompt('1', 'development', 0)];
        const result = calculateSessionActiveTime('session-1', prompts);

        expect(result.totalActiveMinutes).toBe(DEFAULT_MIN_PROMPT_MINUTES);
        expect(result.totalPrompts).toBe(1);
        expect(result.gapsExcluded).toBe(0);
        expect(result.stages).toHaveLength(1);
        expect(result.stages[0].stage).toBe('development');
        expect(result.stages[0].activeMinutes).toBe(DEFAULT_MIN_PROMPT_MINUTES);
        expect(result.stages[0].percentage).toBe(100);
        expect(result.segments).toHaveLength(1);
      });
    });

    describe('gap detection', () => {
      it('should include time for gap of 29 minutes (below threshold)', () => {
        const prompts = [
          createPrompt('1', 'development', 0),
          createPrompt('2', 'development', 29),
        ];

        const result = calculateSessionActiveTime('session-1', prompts);

        expect(result.gapsExcluded).toBe(0);
        expect(result.totalGapMinutes).toBe(0);
        // 29 minutes between prompts + min time for last prompt
        expect(result.totalActiveMinutes).toBeGreaterThanOrEqual(29);
      });

      it('should include time for gap of exactly 30 minutes (at threshold)', () => {
        const prompts = [
          createPrompt('1', 'development', 0),
          createPrompt('2', 'development', 30),
        ];

        const result = calculateSessionActiveTime('session-1', prompts);

        expect(result.gapsExcluded).toBe(0);
        expect(result.totalGapMinutes).toBe(0);
        expect(result.totalActiveMinutes).toBeGreaterThanOrEqual(30);
      });

      it('should exclude time for gap of 31 minutes (above threshold)', () => {
        const prompts = [
          createPrompt('1', 'development', 0),
          createPrompt('2', 'development', 31),
        ];

        const result = calculateSessionActiveTime('session-1', prompts);

        expect(result.gapsExcluded).toBe(1);
        expect(result.totalGapMinutes).toBe(31);
        // Should have minimum time for each segment (2 segments)
        expect(result.totalActiveMinutes).toBe(DEFAULT_MIN_PROMPT_MINUTES * 2);
        expect(result.segments).toHaveLength(2);
      });

      it('should use custom gap threshold', () => {
        const prompts = [
          createPrompt('1', 'development', 0),
          createPrompt('2', 'development', 15),
          createPrompt('3', 'development', 30),
        ];

        // With 10-minute threshold, the 15-minute gap should be excluded
        const result = calculateSessionActiveTime('session-1', prompts, {
          gapThresholdMinutes: 10,
        });

        expect(result.gapsExcluded).toBe(2);
      });

      it('should handle multiple gaps in a session', () => {
        const prompts = [
          createPrompt('1', 'development', 0),
          createPrompt('2', 'development', 5),
          createPrompt('3', 'development', 60), // 55 min gap - excluded
          createPrompt('4', 'development', 65),
          createPrompt('5', 'development', 120), // 55 min gap - excluded
          createPrompt('6', 'development', 125),
        ];

        const result = calculateSessionActiveTime('session-1', prompts);

        expect(result.gapsExcluded).toBe(2);
        expect(result.totalGapMinutes).toBe(110); // 55 + 55
        expect(result.segments).toHaveLength(3);
      });

      it('should handle all gaps scenario (all prompts > threshold apart)', () => {
        const prompts = [
          createPrompt('1', 'development', 0),
          createPrompt('2', 'development', 60),
          createPrompt('3', 'development', 120),
        ];

        const result = calculateSessionActiveTime('session-1', prompts);

        expect(result.gapsExcluded).toBe(2);
        expect(result.totalPrompts).toBe(3);
        // Each prompt creates its own segment with min time
        expect(result.segments).toHaveLength(3);
        expect(result.totalActiveMinutes).toBe(DEFAULT_MIN_PROMPT_MINUTES * 3);
      });
    });

    describe('stage transitions', () => {
      it('should track stage transitions within threshold', () => {
        const prompts = [
          createPrompt('1', 'development', 0),
          createPrompt('2', 'development', 10),
          createPrompt('3', 'debugging', 20),
          createPrompt('4', 'debugging', 25),
        ];

        const result = calculateSessionActiveTime('session-1', prompts);

        expect(result.gapsExcluded).toBe(0);
        expect(result.stages).toHaveLength(2);

        const devStage = result.stages.find((s) => s.stage === 'development');
        const debugStage = result.stages.find((s) => s.stage === 'debugging');

        expect(devStage).toBeDefined();
        expect(debugStage).toBeDefined();
        expect(devStage!.promptCount).toBe(2);
        expect(debugStage!.promptCount).toBe(2);
      });

      it('should create separate segments for each stage', () => {
        const prompts = [
          createPrompt('1', 'development', 0),
          createPrompt('2', 'development', 5),
          createPrompt('3', 'testing', 10),
          createPrompt('4', 'testing', 15),
        ];

        const result = calculateSessionActiveTime('session-1', prompts);

        expect(result.segments).toHaveLength(2);
        expect(result.segments[0].stage).toBe('development');
        expect(result.segments[1].stage).toBe('testing');
      });

      it('should handle rapid stage transitions', () => {
        const prompts = [
          createPrompt('1', 'planning', 0),
          createPrompt('2', 'development', 2),
          createPrompt('3', 'debugging', 4),
          createPrompt('4', 'testing', 6),
        ];

        const result = calculateSessionActiveTime('session-1', prompts);

        expect(result.segments).toHaveLength(4);
        expect(result.stages).toHaveLength(4);
      });

      it('should handle returning to previous stage', () => {
        const prompts = [
          createPrompt('1', 'development', 0),
          createPrompt('2', 'debugging', 5),
          createPrompt('3', 'development', 10),
        ];

        const result = calculateSessionActiveTime('session-1', prompts);

        expect(result.segments).toHaveLength(3);

        const devStage = result.stages.find((s) => s.stage === 'development');
        expect(devStage!.promptCount).toBe(2);
      });
    });

    describe('time calculation', () => {
      it('should calculate active minutes correctly', () => {
        const prompts = [
          createPrompt('1', 'development', 0),
          createPrompt('2', 'development', 10),
          createPrompt('3', 'development', 20),
        ];

        const result = calculateSessionActiveTime('session-1', prompts);

        // 10 + 10 = 20 minutes between prompts, + min time for last prompt
        expect(result.totalActiveMinutes).toBeGreaterThanOrEqual(20);
        expect(result.totalActiveMinutes).toBeLessThan(25);
      });

      it('should calculate percentages correctly', () => {
        const prompts = [
          createPrompt('1', 'development', 0),
          createPrompt('2', 'development', 10),
          createPrompt('3', 'debugging', 20),
          createPrompt('4', 'debugging', 30),
        ];

        const result = calculateSessionActiveTime('session-1', prompts);

        const totalPercentage = result.stages.reduce(
          (sum, s) => sum + s.percentage,
          0
        );
        expect(totalPercentage).toBeGreaterThanOrEqual(98);
        expect(totalPercentage).toBeLessThanOrEqual(102);
      });

      it('should use custom minimum prompt time', () => {
        const prompts = [createPrompt('1', 'development', 0)];

        const result = calculateSessionActiveTime('session-1', prompts, {
          minPromptMinutes: 5,
        });

        expect(result.totalActiveMinutes).toBe(5);
      });

      it('should sort prompts by timestamp regardless of input order', () => {
        const prompts = [
          createPrompt('3', 'testing', 20),
          createPrompt('1', 'development', 0),
          createPrompt('2', 'debugging', 10),
        ];

        const result = calculateSessionActiveTime('session-1', prompts);

        expect(result.segments[0].stage).toBe('development');
        expect(result.segments[1].stage).toBe('debugging');
        expect(result.segments[2].stage).toBe('testing');
      });
    });

    describe('segments', () => {
      it('should track prompt IDs in segments', () => {
        const prompts = [
          createPrompt('p1', 'development', 0),
          createPrompt('p2', 'development', 5),
          createPrompt('p3', 'development', 10),
        ];

        const result = calculateSessionActiveTime('session-1', prompts);

        expect(result.segments).toHaveLength(1);
        expect(result.segments[0].promptIds).toEqual(['p1', 'p2', 'p3']);
        expect(result.segments[0].promptCount).toBe(3);
      });

      it('should set correct start and end times for segments', () => {
        const baseTime = new Date('2025-01-14T10:00:00Z');
        const prompts = [
          createPrompt('1', 'development', 0, baseTime),
          createPrompt('2', 'development', 10, baseTime),
        ];

        const result = calculateSessionActiveTime('session-1', prompts);

        expect(result.segments[0].startTime).toBe(baseTime.toISOString());
        expect(result.segments[0].endTime).toBe(
          new Date(baseTime.getTime() + 10 * 60 * 1000).toISOString()
        );
      });

      it('should calculate segment duration correctly', () => {
        const prompts = [
          createPrompt('1', 'development', 0),
          createPrompt('2', 'development', 15),
        ];

        const result = calculateSessionActiveTime('session-1', prompts);

        expect(result.segments[0].durationMinutes).toBeGreaterThanOrEqual(15);
      });
    });

    describe('performance', () => {
      it('should process 1000 prompts in under 50ms', () => {
        const prompts: PromptWithStage[] = [];
        const stages: ProjectStage[] = [
          'development',
          'debugging',
          'testing',
          'deployment',
        ];

        for (let i = 0; i < 1000; i++) {
          prompts.push(
            createPrompt(
              `p${i}`,
              stages[i % stages.length],
              i * 2 // 2 minutes apart
            )
          );
        }

        const startTime = performance.now();
        const result = calculateSessionActiveTime('session-1', prompts);
        const endTime = performance.now();

        expect(endTime - startTime).toBeLessThan(50);
        expect(result.totalPrompts).toBe(1000);
      });
    });

    describe('real-world scenarios', () => {
      it('should handle typical development session with lunch break', () => {
        const prompts = [
          // Morning session
          createPrompt('1', 'development', 0),
          createPrompt('2', 'development', 5),
          createPrompt('3', 'development', 10),
          createPrompt('4', 'debugging', 20),
          createPrompt('5', 'debugging', 25),
          // Lunch break - 90 minutes
          createPrompt('6', 'development', 115),
          createPrompt('7', 'development', 120),
          createPrompt('8', 'testing', 130),
        ];

        const result = calculateSessionActiveTime('session-1', prompts);

        expect(result.gapsExcluded).toBe(1); // Lunch break
        expect(result.totalGapMinutes).toBe(90);
        expect(result.stages.length).toBeGreaterThanOrEqual(3);
      });

      it('should handle session with multiple short breaks', () => {
        const prompts = [
          createPrompt('1', 'development', 0),
          createPrompt('2', 'development', 35), // 35 min gap - excluded
          createPrompt('3', 'development', 40),
          createPrompt('4', 'development', 80), // 40 min gap - excluded
          createPrompt('5', 'development', 85),
        ];

        const result = calculateSessionActiveTime('session-1', prompts);

        expect(result.gapsExcluded).toBe(2);
        expect(result.segments).toHaveLength(3);
      });
    });
  });

  describe('calculateProjectActiveTime', () => {
    // Helper to create mock session results
    function createSessionResult(
      sessionId: string,
      activeMinutes: number,
      prompts: number,
      stages: { stage: ProjectStage; minutes: number; prompts: number }[]
    ): SessionTimeResult {
      const stageBreakdowns = stages.map((s) => ({
        stage: s.stage,
        activeMinutes: s.minutes,
        promptCount: s.prompts,
        percentage: Math.round((s.minutes / activeMinutes) * 100),
        gapsExcluded: 0,
      }));

      return {
        sessionId,
        totalActiveMinutes: activeMinutes,
        totalPrompts: prompts,
        gapsExcluded: 0,
        totalGapMinutes: 0,
        stages: stageBreakdowns,
        segments: [],
      };
    }

    it('should return empty result for empty input', () => {
      const result = calculateProjectActiveTime([]);

      expect(result.totalActiveMinutes).toBe(0);
      expect(result.totalPrompts).toBe(0);
      expect(result.sessionCount).toBe(0);
      expect(result.stages).toEqual([]);
      expect(result.averageSessionMinutes).toBe(0);
    });

    it('should return empty result for null/undefined input', () => {
      expect(calculateProjectActiveTime(null as any).totalActiveMinutes).toBe(0);
      expect(calculateProjectActiveTime(undefined as any).totalActiveMinutes).toBe(0);
    });

    it('should aggregate single session correctly', () => {
      const sessions = [
        createSessionResult('s1', 60, 10, [
          { stage: 'development', minutes: 40, prompts: 7 },
          { stage: 'debugging', minutes: 20, prompts: 3 },
        ]),
      ];

      const result = calculateProjectActiveTime(sessions);

      expect(result.totalActiveMinutes).toBe(60);
      expect(result.totalPrompts).toBe(10);
      expect(result.sessionCount).toBe(1);
      expect(result.averageSessionMinutes).toBe(60);
    });

    it('should aggregate multiple sessions correctly', () => {
      const sessions = [
        createSessionResult('s1', 60, 10, [
          { stage: 'development', minutes: 40, prompts: 7 },
          { stage: 'debugging', minutes: 20, prompts: 3 },
        ]),
        createSessionResult('s2', 90, 15, [
          { stage: 'development', minutes: 60, prompts: 10 },
          { stage: 'testing', minutes: 30, prompts: 5 },
        ]),
      ];

      const result = calculateProjectActiveTime(sessions);

      expect(result.totalActiveMinutes).toBe(150);
      expect(result.totalPrompts).toBe(25);
      expect(result.sessionCount).toBe(2);
      expect(result.averageSessionMinutes).toBe(75);
    });

    it('should merge same stages from different sessions', () => {
      const sessions = [
        createSessionResult('s1', 60, 10, [
          { stage: 'development', minutes: 60, prompts: 10 },
        ]),
        createSessionResult('s2', 40, 5, [
          { stage: 'development', minutes: 40, prompts: 5 },
        ]),
      ];

      const result = calculateProjectActiveTime(sessions);

      expect(result.stages).toHaveLength(1);
      expect(result.stages[0].stage).toBe('development');
      expect(result.stages[0].activeMinutes).toBe(100);
      expect(result.stages[0].promptCount).toBe(15);
      expect(result.stages[0].percentage).toBe(100);
    });

    it('should calculate correct percentages across sessions', () => {
      const sessions = [
        createSessionResult('s1', 100, 10, [
          { stage: 'development', minutes: 50, prompts: 5 },
          { stage: 'debugging', minutes: 50, prompts: 5 },
        ]),
        createSessionResult('s2', 100, 10, [
          { stage: 'development', minutes: 100, prompts: 10 },
        ]),
      ];

      const result = calculateProjectActiveTime(sessions);

      const devStage = result.stages.find((s) => s.stage === 'development');
      const debugStage = result.stages.find((s) => s.stage === 'debugging');

      expect(devStage!.activeMinutes).toBe(150);
      expect(devStage!.percentage).toBe(75);
      expect(debugStage!.activeMinutes).toBe(50);
      expect(debugStage!.percentage).toBe(25);
    });

    it('should sort stages by active minutes descending', () => {
      const sessions = [
        createSessionResult('s1', 100, 10, [
          { stage: 'testing', minutes: 10, prompts: 1 },
          { stage: 'development', minutes: 60, prompts: 6 },
          { stage: 'debugging', minutes: 30, prompts: 3 },
        ]),
      ];

      const result = calculateProjectActiveTime(sessions);

      expect(result.stages[0].stage).toBe('development');
      expect(result.stages[1].stage).toBe('debugging');
      expect(result.stages[2].stage).toBe('testing');
    });

    it('should aggregate gaps from all sessions', () => {
      const sessions: SessionTimeResult[] = [
        {
          sessionId: 's1',
          totalActiveMinutes: 60,
          totalPrompts: 10,
          gapsExcluded: 2,
          totalGapMinutes: 120,
          stages: [],
          segments: [],
        },
        {
          sessionId: 's2',
          totalActiveMinutes: 40,
          totalPrompts: 5,
          gapsExcluded: 1,
          totalGapMinutes: 45,
          stages: [],
          segments: [],
        },
      ];

      const result = calculateProjectActiveTime(sessions);

      expect(result.totalGapsExcluded).toBe(3);
      expect(result.totalGapMinutes).toBe(165);
    });
  });

  describe('getStageTimeMap', () => {
    it('should create map from session result', () => {
      const prompts = [
        createPrompt('1', 'development', 0),
        createPrompt('2', 'development', 10),
        createPrompt('3', 'debugging', 20),
      ];

      const result = calculateSessionActiveTime('session-1', prompts);
      const map = getStageTimeMap(result);

      expect(map.has('development')).toBe(true);
      expect(map.has('debugging')).toBe(true);
      expect(map.get('development')).toBeGreaterThan(0);
    });

    it('should return empty map for empty result', () => {
      const result = calculateSessionActiveTime('session-1', []);
      const map = getStageTimeMap(result);

      expect(map.size).toBe(0);
    });
  });

  describe('findDominantStage', () => {
    it('should return the stage with most active time', () => {
      const prompts = [
        createPrompt('1', 'debugging', 0),
        createPrompt('2', 'development', 5),
        createPrompt('3', 'development', 10),
        createPrompt('4', 'development', 15),
      ];

      const result = calculateSessionActiveTime('session-1', prompts);
      const dominant = findDominantStage(result);

      expect(dominant).toBe('development');
    });

    it('should return null for empty result', () => {
      const result = calculateSessionActiveTime('session-1', []);
      expect(findDominantStage(result)).toBeNull();
    });
  });

  describe('calculatePromptsPerHour', () => {
    it('should calculate prompts per hour correctly', () => {
      const prompts: PromptWithStage[] = [];
      for (let i = 0; i < 30; i++) {
        prompts.push(createPrompt(`p${i}`, 'development', i * 2));
      }

      const result = calculateSessionActiveTime('session-1', prompts);
      const pph = calculatePromptsPerHour(result);

      // ~58 minutes, 30 prompts = ~31 prompts per hour
      expect(pph).toBeGreaterThan(25);
      expect(pph).toBeLessThan(35);
    });

    it('should return 0 for empty result', () => {
      const result = calculateSessionActiveTime('session-1', []);
      expect(calculatePromptsPerHour(result)).toBe(0);
    });

    it('should handle very short sessions', () => {
      const prompts = [createPrompt('1', 'development', 0)];

      const result = calculateSessionActiveTime('session-1', prompts);
      const pph = calculatePromptsPerHour(result);

      // 1 prompt in 1 minute = 60 prompts per hour
      expect(pph).toBe(60);
    });
  });

  describe('constants', () => {
    it('should have correct default gap threshold', () => {
      expect(DEFAULT_GAP_THRESHOLD_MINUTES).toBe(30);
    });

    it('should have correct default minimum prompt time', () => {
      expect(DEFAULT_MIN_PROMPT_MINUTES).toBe(1);
    });
  });

  describe('prompt count accuracy', () => {
    it('should count prompts correctly with stage transitions', () => {
      const prompts = [
        createPrompt('1', 'development', 0),
        createPrompt('2', 'development', 5),
        createPrompt('3', 'debugging', 10),
        createPrompt('4', 'debugging', 15),
        createPrompt('5', 'development', 20),
      ];

      const result = calculateSessionActiveTime('session-1', prompts);

      expect(result.totalPrompts).toBe(5);

      const devStage = result.stages.find((s) => s.stage === 'development');
      const debugStage = result.stages.find((s) => s.stage === 'debugging');

      expect(devStage!.promptCount).toBe(3); // prompts 1, 2, 5
      expect(debugStage!.promptCount).toBe(2); // prompts 3, 4
    });

    it('should count prompts correctly with gaps', () => {
      const prompts = [
        createPrompt('1', 'development', 0),
        createPrompt('2', 'development', 5),
        createPrompt('3', 'development', 60), // gap excluded
        createPrompt('4', 'development', 65),
      ];

      const result = calculateSessionActiveTime('session-1', prompts);

      expect(result.totalPrompts).toBe(4);
      expect(result.stages[0].promptCount).toBe(4);
    });

    it('should count prompts correctly with gaps and stage transitions', () => {
      const prompts = [
        createPrompt('1', 'development', 0),
        createPrompt('2', 'debugging', 60), // gap excluded, stage change
        createPrompt('3', 'debugging', 65),
      ];

      const result = calculateSessionActiveTime('session-1', prompts);

      expect(result.totalPrompts).toBe(3);

      const devStage = result.stages.find((s) => s.stage === 'development');
      const debugStage = result.stages.find((s) => s.stage === 'debugging');

      expect(devStage!.promptCount).toBe(1);
      expect(debugStage!.promptCount).toBe(2);
    });
  });

  describe('edge case: exactly at threshold boundary', () => {
    it('should include gap at exactly threshold', () => {
      const prompts = [
        createPrompt('1', 'development', 0),
        createPrompt('2', 'development', 30), // exactly at threshold - included
      ];

      const result = calculateSessionActiveTime('session-1', prompts);

      expect(result.gapsExcluded).toBe(0);
      expect(result.totalActiveMinutes).toBeGreaterThanOrEqual(30);
    });

    it('should exclude gap just over threshold', () => {
      const prompts = [
        createPrompt('1', 'development', 0),
        createPrompt('2', 'development', 30.01), // just over threshold
      ];

      // Using milliseconds for precision
      const baseTime = new Date('2025-01-14T10:00:00.000Z');
      const prompt1: PromptWithStage = {
        id: '1',
        timestamp: baseTime.toISOString(),
        detectedStage: 'development',
      };
      const prompt2: PromptWithStage = {
        id: '2',
        timestamp: new Date(baseTime.getTime() + 30.1 * 60 * 1000).toISOString(),
        detectedStage: 'development',
      };

      const result = calculateSessionActiveTime('session-1', [prompt1, prompt2]);

      expect(result.gapsExcluded).toBe(1);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete project lifecycle', () => {
      // Session 1: Planning and initial development
      const session1Prompts = [
        createPrompt('1-1', 'planning', 0),
        createPrompt('1-2', 'planning', 5),
        createPrompt('1-3', 'development', 15),
        createPrompt('1-4', 'development', 25),
      ];

      // Session 2: Development and debugging
      const session2Prompts = [
        createPrompt('2-1', 'development', 0),
        createPrompt('2-2', 'development', 10),
        createPrompt('2-3', 'debugging', 20),
        createPrompt('2-4', 'debugging', 30),
      ];

      // Session 3: Testing and deployment
      const session3Prompts = [
        createPrompt('3-1', 'testing', 0),
        createPrompt('3-2', 'testing', 15),
        createPrompt('3-3', 'deployment', 25),
      ];

      const sessionResults = [
        calculateSessionActiveTime('session-1', session1Prompts),
        calculateSessionActiveTime('session-2', session2Prompts),
        calculateSessionActiveTime('session-3', session3Prompts),
      ];

      const projectResult = calculateProjectActiveTime(sessionResults);

      expect(projectResult.sessionCount).toBe(3);
      expect(projectResult.totalPrompts).toBe(11);
      expect(projectResult.stages.length).toBeGreaterThanOrEqual(5);

      // Verify all stages are represented
      const stageNames = projectResult.stages.map((s) => s.stage);
      expect(stageNames).toContain('planning');
      expect(stageNames).toContain('development');
      expect(stageNames).toContain('debugging');
      expect(stageNames).toContain('testing');
      expect(stageNames).toContain('deployment');
    });

    it('should handle realistic timestamps', () => {
      const prompts = [
        createPromptAt('1', 'development', '2025-01-14T09:00:00.000Z'),
        createPromptAt('2', 'development', '2025-01-14T09:05:30.500Z'),
        createPromptAt('3', 'development', '2025-01-14T09:12:15.250Z'),
        createPromptAt('4', 'debugging', '2025-01-14T09:20:00.000Z'),
        createPromptAt('5', 'debugging', '2025-01-14T09:28:45.750Z'),
      ];

      const result = calculateSessionActiveTime('session-1', prompts);

      expect(result.totalPrompts).toBe(5);
      expect(result.gapsExcluded).toBe(0);
      expect(result.totalActiveMinutes).toBeGreaterThan(20);
      expect(result.totalActiveMinutes).toBeLessThan(35);
    });
  });
});
