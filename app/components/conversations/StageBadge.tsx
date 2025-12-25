"use client";

import { cn } from "@/lib/utils";
import { ProjectStage, STAGE_CONFIG } from "./types";

interface StageBadgeProps {
  stage: ProjectStage;
  size?: "sm" | "md";
  className?: string;
}

/**
 * StageBadge - Displays a project stage indicator
 *
 * Stages: architecture, specification, development, debugging, enhancement
 * Each stage has a distinct color from the design system.
 */
export function StageBadge({ stage, size = "md", className }: StageBadgeProps) {
  const config = STAGE_CONFIG[stage] || STAGE_CONFIG.unknown;

  if (!config) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-md",
        config.bgColor,
        config.color,
        size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-xs",
        className
      )}
      data-testid={`stage-badge-${stage}`}
    >
      {config.label}
    </span>
  );
}

export default StageBadge;
