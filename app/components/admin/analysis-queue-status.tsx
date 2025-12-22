'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  HEALTH_THRESHOLDS,
  getHealthStatus,
  getHealthStatusColors,
} from '@/lib/utils/health-thresholds';
import type { AnalysisQueueStatus as QueueStatusType } from '@/lib/db/queries/system-metrics';

interface AnalysisQueueStatusProps {
  data: QueueStatusType;
}

interface QueueItemProps {
  label: string;
  count: number;
  total: number;
  color: string;
  testId: string;
}

function QueueItem({ label, count, total, color, testId }: QueueItemProps) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Badge variant="outline" className={cn('font-mono', color)}>
          {count}
        </Badge>
      </div>
      <Progress value={percentage} className={cn('h-2', color.replace('text-', 'bg-').replace('-500', '-500/30'))} />
    </div>
  );
}

export function AnalysisQueueStatus({ data }: AnalysisQueueStatusProps) {
  const { counts, total, successRate, errorRate } = data;

  // Determine health status for pending and failed counts
  const pendingStatus = getHealthStatus(counts.pending, HEALTH_THRESHOLDS.pendingQueue);
  const errorStatus = getHealthStatus(errorRate, HEALTH_THRESHOLDS.errorRate);

  const pendingColors = getHealthStatusColors(pendingStatus);
  const errorColors = getHealthStatusColors(errorStatus);

  return (
    <Card className="bg-[#0f0f0f] border-[#2a2a2a]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center justify-between">
          <span>Analysis Queue</span>
          <Badge variant="secondary" className="font-mono">
            Last 24h
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[#2a2a2a]">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{total}</div>
            <div className="text-xs text-muted-foreground">Total Prompts</div>
          </div>
          <div className="text-center">
            <div
              className={cn(
                'text-2xl font-bold',
                successRate >= 95 ? 'text-green-500' : successRate >= 90 ? 'text-yellow-500' : 'text-red-500'
              )}
            >
              {successRate}%
            </div>
            <div className="text-xs text-muted-foreground">Success Rate</div>
          </div>
        </div>

        {/* Individual status counts */}
        <div className="space-y-4">
          <QueueItem
            label="Pending"
            count={counts.pending}
            total={total}
            color={pendingColors.text}
            testId="queue-pending-count"
          />
          <QueueItem
            label="Processing"
            count={counts.processing}
            total={total}
            color="text-blue-500"
            testId="queue-processing-count"
          />
          <QueueItem
            label="Complete"
            count={counts.complete}
            total={total}
            color="text-green-500"
            testId="queue-complete-count"
          />
          <QueueItem
            label="Failed"
            count={counts.failed}
            total={total}
            color={errorColors.text}
            testId="queue-failed-count"
          />
        </div>

        {/* Alert for high pending or error rate */}
        {(pendingStatus !== 'healthy' || errorStatus !== 'healthy') && (
          <div
            className={cn(
              'mt-4 rounded-lg p-3 text-sm',
              pendingStatus === 'critical' || errorStatus === 'critical'
                ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
            )}
            role="alert"
          >
            {pendingStatus === 'critical' && (
              <p>High pending count: {counts.pending} prompts waiting for analysis</p>
            )}
            {pendingStatus === 'warning' && (
              <p>Elevated pending count: {counts.pending} prompts in queue</p>
            )}
            {errorStatus === 'critical' && (
              <p>High error rate: {errorRate}% of analyses failed</p>
            )}
            {errorStatus === 'warning' && (
              <p>Elevated error rate: {errorRate}% of analyses failed</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
