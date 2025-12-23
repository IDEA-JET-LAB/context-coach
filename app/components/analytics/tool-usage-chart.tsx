'use client';

import { cn } from '@/lib/utils';
import {
  Wrench,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Zap,
  Code,
  FileText,
  Search,
  Terminal,
  GitBranch,
  Database,
  Globe,
  LucideIcon,
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
} from 'recharts';

export interface ToolUsageData {
  /** Tool identifier */
  toolId: string;
  /** Tool display name */
  name: string;
  /** Number of times used */
  usageCount: number;
  /** Percentage of total usage */
  percentage: number;
  /** Effectiveness score (0-10) */
  effectiveness?: number;
  /** Trend compared to previous period */
  trend?: 'up' | 'down' | 'stable';
  /** Change percentage */
  change?: number;
}

export interface ToolUsageChartProps {
  /** Tool usage data */
  data: ToolUsageData[];
  /** Top frequently used tools */
  topTools?: string[];
  /** Total tool invocations */
  totalUsage?: number;
  /** Chart display mode */
  displayMode?: 'bar' | 'pie' | 'both';
  /** Show effectiveness indicators */
  showEffectiveness?: boolean;
  /** Maximum number of tools to display */
  maxItems?: number;
  /** Loading state */
  loading?: boolean;
  /** Additional class names */
  className?: string;
  /** Click handler for drill-down */
  onClick?: () => void;
  /** Click handler for specific tool */
  onToolClick?: (toolId: string) => void;
}

// Map tool IDs to icons
const TOOL_ICONS: Record<string, LucideIcon> = {
  read: FileText,
  write: FileText,
  edit: Code,
  bash: Terminal,
  grep: Search,
  glob: Search,
  git: GitBranch,
  database: Database,
  fetch: Globe,
  default: Wrench,
};

// Color palette for tools
const TOOL_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
];

function getToolIcon(toolId: string): LucideIcon {
  const normalizedId = toolId.toLowerCase();
  for (const [key, icon] of Object.entries(TOOL_ICONS)) {
    if (normalizedId.includes(key)) return icon;
  }
  return TOOL_ICONS.default ?? Wrench;
}

function getEffectivenessLabel(score: number): string {
  if (score >= 8) return 'Excellent';
  if (score >= 6) return 'Good';
  if (score >= 4) return 'Average';
  return 'Low';
}

