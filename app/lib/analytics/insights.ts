/**
 * Insights analytics aggregation for Interactive Insights Dashboard (Story 21-11)
 */

import { subDays, startOfWeek, endOfWeek, subWeeks, format } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  InsightsResponse,
  InsightsTimeRange,
  InsightsSummary,
  InsightsWorkStyle,
  InsightsTechnicalProfile,
  InsightsSentiment,
  InsightsSessionHealth,
  InsightsComplexity,
  InsightsTiming,
  InsightsToolUsage,
  InsightsActivityHeatMap,
  InsightsTeamComparison,
  InsightsWeeklyReport,
} from '@/lib/types/insights';
import type { WorkStyleCategory } from '@/lib/analysis/work-style-classifier';
import type { TechnicalPersona } from '@/lib/analysis/technical-depth';
import type { LearningProgression } from '@/lib/analysis/learning-progression';
import type { WorkflowEfficiencyMetrics } from '@/lib/analysis/workflow-efficiency';

interface PromptRow {
  id: string;
  created_at: string;
  char_count: number;
  word_count: number;
  work_style: WorkStyleCategory | null;
  sentiment: string | null;
  complexity_score: number | null;
  has_code: boolean | null;
  analysis_status: string;
  prompt_analyses: {
    overall_score: number | null;
    dimension_scores: Record<string, { score: number }> | null;
  } | null;
}

interface SessionRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  prompt_count: number;
  avg_prompt_score: number | null;
  context_exhaustion_count: number;
  health_score: number | null;
}

/**
 * Get date range based on time range string
 */
function getDateRange(timeRange: InsightsTimeRange): { start: Date; end: Date } {
  const end = new Date();
  let start: Date;

  switch (timeRange) {
    case '7d':
      start = subDays(end, 7);
      break;
    case '30d':
      start = subDays(end, 30);
      break;
    case '90d':
      start = subDays(end, 90);
      break;
    case 'all':
    default:
      start = new Date(0); // Beginning of time
      break;
  }

  return { start, end };
}

/**
 * Calculate summary statistics
 */
async function calculateSummary(
  supabase: SupabaseClient,
  userId: string,
  prompts: PromptRow[],
  sessions: SessionRow[],
  timeRange: InsightsTimeRange
): Promise<InsightsSummary> {
  const totalPrompts = prompts.length;
  const totalSessions = sessions.length;

  // Calculate average session duration
  const sessionDurations = sessions
    .filter(s => s.ended_at)
    .map(s => {
      const start = new Date(s.started_at);
      const end = new Date(s.ended_at!);
      return (end.getTime() - start.getTime()) / 60000; // minutes
    });
  const avgSessionDurationMinutes = sessionDurations.length > 0
    ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length
    : 0;

  // Calculate average prompt score
  const scores = prompts
    .map(p => p.prompt_analyses?.overall_score)
    .filter((s): s is number => s !== null && s !== undefined);
  const avgPromptScore = scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null;

  // Calculate score change from previous period
  let scoreChange: number | null = null;
  if (timeRange !== 'all' && avgPromptScore !== null) {
    const { start } = getDateRange(timeRange);
    const periodLength = new Date().getTime() - start.getTime();
    const previousStart = new Date(start.getTime() - periodLength);

    const { data: previousPrompts } = await supabase
      .from('prompts')
      .select('prompt_analyses(overall_score)')
      .eq('user_id', userId)
      .gte('created_at', previousStart.toISOString())
      .lt('created_at', start.toISOString());

    const previousScores = (previousPrompts || [])
      .map((p: { prompt_analyses: { overall_score: number | null }[] }) =>
        p.prompt_analyses?.[0]?.overall_score)
      .filter((s): s is number => s !== null && s !== undefined);

    if (previousScores.length > 0) {
      const previousAvg = previousScores.reduce((a, b) => a + b, 0) / previousScores.length;
      if (previousAvg > 0) {
        scoreChange = ((avgPromptScore - previousAvg) / previousAvg) * 100;
      }
    }
  }

  return {
    totalPrompts,
    totalSessions,
    avgSessionDurationMinutes: Math.round(avgSessionDurationMinutes * 10) / 10,
    avgPromptScore: avgPromptScore !== null ? Math.round(avgPromptScore * 10) / 10 : null,
    scoreChange: scoreChange !== null ? Math.round(scoreChange * 10) / 10 : null,
  };
}

