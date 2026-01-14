"use client";

/**
 * AnalysisInput - Story 30-7: Interactive Chat Interface
 *
 * Textarea and submit button for asking questions about the conversation.
 */

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";

interface AnalysisInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function AnalysisInput({
  value,
  onChange,
  onSubmit,
  isLoading = false,
  disabled = false,
}: AnalysisInputProps) {
  const canSubmit = value.trim().length > 0 && !isLoading && !disabled;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask a question about this conversation..."
        disabled={isLoading || disabled}
        className="min-h-[80px] resize-none"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Press {navigator?.platform?.includes("Mac") ? "Cmd" : "Ctrl"}+Enter to submit
        </span>
        <Button
          onClick={onSubmit}
          disabled={!canSubmit}
          size="sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Analyze
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
