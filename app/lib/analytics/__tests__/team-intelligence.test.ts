import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the Supabase admin client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

// Import after mocking
import { createAdminClient } from '@/lib/supabase/admin';
import {
  UserMetrics,
  StrugglePattern,
  BestPracticePattern,
} from '@/lib/types/team-intelligence';

// Helper function to create mock metrics
function createMockUserMetrics(overrides: Partial<UserMetrics> = {}): UserMetrics {
  return {
    userId: 'test-user-id',
    userName: 'Test User',
    avatarUrl: undefined,
    avgPromptScore: 7.5,
    promptCount: 50,
    sessionCount: 10,
    frustrationRate: 0.05,
    contextExhaustionRate: 0.1,
    testingRatio: 0.1,
    avgSessionDuration: 45,
    promptsPerHour: 10,
    clarityScore: 7.5,
    ...overrides,
  };
}

describe('Team Intelligence - Struggle Detection Patterns', () => {
  // Test the struggle pattern conditions directly
  const STRUGGLE_PATTERNS: StrugglePattern[] = [
    {
      condition: (m) => m.frustrationRate > 0.1,
      issue: 'High frustration in prompts',
      suggestion: 'Encourage shorter sessions and clearer initial requirements',
      severity: 'high',
    },
    {
      condition: (m) => m.contextExhaustionRate > 0.3,
      issue: 'Frequent context exhaustion',
      suggestion: 'Train team on context management and session planning',
      severity: 'medium',
    },
    {
      condition: (m) => m.avgPromptScore < 5,
      issue: 'Low prompt quality scores',
      suggestion: 'Provide prompt engineering training and examples of high-quality prompts',
      severity: 'high',
    },
    {
      condition: (m) => m.testingRatio < 0.05,
      issue: 'Low testing activity',
      suggestion: 'Encourage test-driven development and verification prompts',
      severity: 'medium',
    },
    {
      condition: (m) => m.clarityScore < 5,
      issue: 'Unclear prompt phrasing',
      suggestion: 'Share templates for clear, structured prompts',
      severity: 'medium',
    },
    {
      condition: (m) => m.avgSessionDuration > 180,
      issue: 'Very long sessions without breaks',
      suggestion: 'Recommend the Pomodoro technique and regular breaks',
      severity: 'low',
    },
    {
      condition: (m) => m.promptsPerHour > 30,
      issue: 'Rapid-fire prompting pattern',
      suggestion: 'Encourage more thoughtful, comprehensive prompts',
      severity: 'low',
    },
  ];

  describe('High frustration detection', () => {
    it('should detect high frustration rate', () => {
      const highFrustrationUser = createMockUserMetrics({ frustrationRate: 0.15 });
      const pattern = STRUGGLE_PATTERNS[0];

      expect(pattern.condition(highFrustrationUser)).toBe(true);
    });

    it('should not flag normal frustration rate', () => {
      const normalUser = createMockUserMetrics({ frustrationRate: 0.05 });
      const pattern = STRUGGLE_PATTERNS[0];

      expect(pattern.condition(normalUser)).toBe(false);
    });

    it('should not flag exactly 10% frustration rate (threshold)', () => {
      const thresholdUser = createMockUserMetrics({ frustrationRate: 0.1 });
      const pattern = STRUGGLE_PATTERNS[0];

      expect(pattern.condition(thresholdUser)).toBe(false);
    });
  });

  describe('Context exhaustion detection', () => {
    it('should detect high context exhaustion', () => {
      const highExhaustionUser = createMockUserMetrics({ contextExhaustionRate: 0.4 });
      const pattern = STRUGGLE_PATTERNS[1];

      expect(pattern.condition(highExhaustionUser)).toBe(true);
    });

    it('should not flag normal context usage', () => {
      const normalUser = createMockUserMetrics({ contextExhaustionRate: 0.2 });
      const pattern = STRUGGLE_PATTERNS[1];

      expect(pattern.condition(normalUser)).toBe(false);
    });
  });

  describe('Low prompt quality detection', () => {
    it('should detect low prompt scores', () => {
      const lowScoreUser = createMockUserMetrics({ avgPromptScore: 4.5 });
      const pattern = STRUGGLE_PATTERNS[2];

      expect(pattern.condition(lowScoreUser)).toBe(true);
    });

    it('should not flag good prompt scores', () => {
      const goodScoreUser = createMockUserMetrics({ avgPromptScore: 7.5 });
      const pattern = STRUGGLE_PATTERNS[2];

      expect(pattern.condition(goodScoreUser)).toBe(false);
    });

    it('should not flag exactly 5 score (threshold)', () => {
      const thresholdUser = createMockUserMetrics({ avgPromptScore: 5 });
      const pattern = STRUGGLE_PATTERNS[2];

      expect(pattern.condition(thresholdUser)).toBe(false);
    });
  });

  describe('Low testing activity detection', () => {
    it('should detect low testing ratio', () => {
      const lowTestingUser = createMockUserMetrics({ testingRatio: 0.02 });
      const pattern = STRUGGLE_PATTERNS[3];

      expect(pattern.condition(lowTestingUser)).toBe(true);
    });

    it('should not flag normal testing ratio', () => {
      const normalUser = createMockUserMetrics({ testingRatio: 0.15 });
      const pattern = STRUGGLE_PATTERNS[3];

      expect(pattern.condition(normalUser)).toBe(false);
    });
  });

  describe('Unclear prompt phrasing detection', () => {
    it('should detect low clarity scores', () => {
      const lowClarityUser = createMockUserMetrics({ clarityScore: 4 });
      const pattern = STRUGGLE_PATTERNS[4];

      expect(pattern.condition(lowClarityUser)).toBe(true);
    });

    it('should not flag good clarity scores', () => {
      const goodClarityUser = createMockUserMetrics({ clarityScore: 8 });
      const pattern = STRUGGLE_PATTERNS[4];

      expect(pattern.condition(goodClarityUser)).toBe(false);
    });
  });

  describe('Long session detection', () => {
    it('should detect very long sessions', () => {
      const longSessionUser = createMockUserMetrics({ avgSessionDuration: 200 });
      const pattern = STRUGGLE_PATTERNS[5];

      expect(pattern.condition(longSessionUser)).toBe(true);
    });

    it('should not flag reasonable session duration', () => {
      const normalUser = createMockUserMetrics({ avgSessionDuration: 60 });
      const pattern = STRUGGLE_PATTERNS[5];

      expect(pattern.condition(normalUser)).toBe(false);
    });
  });

  describe('Rapid-fire prompting detection', () => {
    it('should detect rapid-fire prompting', () => {
      const rapidFireUser = createMockUserMetrics({ promptsPerHour: 35 });
      const pattern = STRUGGLE_PATTERNS[6];

      expect(pattern.condition(rapidFireUser)).toBe(true);
    });

    it('should not flag balanced prompting', () => {
      const balancedUser = createMockUserMetrics({ promptsPerHour: 12 });
      const pattern = STRUGGLE_PATTERNS[6];

      expect(pattern.condition(balancedUser)).toBe(false);
    });
  });
});

