"use client";

import { cn } from "@/lib/utils";
import { ToolExecution } from "./types";
import { CheckCircle2, XCircle, CircleDashed } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ToolExecutionListProps {
  tools: ToolExecution[];
  compact?: boolean;
  className?: string;
}

/**
 * ToolExecutionList - Displays tools used in a response
 *
 * Compact: Just tool name pills [Read] [Edit] [Bash]
 * Expanded: List with input summaries and success indicators
 */
export function ToolExecutionList({
  tools,
  compact = false,
  className,
}: ToolExecutionListProps) {
  if (!tools || tools.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className={cn("flex flex-wrap gap-1", className)}>
        {tools.map((tool, idx) => (
          <TooltipProvider key={tool.id || idx}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded",
                    tool.success === true
                      ? "bg-score-high/10 text-score-high"
                      : tool.success === false
                      ? "bg-destructive/10 text-destructive"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {tool.toolName}
                  {tool.success === true && <CheckCircle2 className="h-3 w-3" />}
                  {tool.success === false && <XCircle className="h-3 w-3" />}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="font-mono text-xs break-all">{tool.inputSummary}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    );
  }

  // Expanded view
  return (
    <div className={cn("space-y-2", className)}>
      <h4 className="text-xs font-medium text-muted-foreground">
        Tool Executions ({tools.length})
      </h4>
      <div className="space-y-1.5">
        {tools.map((tool, idx) => (
          <div
            key={tool.id || idx}
            className="flex items-start gap-2 text-xs"
          >
            {/* Status Icon */}
            <span className="mt-0.5 shrink-0">
              {tool.success === true ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-score-high" />
              ) : tool.success === false ? (
                <XCircle className="h-3.5 w-3.5 text-destructive" />
              ) : (
                <CircleDashed className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </span>

            {/* Tool Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{tool.toolName}</span>
                <span className="text-muted-foreground">#{tool.executionOrder}</span>
              </div>
              <p className="text-muted-foreground font-mono text-[10px] truncate mt-0.5">
                {tool.inputSummary}
              </p>
              {tool.outputSummary && (
                <p className="text-muted-foreground text-[10px] mt-0.5 line-clamp-2">
                  → {tool.outputSummary}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ToolExecutionList;
