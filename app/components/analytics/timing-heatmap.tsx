'use client';

import { cn } from '@/lib/utils';
import { Clock, Calendar, BarChart3, TrendingUp, Sun, Moon } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';

export interface HourlyActivity {
  hour: number; // 0-23
  promptCount: number;
  avgScore?: number;
}

export interface DailyActivity {
  day: string; // 'Mon', 'Tue', etc.
  promptCount: number;
  avgScore?: number;
}

export interface SessionDurationData {
  range: string; // e.g., '0-15 min', '15-30 min'
  count: number;
  percentage: number;
}

export interface TimingHeatmapProps {
  /** Activity by hour of day */
  hourlyData: HourlyActivity[];
  /** Activity by day of week */
  dailyData?: DailyActivity[];
  /** Session duration distribution */
  sessionDurations?: SessionDurationData[];
  /** Most productive hour(s) */
  peakHours?: number[];
  /** Average response time in seconds */
  avgResponseTime?: number;
  /** Loading state */
  loading?: boolean;
  /** Additional class names */
  className?: string;
  /** Click handler for drill-down */
  onClick?: () => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Helper to format hour
function formatHour(hour: number): string {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

// Helper to get intensity color based on value
function getIntensityColor(value: number, max: number): string {
  if (max === 0) return 'hsl(var(--muted))';
  const intensity = value / max;
  if (intensity === 0) return 'hsl(var(--muted))';
  if (intensity < 0.25) return 'hsl(var(--primary) / 0.2)';
  if (intensity < 0.5) return 'hsl(var(--primary) / 0.4)';
  if (intensity < 0.75) return 'hsl(var(--primary) / 0.6)';
  return 'hsl(var(--primary) / 0.9)';
}

export function TimingHeatmap({
  hourlyData,
  dailyData,
  sessionDurations,
  peakHours = [],
  avgResponseTime,
  loading = false,
  className,
  onClick,
}: TimingHeatmapProps) {
  if (loading) {
    return (
      <div
        className={cn('rounded-lg border border-border bg-card p-4', className)}
        data-testid="timing-heatmap-loading"
      >
        <div className="h-4 w-32 animate-pulse rounded bg-muted mb-4" />
        <div className="h-[120px] animate-pulse rounded bg-muted mb-4" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  // Calculate max values for color scaling
  const maxHourly = Math.max(...hourlyData.map((h) => h.promptCount), 1);
  const maxDaily = dailyData
    ? Math.max(...dailyData.map((d) => d.promptCount), 1)
    : 1;

  // Find peak time period (morning, afternoon, evening, night)
  const getPeakPeriod = (): { label: string; icon: typeof Sun } => {
    if (peakHours.length === 0) return { label: 'N/A', icon: Clock };
    const avgPeakHour =
      peakHours.reduce((a, b) => a + b, 0) / peakHours.length;
    if (avgPeakHour >= 5 && avgPeakHour < 12)
      return { label: 'Morning', icon: Sun };
    if (avgPeakHour >= 12 && avgPeakHour < 17)
      return { label: 'Afternoon', icon: Sun };
    if (avgPeakHour >= 17 && avgPeakHour < 21)
      return { label: 'Evening', icon: Moon };
    return { label: 'Night', icon: Moon };
  };

  const peakPeriod = getPeakPeriod();
  const PeakIcon = peakPeriod.icon;

  // Generate accessible description
  const getAccessibleDescription = () => {
    let desc = `Activity timing analysis.`;
    if (peakHours.length > 0) {
      desc += ` Most productive hours: ${peakHours.map(formatHour).join(', ')}.`;
    }
    if (avgResponseTime) {
      desc += ` Average response time: ${avgResponseTime} seconds.`;
    }
    return desc;
  };

  // Prepare hourly histogram data
  const histogramData = hourlyData.map((h) => ({
    hour: formatHour(h.hour),
    value: h.promptCount,
    isPeak: peakHours.includes(h.hour),
  }));

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-4',
        onClick && 'cursor-pointer hover:border-primary/50 transition-colors',
        className
      )}
      onClick={onClick}
      data-testid="timing-heatmap"
      role="img"
      aria-label={getAccessibleDescription()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          Activity Timing
        </h3>
        {peakHours.length > 0 && (
          <div className="flex items-center gap-1 text-sm text-primary">
            <PeakIcon className="h-4 w-4" />
            <span>Peak: {peakPeriod.label}</span>
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Peak Hour</p>
            <p className="text-sm font-medium text-foreground">
              {peakHours.length > 0 && peakHours[0] !== undefined ? formatHour(peakHours[0]) : 'N/A'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Avg Response</p>
            <p className="text-sm font-medium text-foreground">
              {avgResponseTime ? `${avgResponseTime}s` : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Hourly Histogram */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-2">
          <Clock className="h-3 w-3 inline mr-1" />
          Prompts by Hour
        </p>
        <div className="h-[100px]" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={histogramData}
              margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="hour"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                interval={2}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                formatter={(value) => [value ?? 0, 'Prompts']}
              />
              <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                {histogramData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.isPeak
                        ? 'hsl(var(--primary))'
                        : 'hsl(var(--muted-foreground) / 0.3)'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weekly Heatmap Grid */}
      {dailyData && dailyData.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">
            <Calendar className="h-3 w-3 inline mr-1" />
            Activity by Day
          </p>
          <div className="grid grid-cols-7 gap-1" aria-hidden="true">
            {DAYS.map((day) => (
              <div key={day} className="text-center">
                <span className="text-[10px] text-muted-foreground">{day}</span>
              </div>
            ))}
            {DAYS.map((day) => {
              const dayData = dailyData.find((d) => d.day === day);
              const value = dayData?.promptCount || 0;
              return (
                <div
                  key={`value-${day}`}
                  className="h-8 rounded flex items-center justify-center text-xs font-medium transition-colors"
                  style={{ backgroundColor: getIntensityColor(value, maxDaily) }}
                  title={`${day}: ${value} prompts`}
                >
                  {value > 0 && (
                    <span className="text-foreground/80">{value}</span>
                  )}
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex items-center justify-end gap-1 mt-2">
            <span className="text-[10px] text-muted-foreground">Less</span>
            <div className="flex gap-0.5">
              {[0.2, 0.4, 0.6, 0.9].map((opacity) => (
                <div
                  key={opacity}
                  className="w-3 h-3 rounded-sm"
                  style={{
                    backgroundColor: `hsl(var(--primary) / ${opacity})`,
                  }}
                />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">More</span>
          </div>
        </div>
      )}

      {/* Session Duration Distribution */}
      {sessionDurations && sessionDurations.length > 0 && (
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">
            <BarChart3 className="h-3 w-3 inline mr-1" />
            Session Duration
          </p>
          <div className="space-y-2">
            {sessionDurations.map((session) => (
              <div key={session.range} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-20 shrink-0">
                  {session.range}
                </span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${session.percentage}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-10 text-right">
                  {session.percentage}%
                </span>
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
 * Compact time badge showing peak productivity
 */
export function PeakTimeBadge({
  hour,
  className,
}: {
  hour: number;
  className?: string;
}) {
  const isDay = hour >= 6 && hour < 18;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs',
        isDay
          ? 'bg-score-medium/10 text-score-medium'
          : 'bg-primary/10 text-primary',
        className
      )}
      data-testid="peak-time-badge"
    >
      {isDay ? (
        <Sun className="h-3 w-3" />
      ) : (
        <Moon className="h-3 w-3" />
      )}
      <span>{formatHour(hour)}</span>
    </span>
  );
}
