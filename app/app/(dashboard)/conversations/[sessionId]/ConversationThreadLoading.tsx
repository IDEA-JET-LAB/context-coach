"use client";

/**
 * ConversationThreadLoading - Loading state for conversation thread page
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function ConversationThreadLoading() {
  return (
    <div className="flex-1 w-full flex flex-col h-[calc(100vh-4rem)]">
      {/* Fixed Header */}
      <div className="flex items-center gap-3 pb-4 shrink-0">
        {/* Back Button */}
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/conversations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        {/* Title Skeleton */}
        <div className="flex-1 min-w-0">
          <Skeleton className="h-6 w-64 mb-2" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* Navigation Skeleton */}
        <div className="flex items-center gap-1 shrink-0">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>

      {/* Two-column area */}
      <div className="flex-1 flex gap-6 min-h-0">
        {/* Left Column - Messages */}
        <div className="flex-1 min-w-0 overflow-y-auto pr-2">
          <div className="space-y-4 pb-4">
            {/* Time Divider */}
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-border" />
              <Skeleton className="h-4 w-32" />
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* User Message */}
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-12" />
                </div>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>

            {/* Assistant Response */}
            <Card>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
                <div className="flex gap-2 mt-3">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </CardContent>
            </Card>

            {/* Another User Message */}
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-10" />
                </div>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>

            {/* Another Assistant Response */}
            <Card>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Sidebar */}
        <aside className="w-80 shrink-0 overflow-y-auto">
          <div className="space-y-4 pb-4">
            {/* Session Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Session Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-36" />
              </CardContent>
            </Card>

            {/* Analysis */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-6 w-24" />
                </div>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </CardContent>
            </Card>

            {/* Score Breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Score Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="flex-1 h-1.5" />
                      <Skeleton className="h-3 w-8" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}