describe('Team Intelligence - Best Practice Detection Patterns', () => {
  const BEST_PRACTICE_PATTERNS: BestPracticePattern[] = [
    {
      pattern: 'High prompt clarity scores',
      detector: (m) => m.avgPromptScore >= 8.5,
      impact: 'Leads to 40% fewer follow-up prompts',
    },
    {
      pattern: 'Regular testing prompts',
      detector: (m) => m.testingRatio >= 0.15,
      impact: 'Reduces debugging cycles by 50%',
    },
    {
      pattern: 'Consistent session lengths',
      detector: (m) => m.avgSessionDuration >= 30 && m.avgSessionDuration <= 90,
      impact: 'Maintains focus and reduces context exhaustion',
    },
    {
      pattern: 'Balanced prompt pacing',
      detector: (m) => m.promptsPerHour >= 5 && m.promptsPerHour <= 15,
      impact: 'Improves response quality and thinking time',
    },
    {
      pattern: 'Low frustration rate',
      detector: (m) => m.frustrationRate < 0.02,
      impact: 'Better collaboration with AI and more productive sessions',
    },
    {
      pattern: 'High clarity scores',
      detector: (m) => m.clarityScore >= 8,
      impact: 'Reduces misunderstandings and iterations',
    },
  ];

  describe('High prompt quality pattern', () => {
    it('should detect high quality prompts', () => {
      const highQualityUser = createMockUserMetrics({ avgPromptScore: 9 });
      const pattern = BEST_PRACTICE_PATTERNS[0];

      expect(pattern.detector(highQualityUser)).toBe(true);
    });

    it('should not flag average quality', () => {
      const averageUser = createMockUserMetrics({ avgPromptScore: 7 });
      const pattern = BEST_PRACTICE_PATTERNS[0];

      expect(pattern.detector(averageUser)).toBe(false);
    });
  });

  describe('Regular testing pattern', () => {
    it('should detect high testing ratio', () => {
      const testingUser = createMockUserMetrics({ testingRatio: 0.2 });
      const pattern = BEST_PRACTICE_PATTERNS[1];

      expect(pattern.detector(testingUser)).toBe(true);
    });

    it('should not flag low testing', () => {
      const lowTestingUser = createMockUserMetrics({ testingRatio: 0.05 });
      const pattern = BEST_PRACTICE_PATTERNS[1];

      expect(pattern.detector(lowTestingUser)).toBe(false);
    });
  });

  describe('Consistent session length pattern', () => {
    it('should detect ideal session lengths', () => {
      const idealUser = createMockUserMetrics({ avgSessionDuration: 60 });
      const pattern = BEST_PRACTICE_PATTERNS[2];

      expect(pattern.detector(idealUser)).toBe(true);
    });

    it('should not flag very short sessions', () => {
      const shortSessionUser = createMockUserMetrics({ avgSessionDuration: 15 });
      const pattern = BEST_PRACTICE_PATTERNS[2];

      expect(pattern.detector(shortSessionUser)).toBe(false);
    });

    it('should not flag very long sessions', () => {
      const longSessionUser = createMockUserMetrics({ avgSessionDuration: 120 });
      const pattern = BEST_PRACTICE_PATTERNS[2];

      expect(pattern.detector(longSessionUser)).toBe(false);
    });
  });

  describe('Balanced prompt pacing pattern', () => {
    it('should detect balanced pacing', () => {
      const balancedUser = createMockUserMetrics({ promptsPerHour: 10 });
      const pattern = BEST_PRACTICE_PATTERNS[3];

      expect(pattern.detector(balancedUser)).toBe(true);
    });

    it('should not flag too slow pacing', () => {
      const slowUser = createMockUserMetrics({ promptsPerHour: 2 });
      const pattern = BEST_PRACTICE_PATTERNS[3];

      expect(pattern.detector(slowUser)).toBe(false);
    });

    it('should not flag too fast pacing', () => {
      const fastUser = createMockUserMetrics({ promptsPerHour: 25 });
      const pattern = BEST_PRACTICE_PATTERNS[3];

      expect(pattern.detector(fastUser)).toBe(false);
    });
  });

  describe('Low frustration pattern', () => {
    it('should detect very low frustration', () => {
      const calmUser = createMockUserMetrics({ frustrationRate: 0.01 });
      const pattern = BEST_PRACTICE_PATTERNS[4];

      expect(pattern.detector(calmUser)).toBe(true);
    });

    it('should not flag normal frustration', () => {
      const normalUser = createMockUserMetrics({ frustrationRate: 0.05 });
      const pattern = BEST_PRACTICE_PATTERNS[4];

      expect(pattern.detector(normalUser)).toBe(false);
    });
  });

  describe('High clarity pattern', () => {
    it('should detect high clarity', () => {
      const clearUser = createMockUserMetrics({ clarityScore: 9 });
      const pattern = BEST_PRACTICE_PATTERNS[5];

      expect(pattern.detector(clearUser)).toBe(true);
    });

    it('should not flag average clarity', () => {
      const averageUser = createMockUserMetrics({ clarityScore: 6 });
      const pattern = BEST_PRACTICE_PATTERNS[5];

      expect(pattern.detector(averageUser)).toBe(false);
    });
  });
});