/**
 * Calculate work style distribution
 */
function calculateWorkStyle(prompts: PromptRow[]): InsightsWorkStyle {
  const distribution: Partial<Record<WorkStyleCategory, number>> = {};

  prompts.forEach(p => {
    if (p.work_style) {
      distribution[p.work_style] = (distribution[p.work_style] || 0) + 1;
    }
  });

  // Find primary and secondary styles
  const sorted = Object.entries(distribution)
    .sort((a, b) => b[1] - a[1]);

  const primaryStyle = sorted[0]?.[0] as WorkStyleCategory | undefined ?? null;
  const secondaryStyle = sorted[1]?.[0] as WorkStyleCategory | undefined ?? null;

  return {
    distribution,
    primaryStyle,
    secondaryStyle,
  };
}

/**
 * Calculate technical profile
 */
function calculateTechnicalProfile(workStyle: InsightsWorkStyle): InsightsTechnicalProfile {
  const total = Object.values(workStyle.distribution).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return {
      persona: null,
      confidence: 0,
      breakdown: { architecture: 0, debugging: 0, testing: 0, implementation: 0, businessUx: 0 },
    };
  }

  // Map work styles to technical categories using correct category names
  const breakdown = {
    architecture: (workStyle.distribution.architecture_questions || 0) / total,
    debugging: (workStyle.distribution.debugging || 0) / total,
    testing: (workStyle.distribution.testing || 0) / total,
    implementation: ((workStyle.distribution.file_operations || 0) + (workStyle.distribution.deployment || 0)) / total,
    businessUx: ((workStyle.distribution.design_iteration || 0) + (workStyle.distribution.business_discussion || 0) + (workStyle.distribution.context_recovery || 0)) / total,
  };

  // Determine persona based on dominant category
  let persona: TechnicalPersona = 'explorer';
  let maxRatio = 0;

  if (breakdown.architecture > maxRatio) {
    maxRatio = breakdown.architecture;
    persona = 'architect';
  }
  if (breakdown.debugging > maxRatio) {
    maxRatio = breakdown.debugging;
    persona = 'firefighter';
  }
  if (breakdown.implementation > maxRatio) {
    maxRatio = breakdown.implementation;
    persona = 'craftsman';
  }

  // Confidence based on how dominant the primary category is
  const confidence = maxRatio > 0.4 ? 0.8 : maxRatio > 0.25 ? 0.5 : 0.3;

  return {
    persona,
    confidence,
    breakdown: {
      architecture: Math.round(breakdown.architecture * 100),
      debugging: Math.round(breakdown.debugging * 100),
      testing: Math.round(breakdown.testing * 100),
      implementation: Math.round(breakdown.implementation * 100),
      businessUx: Math.round(breakdown.businessUx * 100),
    },
  };
}

/**
 * Calculate sentiment metrics
 */
function calculateSentiment(prompts: PromptRow[], workStyle: InsightsWorkStyle): InsightsSentiment {
  const sentimentCounts = { polite: 0, frustrated: 0, neutral: 0 };

  prompts.forEach(p => {
    const sentiment = p.sentiment?.toLowerCase();
    if (sentiment === 'polite' || sentiment === 'positive') {
      sentimentCounts.polite++;
    } else if (sentiment === 'frustrated' || sentiment === 'negative') {
      sentimentCounts.frustrated++;
    } else {
      sentimentCounts.neutral++;
    }
  });

  const total = prompts.length || 1;
  const overallPoliteRate = sentimentCounts.polite / total;
  const overallFrustratedRate = sentimentCounts.frustrated / total;
  const politenessRatio = sentimentCounts.frustrated > 0
    ? sentimentCounts.polite / sentimentCounts.frustrated
    : sentimentCounts.polite > 0 ? 10 : 1;

  // Determine trend (would need historical data for real implementation)
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (politenessRatio > 2) trend = 'improving';
  if (politenessRatio < 0.5) trend = 'declining';

  // Calculate by work style
  const byWorkStyle: InsightsSentiment['byWorkStyle'] = {};
  Object.keys(workStyle.distribution).forEach(style => {
    const stylePrompts = prompts.filter(p => p.work_style === style);
    const polite = stylePrompts.filter(p =>
      p.sentiment?.toLowerCase() === 'polite' || p.sentiment?.toLowerCase() === 'positive'
    ).length;
    const frustrated = stylePrompts.filter(p =>
      p.sentiment?.toLowerCase() === 'frustrated' || p.sentiment?.toLowerCase() === 'negative'
    ).length;
    const styleTotal = stylePrompts.length || 1;
    byWorkStyle[style as WorkStyleCategory] = {
      politeRate: polite / styleTotal,
      frustratedRate: frustrated / styleTotal,
    };
  });

  return {
    overallPoliteRate: Math.round(overallPoliteRate * 100) / 100,
    overallFrustratedRate: Math.round(overallFrustratedRate * 100) / 100,
    politenessRatio: Math.round(politenessRatio * 10) / 10,
    trend,
    byWorkStyle,
  };
}

