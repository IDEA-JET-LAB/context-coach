'use client';

import { cn } from '@/lib/utils';
import {
  Award,
  TrendingUp,
  Target,
  Star,
  Zap,
  Trophy,
  Flame,
  CheckCircle,
  ChevronRight,
  Sparkles,
  Calendar,
  LucideIcon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area,
  AreaChart,
  ReferenceLine,
} from 'recharts';
import { format, differenceInDays } from 'date-fns';

export interface SkillProgress {
  date: string;
  score: number;
  sessionCount?: number;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  icon: 'star' | 'trophy' | 'flame' | 'zap' | 'award' | 'check';
  achieved: boolean;
  achievedDate?: string;
  progress?: number; // 0-100 for in-progress milestones
}

export interface ImprovementSuggestion {
  id: string;
  area: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
  potentialGain?: number; // Expected score improvement
}

export interface LearningProgressProps {
  /** Skill progression over time */
  progressData: SkillProgress[];
  /** Current skill level (0-10) */
  currentLevel?: number;
  /** Level change from previous period */
  levelChange?: number;
  /** Earned milestones */
  milestones?: Milestone[];
  /** Improvement suggestions */
  suggestions?: ImprovementSuggestion[];
  /** Current streak (days) */
  streak?: number;
  /** Total sessions completed */
  totalSessions?: number;
  /** Learning goal */
  goal?: { target: number; current: number; deadline?: string };
  /** Loading state */
  loading?: boolean;
  /** Additional class names */
  className?: string;
  /** Click handler for drill-down */
  onClick?: () => void;
  /** Click handler for suggestion */
  onSuggestionClick?: (suggestionId: string) => void;
}

const MILESTONE_ICONS: Record<Milestone['icon'], LucideIcon> = {
  star: Star,
  trophy: Trophy,
  flame: Flame,
  zap: Zap,
  award: Award,
  check: CheckCircle,
};

const PRIORITY_CONFIG = {
  high: { color: 'text-destructive', bg: 'bg-destructive/10' },
  medium: { color: 'text-score-growth', bg: 'bg-score-growth/10' },
  low: { color: 'text-info', bg: 'bg-info/10' },
};

function getLevelLabel(score: number): string {
  if (score >= 9) return 'Master';
  if (score >= 7) return 'Expert';
  if (score >= 5) return 'Proficient';
  if (score >= 3) return 'Developing';
  return 'Beginner';
}

