"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Brain, ChevronDown, ChevronUp } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ThinkingSummaryProps {
  summary: string;
  wordCount: number;
  truncated: boolean;
  maxPreviewLength?: number;
  className?: string;
}

/**
 * ThinkingSummary - Displays compressed extended thinking content
 *
 * Shows a preview with option to expand, plus original word count
 */
export function ThinkingSummary({
  summary,
  wordCount,
  truncated,
  maxPreviewLength = 200,
  className,
}: ThinkingSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const showPreview = summary.length > maxPreviewLength;
  const previewText = showPreview
    ? summary.slice(0, maxPreviewLength) + "..."
    : summary;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-2">
        <Brain className="h-3.5 w-3.5 text-muted-foreground" />
        <h4 className="text-xs font-medium text-muted-foreground">
          Thinking
          {wordCount > 0 && (
            <span className="ml-1 font-normal">
              ({wordCount.toLocaleString()} words
              {truncated && ", summarized"})
            </span>
          )}
        </h4>
      </div>

      {showPreview ? (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="text-xs text-muted-foreground italic bg-muted/30 rounded-md p-2">
            {isExpanded ? summary : previewText}
          </div>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1 transition-colors">
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show more
                </>
              )}
            </button>
          </CollapsibleTrigger>
        </Collapsible>
      ) : (
        <div className="text-xs text-muted-foreground italic bg-muted/30 rounded-md p-2">
          {summary}
        </div>
      )}
    </div>
  );
}

export default ThinkingSummary;
