'use client';

import { cn } from '@/lib/utils';
import {
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  Target,
  Lightbulb,
  Eye,
  EyeOff,
  BarChart3,
  ChevronRight,
  UserCircle,
  Sparkles,
  Crown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from 'recharts';
import { format } from 'date-fns';

export interface TeamMemberStats {
  id: string;
  name: string;
  avatarUrl?: string;
  score: number;
  promptCount: number;
  trend: 'up' | 'down' | 'stable';
  change?: number;
  rank?: number;
  isAnonymized?: boolean;
}

export interface TeamTrendPoint {
  date: string;
  teamAvg: number;
  benchmark?: number;
}

export interface CoachingOpportunity {
  id: string;
  type: 'skill_gap' | 'pattern' | 'improvement' | 'celebration';
  title: string;
  description: string;
  affectedMembers?: number;
  priority: 'high' | 'medium' | 'low';
  suggestedAction?: string;
}

export interface TeamIntelligenceProps {
  /** Team aggregate score */
  teamScore: number;
  /** Score change from previous period */
  scoreChange?: number;
  /** Team members with their stats */
  members?: TeamMemberStats[];
  /** Team score trend over time */
  trendData?: TeamTrendPoint[];
  /** Industry/global benchmark */
  benchmark?: number;
  /** Identified coaching opportunities */
  coachingOpportunities?: CoachingOpportunity[];
  /** Total team prompts */
  totalPrompts?: number;
  /** Active members count */
  activeMembers?: number;
  /** Whether to show anonymized mode */
  anonymizedMode?: boolean;
  /** Toggle anonymized mode */
  onToggleAnonymized?: () => void;
  /** Loading state */
  loading?: boolean;
  /** Additional class names */
  className?: string;
  /** Click handler for member detail */
  onMemberClick?: (memberId: string) => void;
  /** Click handler for coaching opportunity */
  onOpportunityClick?: (opportunityId: string) => void;
}

const PRIORITY_CONFIG = {
  high: {
    color: 'text-destructive',
    bgColor: 'bg-destructive/10 border-destructive/20',
  },
  medium: {
    color: 'text-score-growth',
    bgColor: 'bg-score-growth/10 border-score-growth/20',
  },
  low: {
    color: 'text-info',
    bgColor: 'bg-info/10 border-info/20',
  },
};

const OPPORTUNITY_ICONS = {
  skill_gap: Target,
  pattern: BarChart3,
  improvement: TrendingUp,
  celebration: Award,
};

function getScoreColor(score: number): string {
  if (score >= 7) return 'hsl(var(--score-high))';
  if (score >= 5) return 'hsl(var(--score-medium))';
  return 'hsl(var(--score-growth))';
}

function anonymizeName(name: string, index: number): string {
  return `Team Member ${index + 1}`;
}

export function TeamIntelligence({
  teamScore,
  scoreChange,
  members = [],
  trendData = [],
  benchmark,
  coachingOpportunities = [],
  totalPrompts,
  activeMembers,
  anonymizedMode = false,
  onToggleAnonymized,
  loading = false,
  className,
  onMemberClick,
  onOpportunityClick,
}: TeamIntelligenceProps) {
  if (loading) {
    return (
      <div
        className={cn('rounded-lg border border-border bg-card p-4', className)}
        data-testid="team-intelligence-loading"
      >
        <div className="h-4 w-32 animate-pulse rounded bg-muted mb-4" />
        <div className="h-[200px] animate-pulse rounded bg-muted mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  // Sort members by score
  const sortedMembers = [...members].sort((a, b) => b.score - a.score);

  // Calculate team stats
  const topPerformer = sortedMembers[0];
  const scoreVariance = members.length > 1
    ? Math.sqrt(
        members.reduce((sum, m) => sum + Math.pow(m.score - teamScore, 2), 0) /
          members.length
      )
    : 0;

  // Generate accessible description
  const getAccessibleDescription = () => {
    let desc = `Team intelligence dashboard. Team average score: ${teamScore.toFixed(1)}.`;
    if (members.length > 0) {
      desc += ` ${members.length} team members tracked.`;
    }
    if (scoreChange) {
      desc += ` Score ${scoreChange > 0 ? 'improved' : 'declined'} by ${Math.abs(scoreChange).toFixed(1)} points.`;
    }
    if (coachingOpportunities.length > 0) {
      desc += ` ${coachingOpportunities.length} coaching opportunities identified.`;
    }
    return desc;
  };

  // Prepare distribution chart data
  const distributionData = sortedMembers.map((member, index) => ({
    name: anonymizedMode ? anonymizeName(member.name, index) : member.name,
    score: member.score,
    fill: getScoreColor(member.score),
    isAnonymized: member.isAnonymized || anonymizedMode,
  }));

  return (
    <div
      className={cn('rounded-lg border border-border bg-card p-4', className)}
      data-testid="team-intelligence"
      role="img"
      aria-label={getAccessibleDescription()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-medium text-foreground">
            Team Intelligence
          </h3>
        </div>
        {onToggleAnonymized && (
          <button
            onClick={onToggleAnonymized}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors',
              anonymizedMode
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
            aria-label={anonymizedMode ? 'Show names' : 'Hide names'}
          >
            {anonymizedMode ? (
              <>
                <EyeOff className="h-3 w-3" />
                <span>Anonymous</span>
              </>
            ) : (
              <>
                <Eye className="h-3 w-3" />
                <span>Named</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Team Overview Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-muted/30 text-center">
          <p className="text-2xl font-bold text-foreground">
            {teamScore.toFixed(1)}
          </p>
          <p className="text-xs text-muted-foreground">Team Average</p>
          {scoreChange !== undefined && (
            <div
              className={cn(
                'flex items-center justify-center gap-0.5 text-xs mt-1',
                scoreChange > 0
                  ? 'text-score-high'
                  : scoreChange < 0
                    ? 'text-score-growth'
                    : 'text-muted-foreground'
              )}
            >
              {scoreChange > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : scoreChange < 0 ? (
                <TrendingDown className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              <span>
                {scoreChange > 0 ? '+' : ''}
                {scoreChange.toFixed(1)}
              </span>
            </div>
          )}
        </div>
        <div className="p-3 rounded-lg bg-muted/30 text-center">
          <p className="text-2xl font-bold text-foreground">
            {activeMembers ?? members.length}
          </p>
          <p className="text-xs text-muted-foreground">Active Members</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 text-center">
          <p className="text-2xl font-bold text-foreground">
            {totalPrompts?.toLocaleString() ?? '-'}
          </p>
          <p className="text-xs text-muted-foreground">Total Prompts</p>
        </div>
      </div>

      {/* Team Trend Chart */}
      {trendData.length > 1 && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Team Trend</p>
          <div className="h-[150px]" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trendData}
                margin={{ top: 5, right: 20, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => format(new Date(value), 'MMM d')}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0, 10]}
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  ticks={[0, 5, 10]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                  formatter={(value) => [Number(value ?? 0).toFixed(1), '']}
                  labelFormatter={(label) =>
                    format(new Date(label), 'MMM d, yyyy')
                  }
                />
                <Line
                  name="Team Average"
                  type="monotone"
                  dataKey="teamAvg"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                  activeDot={{ r: 5, fill: 'hsl(var(--primary))' }}
                />
                {benchmark && (
                  <Line
                    name="Benchmark"
                    type="monotone"
                    dataKey="benchmark"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                )}
                <Legend
                  wrapperStyle={{
                    fontSize: '11px',
                    color: 'hsl(var(--muted-foreground))',
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Member Distribution */}
      {members.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Score Distribution</p>
          <div className="h-[120px]" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={distributionData}
                margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
              >
                <XAxis
                  dataKey="name"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={40}
                />
                <YAxis
                  domain={[0, 10]}
                  hide
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value) => [Number(value ?? 0).toFixed(1), 'Score']}
                />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top Performers */}
      {members.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Member Rankings</p>
          <div className="space-y-2">
            {sortedMembers.slice(0, 5).map((member, index) => {
              const displayName = anonymizedMode
                ? anonymizeName(member.name, index)
                : member.name;
              const isTop = index === 0;
              const TrendIcon =
                member.trend === 'up'
                  ? TrendingUp
                  : member.trend === 'down'
                    ? TrendingDown
                    : Minus;
              const trendColor =
                member.trend === 'up'
                  ? 'text-score-high'
                  : member.trend === 'down'
                    ? 'text-score-growth'
                    : 'text-muted-foreground';

              return (
                <button
                  key={member.id}
                  onClick={() => onMemberClick?.(member.id)}
                  className={cn(
                    'w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left',
                    'hover:bg-muted/50',
                    isTop && 'bg-score-high/5 border border-score-high/20'
                  )}
                  data-testid={`member-${member.id}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
                        isTop
                          ? 'bg-score-high/20 text-score-high'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {isTop ? <Crown className="h-3 w-3" /> : index + 1}
                    </span>
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt=""
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <UserCircle className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {displayName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member.promptCount} prompts
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-sm font-bold"
                      style={{ color: getScoreColor(member.score) }}
                    >
                      {member.score.toFixed(1)}
                    </p>
                    <div className={cn('flex items-center gap-0.5 text-xs', trendColor)}>
                      <TrendIcon className="h-3 w-3" />
                      {member.change !== undefined && (
                        <span>
                          {member.change > 0 ? '+' : ''}
                          {member.change.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Coaching Opportunities */}
      {coachingOpportunities.length > 0 && (
        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground">Coaching Opportunities</p>
          </div>
          <div className="space-y-2">
            {coachingOpportunities.slice(0, 3).map((opportunity) => {
              const priorityConfig = PRIORITY_CONFIG[opportunity.priority];
              const OpportunityIcon = OPPORTUNITY_ICONS[opportunity.type];

              return (
                <button
                  key={opportunity.id}
                  onClick={() => onOpportunityClick?.(opportunity.id)}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left',
                    priorityConfig.bgColor,
                    'hover:opacity-80'
                  )}
                  data-testid={`opportunity-${opportunity.id}`}
                >
                  <OpportunityIcon
                    className={cn('h-4 w-4 mt-0.5 shrink-0', priorityConfig.color)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {opportunity.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {opportunity.description}
                    </p>
                    {opportunity.suggestedAction && (
                      <p className="text-xs text-primary mt-1 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        {opportunity.suggestedAction}
                      </p>
                    )}
                  </div>
                  {opportunity.affectedMembers !== undefined && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {opportunity.affectedMembers} affected
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Screen reader description */}
      <span className="sr-only">{getAccessibleDescription()}</span>
    </div>
  );
}

/**
 * Compact team stats badge
 */
export function TeamStatsBadge({
  score,
  memberCount,
  className,
}: {
  score: number;
  memberCount: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm',
        className
      )}
      data-testid="team-stats-badge"
    >
      <Users className="h-4 w-4 text-muted-foreground" />
      <span className="font-medium text-foreground">{score.toFixed(1)}</span>
      <span className="text-muted-foreground">
        ({memberCount} members)
      </span>
    </span>
  );
}
