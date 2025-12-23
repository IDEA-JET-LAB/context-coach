'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface UsersPaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  total: number;
}

export function UsersPagination({
  currentPage,
  totalPages,
  pageSize,
  total,
}: UsersPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateUrl(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      params.set(key, value);
    });
    router.push(`/admin/users?${params.toString()}`);
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      updateUrl({ page: page.toString() });
    }
  }

  const startItem = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, total);

  return (
    <div
      data-testid="users-pagination"
      className="flex items-center justify-between border-t border-border px-4 py-3"
    >
      <div className="text-sm text-muted-foreground">
        Showing {startItem} to {endItem} of {total} users
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page</span>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => updateUrl({ pageSize: value, page: '1' })}
          >
            <SelectTrigger data-testid="page-size-select" className="w-16 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="min-w-[100px] text-center text-sm text-muted-foreground">
            Page {currentPage} of {totalPages || 1}
          </span>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
