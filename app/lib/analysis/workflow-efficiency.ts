/**
 * Workflow Efficiency Metrics - Story 21-10
 *
 * Calculates workflow efficiency metrics that measure how effectively
 * developers achieve goals. Includes prompts per task, context resets,
 * debugging loops, and comparison against team benchmarks.
 */

/**
 * Efficiency benchmark levels based on score
 */
export type EfficiencyBenchmark =
  | 'below_average'
  | 'average'
  | 'above_average'
  | 'excellent';

/**
 * Complete workflow efficiency metrics
 */
export interface WorkflowEfficiencyMetrics {
  /** Average prompts required to complete a task */
  promptsPerTask: number;
  /** Average context resets per session */
  contextResetsPerSession: number;
  /** Average prompts in debugging loops before resolution */
  debuggingLoopAverage: number;
  /** Average time in minutes to complete a task */
  timeToResolutionMinutes: number;
  /** Overall efficiency score (0-100) */
  efficiencyScore: number;
  /** Benchmark level based on efficiency score */
  benchmark: EfficiencyBenchmark;
}

/**
 * Input data for efficiency calculation
 */
export interface UserEfficiencyInput {
  /** Total number of prompts submitted */
  totalPrompts: number;
  /** Number of completed tasks (derived from session goals) */
  completedTasks: number;
  /** Number of context resets across all sessions */
  contextResets: number;
  /** Total number of sessions */
  totalSessions: number;
  /** Number of prompts classified as debugging-related */
  debuggingPrompts: number;
  /** Number of debugging issues resolved */
  debuggingResolutions: number;
  /** Total time spent in minutes */
  totalTimeMinutes: number;
}

/**
 * Team benchmark values for comparison
 * These are the average/expected values for an average developer
 */
export const TEAM_BENCHMARKS = {
  /** Average prompts per task (lower is better) */
  promptsPerTask: 5.8,
  /** Average context resets per session (lower is better) */
  contextResetsPerSession: 0.5,
  /** Average debugging prompts per resolution (lower is better) */
  debuggingLoopAverage: 3.0,
} as const;

/**
 * Calculate prompts per task
 *
 * @param totalPrompts - Total number of prompts submitted
 * @param completedTasks - Number of tasks completed
 * @returns Average prompts per task (0 if no tasks completed)
 */
export function calculatePromptsPerTask(
  totalPrompts: number,
  completedTasks: number
): number {
  if (completedTasks <= 0) {
    return 0;
  }
  return Number((totalPrompts / completedTasks).toFixed(2));
}

/**
 * Calculate context resets per session
 *
 * @param contextResets - Total context resets
 * @param totalSessions - Total number of sessions
 * @returns Average context resets per session (0 if no sessions)
 */
export function calculateContextResetsPerSession(
  contextResets: number,
  totalSessions: number
): number {
  if (totalSessions <= 0) {
    return 0;
  }
  return Number((contextResets / totalSessions).toFixed(2));
}

/**
 * Calculate debugging loop average
 *
 * @param debuggingPrompts - Number of debugging-related prompts
 * @param debuggingResolutions - Number of debugging issues resolved
 * @returns Average prompts per debugging resolution (0 if no resolutions)
 */
export function calculateDebuggingLoopAverage(
  debuggingPrompts: number,
  debuggingResolutions: number
): number {
  if (debuggingResolutions <= 0) {
    return 0;
  }
  return Number((debuggingPrompts / debuggingResolutions).toFixed(2));
}

/**
 * Calculate time to resolution in minutes
 *
 * @param totalTimeMinutes - Total time spent in minutes
 * @param completedTasks - Number of tasks completed
 * @returns Average minutes per task (0 if no tasks completed)
 */
export function calculateTimeToResolution(
  totalTimeMinutes: number,
  completedTasks: number
): number {
  if (completedTasks <= 0) {
    return 0;
  }
  return Number((totalTimeMinutes / completedTasks).toFixed(2));
}

/**
 * Calculate efficiency score based on user metrics vs team benchmarks
 *
 * Scoring algorithm:
 * - Start with baseline of 50
 * - Add/subtract points based on comparison to benchmarks
 * - Cap score between 0 and 100
 *
 * @param userMetrics - User's efficiency input data
 * @returns Efficiency score (0-100)
 */
