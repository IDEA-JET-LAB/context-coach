'use client';

import { cn } from '@/lib/utils';
import {
  Wrench,
  Star,
  AlertCircle,
  FileText,
  Terminal,
  Search,
  Code,
  GitBranch,
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
} from 'recharts';
import type { InsightsToolUsage } from '@/lib/types/insights';

export interface ToolUsageInsightsProps {
  toolUsage: InsightsToolUsage;
  loading?: boolean;
  className?: string;
}

const TOOL_ICONS: Record<string, LucideIcon> = {
  Read: FileText,
  Write: FileText,
  Edit: Code,
  Bash: Terminal,
  Grep: Search,
  Glob: Search,
  Git: GitBranch,
};

const TOOL_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
];

const USER_PROFILE_LABELS: Record<string, string> = {
  balanced: 'Balanced User',
  reader: 'Heavy Reader',
  'terminal-power-user': 'Terminal Power User',
};

export function ToolUsageInsights({
  toolUsage,
  loading = false,
  className,
}: ToolUsageInsightsProps) {
  if (loading) {
    return (
      <div
        className={cn('rounded-lg border border-border bg-card p-4', className)}
        data-testid="tool-usage-insights-loading"
      >
        <div className="h-4 w-32 animate-pulse rounded bg-muted mb-4" />
        <div className="h-[180px] animate-pulse rounded bg-muted mb-4" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 w-16 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  // Prepare chart data
  const chartData = Object.entries(toolUsage.distribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count], index) => ({
      name,
      count,
      fill: TOOL_COLORS[index % TOOL_COLORS.length],
      isTop: toolUsage.topTools.includes(name),
    }));

  const totalUsage = Object.values(toolUsage.distribution).reduce((a, b) => a + b, 0);
  const hasData = totalUsage > 0;

  const profileLabel = USER_PROFILE_LABELS[toolUsage.userProfile] || toolUsage.userProfile;

  // Custom tooltip
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: { name: string; count: number; fill: string } }>;
  }) => {
    if (!active || !payload?.length || !payload[0]) return null;
    const data = payload[0].payload;
    const percentage = totalUsage > 0 ? ((data.count / totalUsage) * 100).toFixed(1) : 0;

    return (
      <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground">{data.name}</p>
        <p className="text-xs text-muted-foreground">
          {data.count.toLocaleString()} uses ({percentage}%)
        </p>
      </div>
    );
  };

  return (
    <div
      className={cn('rounded-lg border border-border bg-card p-4', className)}
      data-testid="tool-usage-insights"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">Tool Usage</h3>
        <span className="text-sm text-muted-foreground">
          {totalUsage.toLocaleString()} total
        </span>
      </div>

      {/* User Profile Badge */}
      <div className="mb-4">
        <span
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
          data-testid="user-profile-badge"
        >
          <Wrench className="h-3 w-3" />
          {profileLabel}
        </span>
      </div>

      {/* Top Tools */}
      {toolUsage.topTools.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {toolUsage.topTools.slice(0, 3).map((tool) => {
            const ToolIcon = TOOL_ICONS[tool] || Wrench;
            return (
              <span
                key={tool}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-score-high/10 text-score-high text-xs font-medium"
              >
                <Star className="h-3 w-3" />
                <ToolIcon className="h-3 w-3" />
                <span>{tool}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Bar Chart */}
      {hasData ? (
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
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div
          className="h-[180px] flex items-center justify-center text-muted-foreground"
          data-testid="tool-usage-empty"
        >
          <p className="text-sm">No tool usage data available</p>
        </div>
      )}

      {/* Underutilized Tools */}
      {toolUsage.underutilized.length > 0 && (
        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-score-growth" />
            <p className="text-xs text-muted-foreground">Underutilized Tools</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {toolUsage.underutilized.map((tool) => (
              <span
                key={tool}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Accessible description */}
      <span className="sr-only">
        Tool usage breakdown showing {chartData.length} tools.
        Total tool invocations: {totalUsage}.
        Top tools: {toolUsage.topTools.join(', ')}.
        User profile: {profileLabel}.
      </span>
    </div>
  );
}
