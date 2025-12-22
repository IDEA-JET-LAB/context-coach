'use client';

import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { FeedFilters } from '@/lib/types/filters';

interface DateFilterProps {
  value: FeedFilters['dateRange'];
  onChange: (value: FeedFilters['dateRange']) => void;
}

type DatePreset = 'today' | '7d' | '30d' | 'all';

export function DateFilter({ value, onChange }: DateFilterProps) {
  const [open, setOpen] = useState(false);

  const handlePreset = (preset: DatePreset) => {
    const now = new Date();

    switch (preset) {
      case 'today':
        onChange({ from: startOfDay(now), to: endOfDay(now) });
        break;
      case '7d':
        onChange({ from: startOfDay(subDays(now, 7)), to: endOfDay(now) });
        break;
      case '30d':
        onChange({ from: startOfDay(subDays(now, 30)), to: endOfDay(now) });
        break;
      case 'all':
        onChange(undefined);
        break;
    }
    setOpen(false);
  };

  const formatLabel = () => {
    if (!value) return 'Any date';

    const now = new Date();
    const today = startOfDay(now);
    const sevenDaysAgo = startOfDay(subDays(now, 7));
    const thirtyDaysAgo = startOfDay(subDays(now, 30));

    if (value.from.getTime() === today.getTime()) return 'Today';
    if (value.from.getTime() === sevenDaysAgo.getTime()) return 'Last 7 days';
    if (value.from.getTime() === thirtyDaysAgo.getTime()) return 'Last 30 days';

    return `${format(value.from, 'MMM d')} - ${format(value.to, 'MMM d')}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-[160px] justify-start text-left font-normal bg-[#1a1a1a] border-[#2a2a2a]',
            !value && 'text-muted-foreground'
          )}
          aria-label="Filter by date range"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formatLabel()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2 bg-[#1a1a1a] border-[#2a2a2a]" align="start">
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => handlePreset('today')}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => handlePreset('7d')}
          >
            Last 7 days
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => handlePreset('30d')}
          >
            Last 30 days
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start text-muted-foreground"
            onClick={() => handlePreset('all')}
          >
            Any date
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
