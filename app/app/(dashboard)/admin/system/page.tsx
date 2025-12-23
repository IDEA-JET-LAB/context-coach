'use client';

import { useState, useCallback, useEffect } from 'react';
import { SystemMetricCard } from '@/components/admin/system-metric-card';
import { AnalysisQueueStatus } from '@/components/admin/analysis-queue-status';
import { DeadLetterQueue } from '@/components/admin/dead-letter-queue';
import { AutoRefreshControls } from '@/components/admin/auto-refresh-controls';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getSystemMetrics,
  getAnalysisQueueStatus,
  getDeadLetterQueue,
} from '@/lib/db/queries/system-metrics';
import {
  HEALTH_THRESHOLDS,
  getHealthStatus,
  getThresholdDescription,
} from '@/lib/utils/health-thresholds';
import type {
  SystemMetrics,
  AnalysisQueueStatus as QueueStatusType,
  DeadLetterQueueResponse,
} from '@/lib/db/queries/system-metrics';

// Default values for when data isn't loaded yet
const defaultQueueStatus: QueueStatusType = {
  counts: { pending: 0, processing: 0, complete: 0, failed: 0 },
  total: 0,
  successRate: 100,
  errorRate: 0,
};

const defaultDeadLetterQueue: DeadLetterQueueResponse = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0,
};

const defaultMetrics: SystemMetrics = {
  apiResponseTime: 0,
  databaseStatus: 'connected',
  edgeFunctionStatus: 'operational',
  lastChecked: new Date().toISOString(),
};

interface SystemHealthData {
  metrics: SystemMetrics;
  queueStatus: QueueStatusType;
  deadLetterQueue: DeadLetterQueueResponse;
  error: string | null;
}

export default function SystemHealthPage() {
  const [data, setData] = useState<SystemHealthData>({
    metrics: defaultMetrics,
    queueStatus: defaultQueueStatus,
    deadLetterQueue: defaultDeadLetterQueue,
    error: null,
  });
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const [metrics, queueStatus, deadLetterQueue] = await Promise.all([
        getSystemMetrics().catch((e) => {
          console.error('[SystemHealth] Error fetching metrics:', e);
          return defaultMetrics;
        }),
        getAnalysisQueueStatus().catch((e) => {
          console.error('[SystemHealth] Error fetching queue status:', e);
          return defaultQueueStatus;
        }),
        getDeadLetterQueue().catch((e) => {
          console.error('[SystemHealth] Error fetching dead letter queue:', e);
          return defaultDeadLetterQueue;
        }),
      ]);

      setData({ metrics, queueStatus, deadLetterQueue, error: null });
      setLastUpdated(new Date());
    } catch (error) {
      console.error('[SystemHealth] Error fetching data:', error);
      setData((prev) => ({ ...prev, error: 'Failed to fetch system health data' }));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { metrics, queueStatus, deadLetterQueue } = data;

  // Derive health statuses
  const apiResponseStatus = metrics
    ? getHealthStatus(metrics.apiResponseTime, HEALTH_THRESHOLDS.apiResponseTime)
    : 'healthy';

  const dbStatus =
    metrics?.databaseStatus === 'connected'
      ? 'healthy'
      : metrics?.databaseStatus === 'degraded'
        ? 'warning'
        : 'critical';

  const edgeFunctionStatus =
    metrics?.edgeFunctionStatus === 'operational'
      ? 'healthy'
      : metrics?.edgeFunctionStatus === 'degraded'
        ? 'warning'
        : 'critical';

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="system-health-page">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">System Health</h2>
            <p className="text-muted-foreground">
              Monitor system performance and analysis queue status
            </p>
          </div>
        </div>

        {/* Loading skeletons */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="metrics-grid">
          <Skeleton className="h-32 bg-card" />
          <Skeleton className="h-32 bg-card" />
          <Skeleton className="h-32 bg-card" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 bg-card" />
          <Skeleton className="h-80 bg-card" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="system-health-page">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">System Health</h2>
          <p className="text-muted-foreground">
            Monitor system performance and analysis queue status
          </p>
        </div>
        <AutoRefreshControls
          onRefresh={fetchData}
          lastUpdated={lastUpdated}
          isRefreshing={isRefreshing}
        />
      </div>

      {/* System Metrics Section */}
      <section aria-labelledby="system-metrics-heading">
        <h3 id="system-metrics-heading" className="text-lg font-semibold text-foreground mb-4">
          System Metrics
        </h3>
        <div
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          data-testid="metrics-grid"
        >
          <SystemMetricCard
            title="API Response Time"
            value={metrics?.apiResponseTime ?? 0}
            unit="ms"
            status={apiResponseStatus}
            threshold={getThresholdDescription(HEALTH_THRESHOLDS.apiResponseTime, 'ms')}
            description="Database query latency"
            testId="metric-api-response-time"
          />
          <SystemMetricCard
            title="Database Status"
            value={
              metrics?.databaseStatus === 'connected'
                ? 'Connected'
                : metrics?.databaseStatus === 'degraded'
                  ? 'Degraded'
                  : 'Disconnected'
            }
            status={dbStatus}
            threshold="Status should be 'Connected'"
            description="Supabase connection health"
            testId="metric-database-status"
          />
          <SystemMetricCard
            title="Edge Function Status"
            value={
              metrics?.edgeFunctionStatus === 'operational'
                ? 'Operational'
                : metrics?.edgeFunctionStatus === 'degraded'
                  ? 'Degraded'
                  : 'Down'
            }
            status={edgeFunctionStatus}
            threshold="Status should be 'Operational'"
            description="Analysis Edge Function availability"
            testId="metric-edge-function-status"
          />
        </div>
      </section>

      {/* Queue Status and Dead Letter Queue */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Analysis Queue Status */}
        <section aria-labelledby="queue-status-heading">
          <h3 id="queue-status-heading" className="sr-only">
            Analysis Queue
          </h3>
          <AnalysisQueueStatus data={queueStatus} />
        </section>

        {/* Dead Letter Queue */}
        <section aria-labelledby="dead-letter-heading">
          <h3 id="dead-letter-heading" className="sr-only">
            Dead Letter Queue
          </h3>
          <DeadLetterQueue data={deadLetterQueue} onRefresh={fetchData} />
        </section>
      </div>
    </div>
  );
}
