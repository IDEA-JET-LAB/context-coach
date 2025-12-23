'use client';

import { Check, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { PromptTemplateVariable } from '@/lib/types/prompt-templates';

/**
 * Template Variable Panel
 *
 * Displays available variables for a template type with:
 * - Variable name and description
 * - Required/optional indicator
 * - Example values
 * - Click to insert functionality
 */

interface TemplateVariablePanelProps {
  variables: PromptTemplateVariable[];
  usedVariables: string[];
  onInsert: (variableName: string) => void;
  readOnly?: boolean;
  className?: string;
}

export function TemplateVariablePanel({
  variables,
  usedVariables,
  onInsert,
  readOnly = false,
  className,
}: TemplateVariablePanelProps) {
  return (
    <Card className={cn('border-border bg-background', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          Template Variables
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-xs">
                  Click on a variable to insert it at the cursor position in your
                  template. Variables are replaced with actual values when the
                  template is used.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {variables.length === 0 ? (
          <p className="text-sm text-muted-foreground">No variables available</p>
        ) : (
          variables.map((variable) => {
            const isUsed = usedVariables.includes(variable.name);

            return (
              <button
                key={variable.id}
                type="button"
                onClick={() => !readOnly && onInsert(variable.name)}
                disabled={readOnly}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                  isUsed
                    ? 'border-status-success/50 bg-status-success-subtle'
                    : 'border-border bg-card hover:bg-muted/50',
                  readOnly && 'cursor-default opacity-70'
                )}
                data-testid={`variable-${variable.name}`}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary">
                      {`{{${variable.name}}}`}
                    </code>
                    {variable.required ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Required
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Optional
                      </Badge>
                    )}
                    {isUsed && (
                      <Check className="h-3.5 w-3.5 flex-shrink-0 text-status-success" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{variable.description}</p>
                  {variable.example_value && (
                    <p className="truncate text-[10px] text-muted-foreground/70">
                      Example: {variable.example_value}
                    </p>
                  )}
                </div>
              </button>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Variable Usage Summary
 *
 * Shows a quick summary of variable usage in the template
 */
interface VariableUsageSummaryProps {
  variables: PromptTemplateVariable[];
  usedVariables: string[];
  className?: string;
}

export function VariableUsageSummary({
  variables,
  usedVariables,
  className,
}: VariableUsageSummaryProps) {
  const requiredVars = variables.filter((v) => v.required);
  const usedRequired = requiredVars.filter((v) => usedVariables.includes(v.name));
  const missingRequired = requiredVars.filter((v) => !usedVariables.includes(v.name));

  const usedCount = usedVariables.filter((v) =>
    variables.some((vd) => vd.name === v)
  ).length;

  const unknownVars = usedVariables.filter(
    (v) => !variables.some((vd) => vd.name === v)
  );

  return (
    <div className={cn('flex flex-wrap items-center gap-3 text-xs', className)}>
      {/* Variables used */}
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Used:</span>
        <Badge variant="secondary" className="text-xs">
          {usedCount}/{variables.length}
        </Badge>
      </div>

      {/* Required status */}
      {requiredVars.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Required:</span>
          {missingRequired.length === 0 ? (
            <Badge className="bg-status-success-subtle text-status-success text-xs">
              <Check className="mr-1 h-3 w-3" />
              All included
            </Badge>
          ) : (
            <Badge variant="destructive" className="text-xs">
              Missing {missingRequired.length}
            </Badge>
          )}
        </div>
      )}

      {/* Unknown variables warning */}
      {unknownVars.length > 0 && (
        <div className="flex items-center gap-1.5">
          <Badge className="bg-status-warning-subtle text-status-warning text-xs">
            {unknownVars.length} unknown variable{unknownVars.length > 1 ? 's' : ''}
          </Badge>
        </div>
      )}
    </div>
  );
}
