/**
 * Active Time Calculator - Story 31-3
 *
 * Calculates active work time per project stage, excluding gaps > threshold.
 * Uses prompt timestamps to determine actual working time by filtering out
 * periods of inactivity (breaks, meetings, etc.).
 *
 * Performance requirement: <50ms for 1000-prompt session
 */

import type { ProjectStage } from '@/lib/types/conversations';

// ============================================================================
// Types
// ============================================================================

/**
 * Input format for prompts with detected stages.
 */
export interface PromptWithStage {
  /** Unique identifier for the prompt */
  id: string;
  /** ISO 8601 timestamp when the prompt was sent */
  timestamp: string;
  /** Detected project stage for this prompt */
  detectedStage: ProjectStage;
}

/**
 * A continuous time segment within a single stage.
 */
export interface TimeSegment {
  /** Project stage for this segment */
  stage: ProjectStage;
  /** Start time of the segment (ISO 8601) */
  startTime: string;
  /** End time of the segment (ISO 8601) */
  endTime: string;
  /** Duration in minutes */
  durationMinutes: number;
  /** Number of prompts in this segment */
  promptCount: number;
  /** IDs of prompts in this segment */
  promptIds: string[];
}

/**
 * Breakdown of active time for a single stage.
 */
export interface StageTimeBreakdown {
  /** Project stage */
  stage: ProjectStage;
  /** Total active minutes in this stage */
  activeMinutes: number;
  /** Number of prompts in this stage */
  promptCount: number;
  /** Percentage of total active time */
  percentage: number;
  /** Number of gaps excluded from calculation */
  gapsExcluded: number;
}

/**
 * Result of calculating active time for a single session.
 */
export interface SessionTimeResult {
  /** Session identifier */
  sessionId: string;
  /** Total active minutes (excluding gaps) */
  totalActiveMinutes: number;
  /** Total number of prompts */
  totalPrompts: number;
  /** Number of gaps excluded */
  gapsExcluded: number;
  /** Total minutes in excluded gaps */
  totalGapMinutes: number;
  /** Breakdown by stage */
  stages: StageTimeBreakdown[];
  /** Time segments in chronological order */
  segments: TimeSegment[];
}

/**
 * Aggregated result across multiple sessions.
 */
export interface ProjectTimeResult {
  /** Total active minutes across all sessions */
  totalActiveMinutes: number;
  /** Total number of prompts across all sessions */
  totalPrompts: number;
  /** Total gaps excluded across all sessions */
  totalGapsExcluded: number;
  /** Total gap minutes across all sessions */
  totalGapMinutes: number;
  /** Number of sessions analyzed */
  sessionCount: number;
  /** Aggregated breakdown by stage */
  stages: StageTimeBreakdown[];
  /** Average session duration */
  averageSessionMinutes: number;
}

/**
 * Options for active time calculation.
 */
