import { describe, it, expect } from 'vitest';

/**
 * Tests for Analysis Panel Helper Functions - Story 30-6
 *
 * These tests validate the pure helper functions used by the
 * conversation analysis components.
 */

// ============================================================================
// ContextWindowGauge helpers
// ============================================================================

/**
 * Returns the appropriate color classes based on context usage percentage.
 */
function getColorClasses(percentage: number): {
  bg: string;
  text: string;
} {
  if (percentage >= 90) {
    return {
      bg: 'bg-destructive',
      text: 'text-destructive',
    };
  }
  if (percentage >= 70) {
    return {
      bg: 'bg-score-growth',
      text: 'text-score-growth',
    };
  }
  return {
    bg: 'bg-primary',
    text: 'text-primary',
  };
}

describe('ContextWindowGauge helpers - Story 30-6', () => {
  describe('getColorClasses', () => {
    it('should return primary colors for healthy usage (<70%)', () => {
      expect(getColorClasses(0)).toEqual({
        bg: 'bg-primary',
        text: 'text-primary',
      });
      expect(getColorClasses(50)).toEqual({
        bg: 'bg-primary',
        text: 'text-primary',
      });
      expect(getColorClasses(69)).toEqual({
        bg: 'bg-primary',
        text: 'text-primary',
      });
    });

    it('should return warning colors for caution usage (70-89%)', () => {
      expect(getColorClasses(70)).toEqual({
        bg: 'bg-score-growth',
        text: 'text-score-growth',
      });
      expect(getColorClasses(80)).toEqual({
        bg: 'bg-score-growth',
        text: 'text-score-growth',
      });
      expect(getColorClasses(89)).toEqual({
        bg: 'bg-score-growth',
        text: 'text-score-growth',
      });
    });

    it('should return danger colors for critical usage (>=90%)', () => {
      expect(getColorClasses(90)).toEqual({
        bg: 'bg-destructive',
        text: 'text-destructive',
      });
      expect(getColorClasses(95)).toEqual({
        bg: 'bg-destructive',
        text: 'text-destructive',
      });
      expect(getColorClasses(100)).toEqual({
        bg: 'bg-destructive',
        text: 'text-destructive',
      });
    });
  });
});

// ============================================================================
// AgentBreakdown helpers
// ============================================================================

/**
 * Formats agent type for display
 */
