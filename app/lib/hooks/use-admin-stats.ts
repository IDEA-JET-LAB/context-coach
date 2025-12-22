'use client';

import { useQuery } from '@tanstack/react-query';
import type { PlatformStats, PlatformTrends } from '@/lib/db/queries/admin-stats';

interface AdminStatsResponse {
  data: {
    stats: PlatformStats;
    trends: PlatformTrends;
  };
  meta: {
    timestamp: string;
  };
}

async function fetchAdminStats(): Promise<AdminStatsResponse['data']> {
  const response = await fetch('/api/admin/stats');
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to fetch admin stats');
  }

  return data.data;
}

/**
 * useAdminStats - Hook to fetch platform statistics for admin dashboard.
 * Story 7.2: Admin Dashboard Overview
 */
export function useAdminStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: fetchAdminStats,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}
