'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function PromptDetailSkeleton() {
  return (
    <div className="max-w-3xl mx-auto" data-testid="prompt-detail-skeleton">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-9 w-28" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-16 w-16 rounded-full" />
        </div>
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-28" />
      </div>

      {/* Prompt text */}
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4 mb-8">
        <Skeleton className="h-4 w-16 mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      {/* Dimension cards */}
      <Skeleton className="h-6 w-36 mb-4" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-8" />
            </div>
            <Skeleton className="h-2 w-full mb-3" />
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
