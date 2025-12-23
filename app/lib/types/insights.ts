/**
 * Types for Interactive Insights Dashboard (Story 21-11)
 */

import type { WorkStyleCategory } from '@/lib/analysis/work-style-classifier';
import type { TechnicalPersona } from '@/lib/analysis/technical-depth';
import type { LearningProgression } from '@/lib/analysis/learning-progression';
import type { WorkflowEfficiencyMetrics } from '@/lib/analysis/workflow-efficiency';

export type InsightsTimeRange = '7d' | '30d' | '90d' | 'all';

export interface InsightsSummary {
  totalPrompts: number;
  totalSessions: number;
  avgSessionDurationMinutes: number;
  avgPromptScore: number | null;
  scoreChange: number | null; // Percentage change from previous period
}

export interface InsightsWorkStyle {
  distribution: Partial<Record<WorkStyleCategory, number>>;
  primaryStyle: WorkStyleCategory | null;
  secondaryStyle: WorkStyleCategory | null;
}

export interface InsightsTechnicalProfile {
  persona: TechnicalPersona | null;
  confidence: number;
  breakdown: {
    architecture: number;
    debugging: number;
    testing: number;
    implementation: number;
    businessUx: number;
  };
}

export interface InsightsSentiment {
  overallPoliteRate: number;
  overallFrustratedRate: number;
  politenessRatio: number;
  trend: 'improving' | 'stable' | 'declining';
  byWorkStyle: Partial<Record<WorkStyleCategory, { politeRate: number; frustratedRate: number }>>;
}

export interface InsightsSessionHealth {
  avgHealthScore: number;
  healthDistribution: { healthy: number; warning: number; critical: number };
  avgSessionDuration: number;
  contextExhaustionRate: number;
}

export interface InsightsComplexity {
  avgComplexity: number;
  avgCharsPerPrompt: number;
  distribution: { simple: number; moderate: number; complex: number };
  codeInclusionRate: number;
}

export interface InsightsTiming {
  rapidFireRate: number;
  longPauseRate: number;
  followUpRate: number;
  avgGapSeconds: number;
  medianGapSeconds: number;
}

export interface InsightsToolUsage {
  distribution: Record<string, number>;
  topTools: string[];
  underutilized: string[];
  userProfile: string;
}

export interface InsightsActivityHeatMap {
  data: number[][]; // [dayOfWeek 0-6][hourOfDay 0-23] = count
  maxCount: number;
  totalActiveHours: number;
  peakHour: number;
  peakDay: number;
}

export interface InsightsTeamAverages {
  avgPromptScore: number;
  avgSessionDuration: number;
  avgPromptsPerSession: number;
  avgComplexity: number;
}

export interface InsightsTeamComparison {
  isTeamMember: boolean;
  teamAverages: InsightsTeamAverages | null;
  userPercentiles: {
    promptScore: number;
    sessionDuration: number;
    promptsPerSession: number;
    complexity: number;
  } | null;
  comparison: {
    metric: string;
    userValue: number;
    teamAverage: number;
    difference: number;
    isAboveAverage: boolean;
  }[] | null;
}

export interface InsightsWeeklyReportChange {
  metric: string;
  previousValue: number;
  currentValue: number;
  changePercent: number;
  isImprovement: boolean;
}

export interface InsightsWeeklyAchievement {
  id: string;
  name: string;
  description: string;
  unlockedAt: string;
}

export interface InsightsWeeklyComparison {
  totalPrompts: { current: number; previous: number; change: number };
  avgScore: { current: number; previous: number; change: number };
  sessionCount: { current: number; previous: number; change: number };
}

export interface InsightsWeeklyReport {
  weekStartDate: string;
  weekEndDate: string;
  highlights: string[];
  notableChanges: InsightsWeeklyReportChange[];
  achievementsUnlocked: InsightsWeeklyAchievement[];
  comparisonToPreviousWeek: InsightsWeeklyComparison;
}

export interface InsightsResponse {
  summary: InsightsSummary;
  workStyle: InsightsWorkStyle;
  technicalProfile: InsightsTechnicalProfile;
  sentiment: InsightsSentiment;
  sessionHealth: InsightsSessionHealth;
  complexity: InsightsComplexity;
  timing: InsightsTiming;
  toolUsage: InsightsToolUsage;
  learning: LearningProgression | null;
  efficiency: WorkflowEfficiencyMetrics | null;
  personalizedTips: string[];
  activityHeatMap: InsightsActivityHeatMap;
  teamComparison: InsightsTeamComparison;
  weeklyReport: InsightsWeeklyReport;
}

export interface InsightsApiParams {
  userId: string;
  timeRange: InsightsTimeRange;
  teamId?: string;
}
