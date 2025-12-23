'use client';

import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

export interface HeatmapDataPoint {
  day: number; // 0-6 (Sunday-Saturday)
  hour: number; // 0-23
  value: number;
  label?: string;
}

export interface HeatmapProps {
  data: HeatmapDataPoint[];
  /** Maximum value for color scaling */
  maxValue?: number;
  /** Whether to show day labels */
  showDayLabels?: boolean;
  /** Whether to show hour labels */
  showHourLabels?: boolean;
  /** Additional class names */
  className?: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getHeatColor(value: number, maxValue: number): string {
  if (value === 0) return 'hsl(var(--muted))';
  const intensity = Math.min(value / maxValue, 1);

  // Use primary color with varying opacity
  if (intensity < 0.25) return 'hsl(var(--primary) / 0.2)';
  if (intensity < 0.5) return 'hsl(var(--primary) / 0.4)';
  if (intensity < 0.75) return 'hsl(var(--primary) / 0.6)';
  return 'hsl(var(--primary) / 0.9)';
}

export function Heatmap({
  data,
  maxValue: providedMax,
  showDayLabels = true,
  showHourLabels = true,
  className,
}: HeatmapProps) {
  // Create a map for quick lookup
  const dataMap = new Map<string, HeatmapDataPoint>();
  let calculatedMax = 0;

  data.forEach((point) => {
    const key = `${point.day}-${point.hour}`;
    dataMap.set(key, point);
    calculatedMax = Math.max(calculatedMax, point.value);
  });

  const maxValue = providedMax ?? (calculatedMax || 1);

  return (
    <TooltipProvider>
      <div className={cn('overflow-x-auto', className)} data-testid="heatmap">
        <div className="inline-block">
          {/* Hour labels */}
          {showHourLabels && (
            <div className="flex mb-1" style={{ marginLeft: showDayLabels ? 40 : 0 }}>
              {HOURS.filter((h) => h % 3 === 0).map((hour) => (
                <div
                  key={hour}
                  className="text-xs text-muted-foreground"
                  style={{ width: 12 * 3, textAlign: 'center' }}
                >
                  {hour.toString().padStart(2, '0')}
                </div>
              ))}
            </div>
          )}

          {/* Heatmap grid */}
          {DAYS.map((day, dayIndex) => (
            <div key={day} className="flex items-center gap-1">
              {/* Day label */}
              {showDayLabels && (
                <div className="w-10 text-xs text-muted-foreground">{day}</div>
              )}

              {/* Hour cells */}
              <div className="flex gap-0.5">
                {HOURS.map((hour) => {
                  const key = `${dayIndex}-${hour}`;
                  const point = dataMap.get(key);
                  const value = point?.value || 0;

                  return (
                    <Tooltip key={hour}>
                      <TooltipTrigger asChild>
                        <div
                          className="h-3 w-3 rounded-sm cursor-default transition-colors"
                          style={{ backgroundColor: getHeatColor(value, maxValue) }}
                          data-testid={`heatmap-cell-${dayIndex}-${hour}`}
                          data-value={value}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-sm">
                          {day} {hour.toString().padStart(2, '0')}:00
                        </p>
                        <p className="text-sm font-medium">
                          {point?.label || `${value} prompts`}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center gap-2 mt-3" style={{ marginLeft: showDayLabels ? 40 : 0 }}>
            <span className="text-xs text-muted-foreground">Less</span>
            <div className="flex gap-0.5">
              <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: 'hsl(var(--muted))' }} />
              <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: 'hsl(var(--primary) / 0.2)' }} />
              <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: 'hsl(var(--primary) / 0.4)' }} />
              <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: 'hsl(var(--primary) / 0.6)' }} />
              <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: 'hsl(var(--primary) / 0.9)' }} />
            </div>
            <span className="text-xs text-muted-foreground">More</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
