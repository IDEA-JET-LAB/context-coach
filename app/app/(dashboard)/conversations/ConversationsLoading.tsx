"use client";

/**
 * ConversationsLoading - Loading state for conversations page
 */

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ConversationsLoading() {
  return (
    <div className="flex-1 w-full flex flex-col gap-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>

      {/* Filters Bar Skeleton */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-10 flex-1 min-w-[200px]" />
            <Skeleton className="h-10 w-[180px]" />
            <Skeleton className="h-10 w-[160px]" />
            <Skeleton className="h-10 w-[140px]" />
            <Skeleton className="h-10 w-[130px]" />
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
          </div>
        </CardContent>
      </Card>

      {/* Cards Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-5 w-3/4 mb-3" />
              <Skeleton className="h-4 w-1/2 mb-4" />
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
