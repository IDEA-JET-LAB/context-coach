/**
 * Team Intelligence Service
 * Story 21-12: Team Intelligence Analytics
 *
 * Provides team-level analytics aggregation and intelligence features.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  TeamIntelligenceResponse,
  TeamSummary,
  TeamSentimentHealth,
  TeamSessionHealth,
  TopPerformer,
  CommonStruggle,
  BestPractice,
  WeekOverWeekChanges,
  UserMetrics,
  StrugglePattern,
  BestPracticePattern,
  AnalyticsTimeRange,
  WorkStyleCategory,
  TechnicalPersona,
  PerformanceMetric,
} from '@/lib/types/team-intelligence';
import { createScopedLogger } from '@/lib/utils/logger';

const logger = createScopedLogger('TEAM_INTELLIGENCE');

/**
 * Calculate the date range based on time range selection
 */
function getDateRange(timeRange: AnalyticsTimeRange): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date();

  switch (timeRange) {
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
  }

  return { startDate, endDate };
}

/**
 * Common struggle patterns to detect across team
 */
const STRUGGLE_PATTERNS: StrugglePattern[] = [
  {
    condition: (m) => m.frustrationRate > 0.1,
    issue: 'High frustration in prompts',
    suggestion: 'Encourage shorter sessions and clearer initial requirements',
    severity: 'high',
  },
  {
    condition: (m) => m.contextExhaustionRate > 0.3,
    issue: 'Frequent context exhaustion',
    suggestion: 'Train team on context management and session planning',
    severity: 'medium',
  },
  {
    condition: (m) => m.avgPromptScore < 5,
    issue: 'Low prompt quality scores',
    suggestion: 'Provide prompt engineering training and examples of high-quality prompts',
    severity: 'high',
  },
  {
    condition: (m) => m.testingRatio < 0.05,
    issue: 'Low testing activity',
    suggestion: 'Encourage test-driven development and verification prompts',
    severity: 'medium',
  },
  {
    condition: (m) => m.clarityScore < 5,
    issue: 'Unclear prompt phrasing',
    suggestion: 'Share templates for clear, structured prompts',
    severity: 'medium',
  },
  {
    condition: (m) => m.avgSessionDuration > 180,
    issue: 'Very long sessions without breaks',
    suggestion: 'Recommend the Pomodoro technique and regular breaks',
    severity: 'low',
  },
  {
    condition: (m) => m.promptsPerHour > 30,
    issue: 'Rapid-fire prompting pattern',
    suggestion: 'Encourage more thoughtful, comprehensive prompts',
    severity: 'low',
  },
];

/**
 * Best practice patterns to identify from top performers
 */
const BEST_PRACTICE_PATTERNS: BestPracticePattern[] = [
  {
    pattern: 'High prompt clarity scores',
    detector: (m) => m.avgPromptScore >= 8.5,
    impact: 'Leads to 40% fewer follow-up prompts',
  },
  {
    pattern: 'Regular testing prompts',
    detector: (m) => m.testingRatio >= 0.15,
    impact: 'Reduces debugging cycles by 50%',
  },
  {
    pattern: 'Consistent session lengths',
    detector: (m) => m.avgSessionDuration >= 30 && m.avgSessionDuration <= 90,
    impact: 'Maintains focus and reduces context exhaustion',
  },
  {
    pattern: 'Balanced prompt pacing',
    detector: (m) => m.promptsPerHour >= 5 && m.promptsPerHour <= 15,
    impact: 'Improves response quality and thinking time',
  },
  {
    pattern: 'Low frustration rate',
    detector: (m) => m.frustrationRate < 0.02,
    impact: 'Better collaboration with AI and more productive sessions',
  },
  {
    pattern: 'High clarity scores',
    detector: (m) => m.clarityScore >= 8,
    impact: 'Reduces misunderstandings and iterations',
  },
];

/**
 * Get team summary statistics
 */
