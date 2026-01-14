'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FeedbackFiltersProps {
  category: string;
  status: string;
}

export function FeedbackFilters({ category, status }: FeedbackFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === 'all') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      params.delete('page'); // Reset pagination on filter change
      router.push(`/admin/settings?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div data-testid="feedback-filters" className="flex gap-4">
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">Category:</label>
        <Select value={category} onValueChange={(v) => updateFilter('category', v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="suggestion">Suggestion</SelectItem>
            <SelectItem value="question">Question</SelectItem>
            <SelectItem value="bug">Bug</SelectItem>
            <SelectItem value="feature-request">Feature Request</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">Status:</label>
        <Select value={status} onValueChange={(v) => updateFilter('status', v)}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