/**
 * Calculate session health metrics
 */
function calculateSessionHealth(sessions: SessionRow[]): InsightsSessionHealth {
  const healthScores = sessions
    .map(s => s.health_score)
    .filter((s): s is number => s !== null);

  const avgHealthScore = healthScores.length > 0
    ? healthScores.reduce((a, b) => a + b, 0) / healthScores.length
    : 0;

  const healthDistribution = {
    healthy: healthScores.filter(s => s >= 70).length,
    warning: healthScores.filter(s => s >= 40 && s < 70).length,
    critical: healthScores.filter(s => s < 40).length,
  };

  const sessionDurations = sessions
    .filter(s => s.ended_at)
    .map(s => {
      const start = new Date(s.started_at);
      const end = new Date(s.ended_at!);
      return (end.getTime() - start.getTime()) / 60000;
    });

  const avgSessionDuration = sessionDurations.length > 0
    ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length
    : 0;

  const totalExhaustion = sessions.reduce((a, s) => a + (s.context_exhaustion_count || 0), 0);
  const contextExhaustionRate = sessions.length > 0
    ? totalExhaustion / sessions.length
    : 0;

  return {
    avgHealthScore: Math.round(avgHealthScore),
    healthDistribution,
    avgSessionDuration: Math.round(avgSessionDuration * 10) / 10,
    contextExhaustionRate: Math.round(contextExhaustionRate * 100) / 100,
  };
}

/**
 * Calculate complexity metrics
 */
function calculateComplexity(prompts: PromptRow[]): InsightsComplexity {
  const complexityScores = prompts
    .map(p => p.complexity_score)
    .filter((s): s is number => s !== null);

  const avgComplexity = complexityScores.length > 0
    ? complexityScores.reduce((a, b) => a + b, 0) / complexityScores.length
    : 0;

  const avgCharsPerPrompt = prompts.length > 0
    ? prompts.reduce((a, p) => a + p.char_count, 0) / prompts.length
    : 0;

  const distribution = {
    simple: complexityScores.filter(s => s <= 3).length,
    moderate: complexityScores.filter(s => s > 3 && s <= 7).length,
    complex: complexityScores.filter(s => s > 7).length,
  };

  const codePrompts = prompts.filter(p => p.has_code === true).length;
  const codeInclusionRate = prompts.length > 0 ? codePrompts / prompts.length : 0;

  return {
    avgComplexity: Math.round(avgComplexity * 10) / 10,
    avgCharsPerPrompt: Math.round(avgCharsPerPrompt),
    distribution,
    codeInclusionRate: Math.round(codeInclusionRate * 100) / 100,
  };
}

/**
 * Calculate timing metrics
 */
