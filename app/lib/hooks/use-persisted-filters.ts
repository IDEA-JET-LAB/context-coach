'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FeedFilters, SerializedFeedFilters } from '@/lib/types/filters';

const STORAGE_KEY_PREFIX = 'contextor-filters-';

function serializeFilters(filters: FeedFilters): SerializedFeedFilters {
  return {
    ...filters,
    dateRange: filters.dateRange
      ? {
          from: filters.dateRange.from.toISOString(),
          to: filters.dateRange.to.toISOString(),
        }
      : undefined,
  };
}

function deserializeFilters(stored: SerializedFeedFilters): FeedFilters {
  return {
    ...stored,
    dateRange: stored.dateRange
      ? {
          from: new Date(stored.dateRange.from),
          to: new Date(stored.dateRange.to),
        }
      : undefined,
  };
}

export function usePersistedFilters(teamId: string | undefined) {
  const storageKey = `${STORAGE_KEY_PREFIX}${teamId ?? 'default'}`;
  const [mounted, setMounted] = useState(false);

  const [filters, setFiltersState] = useState<FeedFilters>({});

  // Load from localStorage after mount
  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as SerializedFeedFilters;
        setFiltersState(deserializeFilters(parsed));
      }
    } catch {
      // Invalid stored data, use empty
    }
  }, [storageKey]);

  const setFilters = useCallback((newFilters: FeedFilters) => {
    setFiltersState(newFilters);
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (!mounted) return;

    try {
      const serialized = serializeFilters(filters);
      localStorage.setItem(storageKey, JSON.stringify(serialized));
    } catch {
      // localStorage unavailable or quota exceeded
    }
  }, [filters, storageKey, mounted]);

  return [filters, setFilters] as const;
}