export function LearningProgress({
  progressData,
  currentLevel,
  levelChange,
  milestones = [],
  suggestions = [],
  streak,
  totalSessions,
  goal,
  loading = false,
  className,
  onClick,
  onSuggestionClick,
}: LearningProgressProps) {
  if (loading) {
    return (
      <div
        className={cn('rounded-lg border border-border bg-card p-4', className)}
        data-testid="learning-progress-loading"
      >
        <div className="h-4 w-32 animate-pulse rounded bg-muted mb-4" />
        <div className="h-[150px] animate-pulse rounded bg-muted mb-4" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 w-16 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  // Calculate current level if not provided
  const calculatedLevel =
    currentLevel ??
    (progressData.length > 0
      ? (progressData[progressData.length - 1]?.score ?? 0)
      : 0);

  // Separate achieved and upcoming milestones
  const achievedMilestones = milestones.filter((m) => m.achieved);
  const upcomingMilestones = milestones.filter((m) => !m.achieved);

  // Calculate goal progress
  const goalProgress = goal
    ? Math.min(100, (goal.current / goal.target) * 100)
    : 0;
  const daysToDeadline = goal?.deadline
    ? differenceInDays(new Date(goal.deadline), new Date())
    : null;

  // Generate accessible description
  const getAccessibleDescription = () => {
    let desc = `Learning progress tracker.`;
    if (calculatedLevel) {
      desc += ` Current level: ${calculatedLevel.toFixed(1)} (${getLevelLabel(calculatedLevel)}).`;
    }
    if (levelChange) {
      desc += ` ${levelChange > 0 ? 'Improved' : 'Declined'} by ${Math.abs(levelChange).toFixed(1)} points.`;
    }
    if (achievedMilestones.length > 0) {
      desc += ` ${achievedMilestones.length} milestone(s) achieved.`;
    }
    if (streak) {
      desc += ` Current streak: ${streak} days.`;
    }
    return desc;
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-4',
        onClick && 'cursor-pointer hover:border-primary/50 transition-colors',
        className
      )}
      onClick={onClick}
      data-testid="learning-progress"
      role="img"
      aria-label={getAccessibleDescription()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          Learning Progress
        </h3>
        {levelChange !== undefined && (
          <div
            className={cn(
              'flex items-center gap-1 text-sm',
              levelChange > 0 ? 'text-score-high' : levelChange < 0 ? 'text-score-growth' : 'text-muted-foreground'
            )}
          >
            <TrendingUp
              className={cn('h-4 w-4', levelChange < 0 && 'rotate-180')}
            />
            <span>
              {levelChange > 0 ? '+' : ''}
              {levelChange.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {/* Current Level Display */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xl font-bold text-primary">
              {calculatedLevel.toFixed(1)}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {getLevelLabel(calculatedLevel)}
            </p>
            <p className="text-xs text-muted-foreground">Current Level</p>
          </div>
        </div>
        {/* Stats */}
        {(streak !== undefined || totalSessions !== undefined) && (
          <div className="flex gap-3 ml-auto">
            {streak !== undefined && (
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-score-growth">
                  <Flame className="h-4 w-4" />
                  <span className="text-lg font-bold">{streak}</span>
                </div>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
            )}
            {totalSessions !== undefined && (
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-primary">
                  <Calendar className="h-4 w-4" />
                  <span className="text-lg font-bold">{totalSessions}</span>
                </div>
                <p className="text-xs text-muted-foreground">Sessions</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress Chart */}
      {progressData.length > 1 && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Skill Growth</p>
          <div className="h-[120px]" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={progressData}
                margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="learningGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                  formatter={(value) => [Number(value ?? 0).toFixed(1), 'Score']}
                  labelFormatter={(label) =>
                    format(new Date(label), 'MMM d, yyyy')
                  }
                />
                {goal && (
                  <ReferenceLine
                    y={goal.target}
                    stroke="hsl(var(--score-high))"
                    strokeDasharray="5 5"
                    label={{
                      value: 'Goal',
                      fill: 'hsl(var(--score-high))',
                      fontSize: 10,
                    }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#learningGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Goal Progress */}
      {goal && (
        <div className="mb-4 p-3 rounded-lg bg-muted/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Goal Progress</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {goal.current.toFixed(1)} / {goal.target.toFixed(1)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${goalProgress}%` }}
            />
          </div>
          {daysToDeadline !== null && daysToDeadline > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {daysToDeadline} days remaining
            </p>
          )}
        </div>
      )}

      {/* Milestones */}
      {milestones.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Milestones</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {achievedMilestones.slice(0, 5).map((milestone) => {
              const MilestoneIcon = MILESTONE_ICONS[milestone.icon];
              return (
                <div
                  key={milestone.id}
                  className="flex-shrink-0 w-16 text-center"
                  title={milestone.title}
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-score-high/10 flex items-center justify-center mb-1">
                    <MilestoneIcon className="h-6 w-6 text-score-high" />
                  </div>
                  <p className="text-xs text-foreground truncate">
                    {milestone.title}
                  </p>
                </div>
              );
            })}
            {upcomingMilestones.slice(0, 2).map((milestone) => {
              const MilestoneIcon = MILESTONE_ICONS[milestone.icon];
              return (
                <div
                  key={milestone.id}
                  className="flex-shrink-0 w-16 text-center opacity-50"
                  title={`${milestone.title} (In progress)`}
                >
                  <div className="relative w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center mb-1">
                    <MilestoneIcon className="h-6 w-6 text-muted-foreground" />
                    {milestone.progress !== undefined && (
                      <svg
                        className="absolute inset-0 w-12 h-12 -rotate-90"
                        viewBox="0 0 48 48"
                      >
                        <circle
                          cx="24"
                          cy="24"
                          r="22"
                          fill="none"
                          stroke="hsl(var(--primary))"
                          strokeWidth="2"
                          strokeDasharray={`${(milestone.progress / 100) * 138.2} 138.2`}
                        />
                      </svg>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {milestone.title}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Improvement Suggestions */}
      {suggestions.length > 0 && (
        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground">Improvement Tips</p>
          </div>
          <div className="space-y-2">
            {suggestions.slice(0, 3).map((suggestion) => {
              const priorityConfig = PRIORITY_CONFIG[suggestion.priority];
              return (
                <button
                  key={suggestion.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSuggestionClick?.(suggestion.id);
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors',
                    priorityConfig.bg,
                    'hover:opacity-80'
                  )}
                  data-testid={`suggestion-${suggestion.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">
                      {suggestion.area}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {suggestion.suggestion}
                    </p>
                  </div>
                  {suggestion.potentialGain !== undefined && (
                    <span className="text-xs font-medium text-score-high">
                      +{suggestion.potentialGain.toFixed(1)}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Encouraging message */}
      <div className="mt-4 pt-4 border-t border-border text-center">
        <p className="text-xs text-muted-foreground">
          {calculatedLevel >= 7
            ? 'Outstanding progress! Keep pushing boundaries.'
            : calculatedLevel >= 4
              ? 'Great work! Consistent practice leads to mastery.'
              : 'Every prompt is a step forward. Keep learning!'}
        </p>
      </div>

      {/* Screen reader description */}
      <span className="sr-only">{getAccessibleDescription()}</span>
    </div>
  );
}

/**
 * Compact milestone badge for inline display
 */
export function MilestoneBadge({
  milestone,
  size = 'md',
  className,
}: {
  milestone: Milestone;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const MilestoneIcon = MILESTONE_ICONS[milestone.icon];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        milestone.achieved
          ? 'bg-score-high/10 text-score-high'
          : 'bg-muted text-muted-foreground',
        className
      )}
      data-testid={`milestone-badge-${milestone.id}`}
    >
      <MilestoneIcon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      <span>{milestone.title}</span>
    </span>
  );
}