function formatAgentType(type: string): string {
  return type
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

describe('AgentBreakdown helpers - Story 30-6', () => {
  describe('formatAgentType', () => {
    it('should format hyphenated types', () => {
      expect(formatAgentType('general-purpose')).toBe('General Purpose');
      expect(formatAgentType('code-review')).toBe('Code Review');
    });

    it('should format underscored types', () => {
      expect(formatAgentType('general_purpose')).toBe('General Purpose');
      expect(formatAgentType('code_review')).toBe('Code Review');
    });

    it('should handle single words', () => {
      expect(formatAgentType('research')).toBe('Research');
      expect(formatAgentType('code')).toBe('Code');
    });

    it('should handle mixed separators', () => {
      expect(formatAgentType('general-purpose_agent')).toBe('General Purpose Agent');
    });
  });
});

// ============================================================================
// OutcomeIndicator helpers
// ============================================================================

/**
 * Formats an indicator string for display
 */
function formatIndicator(indicator: string): string {
  // Remove common prefixes
  const cleanIndicator = indicator
    .replace(/^End reason: /i, '')
    .replace(/^Error indicator in stop_reason: /i, 'Error: ');

  // Truncate if too long
  if (cleanIndicator.length > 30) {
    return cleanIndicator.substring(0, 27) + '...';
  }

  return cleanIndicator;
}

describe('OutcomeIndicator helpers - Story 30-6', () => {
  describe('formatIndicator', () => {
    it('should remove "End reason:" prefix', () => {
      expect(formatIndicator('End reason: completed')).toBe('completed');
      expect(formatIndicator('End reason: abandoned')).toBe('abandoned');
    });

    it('should replace error prefix', () => {
      expect(formatIndicator('Error indicator in stop_reason: something failed')).toBe(
        'Error: something failed'
      );
    });

    it('should truncate long strings', () => {
      const longIndicator = 'This is a very long indicator string that should be truncated';
      const result = formatIndicator(longIndicator);

      expect(result.length).toBeLessThanOrEqual(30);
      expect(result.endsWith('...')).toBe(true);
    });

    it('should not truncate short strings', () => {
      const shortIndicator = 'Short indicator';
      expect(formatIndicator(shortIndicator)).toBe('Short indicator');
    });

    it('should handle indicators at exactly 30 characters', () => {
      const exactIndicator = 'Exactly thirty characters long';
      // 30 chars exactly
      expect(exactIndicator.length).toBe(30);
      expect(formatIndicator(exactIndicator)).toBe('Exactly thirty characters long');
    });

    it('should handle indicators at 31 characters', () => {
      const longIndicator = 'This is exactly 31 chars longg!';
      // 31 chars
      expect(longIndicator.length).toBe(31);
      const result = formatIndicator(longIndicator);
      expect(result.endsWith('...')).toBe(true);
      expect(result.length).toBe(30);
    });
  });
});

// ============================================================================
// ConversationStatsPanel helpers
// ============================================================================

/**
 * Formats duration in minutes to human-readable string
 */
function formatDuration(minutes: number): string {
  if (minutes < 1) {
    return '<1 min';
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

describe('ConversationStatsPanel helpers - Story 30-6', () => {
  describe('formatDuration', () => {
    it('should format sub-minute durations', () => {
      expect(formatDuration(0)).toBe('<1 min');
      expect(formatDuration(0.5)).toBe('<1 min');
    });

    it('should format minute durations', () => {
      expect(formatDuration(1)).toBe('1 min');
      expect(formatDuration(15)).toBe('15 min');
      expect(formatDuration(45)).toBe('45 min');
      expect(formatDuration(59)).toBe('59 min');
    });

    it('should format exact hour durations', () => {
      expect(formatDuration(60)).toBe('1h');
      expect(formatDuration(120)).toBe('2h');
      expect(formatDuration(180)).toBe('3h');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(61)).toBe('1h 1m');
      expect(formatDuration(90)).toBe('1h 30m');
      expect(formatDuration(135)).toBe('2h 15m');
      expect(formatDuration(185)).toBe('3h 5m');
    });

    it('should handle large durations', () => {
      expect(formatDuration(600)).toBe('10h');
      expect(formatDuration(615)).toBe('10h 15m');
    });
  });
});

// ============================================================================
// Outcome status configuration tests
// ============================================================================

type OutcomeStatus = 'completed' | 'abandoned' | 'ongoing' | 'error' | 'unknown';

const outcomeConfig: Record<
  OutcomeStatus,
  {
    label: string;
    colorClass: string;
    badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
  }
> = {
  completed: {
    label: 'Completed',
    colorClass: 'text-primary',
    badgeVariant: 'default',
  },
  abandoned: {
    label: 'Abandoned',
    colorClass: 'text-muted-foreground',
    badgeVariant: 'secondary',
  },
  ongoing: {
    label: 'Ongoing',
    colorClass: 'text-primary',
    badgeVariant: 'outline',
  },
  error: {
    label: 'Error',
    colorClass: 'text-destructive',
    badgeVariant: 'destructive',
  },
  unknown: {
    label: 'Unknown',
    colorClass: 'text-muted-foreground',
    badgeVariant: 'secondary',
  },
};

describe('OutcomeIndicator configuration - Story 30-6', () => {
  describe('outcomeConfig', () => {
    it('should have configuration for all statuses', () => {
      const statuses: OutcomeStatus[] = ['completed', 'abandoned', 'ongoing', 'error', 'unknown'];

      statuses.forEach((status) => {
        expect(outcomeConfig[status]).toBeDefined();
        expect(outcomeConfig[status].label).toBeDefined();
        expect(outcomeConfig[status].colorClass).toBeDefined();
        expect(outcomeConfig[status].badgeVariant).toBeDefined();
      });
    });

    it('should use destructive variant only for error status', () => {
      expect(outcomeConfig.error.badgeVariant).toBe('destructive');

      const nonErrorStatuses: OutcomeStatus[] = ['completed', 'abandoned', 'ongoing', 'unknown'];
      nonErrorStatuses.forEach((status) => {
        expect(outcomeConfig[status].badgeVariant).not.toBe('destructive');
      });
    });

    it('should have appropriate color classes', () => {
      expect(outcomeConfig.error.colorClass).toBe('text-destructive');
      expect(outcomeConfig.completed.colorClass).toBe('text-primary');
      expect(outcomeConfig.ongoing.colorClass).toBe('text-primary');
    });
  });
});
