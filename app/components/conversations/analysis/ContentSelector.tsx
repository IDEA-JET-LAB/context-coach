"use client";

/**
 * ContentSelector - Story 30-7: Interactive Chat Interface
 *
 * Checkboxes for selecting what content to include in analysis,
 * with token count display for each option.
 */

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTokens } from "@/lib/analysis/token-estimator";

export interface ContentOptions {
  includePrompts: boolean;
  includeResponses: boolean;
  includeThinking: boolean;
  includeTools: boolean;
}

export interface TokenCounts {
  prompts: number;
  responses: number;
  thinking: number;
  tools: number;
  systemPrompt: number;
  total: number;
}

interface ContentSelectorProps {
  value: ContentOptions;
  onChange: (options: ContentOptions) => void;
  tokenCounts: TokenCounts;
  disabled?: boolean;
}

const THINKING_WARNING_THRESHOLD = 20000;

export function ContentSelector({
  value,
  onChange,
  tokenCounts,
  disabled = false,
}: ContentSelectorProps) {
  const handleChange = (key: keyof ContentOptions, checked: boolean) => {
    onChange({ ...value, [key]: checked });
  };

  // Calculate currently selected tokens
  const selectedTokens =
    (value.includePrompts ? tokenCounts.prompts : 0) +
    (value.includeResponses ? tokenCounts.responses : 0) +
    (value.includeThinking ? tokenCounts.thinking : 0) +
    (value.includeTools ? tokenCounts.tools : 0) +
    tokenCounts.systemPrompt;

  const showThinkingWarning =
    value.includeThinking && tokenCounts.thinking > THINKING_WARNING_THRESHOLD;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {/* User Prompts - Always checked, disabled */}
        <ContentOption
          id="prompts"
          label="User prompts"
          tokens={tokenCounts.prompts}
          checked={value.includePrompts}
          onChange={(checked) => handleChange("includePrompts", checked)}
          disabled={true} // Always included
        />

        {/* AI Responses */}
        <ContentOption
          id="responses"
          label="AI responses"
          tokens={tokenCounts.responses}
          checked={value.includeResponses}
          onChange={(checked) => handleChange("includeResponses", checked)}
          disabled={disabled}
        />

        {/* Thinking Blocks */}
        <ContentOption
          id="thinking"
          label="Thinking blocks"
          tokens={tokenCounts.thinking}
          checked={value.includeThinking}
          onChange={(checked) => handleChange("includeThinking", checked)}
          disabled={disabled}
          warning={
            tokenCounts.thinking > THINKING_WARNING_THRESHOLD
              ? "Large thinking content"
              : undefined
          }
        />

        {/* Tool Calls */}
        <ContentOption
          id="tools"
          label="Tool calls (summary)"
          tokens={tokenCounts.tools}
          checked={value.includeTools}
          onChange={(checked) => handleChange("includeTools", checked)}
          disabled={disabled}
        />
      </div>

      {/* Total Tokens Display */}
      <div className="flex items-center justify-between pt-2 border-t">
        <span className="text-sm text-muted-foreground">Total tokens</span>
        <span className="text-sm font-medium">{formatTokens(selectedTokens)}</span>
      </div>

      {/* Thinking Warning */}
      {showThinkingWarning && (
        <Alert variant="default" className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
            Thinking content is {formatTokens(tokenCounts.thinking)} tokens.
            This may increase analysis cost significantly.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

interface ContentOptionProps {
  id: string;
  label: string;
  tokens: number;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  warning?: string;
}

function ContentOption({
  id,
  label,
  tokens,
  checked,
  onChange,
  disabled = false,
  warning,
}: ContentOptionProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(checked) => onChange(checked === true)}
          disabled={disabled}
        />
        <Label
          htmlFor={id}
          className={cn(
            "text-sm cursor-pointer",
            disabled && "opacity-70 cursor-not-allowed"
          )}
        >
          {label}
        </Label>
        {warning && (
          <span title={warning}>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          </span>
        )}
      </div>
      <span className="text-xs text-muted-foreground">
        {formatTokens(tokens)}
      </span>
    </div>
  );
}