export interface ActiveTimeOptions {
  /** Maximum gap in minutes before excluding time (default: 30) */
  gapThresholdMinutes?: number;
  /** Minimum time to attribute to a single prompt (default: 1 minute) */
  minPromptMinutes?: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default gap threshold in minutes.
 * Gaps larger than this are excluded from active time.
 */
export const DEFAULT_GAP_THRESHOLD_MINUTES = 30;

/**
 * Minimum time attributed to a single prompt in minutes.
 * This ensures single prompts contribute to active time.
 */
export const DEFAULT_MIN_PROMPT_MINUTES = 1;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse ISO timestamp to Date object.
 */
function parseTimestamp(timestamp: string): Date {
  return new Date(timestamp);
}

/**
 * Calculate minutes between two timestamps.
 */
function calculateMinutesBetween(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime();
  return diffMs / (1000 * 60);
}

/**
 * Sort prompts by timestamp in ascending order.
 */
function sortPromptsByTimestamp<T extends { timestamp: string }>(
  prompts: T[]
): T[] {
  return [...prompts].sort(
    (a, b) => parseTimestamp(a.timestamp).getTime() - parseTimestamp(b.timestamp).getTime()
  );
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Calculate active time for a single session.
 *
 * The algorithm:
 * 1. Sort prompts by timestamp
 * 2. For each consecutive pair of prompts:
 *    - If gap <= threshold, add time to active minutes
 *    - If gap > threshold, exclude time but count the gap
 * 3. Group consecutive prompts by stage into segments
 * 4. Calculate totals and percentages
 *
 * @param sessionId - Identifier for the session
 * @param prompts - Array of prompts with detected stages
 * @param options - Calculation options
 * @returns Session time calculation result
 */
export function calculateSessionActiveTime(
  sessionId: string,
  prompts: PromptWithStage[],
  options: ActiveTimeOptions = {}
): SessionTimeResult {
  const {
    gapThresholdMinutes = DEFAULT_GAP_THRESHOLD_MINUTES,
    minPromptMinutes = DEFAULT_MIN_PROMPT_MINUTES,
  } = options;

  // Handle empty or single prompt
  if (!prompts || prompts.length === 0) {
    return {
      sessionId,
      totalActiveMinutes: 0,
      totalPrompts: 0,
      gapsExcluded: 0,
      totalGapMinutes: 0,
      stages: [],
      segments: [],
    };
  }

  const sortedPrompts = sortPromptsByTimestamp(prompts);

  // Single prompt case
  if (sortedPrompts.length === 1) {
    const prompt = sortedPrompts[0]!;
    const segment: TimeSegment = {
      stage: prompt.detectedStage,
      startTime: prompt.timestamp,
      endTime: prompt.timestamp,
      durationMinutes: minPromptMinutes,
      promptCount: 1,
      promptIds: [prompt.id],
    };

    return {
      sessionId,
      totalActiveMinutes: minPromptMinutes,
      totalPrompts: 1,
      gapsExcluded: 0,
      totalGapMinutes: 0,
      stages: [
        {
          stage: prompt.detectedStage,
          activeMinutes: minPromptMinutes,
          promptCount: 1,
          percentage: 100,
          gapsExcluded: 0,
        },
      ],
      segments: [segment],
    };
  }

  // Track segments and gaps
  const segments: TimeSegment[] = [];
  let currentSegment: TimeSegment | null = null;
  let gapsExcluded = 0;
  let totalGapMinutes = 0;

  // Stage-level tracking
  const stageData: Map<ProjectStage, { activeMinutes: number; promptCount: number; gapsExcluded: number }> = new Map();

  // Process prompts
  for (let i = 0; i < sortedPrompts.length; i++) {
    const prompt = sortedPrompts[i]!;
    const prevPrompt = i > 0 ? sortedPrompts[i - 1]! : null;

    // Initialize stage data if needed
    if (!stageData.has(prompt.detectedStage)) {
      stageData.set(prompt.detectedStage, {
        activeMinutes: 0,
        promptCount: 0,
        gapsExcluded: 0,
      });
    }

    // First prompt - start new segment
    if (!prevPrompt) {
      currentSegment = {
        stage: prompt.detectedStage,
        startTime: prompt.timestamp,
        endTime: prompt.timestamp,
        durationMinutes: 0,
        promptCount: 1,
        promptIds: [prompt.id],
      };
      stageData.get(prompt.detectedStage)!.promptCount++;
      continue;
    }

    // Calculate gap from previous prompt
    const prevTime = parseTimestamp(prevPrompt.timestamp);
    const currentTime = parseTimestamp(prompt.timestamp);
    const gapMinutes = calculateMinutesBetween(prevTime, currentTime);

    // Check if gap exceeds threshold
    const isGapExcluded = gapMinutes > gapThresholdMinutes;

    if (isGapExcluded) {
      // Gap too large - close current segment and start new one
      gapsExcluded++;
      totalGapMinutes += gapMinutes;

      // Finalize current segment
      if (currentSegment) {
        // Add minimum time for the last prompt in the segment
        currentSegment.durationMinutes = Math.max(
          currentSegment.durationMinutes,
          minPromptMinutes
        );
        segments.push(currentSegment);
        stageData.get(currentSegment.stage)!.activeMinutes += currentSegment.durationMinutes;
      }

      // Track gap for the stage of the previous prompt (where the gap started)
      stageData.get(prevPrompt.detectedStage)!.gapsExcluded++;

      // Start new segment
      currentSegment = {
        stage: prompt.detectedStage,
        startTime: prompt.timestamp,
        endTime: prompt.timestamp,
        durationMinutes: 0,
        promptCount: 1,
        promptIds: [prompt.id],
      };
      // Track prompt count for this stage
      stageData.get(prompt.detectedStage)!.promptCount++;
    } else {
      // Gap within threshold
      const timeToAdd = gapMinutes;

      // Check if stage changed
      if (currentSegment && prompt.detectedStage !== currentSegment.stage) {
        // Stage transition - close current segment
        currentSegment.durationMinutes = Math.max(
          currentSegment.durationMinutes,
          minPromptMinutes
        );
        segments.push(currentSegment);
        stageData.get(currentSegment.stage)!.activeMinutes += currentSegment.durationMinutes;

        // Start new segment with this prompt
        currentSegment = {
          stage: prompt.detectedStage,
          startTime: prompt.timestamp,
          endTime: prompt.timestamp,
          durationMinutes: 0,
          promptCount: 1,
          promptIds: [prompt.id],
        };
        // Track prompt count for new stage
        stageData.get(prompt.detectedStage)!.promptCount++;
      } else if (currentSegment) {
        // Same stage - extend segment
        currentSegment.endTime = prompt.timestamp;
        currentSegment.durationMinutes += timeToAdd;
        currentSegment.promptCount++;
        currentSegment.promptIds.push(prompt.id);
        // Track prompt count for this stage
        stageData.get(prompt.detectedStage)!.promptCount++;
      }
    }
  }

  // Finalize last segment
  if (currentSegment) {
    currentSegment.durationMinutes = Math.max(
      currentSegment.durationMinutes,
      minPromptMinutes
    );
    segments.push(currentSegment);
    stageData.get(currentSegment.stage)!.activeMinutes += currentSegment.durationMinutes;
  }

  // Calculate totals
  let totalActiveMinutes = 0;
  const stageBreakdowns: StageTimeBreakdown[] = [];

  for (const [stage, data] of stageData) {
    totalActiveMinutes += data.activeMinutes;
    stageBreakdowns.push({
      stage,
      activeMinutes: data.activeMinutes,
      promptCount: data.promptCount,
      percentage: 0, // Will calculate after totals
      gapsExcluded: data.gapsExcluded,
    });
  }

  // Calculate percentages
  for (const breakdown of stageBreakdowns) {
    breakdown.percentage = totalActiveMinutes > 0
      ? Math.round((breakdown.activeMinutes / totalActiveMinutes) * 100)
      : 0;
  }

  // Sort by active minutes descending
  stageBreakdowns.sort((a, b) => b.activeMinutes - a.activeMinutes);

  return {
    sessionId,
    totalActiveMinutes: Math.round(totalActiveMinutes * 100) / 100,
    totalPrompts: sortedPrompts.length,
    gapsExcluded,
    totalGapMinutes: Math.round(totalGapMinutes * 100) / 100,
    stages: stageBreakdowns,
    segments,
  };
}

/**
 * Aggregate active time results across multiple sessions.
 *
 * @param sessionResults - Array of session time results
 * @returns Aggregated project time result
 */
export function calculateProjectActiveTime(
  sessionResults: SessionTimeResult[]
): ProjectTimeResult {
  if (!sessionResults || sessionResults.length === 0) {
    return {
      totalActiveMinutes: 0,
      totalPrompts: 0,
      totalGapsExcluded: 0,
      totalGapMinutes: 0,
      sessionCount: 0,
      stages: [],
      averageSessionMinutes: 0,
    };
  }

  // Aggregate stage data
  const stageData: Map<ProjectStage, { activeMinutes: number; promptCount: number; gapsExcluded: number }> = new Map();

  let totalActiveMinutes = 0;
  let totalPrompts = 0;
  let totalGapsExcluded = 0;
  let totalGapMinutes = 0;

  for (const session of sessionResults) {
    totalActiveMinutes += session.totalActiveMinutes;
    totalPrompts += session.totalPrompts;
    totalGapsExcluded += session.gapsExcluded;
    totalGapMinutes += session.totalGapMinutes;

    for (const stageBreakdown of session.stages) {
      const existing = stageData.get(stageBreakdown.stage);
      if (existing) {
        existing.activeMinutes += stageBreakdown.activeMinutes;
        existing.promptCount += stageBreakdown.promptCount;
        existing.gapsExcluded += stageBreakdown.gapsExcluded;
      } else {
        stageData.set(stageBreakdown.stage, {
          activeMinutes: stageBreakdown.activeMinutes,
          promptCount: stageBreakdown.promptCount,
          gapsExcluded: stageBreakdown.gapsExcluded,
        });
      }
    }
  }

  // Build stage breakdowns with percentages
  const stageBreakdowns: StageTimeBreakdown[] = [];

  for (const [stage, data] of stageData) {
    stageBreakdowns.push({
      stage,
      activeMinutes: Math.round(data.activeMinutes * 100) / 100,
      promptCount: data.promptCount,
      percentage: totalActiveMinutes > 0
        ? Math.round((data.activeMinutes / totalActiveMinutes) * 100)
        : 0,
      gapsExcluded: data.gapsExcluded,
    });
  }

  // Sort by active minutes descending
  stageBreakdowns.sort((a, b) => b.activeMinutes - a.activeMinutes);

  return {
    totalActiveMinutes: Math.round(totalActiveMinutes * 100) / 100,
    totalPrompts,
    totalGapsExcluded,
    totalGapMinutes: Math.round(totalGapMinutes * 100) / 100,
    sessionCount: sessionResults.length,
    stages: stageBreakdowns,
    averageSessionMinutes: Math.round((totalActiveMinutes / sessionResults.length) * 100) / 100,
  };
}

/**
 * Calculate time spent in each stage as a Map for easy lookup.
 *
 * @param result - Session or project time result
 * @returns Map of stage to active minutes
 */
export function getStageTimeMap(
  result: SessionTimeResult | ProjectTimeResult
): Map<ProjectStage, number> {
  const map = new Map<ProjectStage, number>();
  for (const stage of result.stages) {
    map.set(stage.stage, stage.activeMinutes);
  }
  return map;
}

/**
 * Find the dominant stage (most time spent).
 *
 * @param result - Session or project time result
 * @returns The stage with most active time, or null if no data
 */
export function findDominantStage(
  result: SessionTimeResult | ProjectTimeResult
): ProjectStage | null {
  if (result.stages.length === 0) return null;
  // Stages are sorted by activeMinutes descending
  return result.stages[0]!.stage;
}

/**
 * Calculate efficiency ratio (prompts per hour).
 *
 * @param result - Session or project time result
 * @returns Prompts per hour of active time
 */
export function calculatePromptsPerHour(
  result: SessionTimeResult | ProjectTimeResult
): number {
  if (result.totalActiveMinutes === 0) return 0;
  const hours = result.totalActiveMinutes / 60;
  return Math.round((result.totalPrompts / hours) * 100) / 100;
}