describe('Team Intelligence - Date Range Calculation', () => {
  // Test the date range logic
  function getDateRange(timeRange: '7d' | '30d' | '90d'): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();

    switch (timeRange) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
    }

    return { startDate, endDate };
  }

  it('should calculate 7-day range correctly', () => {
    const { startDate, endDate } = getDateRange('7d');
    const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    expect(daysDiff).toBe(7);
  });

  it('should calculate 30-day range correctly', () => {
    const { startDate, endDate } = getDateRange('30d');
    const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    expect(daysDiff).toBe(30);
  });

  it('should calculate 90-day range correctly', () => {
    const { startDate, endDate } = getDateRange('90d');
    const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    expect(daysDiff).toBe(90);
  });
});

describe('Team Intelligence - Persona Determination', () => {
  // Test persona classification logic
  function determinePersona(
    prompts: Array<{ classification: unknown; prompt_analyses: { overall_score: number } | null }>
  ): 'architect' | 'firefighter' | 'craftsman' | 'explorer' {
    const styles: Record<string, number> = {};
    let totalScore = 0;
    let scoreCount = 0;

    prompts.forEach((p) => {
      const classification = p.classification as Record<string, unknown> | null;
      if (classification?.work_style) {
        const style = String(classification.work_style);
        styles[style] = (styles[style] || 0) + 1;
      }
      if (p.prompt_analyses?.overall_score) {
        totalScore += p.prompt_analyses.overall_score;
        scoreCount++;
      }
    });

    const avgScore = scoreCount > 0 ? totalScore / scoreCount : 5;
    const primaryStyle = Object.entries(styles).sort((a, b) => b[1] - a[1])[0]?.[0];

    if (primaryStyle === 'architect' || styles.architect > prompts.length * 0.3) {
      return 'architect';
    }
    if (primaryStyle === 'rapid' || styles.rapid > prompts.length * 0.4) {
      return 'firefighter';
    }
    if (avgScore >= 7 && (primaryStyle === 'focused' || primaryStyle === 'iterative')) {
      return 'craftsman';
    }
    if (primaryStyle === 'explorer' || primaryStyle === 'researcher') {
      return 'explorer';
    }

    return avgScore >= 7 ? 'craftsman' : 'explorer';
  }

  it('should identify architect persona', () => {
    const prompts = [
      { classification: { work_style: 'architect' }, prompt_analyses: { overall_score: 8 } },
      { classification: { work_style: 'architect' }, prompt_analyses: { overall_score: 7 } },
      { classification: { work_style: 'focused' }, prompt_analyses: { overall_score: 6 } },
    ];

    expect(determinePersona(prompts)).toBe('architect');
  });

  it('should identify firefighter persona from rapid style', () => {
    const prompts = [
      { classification: { work_style: 'rapid' }, prompt_analyses: { overall_score: 5 } },
      { classification: { work_style: 'rapid' }, prompt_analyses: { overall_score: 4 } },
      { classification: { work_style: 'rapid' }, prompt_analyses: { overall_score: 5 } },
      { classification: { work_style: 'focused' }, prompt_analyses: { overall_score: 6 } },
    ];

    expect(determinePersona(prompts)).toBe('firefighter');
  });

  it('should identify craftsman persona from high scores and focused style', () => {
    const prompts = [
      { classification: { work_style: 'focused' }, prompt_analyses: { overall_score: 8 } },
      { classification: { work_style: 'focused' }, prompt_analyses: { overall_score: 9 } },
      { classification: { work_style: 'focused' }, prompt_analyses: { overall_score: 8 } },
    ];

    expect(determinePersona(prompts)).toBe('craftsman');
  });

  it('should identify explorer persona', () => {
    const prompts = [
      { classification: { work_style: 'explorer' }, prompt_analyses: { overall_score: 6 } },
      { classification: { work_style: 'explorer' }, prompt_analyses: { overall_score: 5 } },
      { classification: { work_style: 'researcher' }, prompt_analyses: { overall_score: 7 } },
    ];

    expect(determinePersona(prompts)).toBe('explorer');
  });

  it('should default to explorer for low scores without specific style', () => {
    const prompts = [
      { classification: { work_style: 'unknown' }, prompt_analyses: { overall_score: 4 } },
      { classification: { work_style: 'unknown' }, prompt_analyses: { overall_score: 5 } },
    ];

    expect(determinePersona(prompts)).toBe('explorer');
  });

  it('should default to craftsman for high scores without specific style', () => {
    const prompts = [
      { classification: { work_style: 'unknown' }, prompt_analyses: { overall_score: 8 } },
      { classification: { work_style: 'unknown' }, prompt_analyses: { overall_score: 9 } },
    ];

    expect(determinePersona(prompts)).toBe('craftsman');
  });
});