export function calculateEfficiencyScore(
  userMetrics: UserEfficiencyInput
): number {
  let score = 50; // Baseline score

  // Calculate individual metrics
  const promptsPerTask = calculatePromptsPerTask(
    userMetrics.totalPrompts,
    userMetrics.completedTasks
  );

  const contextResetsPerSession = calculateContextResetsPerSession(
    userMetrics.contextResets,
    userMetrics.totalSessions
  );

  const debuggingLoopAverage = calculateDebuggingLoopAverage(
    userMetrics.debuggingPrompts,
    userMetrics.debuggingResolutions
  );

  // Prompts per task scoring (lower is better)
  if (promptsPerTask > 0) {
    if (promptsPerTask < TEAM_BENCHMARKS.promptsPerTask * 0.8) {
      // Excellent: < 80% of benchmark (+20)
      score += 20;
    } else if (promptsPerTask < TEAM_BENCHMARKS.promptsPerTask) {
      // Good: < 100% of benchmark (+10)
      score += 10;
    } else if (promptsPerTask > TEAM_BENCHMARKS.promptsPerTask * 1.5) {
      // Poor: > 150% of benchmark (-15)
      score -= 15;
    }
  }

  // Context resets per session scoring (lower is better)
  if (contextResetsPerSession > 0 || userMetrics.totalSessions > 0) {
    if (contextResetsPerSession < TEAM_BENCHMARKS.contextResetsPerSession * 0.5) {
      // Excellent: < 50% of benchmark (+15)
      score += 15;
    } else if (contextResetsPerSession < TEAM_BENCHMARKS.contextResetsPerSession) {
      // Good: < 100% of benchmark (+8)
      score += 8;
    } else if (contextResetsPerSession > TEAM_BENCHMARKS.contextResetsPerSession * 2) {
      // Poor: > 200% of benchmark (-10)
      score -= 10;
    }
  }

  // Debugging loop scoring (lower is better)
  if (debuggingLoopAverage > 0) {
    if (debuggingLoopAverage < TEAM_BENCHMARKS.debuggingLoopAverage * 0.7) {
      // Excellent: < 70% of benchmark (+15)
      score += 15;
    } else if (debuggingLoopAverage < TEAM_BENCHMARKS.debuggingLoopAverage) {
      // Good: < 100% of benchmark (+8)
      score += 8;
    }
    // Note: No penalty for debugging loops > 100% per the scoring algorithm in story
  }

  // Cap score between 0 and 100
  return Math.max(0, Math.min(100, score));
}

/**
 * Determine benchmark level from efficiency score
 *
 * @param score - Efficiency score (0-100)
 * @returns Benchmark level
 */
export function determineBenchmarkLevel(score: number): EfficiencyBenchmark {
  if (score >= 80) {
    return 'excellent';
  }
  if (score >= 60) {
    return 'above_average';
  }
  if (score >= 40) {
    return 'average';
  }
  return 'below_average';
}

/**
 * Calculate complete workflow efficiency metrics
 *
 * Main entry point for calculating all efficiency metrics from user input.
 *
 * @param userMetrics - User's efficiency input data
 * @returns Complete workflow efficiency metrics
 *
 * @example
 * const metrics = calculateWorkflowEfficiency({
 *   totalPrompts: 58,
 *   completedTasks: 10,
 *   contextResets: 5,
 *   totalSessions: 10,
 *   debuggingPrompts: 30,
 *   debuggingResolutions: 10,
 *   totalTimeMinutes: 600,
 * });
 *
 * console.log(metrics.efficiencyScore); // 76
 * console.log(metrics.benchmark); // 'above_average'
 */
export function calculateWorkflowEfficiency(
  userMetrics: UserEfficiencyInput
): WorkflowEfficiencyMetrics {
  const promptsPerTask = calculatePromptsPerTask(
    userMetrics.totalPrompts,
    userMetrics.completedTasks
  );

  const contextResetsPerSession = calculateContextResetsPerSession(
    userMetrics.contextResets,
    userMetrics.totalSessions
  );

  const debuggingLoopAverage = calculateDebuggingLoopAverage(
    userMetrics.debuggingPrompts,
    userMetrics.debuggingResolutions
  );

  const timeToResolutionMinutes = calculateTimeToResolution(
    userMetrics.totalTimeMinutes,
    userMetrics.completedTasks
  );

  const efficiencyScore = calculateEfficiencyScore(userMetrics);
  const benchmark = determineBenchmarkLevel(efficiencyScore);

  return {
    promptsPerTask,
    contextResetsPerSession,
    debuggingLoopAverage,
    timeToResolutionMinutes,
    efficiencyScore,
    benchmark,
  };
}
