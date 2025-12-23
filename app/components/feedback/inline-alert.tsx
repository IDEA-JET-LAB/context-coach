'use client';

import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X, LucideIcon } from 'lucide-react';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface InlineAlertProps {
  /** Alert variant */
  variant: AlertVariant;
  /** Alert title */
  title?: string;
  /** Alert message */
  message: string;
  /** Whether the alert is dismissible */
  dismissible?: boolean;
  /** Dismiss handler */
  onDismiss?: () => void;
  /** Optional action */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Additional class names */
  className?: string;
}

const variantConfig: Record<
  AlertVariant,
  { icon: LucideIcon; bgColor: string; borderColor: string; textColor: string; iconColor: string }
> = {
  info: {
    icon: Info,
    bgColor: 'bg-info/10',
    borderColor: 'border-info/20',
    textColor: 'text-foreground',
    iconColor: 'text-info',
  },
  success: {
    icon: CheckCircle,
    bgColor: 'bg-score-high/10',
    borderColor: 'border-score-high/20',
    textColor: 'text-foreground',
    iconColor: 'text-score-high',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-score-medium/10',
    borderColor: 'border-score-medium/20',
    textColor: 'text-foreground',
    iconColor: 'text-score-medium',
  },
  error: {
    icon: AlertCircle,
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/20',
    textColor: 'text-foreground',
    iconColor: 'text-destructive',
  },
};

export function InlineAlert({
  variant,
  title,
  message,
  dismissible = false,
  onDismiss,
  action,
  className,
}: InlineAlertProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        config.bgColor,
        config.borderColor,
        className
      )}
      role="alert"
      data-testid="inline-alert"
      data-variant={variant}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', config.iconColor)} />
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className={cn('font-semibold', config.textColor)}>{title}</h4>
          )}
          <p className={cn('text-sm', title ? 'mt-1 text-muted-foreground' : config.textColor)}>
            {message}
          </p>
          {action && (
            <button
              onClick={action.onClick}
              className={cn('mt-2 text-sm font-medium hover:underline', config.iconColor)}
            >
              {action.label}
            </button>
          )}
        </div>
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
