'use client';

import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { InsightsTimeRange } from '@/lib/types/insights';

export interface TimeRangeFilterProps {
  value: InsightsTimeRange;
  onChange: (value: InsightsTimeRange) => void;
  className?: string;
}

const TIME_RANGE_OPTIONS: { value: InsightsTimeRange; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];

export function TimeRangeFilter({ value, onChange, className }: TimeRangeFilterProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as InsightsTimeRange)}
    >
      <SelectTrigger
        className={cn('w-[150px] bg-card border-border', className)}
        data-testid="insights-time-range-trigger"
      >
        <SelectValue placeholder="Time range" />
      </SelectTrigger>
      <SelectContent className="bg-card border-border">
        {TIME_RANGE_OPTIONS.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            data-testid={`insights-time-range-option-${option.value}`}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
