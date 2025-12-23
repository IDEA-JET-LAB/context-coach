'use client';

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
import { AlertTriangle, RotateCcw, Loader2 } from 'lucide-react';

interface RollbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promptCount: number;
  onConfirm: () => void;
  loading?: boolean;
}

export function RollbackDialog({
  open,
  onOpenChange,
  promptCount,
  onConfirm,
  loading = false,
}: RollbackDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="rollback-dialog">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle className="text-foreground">Rollback Import?</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-2">
              <p>
                This will permanently delete{' '}
                <strong className="text-foreground">{promptCount.toLocaleString()} prompts</strong> that were
                imported, along with their analyses.
              </p>
              <p className="text-destructive font-medium">
                This action cannot be undone.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4" />
                Delete {promptCount.toLocaleString()} Prompts
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
