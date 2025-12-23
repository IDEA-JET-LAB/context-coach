'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { TeamsTable, TeamsTableSkeleton } from '@/components/admin/teams-table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useDebounce } from '@/lib/hooks/use-debounce';

interface Team {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  project_count: number;
  prompts_count: number;
  created_at: string;
}

interface TeamsResponse {
  data: Team[];
  meta: {
    count: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export default function AdminTeamsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [teams, setTeams] = useState<Team[]>([]);
  const [isPending, setIsPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState({ count: 0, page: 1, pageSize: 20, totalPages: 0 });

  // Get initial values from URL params
  const initialSearch = searchParams.get('search') || '';
  const initialPage = parseInt(searchParams.get('page') || '1', 10);

  const [search, setSearch] = useState(initialSearch);
  const debouncedSearch = useDebounce(search, 300);

  const fetchTeams = useCallback(
    async (page: number, searchQuery: string) => {
      setIsPending(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set('page', page.toString());
        params.set('pageSize', '20');
        if (searchQuery) {
          params.set('search', searchQuery);
        }

        const response = await fetch(`/api/admin/teams?${params.toString()}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to fetch teams');
        }

        const data: TeamsResponse = await response.json();
        setTeams(data.data);
        setMeta(data.meta);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setTeams([]);
      } finally {
        setIsPending(false);
      }
    },
    []
  );

  // Update URL params when search or page changes
  const updateUrl = useCallback(
    (page: number, searchQuery: string) => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (page > 1) params.set('page', page.toString());
      const queryString = params.toString();
      router.replace(queryString ? `?${queryString}` : '/admin/teams', { scroll: false });
    },
    [router]
  );

  // Fetch when debounced search changes
  useEffect(() => {
    fetchTeams(1, debouncedSearch);
    updateUrl(1, debouncedSearch);
  }, [debouncedSearch, fetchTeams, updateUrl]);

  // Initial fetch
  useEffect(() => {
    fetchTeams(initialPage, initialSearch);
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePageChange = (newPage: number) => {
    fetchTeams(newPage, debouncedSearch);
    updateUrl(newPage, debouncedSearch);
  };

  return (
    <div className="space-y-6" data-testid="admin-teams-page">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Teams</h2>
        <p className="text-muted-foreground">
          View all teams on the platform with their usage statistics.
        </p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search teams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background border-border"
          />
        </div>
        {meta.count > 0 && (
          <span className="text-sm text-muted-foreground">
            {meta.count} team{meta.count !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-red-500">{error}</p>
        </div>
      )}

      {/* Teams table */}
      <div className="rounded-lg border border-border bg-background">
        {isPending ? (
          <TeamsTableSkeleton />
        ) : (
          <TeamsTable teams={teams} />
        )}
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {meta.page} of {meta.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(meta.page - 1)}
              disabled={meta.page <= 1 || isPending}
              className="border-border bg-background"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(meta.page + 1)}
              disabled={meta.page >= meta.totalPages || isPending}
              className="border-border bg-background"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
