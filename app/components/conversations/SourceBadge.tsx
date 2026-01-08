"use client";

import { cn } from "@/lib/utils";
import { Radio, Download } from "lucide-react";

export type SourceType = "live" | "imported";

interface SourceBadgeProps {
  source: SourceType;
  size?: "sm" | "md";
  className?: string;
}

const SOURCE_CONFIG: Record<
  SourceType,
  {
    label: string;
    color: string;
    bgColor: string;
    Icon: typeof Radio;
  }
> = {
  live: {
    label: "Live",
    color: "text-score-high",
    bgColor: "bg-score-high/20",
    Icon: Radio,
  },
  imported: {
    label: "Imported",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    Icon: Download,
  },
};

/**
 * SourceBadge - Displays whether a conversation/project is live-captured or imported
 *
 * Live: Teal color with radio icon - real-time captures from CLI hook
 * Imported: Purple color with download icon - historical imports
 */
export function SourceBadge({ source, size = "md", className }: SourceBadgeProps) {
  const config = SOURCE_CONFIG[source];

  if (!config) {
    return null;
  }

  const { Icon, label, color, bgColor } = config;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium rounded-md",
        bgColor,
        color,
        size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-xs",
        className
      )}
      data-testid={`source-badge-${source}`}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {label}
    </span>
  );
}

export default SourceBadge;
