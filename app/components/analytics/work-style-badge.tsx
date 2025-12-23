'use client';

import { cn } from '@/lib/utils';
import {
  Compass,
  Target,
  RefreshCw,
  Layers,
  Zap,
  Search,
  LucideIcon,
  HelpCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

export type WorkStyle =
  | 'explorer'
  | 'focused'
  | 'iterative'
  | 'architect'
  | 'rapid'
  | 'researcher';

export interface WorkStyleData {
  style: WorkStyle;
  percentage: number;
  promptCount: number;
}

export interface WorkStyleBadgeProps {
  /** Primary work style */
  primaryStyle: WorkStyle;
  /** Distribution of all styles */
  distribution?: WorkStyleData[];
  /** Whether to show distribution chart */
  showDistribution?: boolean;
  /** Chart type for distribution */
  chartType?: 'pie' | 'bar';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Loading state */
  loading?: boolean;
  /** Additional class names */
  className?: string;
  /** Click handler for drill-down */
  onClick?: () => void;
}

interface StyleConfig {
  icon: LucideIcon;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  chartColor: string;
}

const STYLE_CONFIG: Record<WorkStyle, StyleConfig> = {
  explorer: {
    icon: Compass,
    label: 'Explorer',
    description: 'Broad questions, investigating possibilities, learning-oriented',
    color: 'text-chart-1',
    bgColor: 'bg-chart-1/10 border-chart-1/20',
    chartColor: 'hsl(var(--chart-1))',
  },
  focused: {
    icon: Target,
    label: 'Focused',
    description: 'Specific tasks, clear objectives, goal-oriented',
    color: 'text-chart-2',
    bgColor: 'bg-chart-2/10 border-chart-2/20',
    chartColor: 'hsl(var(--chart-2))',
  },
  iterative: {
    icon: RefreshCw,
    label: 'Iterative',
    description: 'Refinement cycles, building on responses, incremental',
    color: 'text-chart-3',
    bgColor: 'bg-chart-3/10 border-chart-3/20',
    chartColor: 'hsl(var(--chart-3))',
  },
  architect: {
    icon: Layers,
    label: 'Architect',
    description: 'System design, planning, structural thinking',
    color: 'text-chart-4',
    bgColor: 'bg-chart-4/10 border-chart-4/20',
    chartColor: 'hsl(var(--chart-4))',
  },
  rapid: {
    icon: Zap,
    label: 'Rapid',
    description: 'Quick queries, short prompts, fast-paced',
    color: 'text-chart-5',
    bgColor: 'bg-chart-5/10 border-chart-5/20',
    chartColor: 'hsl(var(--chart-5))',
  },
  researcher: {
    icon: Search,
    label: 'Researcher',
    description: 'Deep dives, context-heavy, thorough investigation',
    color: 'text-primary',
    bgColor: 'bg-primary/10 border-primary/20',
    chartColor: 'hsl(var(--primary))',
  },
};

const sizeConfig = {
  sm: {
    badge: 'px-2 py-1 text-xs',
    icon: 'h-3 w-3',
    container: 'p-3',
  },
  md: {
    badge: 'px-3 py-1.5 text-sm',
    icon: 'h-4 w-4',
    container: 'p-4',
  },
  lg: {
    badge: 'px-4 py-2 text-base',
    icon: 'h-5 w-5',
    container: 'p-5',
  },
};

export function WorkStyleBadge({
  primaryStyle,
  distribution = [],
  showDistribution = false,
  chartType = 'pie',
  size = 'md',
  loading = false,
  className,
  onClick,
}: WorkStyleBadgeProps) {
  const config = STYLE_CONFIG[primaryStyle];
  const sizes = sizeConfig[size];
  const Icon = config?.icon || HelpCircle;

  if (loading) {
    return (
      <div
        className={cn(
          'rounded-lg border border-border bg-card',
          sizes.container,
          className
        )}
        data-testid="work-style-loading"
      >
        <div className="h-4 w-24 animate-pulse rounded bg-muted mb-3" />
        <div className="h-8 w-32 animate-pulse rounded bg-muted mb-2" />
        <div className="h-3 w-48 animate-pulse rounded bg-muted" />
        {showDistribution && (
          <div className="mt-4 h-[150px] animate-pulse rounded bg-muted" />
        )}
      </div>
    );
  }

  // Prepare chart data
  const chartData = distribution.map((item) => ({
    name: STYLE_CONFIG[item.style].label,
    value: item.percentage,
    count: item.promptCount,
    fill: STYLE_CONFIG[item.style].chartColor,
  }));

  // Generate accessible description
  const getAccessibleDescription = () => {
    let desc = `Your primary work style is ${config.label}. ${config.description}.`;
    if (distribution.length > 0) {
      desc += ` Style distribution: ${distribution
        .map((d) => `${STYLE_CONFIG[d.style].label} ${d.percentage}%`)
        .join(', ')}.`;
    }
    return desc;
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card',
        sizes.container,
        onClick && 'cursor-pointer hover:border-primary/50 transition-colors',
        className
      )}
      onClick={onClick}
      data-testid="work-style-badge"
      role="img"
      aria-label={getAccessibleDescription()}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">Work Style</h3>
        <button
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
          aria-label="Learn more about work styles"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </div>

      {/* Primary Style Badge */}
      <div
        className={cn(
          'inline-flex items-center gap-2 rounded-full border',
          config.bgColor,
          sizes.badge
        )}
        data-testid="primary-style-badge"
      >
        <Icon className={cn(sizes.icon, config.color)} aria-hidden="true" />
        <span className={cn('font-medium', config.color)}>{config.label}</span>
      </div>

      {/* Style Description */}
      <p className="mt-2 text-xs text-muted-foreground">{config.description}</p>

      {/* Distribution Chart */}
      {showDistribution && distribution.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border" aria-hidden="true">
          <p className="text-xs text-muted-foreground mb-2">Style Distribution</p>

          {chartType === 'pie' ? (
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={55}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {chartData.map((entry, index) => (
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
                    formatter={(value, name) => [
                      `${value ?? 0}%`,
                      String(name),
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 60, bottom: 0 }}
                >
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    width={55}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value) => [`${value ?? 0}%`, 'Distribution']}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Legend */}
          <div className="mt-2 flex flex-wrap gap-2">
            {chartData.map((item) => (
              <div
                key={item.name}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: item.fill }}
                />
                <span>{item.name}</span>
                <span className="text-muted-foreground/60">({item.value}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Screen reader description */}
      <span className="sr-only">{getAccessibleDescription()}</span>
    </div>
  );
}

/**
 * Simplified badge component for inline use
 */
export function WorkStyleBadgeInline({
  style,
  size = 'sm',
  className,
}: {
  style: WorkStyle;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const config = STYLE_CONFIG[style];
  const sizes = sizeConfig[size];
  const Icon = config?.icon || HelpCircle;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border',
        config.bgColor,
        sizes.badge,
        className
      )}
      data-testid={`work-style-inline-${style}`}
    >
      <Icon className={cn(sizes.icon, config.color)} aria-hidden="true" />
      <span className={cn('font-medium', config.color)}>{config.label}</span>
    </span>
  );
}
