'use client';

import { useState } from 'react';
import { BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { FeedFilters } from '@/lib/types/filters';

interface ScoreFilterProps {
  value: FeedFilters['scoreRange'];
  onChange: (value: FeedFilters['scoreRange']) => void;
}

type ScorePreset = 'all' | 'high' | 'medium' | 'low';

const PRESETS: { key: ScorePreset; label: string; range: { min: number; max: number } | null; color: string }[] = [
  { key: 'all', label: 'Any score', range: null, color: 'text-muted-foreground' },
  { key: 'high', label: 'High (7-10)', range: { min: 7, max: 10 }, color: 'text-teal-500' },
  { key: 'medium', label: 'Medium (4-6)', range: { min: 4, max: 6 }, color: 'text-amber-500' },
  { key: 'low', label: 'Low (1-3)', range: { min: 1, max: 3 }, color: 'text-red-400' },
];

export function ScoreFilter({ value, onChange }: ScoreFilterProps) {
  const [open, setOpen] = useState(false);

  const handlePreset = (range: { min: number; max: number } | null) => {
    onChange(range ?? undefined);
    setOpen(false);
  };

  const getCurrentLabel = () => {
    if (!value) return 'Any score';

    const preset = PRESETS.find(
      (p) => p.range?.min === value.min && p.range?.max === value.max
    );

    return preset?.label ?? `${value.min}-${value.max}`;
  };

  const getCurrentColor = () => {
    if (!value) return 'text-muted-foreground';

    const preset = PRESETS.find(
      (p) => p.range?.min === value.min && p.range?.max === value.max
    );

    return preset?.color ?? 'text-[#fafafa]';
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-[140px] justify-start text-left font-normal bg-[#1a1a1a] border-[#2a2a2a]',
            getCurrentColor()
          )}
          aria-label="Filter by score range"
        >
          <BarChart2 className="mr-2 h-4 w-4" />
          {getCurrentLabel()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2 bg-[#1a1a1a] border-[#2a2a2a]" align="start">
        <div className="flex flex-col gap-1">
          {PRESETS.map((preset) => (
            <Button
              key={preset.key}
              variant="ghost"
              size="sm"
              className={cn('justify-start', preset.color)}
              onClick={() => handlePreset(preset.range)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
