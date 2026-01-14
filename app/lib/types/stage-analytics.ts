/**
 * Stage Analytics Types - Story 31-5
 *
 * Type definitions for project-level stage analytics API responses.
 */

import type { ProjectStage } from '@/lib/types/conversations';

/**
 * Status of stage analysis across all sessions in a project.
 */
export interface StageAnalysisStatus {
  /** Total number of sessions in the project */
  totalSessions: number;
  /** Number of sessions with completed stage analysis */
  analyzedSessions: number;
  /** Number of sessions pending analysis */
  pendingSessions: number;
  /** Number of sessions with analysis errors */
  errorSessions: number;
  /** When the most recent analysis completed */
  lastAnalyzedAt: string | null;
}

/**
 * Breakdown of time and activity for a single stage.
 */
export interface StageBreakdownItem {
  /** The project stage */
  stage: ProjectStage;
  /** Total active minutes spent in this stage */
  activeMinutes: number;
  /** Total number of prompts in this stage */
  promptCount: number;
  /** Percentage of total active time */
  percentage: number;
  /** Number of sessions that included this stage */
  sessionCount: number;
}

/**
 * Summary of stage analytics data.
 */
export interface StageAnalyticsSummary {
  /** Total active minutes across all stages */
  totalActiveMinutes: number;
  /** Total number of prompts analyzed */
  totalPrompts: number;
  /** Number of sessions included in analysis */
  sessionsAnalyzed: number;
  /** Date range of analyzed data */
  dateRange: {
    start: string;
    end: string;
  };
  /** Breakdown by stage, sorted by active minutes descending */
  stageBreakdown: StageBreakdownItem[];
}

/**
 * Complete project stage analytics response.
 */
export interface ProjectStageAnalytics {
  /** Project identifier */
  projectId: string;
  /** Project name */
  projectName: string;
  /** Analysis status across sessions */
  analysisStatus: StageAnalysisStatus;
  /** Aggregated summary data */
  summary: StageAnalyticsSummary;
  /** Primary stage (most time spent) */
  primaryStage: ProjectStage;
  /** Average active minutes per session */
  averageSessionMinutes: number;
}

/**
 * Stage data for a single time period (day or week).
 */
export interface StageTimelineDataPoint {
  /** Date string (YYYY-MM-DD) */
  date: string;
  /** Stage-by-stage breakdown for this period */
  stages: Record<string, {
    activeMinutes: number;
    promptCount: number;
    sessionCount: number;
  }>;
  /** Total active minutes in this period */
  totalMinutes: number;
}

/**
 * Timeline data for stage analytics visualization.
 */
export interface StageTimelineData {
  /** Project identifier */
  projectId: string;
  /** Time granularity */
  granularity: 'day' | 'week';
  /** Data points sorted by date ascending */
  dataPoints: StageTimelineDataPoint[];
}

/**
 * Valid time range filter values.
 */
export type TimeRangeFilter = '7d' | '30d' | 'all';

/**
 * Valid granularity values for timeline.
 */
export type TimelineGranularity = 'day' | 'week';
