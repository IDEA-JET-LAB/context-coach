import { Metadata } from 'next';
import { Suspense } from 'react';
import { getUsers } from '@/lib/services/admin-users';
import { UserTable } from '@/components/admin/user-table';
import { UsersFilters } from '@/components/admin/users-filters';
import { UsersPagination } from '@/components/admin/users-pagination';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'User Management | Admin',
  description: 'Manage platform users',
};

interface PageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    status?: string;
  }>;
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

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const pageSize = Math.min(50, Math.max(10, parseInt(params.pageSize || '10', 10)));
  const search = params.search || '';
  const status = (params.status as 'all' | 'active' | 'disabled') || 'all';

  return (
    <div data-testid="admin-users-page" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">User Management</h2>
        <p className="text-muted-foreground">
          View and manage all platform users.
        </p>
      </div>

      <Suspense fallback={null}>
        <UsersFilters search={search} status={status} />
      </Suspense>

      <div className="rounded-lg bg-[#0f0f0f]">
        <Suspense fallback={<UsersTableSkeleton />}>
          <UsersContent
            page={page}
            pageSize={pageSize}
            search={search}
            status={status}
          />
        </Suspense>
      </div>
    </div>
  );
}