function calculateTiming(prompts: PromptRow[]): InsightsTiming {
  if (prompts.length < 2) {
    return {
      rapidFireRate: 0,
      longPauseRate: 0,
      followUpRate: 0,
      avgGapSeconds: 0,
      medianGapSeconds: 0,
    };
  }

  const sortedPrompts = [...prompts].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const gaps: number[] = [];
  for (let i = 1; i < sortedPrompts.length; i++) {
    const gap = (new Date(sortedPrompts[i]!.created_at).getTime() -
                 new Date(sortedPrompts[i - 1]!.created_at).getTime()) / 1000;
    gaps.push(gap);
  }

  const rapidFireThreshold = 30; // seconds
  const longPauseThreshold = 300; // 5 minutes

  const rapidFireCount = gaps.filter(g => g < rapidFireThreshold).length;
  const longPauseCount = gaps.filter(g => g > longPauseThreshold).length;

  const avgGapSeconds = gaps.length > 0
    ? gaps.reduce((a, b) => a + b, 0) / gaps.length
    : 0;

  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const medianGapSeconds = sortedGaps.length > 0
    ? sortedGaps[Math.floor(sortedGaps.length / 2)] || 0
    : 0;

  return {
    rapidFireRate: Math.round((rapidFireCount / (gaps.length || 1)) * 100) / 100,
    longPauseRate: Math.round((longPauseCount / (gaps.length || 1)) * 100) / 100,
    followUpRate: Math.round((rapidFireCount / (gaps.length || 1)) * 100) / 100,
    avgGapSeconds: Math.round(avgGapSeconds),
    medianGapSeconds: Math.round(medianGapSeconds),
  };
}

/**
 * Calculate tool usage metrics
 */
async function calculateToolUsage(
  supabase: SupabaseClient,
  userId: string,
  startDate: Date
): Promise<InsightsToolUsage> {
  const { data: toolData } = await supabase
    .from('tool_usage')
    .select('tool_name, usage_count')
    .eq('user_id', userId)
    .gte('recorded_at', startDate.toISOString());

  const distribution: Record<string, number> = {};
  (toolData || []).forEach((t: { tool_name: string; usage_count: number }) => {
    distribution[t.tool_name] = (distribution[t.tool_name] || 0) + t.usage_count;
  });

  const sorted = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  const topTools = sorted.slice(0, 5).map(([name]) => name);

  // Underutilized: tools with very low usage compared to top tools
  const maxUsage = sorted[0]?.[1] || 1;
  const underutilized = sorted
    .filter(([, count]) => count < maxUsage * 0.1)
    .slice(0, 3)
    .map(([name]) => name);

  // Determine user profile
  let userProfile = 'balanced';
  const readCount = distribution['Read'] || 0;
  const editCount = distribution['Edit'] || 0;
  const bashCount = distribution['Bash'] || 0;
  const totalCount = Object.values(distribution).reduce((a, b) => a + b, 0);

  if (readCount > editCount * 2) {
    userProfile = 'reader';
  } else if (bashCount > totalCount * 0.4) {
    userProfile = 'terminal-power-user';
  }

  return {
    distribution,
    topTools,
    underutilized,
    userProfile,
  };
}

/**
 * Calculate activity heat map
 */
function calculateActivityHeatMap(prompts: PromptRow[]): InsightsActivityHeatMap {
  // Initialize 7x24 grid (days x hours)
  const data: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));

  prompts.forEach(p => {
    const date = new Date(p.created_at);
    const day = date.getDay(); // 0 = Sunday
    const hour = date.getHours();
    data[day]![hour]!++;
  });

  let maxCount = 0;
  let peakHour = 0;
  let peakDay = 0;
  let totalActiveHours = 0;

  data.forEach((hours, day) => {
    hours.forEach((count, hour) => {
      if (count > 0) totalActiveHours++;
      if (count > maxCount) {
        maxCount = count;
        peakHour = hour;
        peakDay = day;
      }
    });
  });

  return {
    data,
    maxCount,
    totalActiveHours,
    peakHour,
    peakDay,
  };
}

/**
 * Calculate team comparison
 */
