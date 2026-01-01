import { Suspense } from 'react';
import { getAuditLogs, getAuditUsers } from '@/lib/services/audit-log';
import { AuditLogContent } from '@/components/admin/audit-log-content';
import { Skeleton } from '@/components/ui/skeleton';
import type { AuditAction, AuditEntityType, AuditLogFilters } from '@/lib/types/audit';

function AuditLogSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}

async function AuditLogData({
  page,
  pageSize,
  search,
  action,
  entityType,
  changedBy,
  dateFrom,
  dateTo,
}: {
  page: number;
  pageSize: number;
  search?: string;
  action?: AuditAction[];
  entityType?: AuditEntityType[];
  changedBy?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  // Fetch audit logs and users in parallel
  const [logsResult, usersResult] = await Promise.all([
    getAuditLogs(
      {
        action,
        entity_type: entityType,
        changed_by: changedBy,
        date_from: dateFrom,
        date_to: dateTo,
        search,
      },
      page,
      pageSize
    ),
    getAuditUsers(),
  ]);

  if (!logsResult.success) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        Failed to load audit logs: {logsResult.error.message}
      </div>
    );
  }

  const users = usersResult.success ? usersResult.data : [];

  // Build filters object for the component
  const filters: AuditLogFilters = {
    action,
    entity_type: entityType,
    changed_by: changedBy,
    date_from: dateFrom,
    date_to: dateTo,
    search,
  };

  return (
    <AuditLogContent
      entries={logsResult.data.entries}
      total={logsResult.data.total}
      page={logsResult.data.page}
      pageSize={logsResult.data.pageSize}
      totalPages={logsResult.data.totalPages}
      users={users}
      filters={filters}
    />
  );
}

/**
 * Audit Tab
 *
 * Configuration change history and audit logs.
 */
export async function AuditTab() {
  // Default pagination
  const page = 1;
  const pageSize = 20;

  return (
    <div className="space-y-6" data-testid="audit-tab">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Audit Log</h2>
        <p className="text-muted-foreground text-sm">
          View configuration change history and admin actions.
        </p>
      </div>

      <Suspense fallback={<AuditLogSkeleton />}>
        <AuditLogData page={page} pageSize={pageSize} />
      </Suspense>
    </div>
  );
}
