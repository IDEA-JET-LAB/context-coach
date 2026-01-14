"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, Code, Terminal, FileText, Braces } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  segmentContent,
  ContentSegment,
  getPastedContentPreview,
} from "@/lib/utils/pasted-content-detector";

interface CollapsiblePastedContentProps {
  content: string;
  className?: string;
}

/**
 * CollapsiblePastedContent - Renders user prompt with collapsible pasted sections
 *
 * Automatically detects and collapses:
 * - Code blocks
 * - Terminal/log output
 * - Session continuation summaries
 * - Build output
 * - JSON data
 */
export function CollapsiblePastedContent({
  content,
  className,
}: CollapsiblePastedContentProps) {
  const segmented = useMemo(() => segmentContent(content), [content]);

  // If no pasted content detected, render plain text
  if (!segmented.hasPastedContent) {
    return (
      <p className={cn("text-sm text-foreground whitespace-pre-wrap break-words", className)}>
        {content}
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {segmented.segments.map((segment, index) => (
        <SegmentRenderer key={index} segment={segment} />
      ))}
    </div>
  );
}

/**
 * SegmentRenderer - Renders a single content segment
 */
function SegmentRenderer({ segment }: { segment: ContentSegment }) {
  if (segment.type === "text") {
    return (
      <p className="text-sm text-foreground whitespace-pre-wrap break-words">
        {segment.content}
      </p>
    );
  }

  return <CollapsibleSegment segment={segment} />;
}

/**
 * CollapsibleSegment - A collapsible block for pasted content
 */
function CollapsibleSegment({ segment }: { segment: ContentSegment }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const Icon = getIconForType(segment.pastedType);
  const preview = useMemo(
    () => getPastedContentPreview(segment.content, 100),
    [segment.content]
  );

  // Format char count for display
  const charCountLabel = segment.charCount > 1000
    ? `${(segment.charCount / 1000).toFixed(1)}k chars`
    : `${segment.charCount} chars`;

  return (
    <div className="border border-border/60 rounded-md bg-muted/20 overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 text-left transition-colors",
          "hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset"
        )}
        aria-expanded={isExpanded}
      >
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-muted-foreground">
          {segment.label}
        </span>
        <span className="text-[10px] text-muted-foreground/70">
          ({charCountLabel})
        </span>
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          {isExpanded ? (
            <>
              <span className="text-[10px]">Collapse</span>
              <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              <span className="text-[10px]">Expand</span>
              <ChevronDown className="h-3 w-3" />
            </>
          )}
        </div>
      </button>

      {/* Preview when collapsed */}
      {!isExpanded && (
        <div className="px-3 pb-2">
          <p className="text-xs text-muted-foreground font-mono truncate">
            {preview}
          </p>
        </div>
      )}

      {/* Full content when expanded */}
      {isExpanded && (
        <div className="border-t border-border/40">
          <div className="max-h-[400px] overflow-auto">
            <pre
              className={cn(
                "px-3 py-2 text-xs text-foreground/90 whitespace-pre-wrap break-words",
                segment.pastedType === "code_block" && "font-mono bg-muted/30"
              )}
            >
              {segment.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Get icon for pasted content type
 */
function getIconForType(type: ContentSegment["pastedType"]) {
  switch (type) {
    case "code_block":
      return Code;
    case "terminal_logs":
    case "build_output":
      return Terminal;
    case "json_data":
      return Braces;
    case "session_summary":
    default:
      return FileText;
  }
}

export default CollapsiblePastedContent;
