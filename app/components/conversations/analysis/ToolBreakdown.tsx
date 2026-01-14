'use client';

/**
 * ToolBreakdown - Story 30-6: Analysis Panel UI
 *
 * A collapsible list showing tool usage statistics,
 * sorted by count with top 4 visible by default.
 */

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { ToolUsage } from '@/lib/analysis/conversation-stats';

interface ToolBreakdownProps {
  /** Array of tool usage data, sorted by count */
  tools: ToolUsage[];
  /** Number of tools to show before collapse (default: 4) */
  initialCount?: number;
  /** Optional className for custom styling */
  className?: string;
}

/**
 * ToolBreakdown
 *
 * Displays tool usage with:
 * - Tool name and usage count
 * - Collapsible list showing top N items by default
 * - "Show more" to expand full list
 */
export function ToolBreakdown({
  tools,
  initialCount = 4,
  className,
}: ToolBreakdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (tools.length === 0) {
    return (
      <div className={cn('text-sm text-muted-foreground', className)}>
        No tools used
      </div>
    );
  }

  const visibleTools = tools.slice(0, initialCount);
  const hiddenTools = tools.slice(initialCount);
  const hasMore = hiddenTools.length > 0;

  return (
    <div className={cn('space-y-1', className)}>
      {/* Always visible tools */}
      {visibleTools.map((tool) => (
        <ToolRow key={tool.name} name={tool.name} count={tool.count} />
      ))}

      {/* Collapsible section for additional tools */}
      {hasMore && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleContent className="space-y-1">
            {hiddenTools.map((tool) => (
              <ToolRow key={tool.name} name={tool.name} count={tool.count} />
            ))}
          </CollapsibleContent>

          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1">
            <ChevronDown
              className={cn(
                'h-3 w-3 transition-transform',
                isOpen && 'rotate-180'
              )}
            />
            {isOpen ? 'Show less' : `Show ${hiddenTools.length} more`}
          </CollapsibleTrigger>
        </Collapsible>
      )}
    </div>
  );
}

/**
 * Individual tool row showing name and count
 */
function ToolRow({ name, count }: { name: string; count: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground truncate max-w-[140px]" title={name}>
        {name}
      </span>
      <span className="font-medium tabular-nums">{count}</span>
    </div>
  );
}

export default ToolBreakdown;
