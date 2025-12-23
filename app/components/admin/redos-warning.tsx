'use client';

/**
 * ReDoS Warning Component
 * Story 22-2: Classification Rule Editor - Task 6
 *
 * Displays ReDoS vulnerability warnings with suggestions.
 */

import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle, Shield, Info } from 'lucide-react';
import type { RedosAnalysis, RedosRisk } from '@/lib/types/classification-rules';

interface RedosWarningProps {
  analysis: RedosAnalysis;
  className?: string;
}

const RISK_CONFIG: Record<
  RedosRisk,
  { icon: React.ElementType; color: string; bgColor: string; label: string }
> = {
  safe: {
    icon: CheckCircle,
    color: 'text-status-success',
    bgColor: 'bg-status-success-subtle',
    label: 'Pattern is safe',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-status-warning',
    bgColor: 'bg-status-warning-subtle',
    label: 'Potential performance issues',
  },
  dangerous: {
    icon: Shield,
    color: 'text-status-error',
    bgColor: 'bg-status-error-subtle',
    label: 'ReDoS vulnerability detected',
  },
};

export function RedosWarning({ analysis, className }: RedosWarningProps) {
  const config = RISK_CONFIG[analysis.risk];
  const Icon = config.icon;

  if (analysis.risk === 'safe' && analysis.issues.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-lg p-4 border',
        config.bgColor,
        analysis.risk === 'dangerous' && 'border-status-error/50',
        analysis.risk === 'warning' && 'border-status-warning/50',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', config.color)} />
        <div className="flex-1 space-y-2">
          <p className={cn('font-medium', config.color)}>{config.label}</p>

          {/* Issues */}
          {analysis.issues.length > 0 && (
            <ul className="text-sm text-foreground space-y-1">
              {analysis.issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-muted-foreground shrink-0">-</span>
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Suggestions */}
          {analysis.suggestions.length > 0 && (
            <div className="pt-2 border-t border-border/50">
              <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Suggestions:
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                {analysis.suggestions.map((suggestion, i) => (
                  <li key={i}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Blocking message for dangerous patterns */}
          {analysis.risk === 'dangerous' && (
            <p className="text-sm font-medium text-status-error pt-2">
              This pattern cannot be saved until the issues are resolved.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Inline badge version for lists
 */
export function RedosRiskBadge({ risk }: { risk: RedosRisk }) {
  const config = RISK_CONFIG[risk];
  const Icon = config.icon;

  if (risk === 'safe') {
    return null;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
        config.bgColor,
        config.color
      )}
    >
      <Icon className="h-3 w-3" />
      {risk === 'warning' ? 'Warning' : 'Dangerous'}
    </span>
  );
}