export async function getTeamSummary(
  teamId: string,
  timeRange: AnalyticsTimeRange
): Promise<TeamSummary> {
  const supabase = createAdminClient();
  const { startDate, endDate } = getDateRange(timeRange);

  // Get team size
  const { count: teamSize } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', teamId);

  // Get prompt stats for the time range
  const { data: promptData } = await supabase
    .from('prompts')
    .select(`
      id,
      user_id,
      created_at,
      prompt_analyses!inner(overall_score)
    `)
    .eq('team_id', teamId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  // Get session count
  const { count: totalSessions } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .gte('started_at', startDate.toISOString())
    .lte('started_at', endDate.toISOString());

  // Calculate stats
  const totalPrompts = promptData?.length ?? 0;
  const activeUsers = new Set(promptData?.map((p) => p.user_id) ?? []).size;
  const scores = promptData
    ?.flatMap((p) => {
      const analyses = p.prompt_analyses;
      // Handle both array and object cases from Supabase join
      if (Array.isArray(analyses)) {
        return analyses.map((a) => a?.overall_score);
      }
      return [analyses?.overall_score];
    })
    .filter((s): s is number => s !== null && s !== undefined) ?? [];
  const avgPromptScore = scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 0;

  // Get previous period for comparison
  const prevStartDate = new Date(startDate);
  const prevEndDate = new Date(startDate);
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  prevStartDate.setDate(prevStartDate.getDate() - daysDiff);

  const { data: prevPromptData } = await supabase
    .from('prompts')
    .select(`
      prompt_analyses!inner(overall_score)
    `)
    .eq('team_id', teamId)
    .gte('created_at', prevStartDate.toISOString())
    .lt('created_at', startDate.toISOString());

  const prevScores = prevPromptData
    ?.flatMap((p) => {
      const analyses = p.prompt_analyses;
      // Handle both array and object cases from Supabase join
      if (Array.isArray(analyses)) {
        return analyses.map((a) => a?.overall_score);
      }
      return [analyses?.overall_score];
    })
    .filter((s): s is number => s !== null && s !== undefined) ?? [];
  const prevAvgScore = prevScores.length > 0
    ? prevScores.reduce((a, b) => a + b, 0) / prevScores.length
    : null;

  const scoreChange = prevAvgScore !== null ? avgPromptScore - prevAvgScore : null;

  return {
    teamSize: teamSize ?? 0,
    activeUsers,
    totalPrompts,
    totalSessions: totalSessions ?? 0,
    avgPromptScore: Math.round(avgPromptScore * 10) / 10,
    scoreChange: scoreChange !== null ? Math.round(scoreChange * 10) / 10 : null,
  };
}

/**
 * Get work style distribution for team
 */
export async function getStyleDistribution(
  teamId: string,
  timeRange: AnalyticsTimeRange
): Promise<Record<WorkStyleCategory, number>> {
  const supabase = createAdminClient();
  const { startDate, endDate } = getDateRange(timeRange);

  // Get prompts with classification
  const { data } = await supabase
    .from('prompts')
    .select('classification')
    .eq('team_id', teamId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .not('classification', 'is', null);

  // Initialize distribution
  const distribution: Record<WorkStyleCategory, number> = {
    explorer: 0,
    focused: 0,
    iterative: 0,
    architect: 0,
    rapid: 0,
    researcher: 0,
    debugger: 0,
    refactorer: 0,
    documentor: 0,
    integrator: 0,
  };

  // Count work styles
  data?.forEach((prompt) => {
    const classification = prompt.classification as Record<string, unknown> | null;
    if (classification?.work_style) {
      const style = classification.work_style as WorkStyleCategory;
      if (style in distribution) {
        distribution[style]++;
      }
    }
  });

  return distribution;
}

/**
 * Get persona distribution for team
 */
export async function getPersonaDistribution(
  teamId: string,
  timeRange: AnalyticsTimeRange
): Promise<Record<TechnicalPersona, number>> {
  const supabase = createAdminClient();
  const { startDate, endDate } = getDateRange(timeRange);

  // Get team members with their prompt patterns
  const { data: members } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', teamId);

  if (!members || members.length === 0) {
    return { architect: 0, firefighter: 0, craftsman: 0, explorer: 0 };
  }

  const distribution: Record<TechnicalPersona, number> = {
    architect: 0,
    firefighter: 0,
    craftsman: 0,
    explorer: 0,
  };

  // Analyze each member's patterns to determine persona
  for (const member of members) {
    const { data: prompts } = await supabase
      .from('prompts')
      .select(`
        classification,
        prompt_analyses(overall_score)
      `)
      .eq('user_id', member.user_id)
      .eq('team_id', teamId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (!prompts || prompts.length === 0) continue;

    // Determine persona based on patterns
    const persona = determinePersona(prompts);
    distribution[persona]++;
  }

  return distribution;
}

/**
 * Determine a user's technical persona based on their prompt patterns
 */
function determinePersona(prompts: Array<{ classification: unknown; prompt_analyses: { overall_score: number } | null }>): TechnicalPersona {
  const styles: Record<string, number> = {};
  let totalScore = 0;
  let scoreCount = 0;

  prompts.forEach((p) => {
    const classification = p.classification as Record<string, unknown> | null;
    if (classification?.work_style) {
      const style = String(classification.work_style);
      styles[style] = (styles[style] || 0) + 1;
    }
    if (p.prompt_analyses?.overall_score) {
      totalScore += p.prompt_analyses.overall_score;
      scoreCount++;
    }
  });

  const avgScore = scoreCount > 0 ? totalScore / scoreCount : 5;
  const primaryStyle = Object.entries(styles).sort((a, b) => b[1] - a[1])[0]?.[0];

  // Classification logic
  if (primaryStyle === 'architect' || styles.architect > prompts.length * 0.3) {
    return 'architect';
  }
  if (primaryStyle === 'rapid' || styles.rapid > prompts.length * 0.4) {
    return 'firefighter';
  }
  if (avgScore >= 7 && (primaryStyle === 'focused' || primaryStyle === 'iterative')) {
    return 'craftsman';
  }
  if (primaryStyle === 'explorer' || primaryStyle === 'researcher') {
    return 'explorer';
  }

  // Default based on score
  return avgScore >= 7 ? 'craftsman' : 'explorer';
}

/**
 * Get team sentiment health metrics
 */
export async function getTeamSentimentHealth(
  teamId: string,
  timeRange: AnalyticsTimeRange
): Promise<TeamSentimentHealth> {
  const supabase = createAdminClient();
  const { startDate, endDate } = getDateRange(timeRange);

  // Get prompts with sentiment
  const { data } = await supabase
    .from('prompts')
    .select('classification')
    .eq('team_id', teamId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .not('classification', 'is', null);

  let politeCount = 0;
  let frustratedCount = 0;
  let totalWithSentiment = 0;

  data?.forEach((prompt) => {
    const classification = prompt.classification as Record<string, unknown> | null;
    if (classification?.sentiment) {
      totalWithSentiment++;
      const sentiment = String(classification.sentiment).toLowerCase();
      if (sentiment === 'polite' || sentiment === 'positive') {
        politeCount++;
      } else if (sentiment === 'frustrated' || sentiment === 'negative') {
        frustratedCount++;
      }
    }
  });

  const teamPoliteRate = totalWithSentiment > 0 ? politeCount / totalWithSentiment : 0;
  const teamFrustratedRate = totalWithSentiment > 0 ? frustratedCount / totalWithSentiment : 0;
  const politenessRatio = teamFrustratedRate > 0 ? teamPoliteRate / teamFrustratedRate : teamPoliteRate > 0 ? 10 : 1;

  // Get previous period for trend
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const prevStartDate = new Date(startDate);
  prevStartDate.setDate(prevStartDate.getDate() - daysDiff);

  const { data: prevData } = await supabase
    .from('prompts')
    .select('classification')
    .eq('team_id', teamId)
    .gte('created_at', prevStartDate.toISOString())
    .lt('created_at', startDate.toISOString())
    .not('classification', 'is', null);

  let prevFrustrated = 0;
  let prevTotal = 0;
  prevData?.forEach((prompt) => {
    const classification = prompt.classification as Record<string, unknown> | null;
    if (classification?.sentiment) {
      prevTotal++;
      const sentiment = String(classification.sentiment).toLowerCase();
      if (sentiment === 'frustrated' || sentiment === 'negative') {
        prevFrustrated++;
      }
    }
  });

  const prevFrustrationRate = prevTotal > 0 ? prevFrustrated / prevTotal : 0;
  let trend: 'improving' | 'stable' | 'declining' = 'stable';

  if (teamFrustratedRate < prevFrustrationRate - 0.02) {
    trend = 'improving';
  } else if (teamFrustratedRate > prevFrustrationRate + 0.02) {
    trend = 'declining';
  }

  return {
    teamPoliteRate: Math.round(teamPoliteRate * 100) / 100,
    teamFrustratedRate: Math.round(teamFrustratedRate * 100) / 100,
    politenessRatio: Math.round(politenessRatio * 10) / 10,
    trend,
  };
}

/**
 * Get team session health metrics
 */
export async function getTeamSessionHealth(
  teamId: string,
  timeRange: AnalyticsTimeRange
): Promise<TeamSessionHealth> {
  const supabase = createAdminClient();
  const { startDate, endDate } = getDateRange(timeRange);

  // Get sessions with metrics
  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('team_id', teamId)
    .gte('started_at', startDate.toISOString())
    .lte('started_at', endDate.toISOString());

  if (!sessions || sessions.length === 0) {
    return {
      avgHealthScore: 0,
      healthySessionRate: 0,
      avgContextUsage: 0,
    };
  }

  // Calculate health scores based on session characteristics
  let totalHealthScore = 0;
  let healthySessions = 0;

  sessions.forEach((session) => {
    // Health score based on: completion, duration, and prompt count
    let healthScore = 5; // Base score

    // Completed sessions get bonus
    if (session.end_reason === 'completed') {
      healthScore += 2;
      healthySessions++;
    } else if (session.end_reason === 'interrupted') {
      healthScore -= 1;
    }

    // Reasonable prompt count (5-50) is healthy
    if (session.total_prompts >= 5 && session.total_prompts <= 50) {
      healthScore += 1;
    } else if (session.total_prompts > 100) {
      healthScore -= 1;
    }

    // Duration consideration (if we have both start and end)
    if (session.ended_at) {
      const duration = new Date(session.ended_at).getTime() - new Date(session.started_at).getTime();
      const durationMinutes = duration / (1000 * 60);
      if (durationMinutes >= 15 && durationMinutes <= 120) {
        healthScore += 1;
      }
    }

    totalHealthScore += Math.min(10, Math.max(1, healthScore));
  });

  const avgHealthScore = totalHealthScore / sessions.length;
  const healthySessionRate = healthySessions / sessions.length;

  // Context usage is approximated from token usage
  const totalTokens = sessions.reduce((sum, s) => sum + (s.total_tokens || 0), 0);
  const maxContextPerSession = 100000; // Approximate max context
  const avgContextUsage = sessions.length > 0
    ? (totalTokens / sessions.length) / maxContextPerSession
    : 0;

  return {
    avgHealthScore: Math.round(avgHealthScore * 10) / 10,
    healthySessionRate: Math.round(healthySessionRate * 100) / 100,
    avgContextUsage: Math.min(1, Math.round(avgContextUsage * 100) / 100),
  };
}

/**
 * Get top performers for the team
 */
export async function getTopPerformers(
  teamId: string,
  timeRange: AnalyticsTimeRange,
  isAdmin: boolean
): Promise<TopPerformer[]> {
  if (!isAdmin) {
    // Non-admins cannot see individual member data
    return [];
  }

  const supabase = createAdminClient();
  const { startDate, endDate } = getDateRange(timeRange);

  // Get team members with their user profiles
  const { data: members } = await supabase
    .from('team_members')
    .select(`
      user_id,
      users!inner(id, name, avatar_url)
    `)
    .eq('team_id', teamId);

  if (!members || members.length === 0) {
    return [];
  }

  const userMetrics: Map<string, { name: string; avatarUrl?: string; score: number; efficiency: number; health: number; promptCount: number }> = new Map();

  // Calculate metrics for each member
  for (const member of members) {
    const userId = member.user_id;
    const user = member.users as { id: string; name: string | null; avatar_url: string | null };

    // Get prompt scores
    const { data: prompts } = await supabase
      .from('prompts')
      .select(`
        id,
        prompt_analyses(overall_score)
      `)
      .eq('user_id', userId)
      .eq('team_id', teamId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (!prompts || prompts.length === 0) continue;

    const scores = prompts
      .map((p) => p.prompt_analyses?.overall_score)
      .filter((s): s is number => s !== null && s !== undefined);

    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    // Get session metrics
    const { data: sessions } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('team_id', teamId)
      .gte('started_at', startDate.toISOString())
      .lte('started_at', endDate.toISOString());

    const completedSessions = sessions?.filter((s) => s.end_reason === 'completed').length ?? 0;
    const totalSessions = sessions?.length ?? 0;
    const healthRate = totalSessions > 0 ? completedSessions / totalSessions : 0;

    // Efficiency: prompts per hour
    let totalSessionMinutes = 0;
    sessions?.forEach((s) => {
      if (s.ended_at) {
        totalSessionMinutes += (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / (1000 * 60);
      }
    });
    const efficiency = totalSessionMinutes > 0 ? (prompts.length / totalSessionMinutes) * 60 : 0;

    userMetrics.set(userId, {
      name: user.name || 'Unknown User',
      avatarUrl: user.avatar_url || undefined,
      score: avgScore,
      efficiency,
      health: healthRate * 10, // Scale to 0-10
      promptCount: prompts.length,
    });
  }

  // Create ranked lists for each metric
  const topPerformers: TopPerformer[] = [];
  const metrics: PerformanceMetric[] = ['prompt_quality', 'efficiency', 'session_health'];

  for (const metric of metrics) {
    const sorted = Array.from(userMetrics.entries())
      .filter(([, m]) => m.promptCount >= 5) // Minimum activity threshold
      .sort((a, b) => {
        switch (metric) {
          case 'prompt_quality':
            return b[1].score - a[1].score;
          case 'efficiency':
            return b[1].efficiency - a[1].efficiency;
          case 'session_health':
            return b[1].health - a[1].health;
        }
      })
      .slice(0, 5);

    sorted.forEach(([userId, data], index) => {
      topPerformers.push({
        userId,
        userName: data.name,
        avatarUrl: data.avatarUrl,
        metric,
        value: Math.round(
          (metric === 'prompt_quality' ? data.score :
           metric === 'efficiency' ? data.efficiency :
           data.health) * 10
        ) / 10,
        rank: index + 1,
      });
    });
  }

  return topPerformers;
}

/**
 * Detect common struggles across the team
 */
export async function detectCommonStruggles(
  teamId: string,
  timeRange: AnalyticsTimeRange
): Promise<CommonStruggle[]> {
  const supabase = createAdminClient();
  const { startDate, endDate } = getDateRange(timeRange);

  // Get team members
  const { data: members } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', teamId);

  if (!members || members.length === 0) {
    return [];
  }

  const userMetricsList: UserMetrics[] = [];

  // Gather metrics for each member
  for (const member of members) {
    const { data: prompts } = await supabase
      .from('prompts')
      .select(`
        id,
        classification,
        prompt_analyses(overall_score)
      `)
      .eq('user_id', member.user_id)
      .eq('team_id', teamId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (!prompts || prompts.length < 3) continue;

    // Calculate metrics
    let frustratedCount = 0;
    let totalWithSentiment = 0;
    let totalScore = 0;
    let scoreCount = 0;
    let clarityTotal = 0;

    prompts.forEach((p) => {
      const classification = p.classification as Record<string, unknown> | null;
      if (classification?.sentiment) {
        totalWithSentiment++;
        if (['frustrated', 'negative'].includes(String(classification.sentiment).toLowerCase())) {
          frustratedCount++;
        }
      }
      if (p.prompt_analyses?.overall_score) {
        totalScore += p.prompt_analyses.overall_score;
        scoreCount++;
        clarityTotal += p.prompt_analyses.overall_score; // Using overall score as clarity proxy
      }
    });

    const { data: sessions } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', member.user_id)
      .eq('team_id', teamId)
      .gte('started_at', startDate.toISOString())
      .lte('started_at', endDate.toISOString());

    let totalDuration = 0;
    sessions?.forEach((s) => {
      if (s.ended_at) {
        totalDuration += (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / (1000 * 60);
      }
    });

    userMetricsList.push({
      userId: member.user_id,
      userName: '',
      avgPromptScore: scoreCount > 0 ? totalScore / scoreCount : 5,
      promptCount: prompts.length,
      sessionCount: sessions?.length ?? 0,
      frustrationRate: totalWithSentiment > 0 ? frustratedCount / totalWithSentiment : 0,
      contextExhaustionRate: 0.1, // Placeholder - would need actual context data
      testingRatio: 0.1, // Placeholder - would need classification of test prompts
      avgSessionDuration: sessions?.length ? totalDuration / sessions.length : 30,
      promptsPerHour: totalDuration > 0 ? (prompts.length / totalDuration) * 60 : 10,
      clarityScore: scoreCount > 0 ? clarityTotal / scoreCount : 5,
    });
  }

  // Detect struggles
  const struggles: CommonStruggle[] = [];
  const teamSize = userMetricsList.length;
  const threshold = 0.2; // 20% of team

  for (const pattern of STRUGGLE_PATTERNS) {
    const affected = userMetricsList.filter((m) => pattern.condition(m)).length;
    const affectedPercent = affected / teamSize;

    if (affectedPercent >= threshold) {
      struggles.push({
        issue: pattern.issue,
        affectedPercent: Math.round(affectedPercent * 100),
        severity: pattern.severity,
        suggestion: pattern.suggestion,
      });
    }
  }

  // Sort by severity and affected percentage
  const severityOrder = { high: 0, medium: 1, low: 2 };
  struggles.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.affectedPercent - a.affectedPercent;
  });

  return struggles.slice(0, 5); // Return top 5 struggles
}

/**
 * Extract best practices from top performers
 */
export async function extractBestPractices(
  teamId: string,
  timeRange: AnalyticsTimeRange
): Promise<BestPractice[]> {
  const supabase = createAdminClient();
  const { startDate, endDate } = getDateRange(timeRange);

  // Get team members
  const { data: members } = await supabase
    .from('team_members')
    .select(`
      user_id,
      users!inner(name)
    `)
    .eq('team_id', teamId);

  if (!members || members.length === 0) {
    return [];
  }

  const userMetricsList: (UserMetrics & { isTopPerformer: boolean })[] = [];

  // Gather metrics and identify top performers
  for (const member of members) {
    const { data: prompts } = await supabase
      .from('prompts')
      .select(`
        id,
        classification,
        prompt_analyses(overall_score)
      `)
      .eq('user_id', member.user_id)
      .eq('team_id', teamId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (!prompts || prompts.length < 5) continue;

    let totalScore = 0;
    let scoreCount = 0;
    let frustratedCount = 0;
    let totalWithSentiment = 0;

    prompts.forEach((p) => {
      if (p.prompt_analyses?.overall_score) {
        totalScore += p.prompt_analyses.overall_score;
        scoreCount++;
      }
      const classification = p.classification as Record<string, unknown> | null;
      if (classification?.sentiment) {
        totalWithSentiment++;
        if (['frustrated', 'negative'].includes(String(classification.sentiment).toLowerCase())) {
          frustratedCount++;
        }
      }
    });

    const { data: sessions } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', member.user_id)
      .eq('team_id', teamId)
      .gte('started_at', startDate.toISOString())
      .lte('started_at', endDate.toISOString());

    let totalDuration = 0;
    sessions?.forEach((s) => {
      if (s.ended_at) {
        totalDuration += (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / (1000 * 60);
      }
    });

    const avgScore = scoreCount > 0 ? totalScore / scoreCount : 5;

    userMetricsList.push({
      userId: member.user_id,
      userName: (member.users as { name: string | null }).name || 'Unknown',
      avgPromptScore: avgScore,
      promptCount: prompts.length,
      sessionCount: sessions?.length ?? 0,
      frustrationRate: totalWithSentiment > 0 ? frustratedCount / totalWithSentiment : 0,
      contextExhaustionRate: 0.1,
      testingRatio: 0.1,
      avgSessionDuration: sessions?.length ? totalDuration / sessions.length : 30,
      promptsPerHour: totalDuration > 0 ? (prompts.length / totalDuration) * 60 : 10,
      clarityScore: avgScore,
      isTopPerformer: avgScore >= 7.5,
    });
  }

  const topPerformers = userMetricsList.filter((m) => m.isTopPerformer);

  if (topPerformers.length === 0) {
    return [];
  }

  // Identify practices used by top performers
  const practices: BestPractice[] = [];

  for (const pattern of BEST_PRACTICE_PATTERNS) {
    const exemplars = topPerformers.filter((m) => pattern.detector(m));

    if (exemplars.length > 0) {
      practices.push({
        pattern: pattern.pattern,
        exemplarCount: exemplars.length,
        impact: pattern.impact,
        examples: exemplars.slice(0, 3).map((e) => e.userName),
      });
    }
  }

  // Sort by number of exemplars
  practices.sort((a, b) => b.exemplarCount - a.exemplarCount);

  return practices.slice(0, 5); // Return top 5 practices
}

/**
 * Get week-over-week changes
 */
export async function getWeekOverWeekChanges(
  teamId: string,
  timeRange: AnalyticsTimeRange
): Promise<WeekOverWeekChanges> {
  const supabase = createAdminClient();
  const { startDate, endDate } = getDateRange(timeRange);

  // Calculate previous period
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const prevStartDate = new Date(startDate);
  prevStartDate.setDate(prevStartDate.getDate() - daysDiff);

  // Current period metrics
  const { data: currentPrompts } = await supabase
    .from('prompts')
    .select(`
      classification,
      prompt_analyses(overall_score)
    `)
    .eq('team_id', teamId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  const { data: currentSessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('team_id', teamId)
    .gte('started_at', startDate.toISOString())
    .lte('started_at', endDate.toISOString());

  // Previous period metrics
  const { data: prevPrompts } = await supabase
    .from('prompts')
    .select(`
      classification,
      prompt_analyses(overall_score)
    `)
    .eq('team_id', teamId)
    .gte('created_at', prevStartDate.toISOString())
    .lt('created_at', startDate.toISOString());

  const { data: prevSessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('team_id', teamId)
    .gte('started_at', prevStartDate.toISOString())
    .lt('started_at', startDate.toISOString());

  // Calculate score change
  const currentScores = currentPrompts
    ?.map((p) => p.prompt_analyses?.overall_score)
    .filter((s): s is number => s !== null && s !== undefined) ?? [];
  const prevScores = prevPrompts
    ?.map((p) => p.prompt_analyses?.overall_score)
    .filter((s): s is number => s !== null && s !== undefined) ?? [];

  const currentAvgScore = currentScores.length > 0
    ? currentScores.reduce((a, b) => a + b, 0) / currentScores.length
    : 0;
  const prevAvgScore = prevScores.length > 0
    ? prevScores.reduce((a, b) => a + b, 0) / prevScores.length
    : 0;

  // Calculate efficiency change (prompts per session)
  const currentEfficiency = currentSessions?.length
    ? (currentPrompts?.length ?? 0) / currentSessions.length
    : 0;
  const prevEfficiency = prevSessions?.length
    ? (prevPrompts?.length ?? 0) / prevSessions.length
    : 0;

  // Calculate frustration change
  const calcFrustrationRate = (prompts: typeof currentPrompts) => {
    let frustrated = 0;
    let total = 0;
    prompts?.forEach((p) => {
      const classification = p.classification as Record<string, unknown> | null;
      if (classification?.sentiment) {
        total++;
        if (['frustrated', 'negative'].includes(String(classification.sentiment).toLowerCase())) {
          frustrated++;
        }
      }
    });
    return total > 0 ? frustrated / total : 0;
  };

  const currentFrustration = calcFrustrationRate(currentPrompts);
  const prevFrustration = calcFrustrationRate(prevPrompts);

  return {
    promptScoreChange: Math.round((currentAvgScore - prevAvgScore) * 10) / 10,
    efficiencyChange: Math.round((currentEfficiency - prevEfficiency) * 10) / 10,
    frustrationChange: Math.round((currentFrustration - prevFrustration) * 100) / 100,
  };
}

/**
 * Get full team intelligence data
 */
export async function getTeamIntelligence(
  teamId: string,
  timeRange: AnalyticsTimeRange = '30d',
  isAdmin: boolean = false
): Promise<TeamIntelligenceResponse> {
  logger.log('Fetching team intelligence', { teamId, timeRange, isAdmin });

  const [
    summary,
    styleDistribution,
    personaDistribution,
    sentimentHealth,
    sessionHealth,
    topPerformers,
    commonStruggles,
    bestPractices,
    weekOverWeek,
  ] = await Promise.all([
    getTeamSummary(teamId, timeRange),
    getStyleDistribution(teamId, timeRange),
    getPersonaDistribution(teamId, timeRange),
    getTeamSentimentHealth(teamId, timeRange),
    getTeamSessionHealth(teamId, timeRange),
    getTopPerformers(teamId, timeRange, isAdmin),
    detectCommonStruggles(teamId, timeRange),
    extractBestPractices(teamId, timeRange),
    getWeekOverWeekChanges(teamId, timeRange),
  ]);

  logger.log('Team intelligence fetched successfully', {
    teamId,
    totalPrompts: summary.totalPrompts,
    activeUsers: summary.activeUsers,
  });

  return {
    summary,
    styleDistribution,
    personaDistribution,
    sentimentHealth,
    sessionHealth,
    topPerformers,
    commonStruggles,
    bestPractices,
    weekOverWeek,
  };
}
