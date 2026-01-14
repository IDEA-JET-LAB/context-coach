"use client";

/**
 * ModelSelector - Story 30-7: Interactive Chat Interface
 *
 * Three-button model selector for Haiku/Sonnet/Opus with icons and labels.
 */

import { cn } from "@/lib/utils";
import { Zap, Scale, Brain } from "lucide-react";
import type { AnthropicModel } from "@/lib/analysis/anthropic-client";

interface ModelSelectorProps {
  value: AnthropicModel;
  onChange: (model: AnthropicModel) => void;
  disabled?: boolean;
}

interface ModelOption {
  id: AnthropicModel;
  label: string;
  description: string;
  icon: typeof Zap;
}

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "haiku",
    label: "Haiku",
    description: "Fast & cheap",
    icon: Zap,
  },
  {
    id: "sonnet",
    label: "Sonnet",
    description: "Balanced",
    icon: Scale,
  },
  {
    id: "opus",
    label: "Opus",
    description: "Most capable",
    icon: Brain,
  },
];

export function ModelSelector({
  value,
  onChange,
  disabled = false,
}: ModelSelectorProps) {
  return (
    <div className="flex gap-2">
      {MODEL_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isSelected = value === option.id;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            disabled={disabled}
            className={cn(
              "flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors min-w-[80px]",
              "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              isSelected
                ? "border-primary bg-primary/5"
                : "border-border bg-background"
            )}
          >
            <Icon
              className={cn(
                "h-5 w-5",
                isSelected ? "text-primary" : "text-muted-foreground"
              )}
            />
            <span
              className={cn(
                "text-sm font-medium",
                isSelected ? "text-primary" : "text-foreground"
              )}
            >
              {option.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {option.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
