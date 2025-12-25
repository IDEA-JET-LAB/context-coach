"use client";

import { cn } from "@/lib/utils";
import { PromptType, PROMPT_TYPE_CONFIG } from "./types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PromptTypeBadgeProps {
  type: PromptType;
  size?: "sm" | "md";
  showTooltip?: boolean;
  className?: string;
}

const PROMPT_TYPE_DESCRIPTIONS: Record<PromptType, string> = {
  initiating: "Starts a new task or topic - fully scored",
  continuation: "Provides additional information - partially scored",
  selection: "Chooses from presented options - not scored",
  correction: "Redirects or corrects the LLM - scored on clarity",
  confirmation: "Approves to proceed - not scored",
  clarification: "Asks for explanation - scored on question quality",
};

/**
 * PromptTypeBadge - Displays prompt classification type
 *
 * Types are color-coded based on their scoring weight:
 * - Primary: initiating (full scoring)
 * - Muted: continuation (partial scoring)
 * - Warning: correction
 * - Info: clarification
 * - Subtle: selection, confirmation (not scored)
 */
export function PromptTypeBadge({
  type,
  size = "md",
  showTooltip = true,
  className,
}: PromptTypeBadgeProps) {
  const config = PROMPT_TYPE_CONFIG[type];
  const description = PROMPT_TYPE_DESCRIPTIONS[type];

  const badge = (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-md",
        config.bgColor,
        config.color,
        size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-xs",
        className
      )}
      data-testid={`prompt-type-badge-${type}`}
    >
      {config.label}
    </span>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p>{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default PromptTypeBadge;
