'use client';

import { cn } from '@/lib/utils';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import {
  Layers,
  Bug,
  Code,
  Settings,
  Lightbulb,
  Shield,
  Database,
  GitBranch,
  LucideIcon,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';

export interface TechnicalDepthCategory {
  id: string;
  name: string;
  score: number; // 0-10
  description?: string;
}

export interface DepthRadarProps {
  /** User's technical depth scores */
  data: TechnicalDepthCategory[];
  /** Team average for comparison */
  teamData?: TechnicalDepthCategory[];
  /** Overall technical depth score */
  overallScore?: number;
  /** Change from previous period */
  change?: number;
  /** Trend direction */
  trend?: 'up' | 'down' | 'stable';
  /** Height of the radar chart */
  height?: number;
  /** Show legend */
  showLegend?: boolean;
  /** Show comparison */
  showComparison?: boolean;
  /** Label for user data */
  userLabel?: string;
  /** Label for comparison data */
  compareLabel?: string;
  /** Loading state */
  loading?: boolean;
  /** Additional class names */
  className?: string;
  /** Click handler for drill-down */
  onClick?: () => void;
}

// Map category IDs to icons
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  architecture: Layers,
  debugging: Bug,
  implementation: Code,
  configuration: Settings,
  design: Lightbulb,
  security: Shield,
  database: Database,
  versionControl: GitBranch,
  default: Code,
};

// Default categories if not provided
const DEFAULT_CATEGORIES = [
  { id: 'architecture', name: 'Architecture', description: 'System design and structure' },
  { id: 'debugging', name: 'Debugging', description: 'Problem diagnosis and fixing' },
  { id: 'implementation', name: 'Implementation', description: 'Feature building and coding' },
  { id: 'configuration', name: 'Configuration', description: 'Setup and environment' },
  { id: 'design', name: 'Design', description: 'UI/UX and patterns' },
  { id: 'security', name: 'Security', description: 'Auth, encryption, vulnerabilities' },
];

function getCategoryIcon(categoryId: string): LucideIcon {
  const normalizedId = categoryId.toLowerCase();
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (normalizedId.includes(key.toLowerCase())) return icon;
  }
  return CATEGORY_ICONS.default ?? Code;
}

function getScoreLabel(score: number): string {
  if (score >= 8) return 'Expert';
  if (score >= 6) return 'Proficient';
  if (score >= 4) return 'Developing';
  if (score >= 2) return 'Beginner';
  return 'Exploring';
}

