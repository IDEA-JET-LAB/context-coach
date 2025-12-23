'use client';

/**
 * Pattern Conflict Warning Component
 * Story 22-2: Classification Rule Editor - Task 13
 *
 * Displays warnings when a pattern overlaps with existing rules.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import type { PatternConflict } from '@/lib/types/classification-rules';

interface PatternConflictWarningProps {
  pattern: string;
  categoryId: string;
  excludeRuleId?: string;
}

export function PatternConflictWarning({
  pattern,
  categoryId,
  excludeRuleId,
}: PatternConflictWarningProps) {
  const [conflicts, setConflicts] = useState<PatternConflict[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Check for conflicts when pattern or category changes
  useEffect(() => {
    if (!pattern || !categoryId) {
      setConflicts([]);
      return;
    }

    // Validate pattern first
    try {
      new RegExp(pattern);
    } catch {
      setConflicts([]);
      return;
    }

    const timer = setTimeout(() => {
      checkConflicts();
    }, 500);

    return () => clearTimeout(timer);
  }, [pattern, categoryId, excludeRuleId]);

  const checkConflicts = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/classification-rules/conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern,
          categoryId,
          excludeRuleId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setConflicts(data.conflicts || []);
      }
    } catch (error) {
      console.error('Failed to check conflicts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking for conflicts...
      </div>
    );
  }

  if (conflicts.length === 0) {
    return null;
  }

  const hasErrors = conflicts.some((c) => c.severity === 'error');
  const hasWarnings = conflicts.some((c) => c.severity === 'warning');

  return (
    <Card
      className={cn(
        'border',
        hasErrors
          ? 'border-status-error/50 bg-status-error-subtle'
          : hasWarnings
          ? 'border-status-warning/50 bg-status-warning-subtle'
          : 'border-status-info/50 bg-status-info-subtle'
      )}
    >
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle
              className={cn(
                'h-4 w-4',
                hasErrors ? 'text-status-error' : hasWarnings ? 'text-status-warning' : 'text-status-info'
              )}
            />
            {conflicts.length} pattern conflict{conflicts.length > 1 ? 's' : ''} detected
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 space-y-3">
          {conflicts.map((conflict) => (
            <ConflictItem key={conflict.ruleId} conflict={conflict} />
          ))}

          <p className="text-xs text-muted-foreground pt-2">
            <Info className="h-3 w-3 inline mr-1" />
            Conflicting patterns may match the same prompts. Consider adjusting priorities
            or making patterns more specific.
          </p>
        </CardContent>
      )}
    </Card>
  );
}

// ============================================================================
// Conflict Item Component
// ============================================================================

interface ConflictItemProps {
  conflict: PatternConflict;
}

function ConflictItem({ conflict }: ConflictItemProps) {
  return (
    <div className="p-3 rounded bg-surface-primary/50 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <SeverityBadge severity={conflict.severity} />
          <Link
            href={`/admin/analysis/rules/${conflict.ruleId}`}
            className="font-medium text-content-accent hover:underline truncate"
          >
            {conflict.ruleName}
          </Link>
        </div>
        <OverlapBadge type={conflict.overlapType} />
      </div>

      <p className="text-xs font-mono text-muted-foreground truncate">
        {conflict.pattern}
      </p>

      {conflict.sampleMatches.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Sample matches:</p>
          <div className="flex flex-wrap gap-1">
            {conflict.sampleMatches.map((sample, i) => (
              <span
                key={i}
                className="text-xs bg-surface-tertiary px-2 py-0.5 rounded font-mono"
              >
                "{sample.length > 40 ? sample.substring(0, 40) + '...' : sample}"
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helper Badges
// ============================================================================

function SeverityBadge({ severity }: { severity: 'info' | 'warning' | 'error' }) {
  const config = {
    info: { label: 'Info', className: 'bg-status-info-subtle text-status-info' },
    warning: { label: 'Warning', className: 'bg-status-warning-subtle text-status-warning' },
    error: { label: 'Conflict', className: 'bg-status-error-subtle text-status-error' },
  };

  return (
    <Badge variant="outline" className={cn('text-xs', config[severity].className)}>
      {config[severity].label}
    </Badge>
  );
}

function OverlapBadge({ type }: { type: 'subset' | 'superset' | 'partial' }) {
  const config = {
    subset: { label: 'Subset', title: 'New pattern matches subset of existing' },
    superset: { label: 'Superset', title: 'New pattern matches superset of existing' },
    partial: { label: 'Partial overlap', title: 'Patterns partially overlap' },
  };

  return (
    <Badge variant="secondary" className="text-xs" title={config[type].title}>
      {config[type].label}
    </Badge>
  );
}
