/**
 * Session Stage Summary - Story 31-4
 *
 * Calculates and stores session stage summaries that include both
 * prompt counts AND active time per stage. Integrates with the
 * stage persistence pipeline to provide comprehensive analysis data.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createScopedLogger } from "@/lib/utils/logger";
import {
  calculateSessionActiveTime,
  type SessionTimeResult,
  type PromptWithStage,
} from "./active-time-calculator";
import type { StageDetectionResult } from "./stage-detector";
import type { ProjectStage } from "@/lib/types/conversations";

const logger = createScopedLogger("STAGE_SUMMARY");

// ============================================================================
// Types
// ============================================================================

/**
 * Stage data stored in session's stage_breakdown JSONB column.
 */
export interface StageData {
  /** Number of prompts in this stage */
  promptCount: number;
  /** Active work minutes in this stage */
  activeMinutes: number;
  /** Percentage of total active time */
  percentage: number;
}

/**
 * Complete stage breakdown stored on sessions.
 */
export interface SessionStageBreakdown {
  /** Stage-by-stage breakdown */
  stages: Record<string, StageData>;
  /** Total active work minutes */
  totalActiveMinutes: number;
  /** Total number of prompts */
  totalPrompts: number;
  /** Number of stage transitions */
  transitionCount: number;
  /** Number of gaps > 30 min filtered out */
  gapsExcluded: number;
  /** When this analysis was performed */
  analyzedAt: string;
}

/**
 * Result of updating a session summary.
 */
export interface StageSummaryResult {
  /** Session ID that was updated */
  sessionId: string;
  /** Whether update was successful */
  success: boolean;
  /** Primary stage (most active time) */
  primaryStage: ProjectStage | null;
  /** Total active minutes calculated */
  totalActiveMinutes: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Input for building stage summary from detection results.
 */
export interface StageSummaryInput {
  /** Session ID */
  sessionId: string;
  /** Detection results from stage detector */
  detectionResults: StageDetectionResult[];
  /** Prompt data with timestamps */
  prompts: Array<{
    id: string;
    created_at: string;
  }>;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Builds a SessionStageBreakdown from detection results and prompts.
 *
 * @param input - Detection results and prompt timestamps
 * @returns Complete stage breakdown with time data
 */
export function buildStageSummary(
  input: StageSummaryInput
): SessionStageBreakdown {
  const { detectionResults, prompts } = input;

  // Create timestamp map for efficient lookup
  const timestampMap = new Map<string, string>();
  for (const prompt of prompts) {
    timestampMap.set(prompt.id, prompt.created_at);
  }

  // Convert to PromptWithStage format for time calculation
  const promptsWithStage: PromptWithStage[] = detectionResults.map((result) => ({
    id: result.promptId,
    timestamp: timestampMap.get(result.promptId) || new Date().toISOString(),
    detectedStage: result.detectedStage,
  }));

  // Calculate active time
  const timeResult = calculateSessionActiveTime(
    input.sessionId,
    promptsWithStage
  );

  // Count transitions (where isTransitionPoint is true)
  const transitionCount = detectionResults.filter(
    (r) => r.isTransitionPoint
  ).length;

  // Build stages breakdown
  const stages: Record<string, StageData> = {};
  for (const stage of timeResult.stages) {
    stages[stage.stage] = {
      promptCount: stage.promptCount,
      activeMinutes: stage.activeMinutes,
      percentage: stage.percentage,
    };
  }

  return {
    stages,
    totalActiveMinutes: timeResult.totalActiveMinutes,
    totalPrompts: timeResult.totalPrompts,
    transitionCount,
    gapsExcluded: timeResult.gapsExcluded,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Determines the primary stage (most active time).
 *
 * @param breakdown - Stage breakdown data
 * @returns Stage with most active time, or 'unknown' if empty
 */
export function determinePrimaryStage(
  breakdown: SessionStageBreakdown
): ProjectStage {
  let primaryStage: ProjectStage = "unknown";
  let maxMinutes = 0;

  for (const [stage, data] of Object.entries(breakdown.stages)) {
    if (data.activeMinutes > maxMinutes) {
      maxMinutes = data.activeMinutes;
      primaryStage = stage as ProjectStage;
    }
  }

  return primaryStage;
}

/**
 * Updates a session with stage summary data.
 *
 * @param sessionId - Session to update
 * @param breakdown - Stage breakdown to store
 * @returns Update result
 */
export async function updateSessionStageSummary(
  sessionId: string,
  breakdown: SessionStageBreakdown
): Promise<StageSummaryResult> {
  const supabase = createAdminClient();

  try {
    const primaryStage = determinePrimaryStage(breakdown);

    const { error } = await supabase
      .from("sessions")
      .update({
        primary_stage: primaryStage,
        stage_breakdown: breakdown,
      })
      .eq("id", sessionId);

    if (error) {
      logger.warn("Failed to update session stage summary", {
        sessionId,
        error: error.message,
      });
      return {
        sessionId,
        success: false,
        primaryStage: null,
        totalActiveMinutes: 0,
        error: error.message,
      };
    }

    logger.debug("Session stage summary updated", {
      sessionId,
      primaryStage,
      totalActiveMinutes: breakdown.totalActiveMinutes,
    });

    return {
      sessionId,
      success: true,
      primaryStage,
      totalActiveMinutes: breakdown.totalActiveMinutes,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Error updating session stage summary", {
      sessionId,
      error: errorMessage,
    });
    return {
      sessionId,
      success: false,
      primaryStage: null,
      totalActiveMinutes: 0,
      error: errorMessage,
    };
  }
}

/**
 * Updates multiple sessions with stage summaries.
 *
 * Continues processing on individual failures.
 *
 * @param inputs - Array of summary inputs
 * @returns Summary of update results
 */
export async function updateProjectStageSummaries(
  inputs: StageSummaryInput[]
): Promise<{
  totalSessions: number;
  updatedSessions: number;
  failedSessions: number;
  errors: Array<{ sessionId: string; error: string }>;
}> {
  const errors: Array<{ sessionId: string; error: string }> = [];
  let updatedSessions = 0;

  for (const input of inputs) {
    try {
      const breakdown = buildStageSummary(input);
      const result = await updateSessionStageSummary(input.sessionId, breakdown);

      if (result.success) {
        updatedSessions++;
      } else {
        errors.push({
          sessionId: input.sessionId,
          error: result.error || "Unknown error",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({
        sessionId: input.sessionId,
        error: errorMessage,
      });
    }
  }

  return {
    totalSessions: inputs.length,
    updatedSessions,
    failedSessions: errors.length,
    errors,
  };
}

/**
 * Creates a stage summary from a SessionTimeResult directly.
 *
 * Useful when time calculation was already performed elsewhere.
 *
 * @param timeResult - Pre-calculated time result
 * @param transitionCount - Number of stage transitions
 * @returns Stage breakdown ready for storage
 */
export function createBreakdownFromTimeResult(
  timeResult: SessionTimeResult,
  transitionCount: number
): SessionStageBreakdown {
  const stages: Record<string, StageData> = {};

  for (const stage of timeResult.stages) {
    stages[stage.stage] = {
      promptCount: stage.promptCount,
      activeMinutes: stage.activeMinutes,
      percentage: stage.percentage,
    };
  }

  return {
    stages,
    totalActiveMinutes: timeResult.totalActiveMinutes,
    totalPrompts: timeResult.totalPrompts,
    transitionCount,
    gapsExcluded: timeResult.gapsExcluded,
    analyzedAt: new Date().toISOString(),
  };
}
