"use client";

/**
 * QuickAnalysisButtons - Story 30-8
 *
 * A 2x2 grid of quick analysis preset buttons.
 * Each button shows an icon, label, and estimated token count.
 * Tooltips provide additional context on hover.
 */

import { AlertTriangle as WarningIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatTokens } from "@/lib/analysis/token-estimator";
import {
  QUICK_ANALYSES,
  getAnalysisDescription,
  type QuickAnalysis,
} from "@/lib/analysis/quick-analyses";

// ============================================================================
// Types
// ============================================================================

export interface TokenEstimateMap {
  [analysisId: string]: number;
}

export interface QuickAnalysisButtonsProps {
  /** Token estimates for each quick analysis type */
  tokenEstimates: TokenEstimateMap;
  /** Called when a quick analysis button is clicked */
  onSelect: (analysis: QuickAnalysis) => void;
  /** Whether the buttons should be disabled */
  disabled?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function QuickAnalysisButtons({
  tokenEstimates,
  onSelect,
  disabled = false,
}: QuickAnalysisButtonsProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid grid-cols-2 gap-2">
        {QUICK_ANALYSES.map((analysis) => {
          const Icon = analysis.icon;
          const tokens = tokenEstimates[analysis.id] || 0;
          const description = getAnalysisDescription(analysis.id);

          return (
            <Tooltip key={analysis.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto flex-col gap-1 py-2 px-3"
                  onClick={() => onSelect(analysis)}
                  disabled={disabled}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{analysis.label}</span>
                    {analysis.warning && (
                      <WarningIcon className="h-3 w-3 text-yellow-500" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    ~{formatTokens(tokens)} tokens
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px]">
                <p>{description}</p>
                {analysis.warning && (
                  <p className="mt-1 text-yellow-200 text-xs">
                    {analysis.warning}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
