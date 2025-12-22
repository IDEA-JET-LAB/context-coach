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

/**
 * Validates and sanitizes data read from localStorage (M32)
 * Returns null if data is invalid or malformed
 */
function validateStoredFilters(data: unknown): SerializedFeedFilters | null {
  if (!data || typeof data !== 'object') return null;

  const obj = data as Record<string, unknown>;
  const validated: SerializedFeedFilters = {};

  // Validate search: must be string, sanitize length
  if (obj.search !== undefined) {
    if (typeof obj.search === 'string') {
      // Limit search string length to prevent abuse
      validated.search = obj.search.slice(0, 500);
    } else {
      return null; // Invalid type
    }
  }

  // Validate users: must be array of strings (UUIDs)
  if (obj.users !== undefined) {
    if (Array.isArray(obj.users)) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validUsers = obj.users.filter(
        (u): u is string => typeof u === 'string' && uuidRegex.test(u)
      );
      if (validUsers.length > 0) {
        validated.users = validUsers.slice(0, 50); // Limit number of users
      }
    } else {
      return null;
    }
  }

  // Validate project: must be string (UUID)
  if (obj.project !== undefined) {
    if (typeof obj.project === 'string') {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(obj.project)) {
        validated.project = obj.project;
      }
      // Skip invalid project IDs silently
    } else {
      return null;
    }
  }

  // Validate dateRange: must have valid ISO date strings
  if (obj.dateRange !== undefined) {
    if (obj.dateRange && typeof obj.dateRange === 'object') {
      const dr = obj.dateRange as Record<string, unknown>;
      if (typeof dr.from === 'string' && typeof dr.to === 'string') {
        const fromDate = new Date(dr.from);
        const toDate = new Date(dr.to);
        // Check for valid dates and reasonable range (not more than 10 years)
        const tenYearsMs = 10 * 365 * 24 * 60 * 60 * 1000;
        if (
          !isNaN(fromDate.getTime()) &&
          !isNaN(toDate.getTime()) &&
          fromDate <= toDate &&
          toDate.getTime() - fromDate.getTime() <= tenYearsMs
        ) {
          validated.dateRange = { from: dr.from, to: dr.to };
        }
      }
    }
    // Skip invalid dateRange silently
  }

  // Validate scoreRange: must have min/max as numbers between 0-100
  if (obj.scoreRange !== undefined) {
    if (obj.scoreRange && typeof obj.scoreRange === 'object') {
      const sr = obj.scoreRange as Record<string, unknown>;
      if (
        typeof sr.min === 'number' &&
        typeof sr.max === 'number' &&
        sr.min >= 0 &&
        sr.max <= 100 &&
        sr.min <= sr.max &&
        Number.isFinite(sr.min) &&
        Number.isFinite(sr.max)
      ) {
        validated.scoreRange = { min: sr.min, max: sr.max };
      }
    }
    // Skip invalid scoreRange silently
  }

  return validated;
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
        const parsed = JSON.parse(stored);
        const validated = validateStoredFilters(parsed);
        if (validated) {
          setFiltersState(deserializeFilters(validated));
        }
        // If validation fails, use empty filters (don't set invalid data)
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
