import { Metadata } from 'next';
import { Suspense } from 'react';
import { getAuditLogs, getAuditUsers } from '@/lib/services/audit-log';
import { AuditLogContent } from '@/components/admin/audit-log-content';
import { Skeleton } from '@/components/ui/skeleton';
import { History } from 'lucide-react';
import type { AuditAction, AuditEntityType } from '@/lib/types/audit';

export const metadata: Metadata = {
  title: 'Audit Log | Admin',
  description: 'View configuration change history',
};

interface PageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    action?: string;
    entity_type?: string;
    changed_by?: string;
    date_from?: string;
    date_to?: string;
  }>;
}

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

  return (
    <AuditLogContent
      entries={logsResult.data.entries}
      total={logsResult.data.total}
      page={logsResult.data.page}
      pageSize={logsResult.data.pageSize}
      totalPages={logsResult.data.totalPages}
      users={users}
      filters={{
        search,
        action,
        entity_type: entityType,
        changed_by: changedBy,
        date_from: dateFrom,
        date_to: dateTo,
      }}
    />
  );
}

export default async function AdminAuditPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const pageSize = Math.min(50, Math.max(10, parseInt(params.pageSize || '20', 10)));
  const search = params.search || undefined;

  // Parse action filter (comma-separated)
  const action = params.action
    ? (params.action.split(',') as AuditAction[])
    : undefined;

  // Parse entity type filter (comma-separated)
  const entityType = params.entity_type
    ? (params.entity_type.split(',') as AuditEntityType[])
    : undefined;

  const changedBy = params.changed_by || undefined;
  const dateFrom = params.date_from || undefined;
  const dateTo = params.date_to || undefined;

  return (
    <div data-testid="admin-audit-page" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <History className="h-6 w-6" />
          Audit Log
        </h2>
        <p className="text-muted-foreground">
          View configuration change history for compliance and debugging.
        </p>
      </div>

      <Suspense fallback={<AuditLogSkeleton />}>
        <AuditLogData
          page={page}
          pageSize={pageSize}
          search={search}
          action={action}
          entityType={entityType}
          changedBy={changedBy}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      </Suspense>
    </div>
  );
}
