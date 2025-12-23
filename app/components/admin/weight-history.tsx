'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { History, RotateCcw, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import type { WeightHistoryEntry } from '@/lib/types/scoring-weights';
import { formatDistanceToNow } from 'date-fns';

export interface WeightHistoryProps {
  history: WeightHistoryEntry[];
  onRevert?: (historyEntryId: string) => Promise<{ success: boolean; error?: string }>;
  isReverting?: boolean;
}

export function WeightHistory({ history, onRevert, isReverting = false }: WeightHistoryProps) {
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [revertEntryId, setRevertEntryId] = useState<string | null>(null);

  const handleRevert = async () => {
    if (!revertEntryId || !onRevert) return;

    await onRevert(revertEntryId);
    setRevertEntryId(null);
  };

  if (history.length === 0) {
    return (
      <Card className="border-border bg-background" data-testid="weight-history-empty">
        <CardContent className="py-8 text-center">
          <History className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No weight changes recorded yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border bg-background" data-testid="weight-history">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Change History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.map((entry) => {
            const isExpanded = expandedEntry === entry.id;

            return (
              <div
                key={entry.id}
                className="border border-border rounded-lg overflow-hidden"
                data-testid={`history-entry-${entry.id}`}
              >
                {/* Header */}
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                  data-testid={`history-toggle-${entry.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">
                        {entry.changes.length} dimension{entry.changes.length !== 1 ? 's' : ''} updated
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                        {entry.admin_email && ` by ${entry.admin_email}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      Total: {entry.total_weight}%
                    </Badge>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border p-3 bg-muted/20">
                    <div className="space-y-2 mb-3">
                      {entry.changes.map((change, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-sm"
                          data-testid={`history-change-${entry.id}-${idx}`}
                        >
                          <span className="font-medium text-foreground">{change.dimension_name}</span>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'font-mono',
                                change.new_weight > change.old_weight
                                  ? 'text-score-high'
                                  : change.new_weight < change.old_weight
                                    ? 'text-score-growth'
                                    : 'text-muted-foreground'
                              )}
                            >
                              {change.old_weight}%
                            </span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <span
                              className={cn(
                                'font-mono font-medium',
                                change.new_weight > change.old_weight
                                  ? 'text-score-high'
                                  : change.new_weight < change.old_weight
                                    ? 'text-score-growth'
                                    : 'text-muted-foreground'
                              )}
                            >
                              {change.new_weight}%
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({change.new_weight > change.old_weight ? '+' : ''}
                              {change.new_weight - change.old_weight})
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {onRevert && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRevertEntryId(entry.id)}
                        disabled={isReverting}
                        className="w-full"
                        data-testid={`revert-button-${entry.id}`}
                      >
                        <RotateCcw className="mr-2 h-3.5 w-3.5" />
                        Revert to Before This Change
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Revert Confirmation Dialog */}
      <AlertDialog open={!!revertEntryId} onOpenChange={(open) => !open && setRevertEntryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert Weight Configuration</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the weights to their values before this change was made. Are you
              sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReverting} data-testid="revert-cancel">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevert}
              disabled={isReverting}
              data-testid="revert-confirm"
            >
              {isReverting ? 'Reverting...' : 'Revert Weights'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
