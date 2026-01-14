"use client";

/**
 * ConversationsPageClient - Story 25-5: Connect Conversations UI
 *
 * Client component for conversations list with API-powered data fetching,
 * real-time updates, and URL-based filter persistence.
 */

import { useState, useEffect, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ConversationCard,
  ConversationSummary,
  STAGE_CONFIG,
  StageAnalysisButton,
} from "@/components/conversations";
import { useStageAnalysisStatus } from "@/lib/hooks/use-stage-analysis-status";
import {
  Search,
  Filter,
  MessageSquare,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { useConversations } from "@/lib/hooks/use-conversations";
import { useRealtimeConversations } from "@/lib/hooks/use-realtime-conversations";
import { ExtensionDownloadButton } from "@/components/extension-download-button";
import { useSelectedProject } from "@/lib/hooks/use-selected-project";

interface ConversationsPageClientProps {
  teamId: string;
  projects: Array<{ id: string; name: string }>;
  currentUserId: string;
  initialFilters: {
    projectId?: string;
    stage?: string;
    hasLoop?: boolean;
    sortBy: "date" | "messages" | "score";
  };
}

/**
 * ConversationsPageClient - Client component for conversations list
 *
 * Features:
 * - Filter by project, stage, debugging loop
 * - Search by slug
 * - Sort by date, messages, score
 * - Group by project
 * - Real-time updates
 * - URL state persistence
 */
export function ConversationsPageClient({
  teamId,
  projects,
  currentUserId,
  initialFilters,
}: ConversationsPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Global project selection from header
  const { projectId: globalProjectId } = useSelectedProject();

  // Local filter state (stage, loop, sort)
  const [stageFilter, setStageFilter] = useState<string>(
    initialFilters.stage || "all"
  );
  const [loopFilter, setLoopFilter] = useState<string>(
    initialFilters.hasLoop === true
      ? "with-loops"
      : initialFilters.hasLoop === false
        ? "no-loops"
        : "all"
  );
  const [sortBy, setSortBy] = useState<"date" | "messages" | "score">(
    initialFilters.sortBy
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch conversations with current filters (using global project from header)
  const { data, isPending, error, refetch } = useConversations({
    projectId: globalProjectId || undefined,
    stage: stageFilter !== "all" ? stageFilter : undefined,
    hasLoop:
      loopFilter === "with-loops"
        ? true
        : loopFilter === "no-loops"
          ? false
          : undefined,
    sortBy,
    limit: 50,
  });

  // Real-time updates
  useRealtimeConversations(teamId);

  // Stage analysis status (for current project)
  const {
    data: stageStatus,
    refetch: refetchStageStatus,
  } = useStageAnalysisStatus(globalProjectId);

  // Callback when stage analysis completes
  const handleAnalysisComplete = () => {
    refetch();
    refetchStageStatus();
  };

  // Update URL when local filters change (preserve project param from header)
  useEffect(() => {
    const params = new URLSearchParams();

    // Preserve the project param from the global selection
    if (globalProjectId) {
      params.set("project", globalProjectId);
    }

    if (stageFilter !== "all") {
      params.set("stage", stageFilter);
    }
    if (loopFilter !== "all") {
      params.set("has_loop", loopFilter === "with-loops" ? "true" : "false");
    }
    if (sortBy !== "date") {
      params.set("sort_by", sortBy);
    }

    const queryString = params.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
    router.replace(newUrl, { scroll: false });
    // Note: searchParams is intentionally excluded from deps to prevent infinite loops
    // The effect should only run when local filter state changes
  }, [stageFilter, loopFilter, sortBy, pathname, router, globalProjectId]);

  // Extract conversations from response
  const conversations = useMemo(() => {
    return data?.data?.conversations || [];
  }, [data]);

  const pagination = data?.data?.pagination;

  // Map API response to component type
  const mappedConversations: ConversationSummary[] = useMemo(() => {
    return conversations.map((c) => ({
      id: c.id,
      sessionId: c.sessionId,
      slug: c.slug || "",
      projectId: c.projectId,
      projectName: c.projectName,
      userId: c.userId,
      userName: c.userName,
      startedAt: c.startedAt,
      endedAt: c.endedAt,
      userMessageCount: c.userMessageCount,
      totalMessages: c.totalMessages,
      primaryStage: c.primaryStage as ConversationSummary["primaryStage"],
      hasDebuggingLoop: c.hasDebuggingLoop,
      conversationScore: c.conversationScore,
      gitBranch: c.gitBranch,
      cwd: c.cwd,
      claudeCodeVersion: c.claudeCodeVersion,
      isImported: c.isImported ?? false,
    }));
  }, [conversations]);

  // Local search filter
  const filteredConversations = useMemo(() => {
    if (!searchQuery) return mappedConversations;

    const query = searchQuery.toLowerCase();
    return mappedConversations.filter(
      (c) =>
        c.slug?.toLowerCase().includes(query) ||
        c.projectName?.toLowerCase().includes(query) ||
        c.gitBranch?.toLowerCase().includes(query)
    );
  }, [mappedConversations, searchQuery]);

  // Group by project
  const groupedConversations = useMemo(() => {
    const groups: Record<string, ConversationSummary[]> = {};

    filteredConversations.forEach((conv) => {
      const key = conv.projectName || "Unlinked";
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(conv);
    });

    return groups;
  }, [filteredConversations]);

  const handleConversationClick = (conv: ConversationSummary) => {
    router.push(`/conversations/${conv.sessionId}`);
  };

  const clearFilters = () => {
    setStageFilter("all");
    setLoopFilter("all");
    setSearchQuery("");
  };

  const hasActiveFilters =
    stageFilter !== "all" ||
    loopFilter !== "all" ||
    searchQuery !== "";

  // Error state
  if (error) {
    return (
      <div className="flex-1 w-full">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-medium">Failed to load conversations</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {error.message}
            </p>
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="mt-4"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Conversations</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Browse and analyze your Claude Code sessions
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Stage Analysis Button - shown when project is selected in header */}
          {globalProjectId && (
            <StageAnalysisButton
              projectId={globalProjectId}
              lastAnalyzedAt={stageStatus?.lastAnalyzedAt ?? null}
              onAnalysisComplete={handleAnalysisComplete}
            />
          )}
          <ExtensionDownloadButton />
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isPending}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Stage Filter */}
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {Object.entries(STAGE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Loop Filter */}
            <Select value={loopFilter} onValueChange={setLoopFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Loops" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="with-loops">With Loops</SelectItem>
                <SelectItem value="no-loops">No Loops</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as typeof sortBy)}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Newest</SelectItem>
                <SelectItem value="messages">Most Messages</SelectItem>
                <SelectItem value="score">Highest Score</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>

          {/* Results Count */}
          <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>
              {isPending ? (
                <Skeleton className="h-4 w-24 inline-block" />
              ) : (
                `${filteredConversations.length} of ${pagination?.total || 0} conversations`
              )}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isPending && (
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
      )}

      {/* Empty State */}
      {!isPending && filteredConversations.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No conversations found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {hasActiveFilters
                ? "Try adjusting your filters"
                : "Start a Claude Code session to see conversations here"}
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="mt-4"
              >
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Conversations List - Grouped by Project */}
      {!isPending && filteredConversations.length > 0 && (
        <div className="space-y-6">
          {Object.entries(groupedConversations).map(([projectName, convs]) => (
            <Card key={projectName}>
              <CardHeader className="py-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  {projectName}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({convs.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {convs.map((conv) => (
                    <ConversationCard
                      key={conv.id}
                      conversation={conv}
                      onClick={() => handleConversationClick(conv)}
                      compact
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Load More */}
      {!isPending && pagination?.hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" disabled>
            Load More (coming soon)
          </Button>
        </div>
      )}
    </div>
  );
}

export default ConversationsPageClient;