export function DepthRadar({
  data,
  teamData,
  overallScore,
  change,
  trend = 'stable',
  height = 300,
  showLegend = true,
  showComparison = true,
  userLabel = 'You',
  compareLabel = 'Team Avg',
  loading = false,
  className,
  onClick,
}: DepthRadarProps) {
  if (loading) {
    return (
      <div
        className={cn('rounded-lg border border-border bg-card p-4', className)}
        data-testid="depth-radar-loading"
      >
        <div className="h-4 w-32 animate-pulse rounded bg-muted mb-4" />
        <div
          className="animate-pulse rounded-full bg-muted mx-auto"
          style={{ width: height - 50, height: height - 50 }}
        />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className={cn(
          'rounded-lg border border-border bg-card p-4 flex flex-col items-center justify-center',
          className
        )}
        style={{ minHeight: height }}
        data-testid="depth-radar-empty"
      >
        <Layers className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-muted-foreground">No technical depth data</p>
      </div>
    );
  }

  // Merge data for recharts
  const chartData = data.map((item) => {
    const teamItem = teamData?.find((t) => t.id === item.id);
    return {
      category: item.name,
      user: item.score,
      team: teamItem?.score || 0,
      fullMark: 10,
    };
  });

  // Calculate overall if not provided
  const calculatedOverall =
    overallScore ?? data.reduce((sum, d) => sum + d.score, 0) / data.length;

  // Trend icon
  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up'
      ? 'text-score-high'
      : trend === 'down'
        ? 'text-score-growth'
        : 'text-muted-foreground';

  // Generate accessible description
  const getAccessibleDescription = () => {
    let desc = `Technical depth radar showing ${data.length} categories.`;
    if (calculatedOverall) {
      desc += ` Overall score: ${calculatedOverall.toFixed(1)} out of 10 (${getScoreLabel(calculatedOverall)}).`;
    }
    desc += ` Categories: ${data.map((d) => `${d.name} ${d.score.toFixed(1)}`).join(', ')}.`;
    if (teamData) {
      desc += ` Comparison with team average available.`;
    }
    return desc;
  };

  // Custom tooltip
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{
      name: string;
      value: number;
      dataKey: string;
      color: string;
      payload: { category: string };
    }>;
  }) => {
    if (!active || !payload?.length) return null;
    const category = payload[0]?.payload?.category;
    const categoryData = data.find((d) => d.name === category);

    return (
      <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground mb-1">{category}</p>
        {payload.map((entry) => (
          <p key={entry.dataKey} className="text-xs">
            <span
              className="inline-block w-2 h-2 rounded-full mr-2"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}: </span>
            <span className="font-medium text-foreground">
              {entry.value.toFixed(1)}
            </span>
          </p>
        ))}
        {categoryData?.description && (
          <p className="text-xs text-muted-foreground mt-1 pt-1 border-t border-border">
            {categoryData.description}
          </p>
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-4',
        onClick && 'cursor-pointer hover:border-primary/50 transition-colors',
        className
      )}
      onClick={onClick}
      data-testid="depth-radar"
      role="img"
      aria-label={getAccessibleDescription()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          Technical Depth
        </h3>
        {change !== undefined && (
          <div className={cn('flex items-center gap-1 text-sm', trendColor)}>
            <TrendIcon className="h-4 w-4" />
            <span>{change > 0 ? '+' : ''}{change.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Overall Score */}
      {calculatedOverall !== undefined && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl font-bold text-foreground">
            {calculatedOverall.toFixed(1)}
          </span>
          <span className="text-sm text-muted-foreground">/ 10</span>
          <span
            className={cn(
              'ml-2 px-2 py-0.5 rounded-full text-xs font-medium',
              calculatedOverall >= 7
                ? 'bg-score-high/10 text-score-high'
                : calculatedOverall >= 4
                  ? 'bg-score-medium/10 text-score-medium'
                  : 'bg-score-growth/10 text-score-growth'
            )}
          >
            {getScoreLabel(calculatedOverall)}
          </span>
        </div>
      )}

      {/* Radar Chart */}
      <div style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart
            data={chartData}
            margin={{ top: 20, right: 30, bottom: 20, left: 30 }}
          >
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="category"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 10]}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              tickCount={6}
            />
            {showComparison && teamData && (
              <Radar
                name={compareLabel}
                dataKey="team"
                stroke="hsl(var(--secondary))"
                fill="hsl(var(--secondary))"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            )}
            <Radar
              name={userLabel}
              dataKey="user"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && teamData && (
              <Legend
                wrapperStyle={{
                  color: 'hsl(var(--muted-foreground))',
                  fontSize: '12px',
                }}
              />
            )}
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Category Breakdown */}
      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground mb-2">Category Scores</p>
        <div className="grid grid-cols-2 gap-2">
          {data.map((category) => {
            const CategoryIcon = getCategoryIcon(category.id);
            const teamScore = teamData?.find((t) => t.id === category.id)?.score;
            return (
              <div
                key={category.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-muted/30"
              >
                <CategoryIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground truncate">
                      {category.name}
                    </span>
                    <span className="text-xs font-medium text-foreground ml-1">
                      {category.score.toFixed(1)}
                    </span>
                  </div>
                  <div className="h-1 mt-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${(category.score / 10) * 100}%` }}
                    />
                  </div>
                  {teamScore !== undefined && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Team: {teamScore.toFixed(1)}
                      {category.score > teamScore && (
                        <span className="text-score-high ml-1">
                          +{(category.score - teamScore).toFixed(1)}
                        </span>
                      )}
                      {category.score < teamScore && (
                        <span className="text-score-growth ml-1">
                          {(category.score - teamScore).toFixed(1)}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Screen reader description */}
      <span className="sr-only">{getAccessibleDescription()}</span>
    </div>
  );
}

/**
 * Compact depth indicator for inline use
 */
export function DepthIndicator({
  category,
  score,
  className,
}: {
  category: string;
  score: number;
  className?: string;
}) {
  const CategoryIcon = getCategoryIcon(category);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs',
        score >= 7
          ? 'bg-score-high/10 text-score-high'
          : score >= 4
            ? 'bg-score-medium/10 text-score-medium'
            : 'bg-score-growth/10 text-score-growth',
        className
      )}
      data-testid={`depth-indicator-${category}`}
    >
      <CategoryIcon className="h-3 w-3" />
      <span>{score.toFixed(1)}</span>
    </span>
  );
}
