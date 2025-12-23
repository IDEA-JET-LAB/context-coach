'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useTeamIntelligence } from '@/lib/hooks/use-team-intelligence';
import type {
  AnalyticsTimeRange,
  TopPerformer,
  CommonStruggle,
  BestPractice,
} from '@/lib/types/team-intelligence';
import type { CoachingOpportunity } from '@/components/analytics/team-intelligence';
import { MetricCard } from '@/components/analytics/metric-card';
import { TrendIndicator } from '@/components/analytics/trend-indicator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  FileText,
  Activity,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Lightbulb,
  Award,
  UserCircle,
  Crown,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';

interface TeamIntelligenceDashboardProps {
  teamId: string;
  isAdmin: boolean;
  className?: string;
}

const TIME_RANGE_OPTIONS: { value: AnalyticsTimeRange; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

const PERSONA_COLORS: Record<string, string> = {
  architect: 'hsl(var(--chart-1))',
  firefighter: 'hsl(var(--chart-2))',
  craftsman: 'hsl(var(--chart-3))',
  explorer: 'hsl(var(--chart-4))',
};

const PERSONA_LABELS: Record<string, string> = {
  architect: 'Architects',
  firefighter: 'Firefighters',
  craftsman: 'Craftsmen',
  explorer: 'Explorers',
};

function TeamIntelligenceSkeleton() {
  return (
    <div className="space-y-6" data-testid="team-intelligence-skeleton">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[300px]" />
      </div>
      <Skeleton className="h-[250px]" />
    </div>
  );
}

export function TeamIntelligenceDashboard({
  teamId,
  isAdmin,
  className,
}: TeamIntelligenceDashboardProps) {
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>('30d');
  const { data, isPending, error, refetch } = useTeamIntelligence(teamId, timeRange);

  if (isPending) {
    return <TeamIntelligenceSkeleton />;
  }

  if (error) {
    return (
      <div
        className="rounded-lg border border-status-error/30 bg-status-error-subtle p-6 text-center"
        data-testid="team-intelligence-error"
      >
        <AlertTriangle className="h-8 w-8 text-status-error mx-auto mb-3" />
        <p className="text-status-error mb-4">Failed to load team intelligence</p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-card border border-border hover:bg-muted transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="rounded-lg border border-border bg-card p-8 text-center"
        data-testid="team-intelligence-empty"
      >
        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-lg font-medium text-foreground mb-2">No analytics data yet</p>
        <p className="text-muted-foreground">
          Team intelligence will appear once team members start submitting prompts.
        </p>
      </div>
    );
  }

  const { summary, styleDistribution, personaDistribution, sentimentHealth, sessionHealth, topPerformers, commonStruggles, bestPractices, weekOverWeek } = data;

  // Prepare work style chart data
  const workStyleData = Object.entries(styleDistribution)
    .filter(([, count]) => count > 0)
    .map(([style, count]) => ({
      name: style.charAt(0).toUpperCase() + style.slice(1),
      value: count,
    }));

  // Prepare persona chart data
  const personaData = Object.entries(personaDistribution)
    .filter(([, count]) => count > 0)
    .map(([persona, count]) => ({
      name: PERSONA_LABELS[persona] || persona,
      value: count,
      fill: PERSONA_COLORS[persona] || 'hsl(var(--primary))',
    }));

  return (
    <div className={cn('space-y-6', className)} data-testid="team-intelligence-dashboard">
      {/* Header with Time Range */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Team Intelligence</h2>
          <p className="text-sm text-muted-foreground">
            {data.meta?.teamName ? `Insights for ${data.meta.teamName}` : 'Team analytics and insights'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as AnalyticsTimeRange)}
            className="px-3 py-2 rounded-md border border-border bg-card text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
            data-testid="time-range-select"
          >
            {TIME_RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Team Size"
          value={summary.teamSize}
          icon={Users}
          subtitle={`${summary.activeUsers} active`}
        />
        <MetricCard
          title="Total Prompts"
          value={summary.totalPrompts.toLocaleString()}
          icon={FileText}
        />
        <MetricCard
          title="Total Sessions"
          value={summary.totalSessions.toLocaleString()}
          icon={Activity}
        />
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Avg Score</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {summary.avgPromptScore.toFixed(1)}
            </span>
            <span className="text-muted-foreground">/10</span>
            {summary.scoreChange !== null && (
              <TrendIndicator
                direction={summary.scoreChange > 0 ? 'up' : summary.scoreChange < 0 ? 'down' : 'stable'}
                value={`${summary.scoreChange > 0 ? '+' : ''}${summary.scoreChange.toFixed(1)}`}
                size="sm"
              />
            )}
          </div>
        </div>
      </div>

      {/* Week-over-Week Changes */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">Week-over-Week Changes</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              {weekOverWeek.promptScoreChange > 0 ? (
                <TrendingUp className="h-4 w-4 text-score-high" />
              ) : weekOverWeek.promptScoreChange < 0 ? (
                <TrendingDown className="h-4 w-4 text-score-growth" />
              ) : (
                <Minus className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={cn(
                'font-medium',
                weekOverWeek.promptScoreChange > 0 ? 'text-score-high' :
                weekOverWeek.promptScoreChange < 0 ? 'text-score-growth' :
                'text-muted-foreground'
              )}>
                {weekOverWeek.promptScoreChange > 0 ? '+' : ''}
                {weekOverWeek.promptScoreChange.toFixed(1)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Score Change</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              {weekOverWeek.efficiencyChange > 0 ? (
                <TrendingUp className="h-4 w-4 text-score-high" />
              ) : weekOverWeek.efficiencyChange < 0 ? (
                <TrendingDown className="h-4 w-4 text-score-growth" />
              ) : (
                <Minus className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={cn(
                'font-medium',
                weekOverWeek.efficiencyChange > 0 ? 'text-score-high' :
                weekOverWeek.efficiencyChange < 0 ? 'text-score-growth' :
                'text-muted-foreground'
              )}>
                {weekOverWeek.efficiencyChange > 0 ? '+' : ''}
                {weekOverWeek.efficiencyChange.toFixed(1)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Efficiency</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              {weekOverWeek.frustrationChange < 0 ? (
                <TrendingDown className="h-4 w-4 text-score-high" />
              ) : weekOverWeek.frustrationChange > 0 ? (
                <TrendingUp className="h-4 w-4 text-score-growth" />
              ) : (
                <Minus className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={cn(
                'font-medium',
                weekOverWeek.frustrationChange < 0 ? 'text-score-high' :
                weekOverWeek.frustrationChange > 0 ? 'text-score-growth' :
                'text-muted-foreground'
              )}>
                {weekOverWeek.frustrationChange > 0 ? '+' : ''}
                {(weekOverWeek.frustrationChange * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Frustration</p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Work Style Distribution */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-foreground mb-4">Work Style Distribution</h3>
          {workStyleData.length > 0 ? (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workStyleData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={80}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value) => [value, 'Prompts']}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              No work style data available
            </div>
          )}
        </div>

        {/* Persona Distribution */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-foreground mb-4">Team Personas</h3>
          {personaData.length > 0 ? (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={personaData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                  >
                    {personaData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value) => [value, 'Members']}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '12px' }}
                    formatter={(value) => <span className="text-foreground">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              No persona data available
            </div>
          )}
        </div>
      </div>

      {/* Health Metrics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sentiment Health */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-foreground mb-4">Team Sentiment</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <p className="text-3xl font-bold text-score-high">
                {(sentimentHealth.teamPoliteRate * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">Polite Rate</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <p className="text-3xl font-bold text-score-growth">
                {(sentimentHealth.teamFrustratedRate * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">Frustrated Rate</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Politeness Ratio</span>
              <span className="font-medium text-foreground">
                {sentimentHealth.politenessRatio.toFixed(1)}:1
              </span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-muted-foreground">Trend</span>
              <span className={cn(
                'font-medium capitalize',
                sentimentHealth.trend === 'improving' ? 'text-score-high' :
                sentimentHealth.trend === 'declining' ? 'text-score-growth' :
                'text-muted-foreground'
              )}>
                {sentimentHealth.trend}
              </span>
            </div>
          </div>
        </div>

        {/* Session Health */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-foreground mb-4">Session Health</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">
                {sessionHealth.avgHealthScore.toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Avg Health</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-score-high">
                {(sessionHealth.healthySessionRate * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">Healthy Sessions</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">
                {(sessionHealth.avgContextUsage * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">Context Usage</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Performers (Admin only) */}
      {isAdmin && topPerformers.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <Award className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-medium text-foreground">Top Performers</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['prompt_quality', 'efficiency', 'session_health'].map((metric) => {
              const performers = topPerformers
                .filter((p) => p.metric === metric)
                .slice(0, 3);

              if (performers.length === 0) return null;

              const metricLabels: Record<string, string> = {
                prompt_quality: 'Prompt Quality',
                efficiency: 'Efficiency',
                session_health: 'Session Health',
              };

              return (
                <div key={metric} className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {metricLabels[metric]}
                  </p>
                  {performers.map((performer, index) => (
                    <div
                      key={`${performer.userId}-${performer.metric}`}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded-lg',
                        index === 0 ? 'bg-score-high/10' : 'bg-muted/30'
                      )}
                    >
                      <span
                        className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium',
                          index === 0 ? 'bg-score-high/20 text-score-high' : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {index === 0 ? <Crown className="h-3 w-3" /> : index + 1}
                      </span>
                      {performer.avatarUrl ? (
                        <img
                          src={performer.avatarUrl}
                          alt=""
                          className="w-6 h-6 rounded-full"
                        />
                      ) : (
                        <UserCircle className="w-6 h-6 text-muted-foreground" />
                      )}
                      <span className="flex-1 text-sm truncate text-foreground">
                        {performer.userName}
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {performer.value.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Common Struggles */}
      {commonStruggles.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-score-growth" />
            <h3 className="text-sm font-medium text-foreground">Common Struggles</h3>
          </div>
          <div className="space-y-3">
            {commonStruggles.map((struggle, index) => (
              <div
                key={index}
                className={cn(
                  'p-3 rounded-lg border',
                  struggle.severity === 'high'
                    ? 'bg-destructive/10 border-destructive/20'
                    : struggle.severity === 'medium'
                      ? 'bg-score-growth/10 border-score-growth/20'
                      : 'bg-muted/30 border-border'
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-foreground">{struggle.issue}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {struggle.suggestion}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      struggle.severity === 'high'
                        ? 'bg-destructive/20 text-destructive'
                        : struggle.severity === 'medium'
                          ? 'bg-score-growth/20 text-score-growth'
                          : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {struggle.affectedPercent}% affected
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best Practices */}
      {bestPractices.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-medium text-foreground">Best Practices from Top Performers</h3>
          </div>
          <div className="space-y-3">
            {bestPractices.map((practice, index) => (
              <div
                key={index}
                className="p-3 rounded-lg bg-primary/5 border border-primary/20"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-foreground">{practice.pattern}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {practice.impact}
                    </p>
                    {practice.examples.length > 0 && (
                      <p className="text-xs text-primary mt-2">
                        Exemplars: {practice.examples.join(', ')}
                      </p>
                    )}
                  </div>
                  <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {practice.exemplarCount} {practice.exemplarCount === 1 ? 'user' : 'users'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
