'use client';

import { useQuery } from '@tanstack/react-query';
import type { SystemHealth, HealthStatus } from '@/lib/db/queries/system-health';

interface AdminHealthResponse {
  data: {
    health: SystemHealth;
    statuses: {
      successRate: HealthStatus;
      errorRate: HealthStatus;
      avgTime: HealthStatus;
      pendingQueue: HealthStatus;
    };
    deadLetterCount: number;
  };
  meta: {
    timestamp: string;
  };
}

async function fetchAdminHealth(): Promise<AdminHealthResponse['data']> {
  const response = await fetch('/api/admin/health');
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to fetch admin health');
  }

  return data.data;
}

/**
 * useAdminHealth - Hook to fetch system health metrics for admin dashboard.
 * Story 7.2: Admin Dashboard Overview
 */
export function useAdminHealth() {
  return useQuery({
    queryKey: ['admin', 'health'],
    queryFn: fetchAdminHealth,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}
