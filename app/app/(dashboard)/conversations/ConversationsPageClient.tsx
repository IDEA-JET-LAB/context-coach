"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
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
import {
  ConversationCard,
  ConversationSummary,
  ProjectStage,
  STAGE_CONFIG,
} from "@/components/conversations";
import { Search, Filter, MessageSquare, RefreshCw } from "lucide-react";

interface ConversationsPageClientProps {
  conversations: ConversationSummary[];
  projects: Array<{ id: string; name: string }>;
  currentUserId: string;
}

/**
 * ConversationsPageClient - Client component for conversations list
 *
 * Features:
 * - Filter by project, stage, debugging loop
 * - Search by slug
 * - Sort by date, messages, score
 * - Group by project
 */
export function ConversationsPageClient({
  conversations,
  projects,
  currentUserId,
}: ConversationsPageClientProps) {
  const router = useRouter();

  // Filter state
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [loopFilter, setLoopFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "messages" | "score">("date");

  // Apply filters
  const filteredConversations = useMemo(() => {
    let result = [...conversations];

    // Project filter
    if (projectFilter !== "all") {
      if (projectFilter === "unlinked") {
        result = result.filter((c) => !c.projectId);
      } else {
        result = result.filter((c) => c.projectId === projectFilter);
      }
    }

    // Stage filter
    if (stageFilter !== "all") {
      result = result.filter((c) => c.primaryStage === stageFilter);
    }

    // Loop filter
    if (loopFilter === "with-loops") {
      result = result.filter((c) => c.hasDebuggingLoop);
    } else if (loopFilter === "no-loops") {
      result = result.filter((c) => !c.hasDebuggingLoop);
    }

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.slug?.toLowerCase().includes(query) ||
          c.projectName?.toLowerCase().includes(query) ||
          c.gitBranch?.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "messages":
          return (b.userMessageCount || 0) - (a.userMessageCount || 0);
        case "score":
          return (b.conversationScore || 0) - (a.conversationScore || 0);
        case "date":
        default:
          return (
            new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
          );
      }
    });

    return result;
  }, [
    conversations,
    projectFilter,
    stageFilter,
    loopFilter,
    searchQuery,
    sortBy,
  ]);

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
    setProjectFilter("all");
    setStageFilter("all");
    setLoopFilter("all");
    setSearchQuery("");
  };

  const hasActiveFilters =
    projectFilter !== "all" ||
    stageFilter !== "all" ||
    loopFilter !== "all" ||
    searchQuery !== "";

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
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.refresh()}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
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

            {/* Project Filter */}
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                <SelectItem value="unlinked">Unlinked</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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
              {filteredConversations.length} of {conversations.length}{" "}
              conversations
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Conversations List */}
      {filteredConversations.length === 0 ? (
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
              <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
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
    </div>
  );
}

export default ConversationsPageClient;
