'use client';

import { useEffect, useState, useCallback } from 'react';
import { FeedbackTable } from '@/components/admin/feedback-table';
import { FeedbackFilters } from '@/components/admin/feedback-filters';
import { FeedbackPagination } from '@/components/admin/feedback-pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { FeedbackItem } from '@/lib/services/admin-feedback';

interface FeedbackTabProps {
  searchParams: {
    page?: string;
    pageSize?: string;
    category?: string;
    status?: string;
  };
}

interface FeedbackResponse {
  feedback: FeedbackItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function FeedbackTableSkeleton() {
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

/**
 * Feedback Tab
 *
 * User feedback management with filters and pagination.
 * Uses client-side data fetching via API.
 */
export function FeedbackTab({ searchParams }: FeedbackTabProps) {
  const [data, setData] = useState<FeedbackResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const page = Math.max(1, parseInt(searchParams.page || '1', 10));
  const pageSize = Math.min(50, Math.max(10, parseInt(searchParams.pageSize || '20', 10)));
  const category = searchParams.category || 'all';
  const status = searchParams.status || 'all';

  const fetchFeedback = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', pageSize.toString());
      if (category && category !== 'all') params.set('category', category);
      if (status && status !== 'all') params.set('status', status);

      const response = await fetch(`/api/feedback?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `Failed to fetch feedback (${response.status})`);
      }

      const result = await response.json();

      // Transform API response (camelCase) to component format (snake_case)
      const transformedFeedback = (result.data || []).map((item: Record<string, unknown>) => ({
        id: item.id,
        user_id: item.userId,
        user_email: item.userEmail || 'Unknown',
        category: item.category,
        message: item.message,
        extension_version: item.extensionVersion,
        created_at: item.createdAt,
        status: item.status,
        admin_notes: item.adminNotes,
        reviewed_at: item.reviewedAt,
        reviewed_by: item.reviewedBy,
      }));

      setData({
        feedback: transformedFeedback,
        total: result.meta?.total || 0,
        page: result.meta?.page || page,
        pageSize: result.meta?.limit || pageSize,
        totalPages: result.meta?.totalPages || 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feedback');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, category, status]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  return (
    <div data-testid="feedback-tab" className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">User Feedback</h2>
        <p className="text-muted-foreground text-sm">
          View and manage feedback submitted by users through the VS Code extension.
        </p>
      </div>

      <FeedbackFilters category={category} status={status} />

      {isLoading ? (
        <FeedbackTableSkeleton />
      ) : error ? (
        <div className="text-red-500 p-4 border border-red-200 rounded-lg">
          {error}
        </div>
      ) : data ? (
        <>
          <FeedbackTable feedback={data.feedback} onStatusUpdate={fetchFeedback} />
          <FeedbackPagination
            currentPage={data.page}
            totalPages={data.totalPages}
            pageSize={data.pageSize}
            total={data.total}
          />
        </>
      ) : null}
    </div>
  );
}
