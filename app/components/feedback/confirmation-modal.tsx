'use client';

import { cn } from '@/lib/utils';
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
import { AlertTriangle, Trash2, LogOut, RefreshCw, LucideIcon } from 'lucide-react';

export type ConfirmationVariant = 'destructive' | 'warning' | 'info';

export interface ConfirmationModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Close handler */
  onOpenChange: (open: boolean) => void;
  /** Modal title */
  title: string;
  /** Modal description */
  description: string;
  /** Confirm button text */
  confirmLabel?: string;
  /** Cancel button text */
  cancelLabel?: string;
  /** Confirm handler */
  onConfirm: () => void;
  /** Whether confirm action is in progress */
  loading?: boolean;
  /** Visual variant */
  variant?: ConfirmationVariant;
  /** Custom icon */
  icon?: LucideIcon;
}

const variantConfig: Record<ConfirmationVariant, { icon: LucideIcon; buttonClass: string }> = {
  destructive: {
    icon: Trash2,
    buttonClass: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  },
  warning: {
    icon: AlertTriangle,
    buttonClass: 'bg-score-medium text-white hover:bg-score-medium/90',
  },
  info: {
    icon: RefreshCw,
    buttonClass: 'bg-primary text-primary-foreground hover:bg-primary/90',
  },
};

export function ConfirmationModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  loading = false,
  variant = 'destructive',
  icon,
}: ConfirmationModalProps) {
  const config = variantConfig[variant];
  const Icon = icon || config.icon;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="confirmation-modal">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full',
                variant === 'destructive' && 'bg-destructive/10',
                variant === 'warning' && 'bg-score-medium/10',
                variant === 'info' && 'bg-primary/10'
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5',
                  variant === 'destructive' && 'text-destructive',
                  variant === 'warning' && 'text-score-medium',
                  variant === 'info' && 'text-primary'
                )}
              />
            </div>
            <AlertDialogTitle className="text-foreground">{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className={config.buttonClass}
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
