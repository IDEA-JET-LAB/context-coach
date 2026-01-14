/**
 * Stage Persistence Service - Story 31-2
 *
 * Provides functions to analyze sessions and persist detected stages
 * to the database. Supports both individual session analysis and
 * batch processing for entire projects.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createScopedLogger } from "@/lib/utils/logger";
import { isValidUuid } from "@/lib/utils/uuid";
import {
  detectConversationStages,
  findPrimaryStage,
  calculateStageDistribution,
  type ConversationPromptInput,
  type StageDetectionResult,
} from "./stage-detector";
import {
  buildStageSummary,
  determinePrimaryStage,
  type StageSummaryInput,
} from "./stage-summary";
import type { ProjectStage } from "@/lib/types/conversations";

const logger = createScopedLogger("STAGE_PERSISTENCE");

// ============================================================================
// Types
// ============================================================================

/**
 * Status of stage analysis for a session.
 */
export type StageAnalysisStatus = "pending" | "processing" | "complete" | "error";

/**
 * Result of analyzing a single session's stages.
 */
export interface SessionAnalysisResult {
  /** Database UUID of the session */
  sessionId: string;
  /** Whether analysis was successful */
  success: boolean;
  /** Number of prompts analyzed */
  promptsAnalyzed: number;
  /** Number of prompts updated with stage */
  promptsUpdated: number;
  /** Primary stage detected for the session */
  primaryStage: ProjectStage | null;
  /** Error message if analysis failed */
  error?: string;
}

/**
 * Result of batch analyzing a project's sessions.
 */
export interface ProjectAnalysisResult {
  /** Project ID that was analyzed */
  projectId: string;
  /** Total number of sessions processed */
  sessionsProcessed: number;
  /** Number of sessions successfully analyzed */
  sessionsSucceeded: number;
  /** Number of sessions that failed analysis */
  sessionsFailed: number;
  /** Individual session results */
  results: SessionAnalysisResult[];
  /** Total sessions linked to this project (regardless of status) */
  totalProjectSessions: number;
  /** Sessions already analyzed (status = 'complete') */
  alreadyAnalyzedSessions: number;
}

/**
 * Status of project analysis progress.
 */
export interface ProjectAnalysisStatus {
  /** Project ID */
  projectId: string;
  /** Total sessions to analyze */
  totalSessions: number;
  /** Sessions pending analysis */
  pendingSessions: number;
  /** Sessions currently processing */
  processingSessions: number;
  /** Sessions completed */
  completedSessions: number;
  /** Sessions with errors */
  errorSessions: number;
  /** Whether analysis is complete */
  isComplete: boolean;
  /** When the most recent session was analyzed */
  lastAnalyzedAt: string | null;
}

/**
 * Options for batch analysis.
 */
export interface BatchAnalysisOptions {
  /** Maximum sessions to process in one batch (default: all pending sessions) */
  batchSize?: number;
  /** Whether to re-analyze already completed sessions (default: false) */
  reanalyze?: boolean;
}

// ============================================================================
// Session Analysis
// ============================================================================

/**
 * Analyzes a session's prompts and persists detected stages.
 *
 * This function:
 * 1. Fetches all prompts for the session
 * 2. Runs stage detection on the conversation
 * 3. Updates each prompt's detected_stage column
 * 4. Updates session's primary_stage and stage analysis status
 *
 * @param sessionId - Database UUID of the session to analyze
 * @returns Analysis result with success status and statistics
 *
 * @example
 * const result = await analyzeAndPersistSessionStages(sessionId);
 * if (result.success) {
 *   console.log(`Analyzed ${result.promptsAnalyzed} prompts`);
 *   console.log(`Primary stage: ${result.primaryStage}`);
 * }
 */
