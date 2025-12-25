"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LoopIndicatorProps {
  loopCount?: number;
  variant?: "badge" | "icon" | "full";
  className?: string;
}

/**
 * LoopIndicator - Displays a debugging loop warning
 *
 * Variants:
 * - badge: Compact pill with "Loop!" or count
 * - icon: Just the warning icon
 * - full: Icon with text description
 */
export function LoopIndicator({
  loopCount,
  variant = "badge",
  className,
}: LoopIndicatorProps) {
  const tooltipText = loopCount
    ? `${loopCount} similar fix attempts detected - you may be stuck in a debugging loop`
    : "Debugging loop detected - consider trying a different approach";

  if (variant === "icon") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "inline-flex items-center text-score-growth",
                className
              )}
              data-testid="loop-indicator-icon"
            >
              <AlertTriangle className="h-4 w-4" />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === "full") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 text-score-growth",
          className
        )}
        data-testid="loop-indicator-full"
      >
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm font-medium">
          {loopCount
            ? `${loopCount} similar attempts - debugging loop detected`
            : "Debugging loop detected"}
        </span>
      </div>
    );
  }

  // Badge variant (default)
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-md",
              "bg-score-growth/20 text-score-growth",
              className
            )}
            data-testid="loop-indicator-badge"
          >
            <AlertTriangle className="h-3 w-3" />
            {loopCount ? `${loopCount} loops` : "Loop!"}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default LoopIndicator;
