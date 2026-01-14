"use client";

/**
 * CostEstimate - Story 30-7: Interactive Chat Interface
 *
 * Displays estimated cost for the selected model.
 */

import { cn } from "@/lib/utils";
import { formatCost, type CostEstimate as CostEstimateType } from "@/lib/analysis/token-estimator";
import type { AnthropicModel } from "@/lib/analysis/anthropic-client";

interface CostEstimateProps {
  costs: CostEstimateType;
  selectedModel: AnthropicModel;
}

export function CostEstimate({ costs, selectedModel }: CostEstimateProps) {
  const selectedCost = costs[selectedModel];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Estimated cost</span>
        <span className="text-sm font-medium">
          {formatCost(selectedCost.totalCents)}
        </span>
      </div>

      {/* Cost comparison */}
      <div className="grid grid-cols-3 gap-1 text-center">
        {(["haiku", "sonnet", "opus"] as AnthropicModel[]).map((model) => (
          <div
            key={model}
            className={cn(
              "py-1.5 px-2 rounded text-xs",
              selectedModel === model
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground"
            )}
          >
            <div className="capitalize">{model}</div>
            <div>{formatCost(costs[model].totalCents)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
