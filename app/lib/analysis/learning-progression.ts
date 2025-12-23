/**
 * Story 21-9: Learning Progression Tracking
 *
 * Implements week-over-week tracking of prompting skill improvement,
 * achievement generation, and improvement suggestions.
 */

/**
 * Represents aggregated metrics for a single week
 */
export interface WeeklyMetrics {
  /** ISO date string for week start (Sunday) */
  weekStart: string;
  /** Average prompt score (0-10) */
  avgPromptScore: number;
  /** Ratio of frustrated prompts (0-1) */
  frustrationRate: number;
  /** Average prompts needed to achieve goal */
  promptsPerGoal: number;
  /** Ratio of sessions with context resets (0-1) */
  contextExhaustionRate: number;
  /** Total prompts submitted this week */
  totalPrompts: number;
  /** Total sessions this week */
  totalSessions: number;
}

/**
 * Percentage changes between weeks for each metric
 */
export interface MetricImprovements {
  /** Percentage change in prompt score (positive = improvement) */
  promptScore: number;
  /** Percentage change in frustration rate (negative = improvement) */
  frustration: number;
  /** Percentage change in efficiency (positive = improvement, fewer prompts per goal) */
  efficiency: number;
  /** Percentage change in context management (positive = improvement, fewer resets) */
  contextManagement: number;
}

/**
 * Achievement thresholds for generating achievement messages
 */
export interface AchievementThresholds {
  /** Minimum prompt score improvement to trigger achievement (default: 5%) */
  promptScoreImprovement: number;
  /** Minimum frustration decrease to trigger achievement (default: 10%) */
  frustrationDecrease: number;
  /** Minimum efficiency improvement to trigger achievement (default: 10%) */
  efficiencyImprovement: number;
  /** Minimum context management improvement to trigger achievement (default: 20%) */
  contextManagementImprovement: number;
}

/**
 * Complete learning progression data
 */
export interface LearningProgression {
  /** Current week's metrics */
  currentWeek: WeeklyMetrics;
  /** Previous week's metrics (null for first week) */
  previousWeek: WeeklyMetrics | null;
  /** Calculated improvements (null for first week) */
  improvements: MetricImprovements | null;
  /** Achievement messages earned this week */
  achievements: string[];
  /** Improvement suggestions based on declining metrics */
  suggestions: string[];
}

/**
 * Default achievement thresholds
 */
export const DEFAULT_THRESHOLDS: AchievementThresholds = {
  promptScoreImprovement: 5,
  frustrationDecrease: 10,
  efficiencyImprovement: 10,
  contextManagementImprovement: 20,
};

/**
 * First week welcome message
 */
export const FIRST_WEEK_MESSAGE = 'First week tracked! Keep prompting to see your progress.';

/**
 * Calculates the percentage change between two values
 * Returns 0 if the base value is 0 or negative
 *
 * @param current - Current value
 * @param previous - Previous value (baseline)
 * @returns Percentage change (positive = increase, negative = decrease)
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous <= 0) {
    return 0;
  }
  return ((current - previous) / previous) * 100;
}

/**
 * Calculates metric improvements between two weeks
 *
 * For metrics where lower is better (frustration, prompts per goal, context exhaustion),
 * the improvement is calculated as the decrease percentage.
 *
 * @param current - Current week's metrics
 * @param previous - Previous week's metrics
 * @returns Improvements object with percentage changes
 */
export function calculateImprovements(
  current: WeeklyMetrics,
  previous: WeeklyMetrics
): MetricImprovements {
  return {
    // Higher prompt score is better - positive change = improvement
    promptScore: calculatePercentageChange(
      current.avgPromptScore,
      previous.avgPromptScore
    ),
    // Lower frustration is better - negative change = improvement
    // We report as-is; consumer checks for < -threshold
    frustration: calculatePercentageChange(
      current.frustrationRate,
      previous.frustrationRate
    ),
    // Lower prompts per goal is better - we invert to show improvement as positive
    // If current is lower than previous, (prev - curr) / prev is positive
    efficiency: previous.promptsPerGoal > 0
      ? ((previous.promptsPerGoal - current.promptsPerGoal) / previous.promptsPerGoal) * 100
      : 0,
    // Lower context exhaustion is better - we invert to show improvement as positive
    contextManagement: previous.contextExhaustionRate > 0
      ? ((previous.contextExhaustionRate - current.contextExhaustionRate) / previous.contextExhaustionRate) * 100
      : 0,
  };
}

/**
 * Generates achievement messages based on improvements
 *
 * @param improvements - Calculated improvements between weeks
 * @param thresholds - Achievement thresholds (optional, uses defaults)
 * @returns Array of achievement messages
 */
export function generateAchievements(
  improvements: MetricImprovements,
  thresholds: AchievementThresholds = DEFAULT_THRESHOLDS
): string[] {
  const achievements: string[] = [];

  // AC #3: Prompt score improved >5%
  if (improvements.promptScore > thresholds.promptScoreImprovement) {
    achievements.push(
      `Prompt quality improved ${Math.round(improvements.promptScore)}%!`
    );
  }

  // AC #4: Frustration rate decreased >10% (frustration is negative when decreasing)
  if (improvements.frustration < -thresholds.frustrationDecrease) {
    achievements.push('Frustration levels decreased - great communication!');
  }

  // AC #5: Prompts per goal decreased >10% (efficiency is positive when improving)
  if (improvements.efficiency > thresholds.efficiencyImprovement) {
    achievements.push('Workflow efficiency improved - fewer prompts per goal!');
  }

  // AC #6: Context exhaustion rate decreased >20% (contextManagement is positive when improving)
  if (improvements.contextManagement > thresholds.contextManagementImprovement) {
    achievements.push('Context management mastery - fewer resets!');
  }

  return achievements;
}

