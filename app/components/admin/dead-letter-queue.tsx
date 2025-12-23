'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { RefreshCw, X, AlertCircle, RotateCcw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { showToast } from '@/components/feedback';
import { retryAnalysis, bulkRetryAnalysis } from '@/lib/api/admin/retry-analysis';
import { dismissFailedAnalysis } from '@/lib/api/admin/dismiss-failed-analysis';
import type { DeadLetterQueueResponse } from '@/lib/db/queries/system-metrics';

interface DeadLetterQueueProps {
  data: DeadLetterQueueResponse;
  onRefresh: () => void;
}

export function DeadLetterQueue({ data, onRefresh }: DeadLetterQueueProps) {
  const { items, total } = data;
  const [isPending, startTransition] = useTransition();
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const handleRetry = async (promptId: string) => {
    setActionInProgress(promptId);
    startTransition(async () => {
      const result = await retryAnalysis(promptId);
      if (result.success) {
        showToast.success('Analysis queued for retry');
        onRefresh();
      } else {
        showToast.error(result.error || 'Failed to retry analysis');
      }
      setActionInProgress(null);
    });
  };

  const handleDismiss = async (promptId: string) => {
    setActionInProgress(promptId);
    startTransition(async () => {
      const result = await dismissFailedAnalysis(promptId);
      if (result.success) {
        showToast.success('Failed analysis dismissed');
        onRefresh();
      } else {
        showToast.error(result.error || 'Failed to dismiss analysis');
      }
      setActionInProgress(null);
    });
  };

  const handleBulkRetry = async () => {
    startTransition(async () => {
      const result = await bulkRetryAnalysis();
      if (result.success) {
        showToast.success(`${result.count} analyses queued for retry`);
        onRefresh();
      } else {
        showToast.error(result.error || 'Failed to bulk retry analyses');
      }
    });
  };

  return (
    <Card className="bg-background border-border">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
            <span>Dead Letter Queue</span>
            {total > 0 && (
              <Badge variant="destructive" className="font-mono">
                {total}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {total > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" aria-hidden="true" />
                    Retry All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Retry all failed analyses?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will reset {Math.min(total, 100)} failed prompts and queue them for analysis.
                      {total > 100 && ` (Processing first 100 of ${total} total)`}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkRetry}>
                      Retry All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isPending}
            >
              <RefreshCw
                className={`h-4 w-4 mr-1 ${isPending ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              Refresh
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
            <p>No failed analyses. System is healthy!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table data-testid="dead-letter-table">
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">Prompt</TableHead>
                  <TableHead className="text-muted-foreground">Attempts</TableHead>
                  <TableHead className="text-muted-foreground">Failed</TableHead>
                  <TableHead className="text-muted-foreground">Error</TableHead>
                  <TableHead className="text-right text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.id}
                    className="border-border hover:bg-card"
                    tabIndex={0}
                  >
                    <TableCell className="max-w-xs">
                      <span
                        className="truncate block text-foreground"
                        title={item.text}
                      >
                        {item.text.length > 50
                          ? `${item.text.substring(0, 50)}...`
                          : item.text}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {item.analysis_attempts}/3
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(item.updated_at), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <span
                        className="truncate block text-red-500 text-sm"
                        title={item.last_analysis_error ?? ''}
                      >
                        {item.last_analysis_error ?? 'Unknown error'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetry(item.id)}
                          disabled={isPending && actionInProgress === item.id}
                        >
                          <RefreshCw
                            className={`h-3 w-3 mr-1 ${
                              actionInProgress === item.id ? 'animate-spin' : ''
                            }`}
                            aria-hidden="true"
                          />
                          Retry
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isPending && actionInProgress === item.id}
                              className="text-muted-foreground hover:text-red-500"
                            >
                              <X className="h-3 w-3" aria-hidden="true" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Dismiss failed analysis?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove this prompt from the
                                dead letter queue. The prompt data will be kept but
                                marked as dismissed.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDismiss(item.id)}
                                className="bg-red-500 hover:bg-red-600"
                              >
                                Dismiss
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