async function calculateTeamComparison(
  supabase: SupabaseClient,
  userId: string,
  teamId: string | undefined,
  userSummary: InsightsSummary,
  userComplexity: InsightsComplexity
): Promise<InsightsTeamComparison> {
  if (!teamId) {
    return {
      isTeamMember: false,
      teamAverages: null,
      userPercentiles: null,
      comparison: null,
    };
  }

  // Get team members' data
  const { data: teamPrompts } = await supabase
    .from('prompts')
    .select(`
      user_id,
      char_count,
      complexity_score,
      prompt_analyses(overall_score)
    `)
    .eq('team_id', teamId);

  const { data: teamSessions } = await supabase
    .from('sessions')
    .select('user_id, started_at, ended_at, prompt_count')
    .eq('team_id', teamId);

  if (!teamPrompts?.length) {
    return {
      isTeamMember: true,
      teamAverages: null,
      userPercentiles: null,
      comparison: null,
    };
  }

  // Calculate team averages
  const allScores = teamPrompts
    .map((p: { prompt_analyses: { overall_score: number | null }[] }) =>
      p.prompt_analyses?.[0]?.overall_score)
    .filter((s): s is number => s !== null);
  const teamAvgScore = allScores.length > 0
    ? allScores.reduce((a, b) => a + b, 0) / allScores.length
    : 0;

  const allComplexities = teamPrompts
    .map((p: { complexity_score: number | null }) => p.complexity_score)
    .filter((s): s is number => s !== null);
  const teamAvgComplexity = allComplexities.length > 0
    ? allComplexities.reduce((a, b) => a + b, 0) / allComplexities.length
    : 0;

  // Calculate session averages
  const sessionDurations = (teamSessions || [])
    .filter((s: { ended_at: string | null }) => s.ended_at)
    .map((s: { started_at: string; ended_at: string }) => {
      const start = new Date(s.started_at);
      const end = new Date(s.ended_at);
      return (end.getTime() - start.getTime()) / 60000;
    });
  const teamAvgSessionDuration = sessionDurations.length > 0
    ? sessionDurations.reduce((a: number, b: number) => a + b, 0) / sessionDurations.length
    : 0;

  const promptCounts = (teamSessions || []).map((s: { prompt_count: number }) => s.prompt_count);
  const teamAvgPromptsPerSession = promptCounts.length > 0
    ? promptCounts.reduce((a: number, b: number) => a + b, 0) / promptCounts.length
    : 0;

  const teamAverages = {
    avgPromptScore: Math.round(teamAvgScore * 10) / 10,
    avgSessionDuration: Math.round(teamAvgSessionDuration * 10) / 10,
    avgPromptsPerSession: Math.round(teamAvgPromptsPerSession * 10) / 10,
    avgComplexity: Math.round(teamAvgComplexity * 10) / 10,
  };

  // Calculate user percentiles (simplified)
  const userScore = userSummary.avgPromptScore || 0;
  const userSessionDuration = userSummary.avgSessionDurationMinutes;
  const userPromptsPerSession = userSummary.totalSessions > 0
    ? userSummary.totalPrompts / userSummary.totalSessions
    : 0;
  const userComplexityScore = userComplexity.avgComplexity;

  // Simplified percentile calculation
  const calculatePercentile = (userValue: number, teamAvg: number) => {
    if (teamAvg === 0) return 50;
    const ratio = userValue / teamAvg;
    return Math.min(99, Math.max(1, Math.round(ratio * 50)));
  };

  const userPercentiles = {
    promptScore: calculatePercentile(userScore, teamAverages.avgPromptScore),
    sessionDuration: calculatePercentile(userSessionDuration, teamAverages.avgSessionDuration),
    promptsPerSession: calculatePercentile(userPromptsPerSession, teamAverages.avgPromptsPerSession),
    complexity: calculatePercentile(userComplexityScore, teamAverages.avgComplexity),
  };

  const comparison = [
    {
      metric: 'Prompt Score',
      userValue: userScore,
      teamAverage: teamAverages.avgPromptScore,
      difference: userScore - teamAverages.avgPromptScore,
      isAboveAverage: userScore > teamAverages.avgPromptScore,
    },
    {
      metric: 'Session Duration',
      userValue: userSessionDuration,
      teamAverage: teamAverages.avgSessionDuration,
      difference: userSessionDuration - teamAverages.avgSessionDuration,
      isAboveAverage: userSessionDuration > teamAverages.avgSessionDuration,
    },
    {
      metric: 'Prompts/Session',
      userValue: userPromptsPerSession,
      teamAverage: teamAverages.avgPromptsPerSession,
      difference: userPromptsPerSession - teamAverages.avgPromptsPerSession,
      isAboveAverage: userPromptsPerSession > teamAverages.avgPromptsPerSession,
    },
    {
      metric: 'Complexity',
      userValue: userComplexityScore,
      teamAverage: teamAverages.avgComplexity,
      difference: userComplexityScore - teamAverages.avgComplexity,
      isAboveAverage: userComplexityScore > teamAverages.avgComplexity,
    },
  ];

  return {
    isTeamMember: true,
    teamAverages,
    userPercentiles,
    comparison,
  };
}

/**
 * Calculate weekly report
 */
