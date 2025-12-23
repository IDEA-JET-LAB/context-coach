'use client';

import { cn } from '@/lib/utils';
import { Clock, Calendar } from 'lucide-react';
import type { InsightsActivityHeatMap } from '@/lib/types/insights';

export interface ActivityHeatMapProps {
  heatMap: InsightsActivityHeatMap;
  loading?: boolean;
  className?: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(hour: number): string {
  if (hour === 0) return '12a';
  if (hour === 12) return '12p';
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}

function getIntensityColor(value: number, max: number): string {
  if (max === 0 || value === 0) return 'bg-muted';
  const intensity = value / max;
  if (intensity < 0.25) return 'bg-primary/20';
  if (intensity < 0.5) return 'bg-primary/40';
  if (intensity < 0.75) return 'bg-primary/60';
  return 'bg-primary/90';
}

export function ActivityHeatMap({
  heatMap,
  loading = false,
  className,
}: ActivityHeatMapProps) {
  if (loading) {
    return (
      <div
        className={cn('rounded-lg border border-border bg-card p-4', className)}
        data-testid="activity-heat-map-loading"
      >
        <div className="h-4 w-32 animate-pulse rounded bg-muted mb-4" />
        <div className="grid grid-cols-25 gap-1">
          {Array.from({ length: 168 }).map((_, i) => (
            <div key={i} className="h-4 w-4 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const hasData = heatMap.maxCount > 0;

  return (
    <div
      className={cn('rounded-lg border border-border bg-card p-4', className)}
      data-testid="activity-heat-map"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">Activity Heat Map</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Peak: {formatHour(heatMap.peakHour)} on {DAYS[heatMap.peakDay]}</span>
        </div>
      </div>

      {hasData ? (
        <>
          {/* Heat Map Grid */}
          <div className="overflow-x-auto" aria-hidden="true">
            <div className="min-w-[500px]">
              {/* Hour labels */}
              <div className="flex mb-1 ml-10">
                {HOURS.filter((h) => h % 3 === 0).map((hour) => (
                  <div
                    key={hour}
                    className="text-[10px] text-muted-foreground"
                    style={{ width: '36px' }}
                  >
                    {formatHour(hour)}
                  </div>
                ))}
              </div>

              {/* Grid rows (days) */}
              {DAYS.map((day, dayIndex) => (
                <div key={day} className="flex items-center mb-1">
                  <span className="w-10 text-xs text-muted-foreground">{day}</span>
                  <div className="flex gap-0.5">
                    {HOURS.map((hour) => {
                      const count = heatMap.data[dayIndex]?.[hour] || 0;
                      return (
                        <div
                          key={`${dayIndex}-${hour}`}
                          className={cn(
                            'w-3 h-3 rounded-sm transition-colors',
                            getIntensityColor(count, heatMap.maxCount)
                          )}
                          title={`${day} ${formatHour(hour)}: ${count} prompts`}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">Less</span>
              <div className="flex gap-0.5">
                {['bg-muted', 'bg-primary/20', 'bg-primary/40', 'bg-primary/60', 'bg-primary/90'].map((color, i) => (
                  <div
                    key={i}
                    className={cn('w-3 h-3 rounded-sm', color)}
                  />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">More</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {heatMap.totalActiveHours} active hours
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="p-2 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground">Peak Activity</p>
              <p className="text-sm font-medium text-foreground">
                {DAYS[heatMap.peakDay]} at {formatHour(heatMap.peakHour)}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground">Max in Hour</p>
              <p className="text-sm font-medium text-foreground">
                {heatMap.maxCount} prompts
              </p>
            </div>
          </div>
        </>
      ) : (
        <div
          className="h-[200px] flex items-center justify-center text-muted-foreground"
          data-testid="activity-heat-map-empty"
        >
          <p className="text-sm">No activity data available</p>
        </div>
      )}

      {/* Accessible description */}
      <span className="sr-only">
        Activity heat map showing prompt activity by day and hour.
        Peak activity: {DAYS[heatMap.peakDay]} at {formatHour(heatMap.peakHour)} with {heatMap.maxCount} prompts.
        Total active hours: {heatMap.totalActiveHours}.
      </span>
    </div>
  );
}
