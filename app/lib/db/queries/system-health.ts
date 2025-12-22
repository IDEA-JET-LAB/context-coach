/**
 * System Health Query Functions
 * Story 7.2: Admin Dashboard Overview
 *
 * System health metrics for the admin dashboard.
 * Uses service role client to bypass RLS for cross-team queries.
 *
 * IMPORTANT: These functions should ONLY be called from server-side code
 * and ONLY after admin access has been verified.
 */

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * M43 Fix: Configurable max retries via environment variable.
 * Default is 3 retries if not configured.
 */
function getMaxRetries(): number {
  const envValue = process.env.ANALYSIS_MAX_RETRIES;
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 3; // Default value
}

export interface SystemHealth {
  successRate: number;
  errorRate: number;
  averageAnalysisTime: number;
  pendingCount: number;
  processingCount: number;
}

export type HealthStatus = "green" | "yellow" | "red";

export interface HealthThresholds {
  successRate: { green: number; yellow: number };
  errorRate: { green: number; yellow: number };
  avgTime: { green: number; yellow: number };
  pendingQueue: { green: number; yellow: number };
}

/**
 * Default health thresholds as defined in the story.
 */
export const DEFAULT_HEALTH_THRESHOLDS: HealthThresholds = {
  successRate: { green: 95, yellow: 90 }, // >= green is green, >= yellow is yellow, else red
  errorRate: { green: 1, yellow: 5 }, // < green is green, < yellow is yellow, else red (inverted)
  avgTime: { green: 3, yellow: 10 }, // < green is green, < yellow is yellow, else red (inverted)
  pendingQueue: { green: 50, yellow: 100 }, // < green is green, < yellow is yellow, else red (inverted)
};

/**
 * Get system health metrics for the admin dashboard.
 * Calculates analysis success rate, average time, and queue status.
 *
 * @param lookbackHours - Number of hours to look back (default: 24)
 * @returns System health metrics
 */
export async function getSystemHealth(lookbackHours: number = 24): Promise<SystemHealth> {
  const supabase = createAdminClient();

  try {
    const lookbackTime = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();

    // Fetch prompt status counts and analysis timing data
    const [statusData, analysisTimeData] = await Promise.all([
      // Get analysis status distribution
      supabase
        .from("prompts")
        .select("analysis_status")
        .gte("created_at", lookbackTime),
      // Get analysis timing data by joining prompts and prompt_analyses
      supabase
        .from("prompt_analyses")
        .select(`
          created_at,
          prompt:prompts!inner(created_at)
        `)
        .gte("created_at", lookbackTime)
        .limit(1000), // Limit for performance
    ]);

    // Calculate status counts
    const counts = { complete: 0, failed: 0, pending: 0, processing: 0 };
    statusData.data?.forEach((row) => {
      const status = row.analysis_status as keyof typeof counts;
      if (status in counts) {
        counts[status]++;
      }
    });

    // Calculate success rate
    const totalProcessed = counts.complete + counts.failed;
    const successRate = totalProcessed > 0
      ? Math.round((counts.complete / totalProcessed) * 100)
      : 100; // No failures means 100% success

    // Calculate average analysis time
    let averageAnalysisTime = 0;
    if (analysisTimeData.data && analysisTimeData.data.length > 0) {
      const durations: number[] = [];

      analysisTimeData.data.forEach((analysis) => {
        const analysisCreatedAt = new Date(analysis.created_at).getTime();
        // Type assertion for the nested prompt data
        const promptData = analysis.prompt as unknown as { created_at: string };
        if (promptData?.created_at) {
          const promptCreatedAt = new Date(promptData.created_at).getTime();
          const durationSeconds = (analysisCreatedAt - promptCreatedAt) / 1000;
          if (durationSeconds > 0 && durationSeconds < 3600) { // Sanity check: < 1 hour
            durations.push(durationSeconds);
          }
        }
      });

      if (durations.length > 0) {
        const sum = durations.reduce((acc, d) => acc + d, 0);
        averageAnalysisTime = Math.round((sum / durations.length) * 10) / 10; // 1 decimal
      }
    }

    return {
      successRate,
      errorRate: 100 - successRate,
      averageAnalysisTime,
      pendingCount: counts.pending,
      processingCount: counts.processing,
    };
  } catch (error) {
    console.error("[ADMIN] getSystemHealth failed:", error);
    return {
      successRate: 100,
      errorRate: 0,
      averageAnalysisTime: 0,
      pendingCount: 0,
      processingCount: 0,
    };
  }
}

/**
 * Determine health status based on value and thresholds.
 *
 * @param value - The metric value
 * @param thresholds - The threshold configuration
 * @param inverted - If true, lower values are better (like error rate)
 * @returns Health status color
 */
export function getHealthStatus(
  value: number,
  thresholds: { green: number; yellow: number },
  inverted: boolean = false
): HealthStatus {
  if (inverted) {
    // Lower is better (error rate, avg time, pending queue)
    if (value < thresholds.green) return "green";
    if (value < thresholds.yellow) return "yellow";
    return "red";
  } else {
    // Higher is better (success rate)
    if (value >= thresholds.green) return "green";
    if (value >= thresholds.yellow) return "yellow";
    return "red";
  }
}

/**
 * Get dead letter queue count (prompts that have exhausted retries).
 *
 * M43 Fix: Uses configurable max retries from environment variable.
 *
 * @returns Count of prompts in dead letter state
 */
export async function getDeadLetterCount(): Promise<number> {
  const supabase = createAdminClient();
  const maxRetries = getMaxRetries();

  try {
    const { count, error } = await supabase
      .from("prompts")
      .select("id", { count: "exact", head: true })
      .eq("analysis_status", "failed")
      .gte("analysis_attempts", maxRetries); // M43 Fix: Use configurable max retries

    if (error) {
      console.error("[ADMIN] getDeadLetterCount failed:", error);
      return 0;
    }

    return count ?? 0;
  } catch (error) {
    console.error("[ADMIN] getDeadLetterCount failed:", error);
    return 0;
  }
}

/**
 * Get combined system health data for the admin dashboard.
 *
 * @returns Complete system health data with status indicators
 */
export async function getSystemHealthWithStatus(): Promise<{
  health: SystemHealth;
  statuses: {
    successRate: HealthStatus;
    errorRate: HealthStatus;
    avgTime: HealthStatus;
    pendingQueue: HealthStatus;
  };
  deadLetterCount: number;
}> {
  const [health, deadLetterCount] = await Promise.all([
    getSystemHealth(),
    getDeadLetterCount(),
  ]);

  const thresholds = DEFAULT_HEALTH_THRESHOLDS;

  return {
    health,
    statuses: {
      successRate: getHealthStatus(health.successRate, thresholds.successRate, false),
      errorRate: getHealthStatus(health.errorRate, thresholds.errorRate, true),
      avgTime: getHealthStatus(health.averageAnalysisTime, thresholds.avgTime, true),
      pendingQueue: getHealthStatus(health.pendingCount, thresholds.pendingQueue, true),
    },
    deadLetterCount,
  };
}