export function ToolUsageChart({
  data,
  topTools = [],
  totalUsage,
  displayMode = 'bar',
  showEffectiveness = true,
  maxItems = 8,
  loading = false,
  className,
  onClick,
  onToolClick,
}: ToolUsageChartProps) {
  if (loading) {
    return (
      <div
        className={cn('rounded-lg border border-border bg-card p-4', className)}
        data-testid="tool-usage-loading"
      >
        <div className="h-4 w-32 animate-pulse rounded bg-muted mb-4" />
        <div className="h-[200px] animate-pulse rounded bg-muted mb-4" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 w-16 animate-pulse rounded bg-muted" />
          ))}
        </div>
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
        style={{ minHeight: 250 }}
        data-testid="tool-usage-empty"
      >
        <Wrench className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-muted-foreground">No tool usage data</p>
      </div>
    );
  }

  // Prepare chart data (limited to maxItems)
  const chartData = data.slice(0, maxItems).map((tool, index) => ({
    ...tool,
    fill: TOOL_COLORS[index % TOOL_COLORS.length],
  }));

  // Calculate totals
  const calculatedTotal = totalUsage || data.reduce((sum, t) => sum + t.usageCount, 0);

  // Get trend icon
  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return TrendingUp;
    if (trend === 'down') return TrendingDown;
    return Minus;
  };

  // Generate accessible description
  const getAccessibleDescription = () => {
    let desc = `Tool usage breakdown showing ${data.length} tools.`;
    desc += ` Total tool invocations: ${calculatedTotal}.`;
    if (topTools.length > 0) {
      desc += ` Most used tools: ${topTools.join(', ')}.`;
    }
    return desc;
  };

  // Custom tooltip
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: ToolUsageData & { fill: string } }>;
  }) => {
    if (!active || !payload?.length || !payload[0]) return null;
    const tool = payload[0].payload;
    const ToolIcon = getToolIcon(tool.toolId);

    return (
      <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <ToolIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{tool.name}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {tool.usageCount.toLocaleString()} uses ({tool.percentage}%)
        </p>
        {tool.effectiveness !== undefined && showEffectiveness && (
          <p className="text-xs text-muted-foreground mt-1">
            Effectiveness: {tool.effectiveness.toFixed(1)} -{' '}
            {getEffectivenessLabel(tool.effectiveness)}
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
      data-testid="tool-usage-chart"
      role="img"
      aria-label={getAccessibleDescription()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">Tool Usage</h3>
        <span className="text-sm text-muted-foreground">
          {calculatedTotal.toLocaleString()} total
        </span>
      </div>

      {/* Frequently Used Badges */}
      {topTools.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {topTools.slice(0, 3).map((toolId) => {
            const tool = data.find((t) => t.toolId === toolId);
            if (!tool) return null;
            const ToolIcon = getToolIcon(toolId);
            return (
              <button
                key={toolId}
                onClick={(e) => {
                  e.stopPropagation();
                  onToolClick?.(toolId);
                }}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                data-testid={`top-tool-${toolId}`}
              >
                <Star className="h-3 w-3" />
                <ToolIcon className="h-3 w-3" />
                <span>{tool.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Bar Chart */}
      {(displayMode === 'bar' || displayMode === 'both') && (
        <div className="h-[180px] mb-4" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 20, left: 60, bottom: 0 }}
            >
              <XAxis
                type="number"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                width={55}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="usageCount" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Pie Chart */}
      {displayMode === 'pie' && (
        <div className="h-[180px] mb-4" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="usageCount"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tool List with Effectiveness */}
      {showEffectiveness && (
        <div className="space-y-2">
          {chartData.slice(0, 5).map((tool) => {
            const ToolIcon = getToolIcon(tool.toolId);
            const TrendIcon = getTrendIcon(tool.trend);
            const trendColor =
              tool.trend === 'up'
                ? 'text-score-high'
                : tool.trend === 'down'
                  ? 'text-score-growth'
                  : 'text-muted-foreground';

            return (
              <button
                key={tool.toolId}
                onClick={(e) => {
                  e.stopPropagation();
                  onToolClick?.(tool.toolId);
                }}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                data-testid={`tool-item-${tool.toolId}`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${tool.fill}20` }}
                >
                  <ToolIcon
                    className="h-4 w-4"
                    style={{ color: tool.fill }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground truncate">
                      {tool.name}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {tool.percentage}%
                    </span>
                  </div>
                  {tool.effectiveness !== undefined && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${(tool.effectiveness / 10) * 100}%`,
                            backgroundColor: tool.fill,
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {tool.effectiveness.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>
                {tool.trend && tool.change !== undefined && (
                  <div className={cn('flex items-center gap-0.5 text-xs', trendColor)}>
                    <TrendIcon className="h-3 w-3" />
                    <span>{tool.change > 0 ? '+' : ''}{tool.change}%</span>
                  </div>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      )}

      {/* "Other" indicator if there are more tools */}
      {data.length > maxItems && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          + {data.length - maxItems} more tools
        </p>
      )}

      {/* Screen reader description */}
      <span className="sr-only">{getAccessibleDescription()}</span>
    </div>
  );
}

/**
 * Compact tool badge for inline display
 */
export function ToolBadge({
  toolId,
  name,
  count,
  className,
}: {
  toolId: string;
  name: string;
  count?: number;
  className?: string;
}) {
  const ToolIcon = getToolIcon(toolId);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted text-xs font-medium text-foreground',
        className
      )}
      data-testid={`tool-badge-${toolId}`}
    >
      <ToolIcon className="h-3 w-3" />
      <span>{name}</span>
      {count !== undefined && (
        <span className="text-muted-foreground">({count})</span>
      )}
    </span>
  );
}
