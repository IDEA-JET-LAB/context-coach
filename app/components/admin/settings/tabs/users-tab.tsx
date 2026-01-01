import { Suspense } from 'react';
import { getUsers } from '@/lib/services/admin-users';
import { UserTable } from '@/components/admin/user-table';
import { UsersFilters } from '@/components/admin/users-filters';
import { UsersPagination } from '@/components/admin/users-pagination';
import { Skeleton } from '@/components/ui/skeleton';

interface UsersTabProps {
  searchParams: {
    page?: string;
    pageSize?: string;
    search?: string;
    status?: string;
  };
}

function UsersTableSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

async function UsersContent({
  page,
  pageSize,
  search,
  status,
}: {
  page: number;
  pageSize: number;
  search?: string;
  status?: 'all' | 'active' | 'disabled';
}) {
  const result = await getUsers({ page, pageSize, search, status });

  return (
    <>
      <UserTable users={result.users} />
      <UsersPagination
        currentPage={result.page}
        totalPages={result.totalPages}
        pageSize={result.pageSize}
        total={result.total}
      />
    </>
  );
}

/**
 * Users Tab
 *
 * User management with search, filters, and pagination.
 */
export async function UsersTab({ searchParams }: UsersTabProps) {
  const page = Math.max(1, parseInt(searchParams.page || '1', 10));
  const pageSize = Math.min(50, Math.max(10, parseInt(searchParams.pageSize || '10', 10)));
  const search = searchParams.search || '';
  const status = (searchParams.status as 'all' | 'active' | 'disabled') || 'all';

  return (
    <div data-testid="users-tab" className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">User Management</h2>
        <p className="text-muted-foreground text-sm">
          View and manage all platform users.
        </p>
      </div>

      <Suspense fallback={null}>
        <UsersFilters search={search} status={status} />
      </Suspense>

      <Suspense fallback={<UsersTableSkeleton />}>
        <UsersContent page={page} pageSize={pageSize} search={search} status={status} />
      </Suspense>
    </div>
  );
}
