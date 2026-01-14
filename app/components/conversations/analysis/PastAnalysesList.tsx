"use client";

/**
 * PastAnalysesList - Story 30-7: Interactive Chat Interface
 *
 * Collapsible list of past analyses for a conversation.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, History, Zap, Scale, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCost } from "@/lib/analysis/token-estimator";
import type { ConversationAnalysis, AnalysisModel } from "@/lib/types/conversation-analysis";

interface PastAnalysesListProps {
  analyses: ConversationAnalysis[];
  isLoading?: boolean;
  onSelect?: (analysis: ConversationAnalysis) => void;
}

const MODEL_ICONS: Record<AnalysisModel, typeof Zap> = {
  haiku: Zap,
  sonnet: Scale,
  opus: Brain,
};

export function PastAnalysesList({
  analyses,
  isLoading = false,
  onSelect,
}: PastAnalysesListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <History className="h-4 w-4" />
            Past Analyses
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <History className="h-4 w-4" />
          Past Analyses {analyses.length > 0 && `(${analyses.length})`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {analyses.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No analyses yet. Run an analysis above to see it saved here.
          </p>
        ) : (
          analyses.map((analysis) => (
            <AnalysisItem key={analysis.id} analysis={analysis} onSelect={onSelect} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

interface AnalysisItemProps {
  analysis: ConversationAnalysis;
  onSelect?: (analysis: ConversationAnalysis) => void;
}

function AnalysisItem({ analysis, onSelect }: AnalysisItemProps) {
  const Icon = MODEL_ICONS[analysis.model];

  // Format relative time
  const relativeTime = formatRelativeTime(analysis.createdAt);

  const handleClick = () => {
    if (onSelect) {
      onSelect(analysis);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors",
        "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      )}
    >
      {/* Arrow Icon */}
      <div className="mt-0.5">
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{analysis.question}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <Icon className="h-3 w-3" />
          <span className="capitalize">{analysis.model}</span>
          <span>&middot;</span>
          <span>{formatCost(analysis.estimatedCostCents)}</span>
          <span>&middot;</span>
          <span>{relativeTime}</span>
        </div>
      </div>
    </button>
  );
}

/**
 * Formats a timestamp to relative time (e.g., "2h ago", "3d ago")
 */
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
}