export async function analyzeAndPersistSessionStages(
  sessionId: string
): Promise<SessionAnalysisResult> {
  // Validate session ID
  if (!isValidUuid(sessionId)) {
    logger.warn("Invalid session ID format", { sessionId });
    return {
      sessionId,
      success: false,
      promptsAnalyzed: 0,
      promptsUpdated: 0,
      primaryStage: null,
      error: "Invalid session ID format",
    };
  }

  const supabase = createAdminClient();

  try {
    // Mark session as processing
    await supabase
      .from("sessions")
      .update({
        stage_analysis_status: "processing",
        stage_analysis_error: null,
      })
      .eq("id", sessionId);

    // Fetch prompts for the session, ordered by sequence
    const { data: prompts, error: fetchError } = await supabase
      .from("prompts")
      .select("id, text, sequence_number, created_at")
      .eq("session_uuid", sessionId)
      .order("sequence_number", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch prompts: ${fetchError.message}`);
    }

    // No prompts - mark as complete but with no updates
    if (!prompts || prompts.length === 0) {
      await supabase
        .from("sessions")
        .update({
          stage_analysis_status: "complete",
          stage_analysis_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      logger.debug("No prompts to analyze", { sessionId });
      return {
        sessionId,
        success: true,
        promptsAnalyzed: 0,
        promptsUpdated: 0,
        primaryStage: null,
      };
    }

    // Convert to stage detector input format
    const promptInputs: ConversationPromptInput[] = prompts.map((p, index) => ({
      id: p.id,
      text: p.text || "",
      sequenceNumber: p.sequence_number ?? index + 1,
      timestamp: p.created_at,
    }));

    // Run stage detection
    const detectionResults = detectConversationStages(promptInputs);

    // Build update map: promptId -> detectedStage
    const stageUpdates: { id: string; detected_stage: ProjectStage }[] = [];
    for (const result of detectionResults) {
      stageUpdates.push({
        id: result.promptId,
        detected_stage: result.detectedStage,
      });
    }

    // Batch update prompts with detected stages
    let updatedCount = 0;
    for (const update of stageUpdates) {
      const { error: updateError } = await supabase
        .from("prompts")
        .update({ detected_stage: update.detected_stage })
        .eq("id", update.id);

      if (!updateError) {
        updatedCount++;
      } else {
        logger.warn("Failed to update prompt stage", {
          promptId: update.id,
          error: updateError.message,
        });
      }
    }

    // Build stage summary with active time calculations (Story 31-4)
    const summaryInput: StageSummaryInput = {
      sessionId,
      detectionResults,
      prompts: prompts.map((p) => ({
        id: p.id,
        created_at: p.created_at,
      })),
    };
    const stageBreakdown = buildStageSummary(summaryInput);

    // Determine primary stage based on active time (not just prompt count)
    const primaryStage = determinePrimaryStage(stageBreakdown);

    // Update session with analysis results including active time data
    await supabase
      .from("sessions")
      .update({
        stage_analysis_status: "complete",
        stage_analysis_at: new Date().toISOString(),
        stage_analysis_error: null,
        primary_stage: primaryStage,
        stage_breakdown: stageBreakdown,
      })
      .eq("id", sessionId);

    logger.log("Session stage analysis complete", {
      sessionId,
      promptsAnalyzed: prompts.length,
      promptsUpdated: updatedCount,
      primaryStage,
    });

    return {
      sessionId,
      success: true,
      promptsAnalyzed: prompts.length,
      promptsUpdated: updatedCount,
      primaryStage,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Update session with error status
    await supabase
      .from("sessions")
      .update({
        stage_analysis_status: "error",
        stage_analysis_error: errorMessage,
      })
      .eq("id", sessionId);

    logger.error("Session stage analysis failed", error, { sessionId });

    return {
      sessionId,
      success: false,
      promptsAnalyzed: 0,
      promptsUpdated: 0,
      primaryStage: null,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Project Batch Analysis
// ============================================================================

/**
 * Analyzes all sessions in a project and persists detected stages.
 *
 * This function processes sessions in batches and continues even if
 * individual sessions fail. Each session is analyzed independently.
 *
 * @param projectId - Database UUID of the project
 * @param options - Batch analysis options
 * @returns Aggregate result with per-session statistics
 *
 * @example
 * const result = await analyzeProjectStages(projectId);
 * console.log(`Processed ${result.sessionsProcessed} sessions`);
 * console.log(`${result.sessionsSucceeded} succeeded, ${result.sessionsFailed} failed`);
 */
export async function analyzeProjectStages(
  projectId: string,
  options: BatchAnalysisOptions = {}
): Promise<ProjectAnalysisResult> {
  const { batchSize, reanalyze = false } = options;

  // Validate project ID
  if (!isValidUuid(projectId)) {
    logger.warn("Invalid project ID format", { projectId });
    return {
      projectId,
      sessionsProcessed: 0,
      sessionsSucceeded: 0,
      sessionsFailed: 0,
      results: [],
      totalProjectSessions: 0,
      alreadyAnalyzedSessions: 0,
    };
  }

  const supabase = createAdminClient();

  // First, get total counts for better diagnostics
  const { data: allSessions, error: countError } = await supabase
    .from("sessions")
    .select("id, stage_analysis_status")
    .eq("project_id", projectId);

  const totalProjectSessions = allSessions?.length ?? 0;
  const alreadyAnalyzedSessions = (allSessions ?? []).filter(
    (s) => s.stage_analysis_status === "complete"
  ).length;

  if (countError) {
    logger.error("Failed to count sessions for project", countError, { projectId });
    return {
      projectId,
      sessionsProcessed: 0,
      sessionsSucceeded: 0,
      sessionsFailed: 0,
      results: [],
      totalProjectSessions: 0,
      alreadyAnalyzedSessions: 0,
    };
  }

  // Build query for sessions to analyze
  let query = supabase
    .from("sessions")
    .select("id")
    .eq("project_id", projectId);

  // Only include sessions that haven't been analyzed unless reanalyze is true
  if (!reanalyze) {
    query = query.or("stage_analysis_status.is.null,stage_analysis_status.neq.complete");
  }

  // Order by creation time for consistent processing
  query = query.order("created_at", { ascending: true });

  // Only apply limit if batchSize is explicitly provided
  if (batchSize !== undefined && batchSize > 0) {
    query = query.limit(batchSize);
  }

  const { data: sessions, error: fetchError } = await query;

  if (fetchError) {
    logger.error("Failed to fetch sessions for project", fetchError, { projectId });
    return {
      projectId,
      sessionsProcessed: 0,
      sessionsSucceeded: 0,
      sessionsFailed: 0,
      results: [],
      totalProjectSessions,
      alreadyAnalyzedSessions,
    };
  }

  if (!sessions || sessions.length === 0) {
    logger.debug("No sessions to analyze", { projectId, reanalyze, totalProjectSessions, alreadyAnalyzedSessions });
    return {
      projectId,
      sessionsProcessed: 0,
      sessionsSucceeded: 0,
      sessionsFailed: 0,
      results: [],
      totalProjectSessions,
      alreadyAnalyzedSessions,
    };
  }

  logger.log("Starting project stage analysis", {
    projectId,
    sessionCount: sessions.length,
    batchSize: batchSize ?? "unlimited",
    reanalyze,
  });

  const results: SessionAnalysisResult[] = [];
  let succeeded = 0;
  let failed = 0;

  // Process each session
  for (const session of sessions) {
    const result = await analyzeAndPersistSessionStages(session.id);
    results.push(result);

    if (result.success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  logger.log("Project stage analysis complete", {
    projectId,
    sessionsProcessed: sessions.length,
    succeeded,
    failed,
  });

  return {
    projectId,
    sessionsProcessed: sessions.length,
    sessionsSucceeded: succeeded,
    sessionsFailed: failed,
    results,
    totalProjectSessions,
    alreadyAnalyzedSessions: alreadyAnalyzedSessions + succeeded, // Updated count after this batch
  };
}

// ============================================================================
// Status Queries
// ============================================================================

/**
 * Gets the current stage analysis status for a project.
 *
 * @param projectId - Database UUID of the project
 * @returns Status summary with counts per status
 */
export async function getProjectAnalysisStatus(
  projectId: string
): Promise<ProjectAnalysisStatus | null> {
  if (!isValidUuid(projectId)) {
    return null;
  }

  const supabase = createAdminClient();

  // Count sessions by analysis status and get last analyzed time
  const { data: statusCounts, error } = await supabase
    .from("sessions")
    .select("stage_analysis_status, stage_analysis_at")
    .eq("project_id", projectId);

  if (error) {
    logger.error("Failed to fetch project analysis status", error, { projectId });
    return null;
  }

  const counts = {
    pending: 0,
    processing: 0,
    complete: 0,
    error: 0,
    null: 0,
  };

  let lastAnalyzedAt: string | null = null;

  for (const row of statusCounts || []) {
    const status = row.stage_analysis_status as string | null;
    if (status === null) {
      counts.null++;
    } else if (status in counts) {
      counts[status as keyof typeof counts]++;
    }

    // Track the most recent analysis timestamp
    if (row.stage_analysis_at) {
      if (!lastAnalyzedAt || new Date(row.stage_analysis_at) > new Date(lastAnalyzedAt)) {
        lastAnalyzedAt = row.stage_analysis_at;
      }
    }
  }

  const totalSessions = statusCounts?.length || 0;
  const pendingSessions = counts.pending + counts.null;
  const isComplete = pendingSessions === 0 && counts.processing === 0;

  return {
    projectId,
    totalSessions,
    pendingSessions,
    processingSessions: counts.processing,
    completedSessions: counts.complete,
    errorSessions: counts.error,
    isComplete,
    lastAnalyzedAt,
  };
}

/**
 * Gets the stage analysis status for a specific session.
 *
 * @param sessionId - Database UUID of the session
 * @returns Status and any error message
 */
export async function getSessionAnalysisStatus(
  sessionId: string
): Promise<{ status: StageAnalysisStatus | null; error: string | null } | null> {
  if (!isValidUuid(sessionId)) {
    return null;
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("sessions")
    .select("stage_analysis_status, stage_analysis_error")
    .eq("id", sessionId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    status: data.stage_analysis_status as StageAnalysisStatus | null,
    error: data.stage_analysis_error,
  };
}