/**
 * Suggestion definition for declining metrics
 */
interface SuggestionRule {
  metric: keyof MetricImprovements;
  /** Threshold for triggering suggestion (sign depends on metric) */
  threshold: number;
  /** Comparison: 'less' for negative thresholds, 'greater' for positive */
  comparison: 'less' | 'greater';
  /** Suggestion text */
  suggestion: string;
  /** Priority for sorting (lower = higher priority) */
  priority: number;
}

/**
 * Suggestion rules for declining metrics
 */
const SUGGESTION_RULES: SuggestionRule[] = [
  {
    metric: 'promptScore',
    threshold: -5,
    comparison: 'less',
    suggestion: 'Focus on prompt clarity this week - be more specific about requirements',
    priority: 1,
  },
  {
    metric: 'frustration',
    threshold: 10,
    comparison: 'greater',
    suggestion: 'Try shorter sessions or clearer initial requirements',
    priority: 2,
  },
  {
    metric: 'efficiency',
    threshold: -10,
    comparison: 'less',
    suggestion: 'Break complex tasks into smaller, focused prompts',
    priority: 3,
  },
  {
    metric: 'contextManagement',
    threshold: -20,
    comparison: 'less',
    suggestion: 'Consider summarizing context periodically to avoid resets',
    priority: 4,
  },
];

/**
 * Generates improvement suggestions based on declining metrics
 *
 * @param improvements - Calculated improvements between weeks
 * @returns Array of suggestion messages, sorted by priority
 */
export function generateSuggestions(improvements: MetricImprovements): string[] {
  const suggestions: { suggestion: string; priority: number }[] = [];

  for (const rule of SUGGESTION_RULES) {
    const value = improvements[rule.metric];
    const triggered =
      rule.comparison === 'less'
        ? value < rule.threshold
        : value > rule.threshold;

    if (triggered) {
      suggestions.push({
        suggestion: rule.suggestion,
        priority: rule.priority,
      });
    }
  }

  // Sort by priority and return just the suggestions
  return suggestions
    .sort((a, b) => a.priority - b.priority)
    .map((s) => s.suggestion);
}

/**
 * Calculates learning progression between current and previous week
 *
 * Handles first-week case by returning a welcome message instead of comparisons.
 *
 * @param current - Current week's metrics
 * @param previous - Previous week's metrics (null for first week)
 * @param thresholds - Optional custom thresholds
 * @returns Complete learning progression data
 */
export function calculateProgression(
  current: WeeklyMetrics,
  previous: WeeklyMetrics | null,
  thresholds: AchievementThresholds = DEFAULT_THRESHOLDS
): LearningProgression {
  // AC #8: First week case
  if (!previous) {
    return {
      currentWeek: current,
      previousWeek: null,
      improvements: null,
      achievements: [FIRST_WEEK_MESSAGE],
      suggestions: [],
    };
  }

  // Calculate improvements
  const improvements = calculateImprovements(current, previous);

  // Generate achievements and suggestions
  const achievements = generateAchievements(improvements, thresholds);
  const suggestions = generateSuggestions(improvements);

  return {
    currentWeek: current,
    previousWeek: previous,
    improvements,
    achievements,
    suggestions,
  };
}

/**
 * Creates an empty WeeklyMetrics object for a given week
 *
 * @param weekStart - ISO date string for week start
 * @returns WeeklyMetrics with zero values
 */
export function createEmptyWeeklyMetrics(weekStart: string): WeeklyMetrics {
  return {
    weekStart,
    avgPromptScore: 0,
    frustrationRate: 0,
    promptsPerGoal: 0,
    contextExhaustionRate: 0,
    totalPrompts: 0,
    totalSessions: 0,
  };
}

/**
 * Gets the week start date (Sunday) for a given date
 *
 * @param date - Date to get week start for
 * @returns ISO date string for the Sunday of that week (YYYY-MM-DD format)
 */
export function getWeekStart(date: Date): string {
  const d = new Date(date);
  // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const dayOfWeek = d.getDay();
  // Subtract days to get to Sunday
  d.setDate(d.getDate() - dayOfWeek);
  // Format as YYYY-MM-DD using local date components to avoid timezone issues
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets the previous week's start date
 *
 * @param weekStart - Current week's start date (ISO string)
 * @returns Previous week's start date (ISO string)
 */
export function getPreviousWeekStart(weekStart: string): string {
  const date = new Date(weekStart);
  date.setDate(date.getDate() - 7);
  // Format as YYYY-MM-DD using local date components to avoid timezone issues
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Validates that a date string is a Sunday (week start)
 *
 * @param dateStr - ISO date string to validate
 * @returns True if the date is a Sunday
 */
export function isValidWeekStart(dateStr: string): boolean {
  const date = new Date(dateStr);
  return date.getDay() === 0;
}