describe('Team Intelligence - Sentiment Trend Calculation', () => {
  // Test sentiment trend logic
  function calculateSentimentTrend(
    currentRate: number,
    previousRate: number
  ): 'improving' | 'stable' | 'declining' {
    if (currentRate < previousRate - 0.02) {
      return 'improving';
    } else if (currentRate > previousRate + 0.02) {
      return 'declining';
    }
    return 'stable';
  }

  it('should detect improving trend', () => {
    const trend = calculateSentimentTrend(0.05, 0.10);
    expect(trend).toBe('improving');
  });

  it('should detect declining trend', () => {
    const trend = calculateSentimentTrend(0.10, 0.05);
    expect(trend).toBe('declining');
  });

  it('should detect stable trend within threshold', () => {
    const trend = calculateSentimentTrend(0.05, 0.06);
    expect(trend).toBe('stable');
  });

  it('should be stable at exact boundary', () => {
    const trend = calculateSentimentTrend(0.05, 0.07);
    expect(trend).toBe('stable');
  });
});

describe('Team Intelligence - Politeness Ratio Calculation', () => {
  // Test politeness ratio logic
  function calculatePolitenessRatio(politeRate: number, frustratedRate: number): number {
    if (frustratedRate > 0) {
      return politeRate / frustratedRate;
    }
    return politeRate > 0 ? 10 : 1;
  }

  it('should calculate ratio correctly', () => {
    const ratio = calculatePolitenessRatio(0.8, 0.1);
    expect(ratio).toBe(8);
  });

  it('should handle zero frustrated rate with polite prompts', () => {
    const ratio = calculatePolitenessRatio(0.5, 0);
    expect(ratio).toBe(10);
  });

  it('should handle zero frustrated rate with no polite prompts', () => {
    const ratio = calculatePolitenessRatio(0, 0);
    expect(ratio).toBe(1);
  });

  it('should handle equal rates', () => {
    const ratio = calculatePolitenessRatio(0.3, 0.3);
    expect(ratio).toBe(1);
  });
});
