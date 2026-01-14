'use client';

/**
 * AgentBreakdown - Story 30-6: Analysis Panel UI
 *
 * A collapsible list showing agent/subagent usage statistics,
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
import type { AgentUsage } from '@/lib/analysis/conversation-stats';

interface AgentBreakdownProps {
  /** Array of agent usage data, sorted by count */
  agents: AgentUsage[];
  /** Number of agents to show before collapse (default: 4) */
  initialCount?: number;
  /** Optional className for custom styling */
  className?: string;
}

/**
 * Formats agent type for display
 * e.g., "general-purpose" -> "General Purpose"
 */
function formatAgentType(type: string): string {
  return type
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * AgentBreakdown
 *
 * Displays agent/subagent usage with:
 * - Agent type and usage count
 * - Collapsible list showing top N items by default
 * - "Show more" to expand full list
 */
export function AgentBreakdown({
  agents,
  initialCount = 4,
  className,
}: AgentBreakdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (agents.length === 0) {
    return (
      <div className={cn('text-sm text-muted-foreground', className)}>
        No subagents used
      </div>
    );
  }

  const visibleAgents = agents.slice(0, initialCount);
  const hiddenAgents = agents.slice(initialCount);
  const hasMore = hiddenAgents.length > 0;

  return (
    <div className={cn('space-y-1', className)}>
      {/* Always visible agents */}
      {visibleAgents.map((agent) => (
        <AgentRow
          key={agent.type}
          type={agent.type}
          count={agent.count}
        />
      ))}

      {/* Collapsible section for additional agents */}
      {hasMore && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleContent className="space-y-1">
            {hiddenAgents.map((agent) => (
              <AgentRow
                key={agent.type}
                type={agent.type}
                count={agent.count}
              />
            ))}
          </CollapsibleContent>

          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1">
            <ChevronDown
              className={cn(
                'h-3 w-3 transition-transform',
                isOpen && 'rotate-180'
              )}
            />
            {isOpen ? 'Show less' : `Show ${hiddenAgents.length} more`}
          </CollapsibleTrigger>
        </Collapsible>
      )}
    </div>
  );
}

/**
 * Individual agent row showing type and count
 */
function AgentRow({ type, count }: { type: string; count: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground truncate max-w-[140px]" title={type}>
        {formatAgentType(type)}
      </span>
      <span className="font-medium tabular-nums">{count}</span>
    </div>
  );
}

export default AgentBreakdown;
