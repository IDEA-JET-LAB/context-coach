/**
 * Stage Patterns Tests - Story 31-1
 */

import { describe, it, expect } from 'vitest';
import {
  STAGE_PATTERNS,
  SLASH_COMMAND_STAGE_MAP,
  CONFIRMATION_PATTERNS,
  getStagesByPriority,
  isConfirmationPrompt,
  extractSlashCommand,
  isTooShortToClassify,
} from '../stage-patterns';
import type { ProjectStage } from '@/lib/types/conversations';

describe('stage-patterns', () => {
  describe('STAGE_PATTERNS', () => {
    it('should have patterns for all major stages', () => {
      const expectedStages: ProjectStage[] = [
        'planning',
        'architecture',
        'specification',
        'debugging',
        'deployment',
        'testing',
        'review',
        'refactoring',
        'documentation',
        'development',
        'implementation',
        'enhancement',
        'exploration',
        'unknown',
      ];

      for (const stage of expectedStages) {
        expect(STAGE_PATTERNS[stage]).toBeDefined();
        expect(STAGE_PATTERNS[stage].priority).toBeGreaterThanOrEqual(0);
        expect(STAGE_PATTERNS[stage].minConfidence).toBeGreaterThanOrEqual(0);
        expect(STAGE_PATTERNS[stage].minConfidence).toBeLessThanOrEqual(1);
      }
    });

    it('should have valid regex patterns', () => {
      for (const [stage, config] of Object.entries(STAGE_PATTERNS)) {
        for (const pattern of config.patterns) {
          expect(pattern).toBeInstanceOf(RegExp);
          // Ensure pattern doesn't throw on test
          expect(() => pattern.test('test string')).not.toThrow();
        }
      }
    });

    it('should have higher priority for urgent stages', () => {
      expect(STAGE_PATTERNS.planning.priority).toBeGreaterThan(
        STAGE_PATTERNS.development.priority
      );
      expect(STAGE_PATTERNS.debugging.priority).toBeGreaterThan(
        STAGE_PATTERNS.development.priority
      );
      expect(STAGE_PATTERNS.testing.priority).toBeGreaterThan(
        STAGE_PATTERNS.development.priority
      );
    });
  });

  describe('Pattern matching', () => {
    describe('planning patterns', () => {
      const patterns = STAGE_PATTERNS.planning.patterns;

      it('should match "let\'s plan"', () => {
        expect(patterns.some((p) => p.test("let's plan this feature"))).toBe(true);
      });

      it('should match "how should we"', () => {
        expect(patterns.some((p) => p.test('how should we approach this?'))).toBe(
          true
        );
      });

      it('should match "strategy"', () => {
        expect(patterns.some((p) => p.test("what's our strategy?"))).toBe(true);
      });

      it('should match "before we start"', () => {
        expect(
          patterns.some((p) => p.test('before we start, let me think'))
        ).toBe(true);
      });
    });

    describe('debugging patterns', () => {
      const patterns = STAGE_PATTERNS.debugging.patterns;

      it('should match "fix this bug"', () => {
        expect(patterns.some((p) => p.test('fix this bug please'))).toBe(true);
      });

      it('should match "error"', () => {
        expect(patterns.some((p) => p.test('I got an error'))).toBe(true);
      });

      it('should match "not working"', () => {
        expect(patterns.some((p) => p.test("this is not working"))).toBe(true);
      });

      it('should match "why is"', () => {
        expect(patterns.some((p) => p.test('why is this failing?'))).toBe(true);
      });

      it('should match "why doesn\'t"', () => {
        expect(patterns.some((p) => p.test("why doesn't this work?"))).toBe(true);
      });

      it('should match "debug"', () => {
        expect(patterns.some((p) => p.test('help me debug this'))).toBe(true);
      });

      it('should match "stuck"', () => {
        expect(patterns.some((p) => p.test("I'm stuck on this issue"))).toBe(true);
      });
    });

    describe('testing patterns', () => {
      const patterns = STAGE_PATTERNS.testing.patterns;

      it('should match "add tests"', () => {
        expect(patterns.some((p) => p.test('add tests for this'))).toBe(true);
      });

      it('should match "write unit tests"', () => {
        expect(patterns.some((p) => p.test('write unit tests'))).toBe(true);
      });

      it('should match "run e2e tests"', () => {
        expect(patterns.some((p) => p.test('run e2e tests'))).toBe(true);
      });

      it('should match "playwright"', () => {
        expect(patterns.some((p) => p.test('use playwright for this'))).toBe(true);
      });

      it('should match "jest"', () => {
        expect(patterns.some((p) => p.test('configure jest'))).toBe(true);
      });

      it('should match "npm test"', () => {
        expect(patterns.some((p) => p.test('run npm test'))).toBe(true);
      });

      it('should match ".spec.ts"', () => {
        expect(patterns.some((p) => p.test('create user.spec.ts'))).toBe(true);
      });
    });

    describe('deployment patterns', () => {
      const patterns = STAGE_PATTERNS.deployment.patterns;

      it('should match "deploy"', () => {
        expect(patterns.some((p) => p.test('deploy to production'))).toBe(true);
      });

      it('should match "release"', () => {
        expect(patterns.some((p) => p.test('create a new release'))).toBe(true);
      });

      it('should match "docker"', () => {
        expect(patterns.some((p) => p.test('build docker image'))).toBe(true);
      });

      it('should match "CI/CD"', () => {
        expect(patterns.some((p) => p.test('setup CI/CD pipeline'))).toBe(true);
      });

      it('should match "kubernetes"', () => {
        expect(patterns.some((p) => p.test('deploy to kubernetes'))).toBe(true);
      });
    });

    describe('development patterns', () => {
      const patterns = STAGE_PATTERNS.development.patterns;

      it('should match "implement feature"', () => {
        expect(patterns.some((p) => p.test('implement the auth feature'))).toBe(
          true
        );
      });

      it('should match "create component"', () => {
        expect(patterns.some((p) => p.test('create a new component'))).toBe(true);
      });

      it('should match "build service"', () => {
        expect(patterns.some((p) => p.test('build a service for this'))).toBe(
          true
        );
      });

      it('should match "add endpoint"', () => {
        expect(patterns.some((p) => p.test('add a new api endpoint'))).toBe(true);
      });
    });

    describe('refactoring patterns', () => {
      const patterns = STAGE_PATTERNS.refactoring.patterns;

      it('should match "refactor"', () => {
        expect(patterns.some((p) => p.test('refactor this code'))).toBe(true);
      });

      it('should match "clean up"', () => {
        expect(patterns.some((p) => p.test('clean up this function'))).toBe(true);
      });

      it('should match "optimize"', () => {
        expect(patterns.some((p) => p.test('optimize the query'))).toBe(true);
      });

      it('should match "rename"', () => {
        expect(patterns.some((p) => p.test('rename this variable'))).toBe(true);
      });
    });

    describe('documentation patterns', () => {
      const patterns = STAGE_PATTERNS.documentation.patterns;

      it('should match "document"', () => {
        expect(patterns.some((p) => p.test('document this function'))).toBe(true);
      });

      it('should match "readme"', () => {
        expect(patterns.some((p) => p.test('update the readme'))).toBe(true);
      });

      it('should match "add comments"', () => {
        expect(patterns.some((p) => p.test('add comments to explain'))).toBe(true);
      });
    });

    describe('review patterns', () => {
      const patterns = STAGE_PATTERNS.review.patterns;

      it('should match "code review"', () => {
        expect(patterns.some((p) => p.test('do a code review'))).toBe(true);
      });

      it('should match "lgtm"', () => {
        expect(patterns.some((p) => p.test('lgtm, ship it'))).toBe(true);
      });

      it('should match "pull request"', () => {
        expect(patterns.some((p) => p.test('create a pull request'))).toBe(true);
      });
    });

    describe('architecture patterns', () => {
      const patterns = STAGE_PATTERNS.architecture.patterns;

      it('should match "architecture"', () => {
        expect(patterns.some((p) => p.test('discuss the architecture'))).toBe(
          true
        );
      });

      it('should match "system design"', () => {
        expect(patterns.some((p) => p.test('system design for this'))).toBe(true);
      });

      it('should match "database schema"', () => {
        expect(patterns.some((p) => p.test('design the database schema'))).toBe(
          true
        );
      });
    });

    describe('exploration patterns', () => {
      const patterns = STAGE_PATTERNS.exploration.patterns;

      it('should match "explore"', () => {
        expect(patterns.some((p) => p.test('explore the codebase'))).toBe(true);
      });

      it('should match "how does"', () => {
        expect(patterns.some((p) => p.test('how does this work?'))).toBe(true);
      });

      it('should match "understand"', () => {
        expect(patterns.some((p) => p.test('help me understand this'))).toBe(true);
      });
    });
  });

  describe('SLASH_COMMAND_STAGE_MAP', () => {
    it('should map /commit to development', () => {
      expect(SLASH_COMMAND_STAGE_MAP['/commit']).toBe('development');
    });

    it('should map /test to testing', () => {
      expect(SLASH_COMMAND_STAGE_MAP['/test']).toBe('testing');
    });

    it('should map /deploy to deployment', () => {
      expect(SLASH_COMMAND_STAGE_MAP['/deploy']).toBe('deployment');
    });

    it('should map /fix to debugging', () => {
      expect(SLASH_COMMAND_STAGE_MAP['/fix']).toBe('debugging');
    });

    it('should map /review to review', () => {
      expect(SLASH_COMMAND_STAGE_MAP['/review']).toBe('review');
    });

    it('should map /refactor to refactoring', () => {
      expect(SLASH_COMMAND_STAGE_MAP['/refactor']).toBe('refactoring');
    });

    it('should map /docs to documentation', () => {
      expect(SLASH_COMMAND_STAGE_MAP['/docs']).toBe('documentation');
    });

    it('should map /plan to planning', () => {
      expect(SLASH_COMMAND_STAGE_MAP['/plan']).toBe('planning');
    });
  });

  describe('getStagesByPriority', () => {
    it('should return stages sorted by priority (highest first)', () => {
      const sorted = getStagesByPriority();
      expect(sorted.length).toBeGreaterThan(0);

      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i - 1][1].priority).toBeGreaterThanOrEqual(
          sorted[i][1].priority
        );
      }
    });

    it('should not include unknown stage (no patterns)', () => {
      const sorted = getStagesByPriority();
      const unknownEntry = sorted.find(([stage]) => stage === 'unknown');
      expect(unknownEntry).toBeUndefined();
    });

    it('should have planning near the top', () => {
      const sorted = getStagesByPriority();
      const planningIndex = sorted.findIndex(([stage]) => stage === 'planning');
      expect(planningIndex).toBeLessThan(5);
    });
  });

  describe('isConfirmationPrompt', () => {
    it('should return true for "yes"', () => {
      expect(isConfirmationPrompt('yes')).toBe(true);
    });

    it('should return true for "ok"', () => {
      expect(isConfirmationPrompt('ok')).toBe(true);
    });

    it('should return true for "sure"', () => {
      expect(isConfirmationPrompt('sure')).toBe(true);
    });

    it('should return true for "go ahead"', () => {
      expect(isConfirmationPrompt('go ahead')).toBe(true);
    });

    it('should return true for single numbers', () => {
      expect(isConfirmationPrompt('1')).toBe(true);
      expect(isConfirmationPrompt('3')).toBe(true);
    });

    it('should return true for "option 2"', () => {
      expect(isConfirmationPrompt('option 2')).toBe(true);
    });

    it('should return true for "thanks"', () => {
      expect(isConfirmationPrompt('thanks')).toBe(true);
    });

    it('should return true for "sounds good"', () => {
      expect(isConfirmationPrompt('sounds good')).toBe(true);
    });

    it('should return false for actual prompts', () => {
      expect(isConfirmationPrompt('implement auth feature')).toBe(false);
      expect(isConfirmationPrompt('fix this bug')).toBe(false);
      expect(isConfirmationPrompt('add unit tests')).toBe(false);
    });

    it('should handle whitespace', () => {
      expect(isConfirmationPrompt('  yes  ')).toBe(true);
      expect(isConfirmationPrompt('\nok\n')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(isConfirmationPrompt('YES')).toBe(true);
      expect(isConfirmationPrompt('Ok')).toBe(true);
      expect(isConfirmationPrompt('SURE')).toBe(true);
    });
  });

  describe('extractSlashCommand', () => {
    it('should extract /commit', () => {
      expect(extractSlashCommand('/commit')).toBe('/commit');
    });

    it('should extract /test from longer text', () => {
      expect(extractSlashCommand('/test run all')).toBe('/test');
    });

    it('should return null for non-slash text', () => {
      expect(extractSlashCommand('implement feature')).toBeNull();
    });

    it('should handle whitespace', () => {
      expect(extractSlashCommand('  /deploy  ')).toBe('/deploy');
    });

    it('should be case insensitive', () => {
      expect(extractSlashCommand('/COMMIT')).toBe('/commit');
      expect(extractSlashCommand('/Deploy')).toBe('/deploy');
    });

    it('should return null for empty string', () => {
      expect(extractSlashCommand('')).toBeNull();
    });
  });

  describe('isTooShortToClassify', () => {
    it('should return true for very short prompts', () => {
      expect(isTooShortToClassify('hi')).toBe(true);
      expect(isTooShortToClassify('ok')).toBe(true);
      expect(isTooShortToClassify('...')).toBe(true);
    });

    it('should return false for longer prompts', () => {
      expect(isTooShortToClassify('implement auth feature')).toBe(false);
      expect(isTooShortToClassify('fix this bug please')).toBe(false);
    });

    it('should handle custom min length', () => {
      expect(isTooShortToClassify('hello', 3)).toBe(false);
      expect(isTooShortToClassify('hi', 3)).toBe(true);
    });

    it('should handle whitespace correctly', () => {
      expect(isTooShortToClassify('   hi   ')).toBe(true); // trimmed = 2 chars
      expect(isTooShortToClassify('   hello world   ')).toBe(false);
    });
  });
});
