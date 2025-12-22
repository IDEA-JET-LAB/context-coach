'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TimeRange } from '@/lib/hooks/use-personal-analytics';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
}

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TimeRange)} data-testid="time-range-selector">
      <SelectTrigger className="w-[140px] bg-[#1a1a1a] border-[#2a2a2a]" data-testid="time-range-trigger">
        <SelectValue placeholder="Time range" />
      </SelectTrigger>
      <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
        {TIME_RANGE_OPTIONS.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            data-testid={`time-range-option-${option.value}`}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