async function calculateWeeklyReport(
  supabase: SupabaseClient,
  userId: string
): Promise<InsightsWeeklyReport> {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const prevWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const prevWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

  // Get current week data
  const { data: currentPrompts } = await supabase
    .from('prompts')
    .select('id, prompt_analyses(overall_score)')
    .eq('user_id', userId)
    .gte('created_at', weekStart.toISOString())
    .lte('created_at', weekEnd.toISOString());

  const { data: currentSessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('user_id', userId)
    .gte('started_at', weekStart.toISOString())
    .lte('started_at', weekEnd.toISOString());

  // Get previous week data
  const { data: previousPrompts } = await supabase
    .from('prompts')
    .select('id, prompt_analyses(overall_score)')
    .eq('user_id', userId)
    .gte('created_at', prevWeekStart.toISOString())
    .lte('created_at', prevWeekEnd.toISOString());

  const { data: previousSessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('user_id', userId)
    .gte('started_at', prevWeekStart.toISOString())
    .lte('started_at', prevWeekEnd.toISOString());

  const currentCount = currentPrompts?.length || 0;
  const previousCount = previousPrompts?.length || 0;
  const currentSessionCount = currentSessions?.length || 0;
  const previousSessionCount = previousSessions?.length || 0;

  const currentScores = (currentPrompts || [])
    .map((p: { prompt_analyses: { overall_score: number | null }[] }) =>
      p.prompt_analyses?.[0]?.overall_score)
    .filter((s): s is number => s !== null);
  const currentAvgScore = currentScores.length > 0
    ? currentScores.reduce((a, b) => a + b, 0) / currentScores.length
    : 0;

  const previousScores = (previousPrompts || [])
    .map((p: { prompt_analyses: { overall_score: number | null }[] }) =>
      p.prompt_analyses?.[0]?.overall_score)
    .filter((s): s is number => s !== null);
  const previousAvgScore = previousScores.length > 0
    ? previousScores.reduce((a, b) => a + b, 0) / previousScores.length
    : 0;

  // Generate highlights
  const highlights: string[] = [];
  if (currentCount > previousCount) {
    highlights.push(`You submitted ${currentCount - previousCount} more prompts than last week!`);
  }
  if (currentAvgScore > previousAvgScore) {
    highlights.push(`Your average score improved by ${(currentAvgScore - previousAvgScore).toFixed(1)} points.`);
  }
  if (currentSessionCount > 0) {
    highlights.push(`You completed ${currentSessionCount} development sessions this week.`);
  }

  // Notable changes
  const notableChanges = [];
  if (previousCount > 0) {
    const promptChange = ((currentCount - previousCount) / previousCount) * 100;
    notableChanges.push({
      metric: 'Total Prompts',
      previousValue: previousCount,
      currentValue: currentCount,
      changePercent: Math.round(promptChange * 10) / 10,
      isImprovement: promptChange > 0,
    });
  }
  if (previousAvgScore > 0) {
    const scoreChange = ((currentAvgScore - previousAvgScore) / previousAvgScore) * 100;
    notableChanges.push({
      metric: 'Average Score',
      previousValue: Math.round(previousAvgScore * 10) / 10,
      currentValue: Math.round(currentAvgScore * 10) / 10,
      changePercent: Math.round(scoreChange * 10) / 10,
      isImprovement: scoreChange > 0,
    });
  }

  return {
    weekStartDate: format(weekStart, 'yyyy-MM-dd'),
    weekEndDate: format(weekEnd, 'yyyy-MM-dd'),
    highlights,
    notableChanges,
    achievementsUnlocked: [], // Would need a separate achievements system
    comparisonToPreviousWeek: {
      totalPrompts: {
        current: currentCount,
        previous: previousCount,
        change: currentCount - previousCount,
      },
      avgScore: {
        current: Math.round(currentAvgScore * 10) / 10,
        previous: Math.round(previousAvgScore * 10) / 10,
        change: Math.round((currentAvgScore - previousAvgScore) * 10) / 10,
      },
      sessionCount: {
        current: currentSessionCount,
        previous: previousSessionCount,
        change: currentSessionCount - previousSessionCount,
      },
    },
  };
}

/**
 * Generate personalized tips based on user patterns
 */
function generatePersonalizedTips(
  summary: InsightsSummary,
  sentiment: InsightsSentiment,
  sessionHealth: InsightsSessionHealth,
  timing: InsightsTiming,
  complexity: InsightsComplexity
): string[] {
  const tips: string[] = [];

  // Score-based tips
  if (summary.avgPromptScore !== null && summary.avgPromptScore < 7) {
    tips.push('Try adding more context to your prompts - explain the "why" behind your request.');
  }

  // Sentiment tips
  if (sentiment.overallFrustratedRate > 0.2) {
    tips.push('Take short breaks between sessions to maintain focus and reduce frustration.');
  }

  // Session health tips
  if (sessionHealth.contextExhaustionRate > 0.3) {
    tips.push('Consider breaking large tasks into smaller, focused sessions to avoid context exhaustion.');
  }
  if (sessionHealth.avgHealthScore < 60) {
    tips.push('Your sessions may be running too long - try the Pomodoro technique (25-min focused work).');
  }

  // Timing tips
  if (timing.rapidFireRate > 0.3) {
    tips.push('Slow down between prompts - take time to read and understand responses fully.');
  }
  if (timing.longPauseRate > 0.4) {
    tips.push('Long pauses may indicate confusion - try asking clarifying questions earlier.');
  }

  // Complexity tips
  if (complexity.avgCharsPerPrompt < 50) {
    tips.push('Your prompts are quite short - adding more detail often leads to better results.');
  }
  if (complexity.avgComplexity < 3 && summary.totalPrompts > 10) {
    tips.push('Challenge yourself with more complex prompts to accelerate your learning.');
  }

  // Limit to 5 tips
  return tips.slice(0, 5);
}

/**
 * Main function to fetch all insights
 */
export async function fetchInsights(
  supabase: SupabaseClient,
  userId: string,
  timeRange: InsightsTimeRange,
  teamId?: string
): Promise<InsightsResponse> {
  const { start, end } = getDateRange(timeRange);

  // Fetch prompts
  let promptsQuery = supabase
    .from('prompts')
    .select(`
      id,
      created_at,
      char_count,
      word_count,
      work_style,
      sentiment,
      complexity_score,
      has_code,
      analysis_status,
      prompt_analyses(overall_score, dimension_scores)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (timeRange !== 'all') {
    promptsQuery = promptsQuery
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());
  }

  const { data: prompts } = await promptsQuery;
  const typedPrompts = (prompts || []) as unknown as PromptRow[];

  // Fetch sessions
  let sessionsQuery = supabase
    .from('sessions')
    .select(`
      id,
      started_at,
      ended_at,
      prompt_count,
      avg_prompt_score,
      context_exhaustion_count,
      health_score
    `)
    .eq('user_id', userId)
    .order('started_at', { ascending: true });

  if (timeRange !== 'all') {
    sessionsQuery = sessionsQuery
      .gte('started_at', start.toISOString())
      .lte('started_at', end.toISOString());
  }

  const { data: sessions } = await sessionsQuery;
  const typedSessions = (sessions || []) as SessionRow[];

  // Calculate all metrics
  const summary = await calculateSummary(supabase, userId, typedPrompts, typedSessions, timeRange);
  const workStyle = calculateWorkStyle(typedPrompts);
  const technicalProfile = calculateTechnicalProfile(workStyle);
  const sentiment = calculateSentiment(typedPrompts, workStyle);
  const sessionHealth = calculateSessionHealth(typedSessions);
  const complexity = calculateComplexity(typedPrompts);
  const timing = calculateTiming(typedPrompts);
  const toolUsage = await calculateToolUsage(supabase, userId, start);
  const activityHeatMap = calculateActivityHeatMap(typedPrompts);
  const teamComparison = await calculateTeamComparison(supabase, userId, teamId, summary, complexity);
  const weeklyReport = await calculateWeeklyReport(supabase, userId);
  const personalizedTips = generatePersonalizedTips(summary, sentiment, sessionHealth, timing, complexity);

  return {
    summary,
    workStyle,
    technicalProfile,
    sentiment,
    sessionHealth,
    complexity,
    timing,
    toolUsage,
    learning: null, // Would need integration with learning-progression module
    efficiency: null, // Would need integration with workflow-efficiency module
    personalizedTips,
    activityHeatMap,
    teamComparison,
    weeklyReport,
  };
}
