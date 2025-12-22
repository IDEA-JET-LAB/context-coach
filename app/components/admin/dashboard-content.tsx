'use client';

import { useAdminStats } from '@/lib/hooks/use-admin-stats';
import { useAdminHealth } from '@/lib/hooks/use-admin-health';
import { StatCard } from './stat-card';
import { HealthIndicator } from './health-indicator';
import { RealTimeStatsProvider, useRefreshStats } from './real-time-stats';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * AdminDashboardContent - Client component with real-time admin dashboard stats.
 * Story 7.2: Admin Dashboard Overview
 */
function DashboardContent() {
  const { data: statsData, isPending: statsPending, dataUpdatedAt } = useAdminStats();
  const { data: healthData, isPending: healthPending } = useAdminHealth();
  const { refresh } = useRefreshStats();

  const formatLastUpdated = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="space-y-8">
      {/* Header with refresh and last updated */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Admin Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor platform health and usage metrics.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div
            data-testid="last-updated"
            className="text-sm text-muted-foreground"
          >
            {dataUpdatedAt && (
              <>Last updated: {formatLastUpdated(dataUpdatedAt)}</>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            className="border-[#2a2a2a] bg-[#0f0f0f] hover:bg-[#1a1a1a]"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Platform Overview Section */}
      <section>
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Platform Overview
        </h3>
        <div
          data-testid="metrics-grid"
          className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
        >
          <StatCard
            testId="stat-total-users"
            title="Total Users"
            value={statsData?.stats.totalUsers ?? 0}
            trend={statsData?.trends.users}
            isPending={statsPending}
          />
          <StatCard
            testId="stat-total-teams"
            title="Total Teams"
            value={statsData?.stats.totalTeams ?? 0}
            trend={statsData?.trends.teams}
            isPending={statsPending}
          />
          <StatCard
            testId="stat-total-prompts"
            title="Total Prompts"
            value={statsData?.stats.totalPrompts ?? 0}
            trend={statsData?.trends.prompts}
            isPending={statsPending}
          />
          <StatCard
            testId="stat-prompts-today"
            title="Prompts Today"
            value={statsData?.stats.promptsToday ?? 0}
            isPending={statsPending}
          />
        </div>
      </section>

      {/* System Health Section */}
      <section>
        <h3 className="text-lg font-semibold text-foreground mb-4">
          System Health
        </h3>
        <div
          data-testid="health-grid"
          className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
        >
          <HealthIndicator
            testId="health-success-rate"
            title="Analysis Success Rate"
            value={healthData?.health.successRate ?? 100}
            unit="%"
            status={healthData?.statuses.successRate ?? 'green'}
            tooltip="Percentage of prompts successfully analyzed in the last 24 hours. Green: >= 95%, Yellow: >= 90%, Red: < 90%"
            isPending={healthPending}
          />
          <HealthIndicator
            testId="health-avg-time"
            title="Avg Analysis Time"
            value={healthData?.health.averageAnalysisTime ?? 0}
            unit="s"
            status={healthData?.statuses.avgTime ?? 'green'}
            tooltip="Average time to analyze a prompt in the last 24 hours. Green: < 3s, Yellow: < 10s, Red: >= 10s"
            isPending={healthPending}
          />
          <HealthIndicator
            testId="health-error-rate"
            title="API Error Rate"
            value={healthData?.health.errorRate ?? 0}
            unit="%"
            status={healthData?.statuses.errorRate ?? 'green'}
            tooltip="Percentage of failed analysis attempts in the last 24 hours. Green: < 1%, Yellow: < 5%, Red: >= 5%"
            isPending={healthPending}
          />
          <HealthIndicator
            testId="health-pending-queue"
            title="Pending Queue"
            value={healthData?.health.pendingCount ?? 0}
            unit=""
            status={healthData?.statuses.pendingQueue ?? 'green'}
            tooltip="Number of prompts waiting for analysis. Green: < 50, Yellow: < 100, Red: >= 100"
            isPending={healthPending}
          />
        </div>
      </section>

      {/* Quick Stats Row */}
      {healthData && (
        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Queue Status
          </h3>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            <div className="rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] p-4">
              <p className="text-sm font-medium text-muted-foreground">Processing</p>
              <p className="text-xl font-bold text-foreground">
                {healthData.health.processingCount}
              </p>
            </div>
            <div className="rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] p-4">
              <p className="text-sm font-medium text-muted-foreground">Dead Letter</p>
              <p className="text-xl font-bold text-foreground">
                {healthData.deadLetterCount}
              </p>
            </div>
            <div className="rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] p-4">
              <p className="text-sm font-medium text-muted-foreground">Pending</p>
              <p className="text-xl font-bold text-foreground">
                {healthData.health.pendingCount}
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * AdminDashboardContent wrapped with real-time provider.
 */
export function AdminDashboardContent() {
  return (
    <RealTimeStatsProvider>
      <DashboardContent />
    </RealTimeStatsProvider>
  );
}
