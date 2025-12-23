'use client';

import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { FeedFilters } from '@/lib/types/filters';

interface ActiveFiltersProps {
  filters: FeedFilters;
  onRemove: (key: keyof FeedFilters) => void;
  onClearAll: () => void;
}

function formatFilterLabel(key: string, value: unknown): string {
  switch (key) {
    case 'search':
      return `Search: "${value}"`;
    case 'users':
      return `Users: ${(value as string[]).length} selected`;
    case 'project':
      return `Project selected`;
    case 'dateRange': {
      const range = value as { from: Date; to: Date };
      return `${range.from.toLocaleDateString()} - ${range.to.toLocaleDateString()}`;
    }
    case 'scoreRange': {
      const range = value as { min: number; max: number };
      return `Score: ${range.min}-${range.max}`;
    }
    default:
      return `${key}: ${value}`;
  }
}

export function ActiveFilters({ filters, onRemove, onClearAll }: ActiveFiltersProps) {
  const activeFilters = Object.entries(filters).filter(([_, value]) => {
    if (value === undefined || value === null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return true;
    return Boolean(value);
  });

  if (activeFilters.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2 mb-4"
      role="list"
      aria-label="Active filters"
      data-testid="active-filters"
    >
      {activeFilters.map(([key, value]) => (
        <Badge
          key={key}
          variant="secondary"
          className="bg-muted text-foreground pr-1 gap-1"
          data-testid={`active-filter-${key}`}
        >
          <span>{formatFilterLabel(key, value)}</span>
          <button
            onClick={() => onRemove(key as keyof FeedFilters)}
            className="ml-1 rounded-full p-0.5 hover:bg-muted"
            aria-label={`Remove ${key} filter`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {activeFilters.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="text-muted-foreground"
          data-testid="clear-all-filters"
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
