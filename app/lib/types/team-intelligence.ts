/**
 * Team Intelligence Types
 * Story 21-12: Team Intelligence Analytics
 */

/**
 * Work style categories for team analysis
 */
export type WorkStyleCategory =
  | 'explorer'
  | 'focused'
  | 'iterative'
  | 'architect'
  | 'rapid'
  | 'researcher'
  | 'debugger'
  | 'refactorer'
  | 'documentor'
  | 'integrator';

/**
 * Technical personas for team member classification
 */
export type TechnicalPersona = 'architect' | 'firefighter' | 'craftsman' | 'explorer';

/**
 * Sentiment trend direction
 */
export type SentimentTrend = 'improving' | 'stable' | 'declining';

/**
 * Performance metric categories for top performers
 */
export type PerformanceMetric = 'prompt_quality' | 'efficiency' | 'session_health';

/**
 * Struggle severity levels
 */
export type StruggeSeverity = 'low' | 'medium' | 'high';

/**
 * Time range options for analytics
 */
export type AnalyticsTimeRange = '7d' | '30d' | '90d';

/**
 * Team summary statistics
 */
export interface TeamSummary {
  teamSize: number;
  activeUsers: number;
  totalPrompts: number;
  totalSessions: number;
  avgPromptScore: number;
  scoreChange: number | null;
}

/**
 * Team sentiment health metrics
 */
export interface TeamSentimentHealth {
  teamPoliteRate: number;
  teamFrustratedRate: number;
  politenessRatio: number;
  trend: SentimentTrend;
}

/**
 * Team session health metrics
 */
export interface TeamSessionHealth {
  avgHealthScore: number;
  healthySessionRate: number;
  avgContextUsage: number;
}

/**
 * Top performer entry
 */
export interface TopPerformer {
  userId: string;
  userName: string;
  avatarUrl?: string;
  metric: PerformanceMetric;
  value: number;
  rank: number;
}

/**
 * Common struggle identified across team
 */
export interface CommonStruggle {
  issue: string;
  affectedPercent: number;
  severity: StruggeSeverity;
  suggestion: string;
}

/**
 * Best practice identified from top performers
 */
export interface BestPractice {
  pattern: string;
  exemplarCount: number;
  impact: string;
  examples: string[];
}

/**
 * Week-over-week change metrics
 */
export interface WeekOverWeekChanges {
  promptScoreChange: number;
  efficiencyChange: number;
  frustrationChange: number;
}

/**
 * Full team intelligence response from API
 */
export interface TeamIntelligenceResponse {
  summary: TeamSummary;
  styleDistribution: Record<WorkStyleCategory, number>;
  personaDistribution: Record<TechnicalPersona, number>;
  sentimentHealth: TeamSentimentHealth;
  sessionHealth: TeamSessionHealth;
  topPerformers: TopPerformer[];
  commonStruggles: CommonStruggle[];
  bestPractices: BestPractice[];
  weekOverWeek: WeekOverWeekChanges;
}

/**
 * Team daily analytics record from database
 */
export interface TeamDailyAnalytics {
  id: string;
  team_id: string;
  date: string;
  total_prompts: number;
  total_sessions: number;
  avg_prompt_score: number | null;
  avg_session_health: number | null;
  work_style_distribution: Record<string, number> | null;
  sentiment_distribution: Record<string, number> | null;
  persona_distribution: Record<string, number> | null;
  active_users: number;
  total_team_members: number;
  score_change: number | null;
  efficiency_change: number | null;
  frustration_change: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * User metrics for struggle/practice detection
 */
export interface UserMetrics {
  userId: string;
  userName: string;
  avatarUrl?: string;
  avgPromptScore: number;
  promptCount: number;
  sessionCount: number;
  frustrationRate: number;
  contextExhaustionRate: number;
  testingRatio: number;
  avgSessionDuration: number;
  promptsPerHour: number;
  clarityScore: number;
}

/**
 * Struggle pattern definition for detection
 */
export interface StrugglePattern {
  condition: (metrics: UserMetrics) => boolean;
  issue: string;
  suggestion: string;
  severity: StruggeSeverity;
}

/**
 * Best practice pattern definition for detection
 */
export interface BestPracticePattern {
  pattern: string;
  detector: (metrics: UserMetrics) => boolean;
  impact: string;
}

/**
 * API request params for team intelligence
 */
export interface TeamIntelligenceParams {
  teamId: string;
  timeRange?: AnalyticsTimeRange;
}

/**
 * Team member with analytics data
 */
export interface TeamMemberWithAnalytics {
  id: string;
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  role: 'admin' | 'member';
  promptCount: number;
  avgScore: number;
  lastActive: string | null;
}
