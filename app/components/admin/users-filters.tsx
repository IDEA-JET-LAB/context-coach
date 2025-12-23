'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import { useDebounce } from '@/lib/hooks/use-debounce';

interface UsersFiltersProps {
  search?: string;
  status?: string;
}

export function UsersFilters({ search = '', status = 'all' }: UsersFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(search);
  const debouncedSearch = useDebounce(searchValue, 300);
  const isClearing = useRef(false);

  function updateUrl(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '' || value === 'all') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    // Reset to page 1 when filtering
    params.set('page', '1');
    startTransition(() => {
      router.push(`/admin/users?${params.toString()}`);
    });
  }

  useEffect(() => {
    // Skip update if we're clearing filters
    if (isClearing.current) {
      isClearing.current = false;
      return;
    }
    if (debouncedSearch !== search) {
      updateUrl({ search: debouncedSearch || null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  function handleSearchChange(value: string) {
    setSearchValue(value);
  }

  function handleStatusChange(value: string) {
    updateUrl({ status: value === 'all' ? null : value });
  }

  function clearFilters() {
    // Mark that we're clearing to prevent debounce effect from firing
    isClearing.current = true;
    setSearchValue('');
    // Navigate to clean URL
    startTransition(() => {
      router.push('/admin/users');
    });
  }

  const hasFilters = searchValue || status !== 'all';

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          data-testid="users-search"
          type="search"
          placeholder="Search by email or name..."
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9 bg-background border-border"
        />
      </div>

      <Select value={status} onValueChange={handleStatusChange}>
        <SelectTrigger data-testid="status-filter" className="w-32 bg-background border-border">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="disabled">Disabled</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          data-testid="clear-filters"
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          disabled={isPending}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="mr-1 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
