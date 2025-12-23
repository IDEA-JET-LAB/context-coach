'use client';

import { toast } from 'sonner';
import { CheckCircle, AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';

/**
 * Toast utility functions with consistent styling
 * Uses sonner under the hood with custom icons
 */
export const showToast = {
  /**
   * Show a success toast
   */
  success: (message: string, options?: { description?: string; duration?: number }) => {
    toast.success(message, {
      icon: <CheckCircle className="h-4 w-4 text-score-high" />,
      description: options?.description,
      duration: options?.duration ?? 4000,
    });
  },

  /**
   * Show an error toast
   */
  error: (message: string, options?: { description?: string; duration?: number }) => {
    toast.error(message, {
      icon: <AlertCircle className="h-4 w-4 text-destructive" />,
      description: options?.description,
      duration: options?.duration ?? 5000,
    });
  },

  /**
   * Show a warning toast
   */
  warning: (message: string, options?: { description?: string; duration?: number }) => {
    toast.warning(message, {
      icon: <AlertTriangle className="h-4 w-4 text-score-medium" />,
      description: options?.description,
      duration: options?.duration ?? 4000,
    });
  },

  /**
   * Show an info toast
   */
  info: (message: string, options?: { description?: string; duration?: number }) => {
    toast.info(message, {
      icon: <Info className="h-4 w-4 text-info" />,
      description: options?.description,
      duration: options?.duration ?? 4000,
    });
  },

  /**
   * Show a loading toast that can be updated
   */
  loading: (message: string, options?: { description?: string }) => {
    return toast.loading(message, {
      icon: <Loader2 className="h-4 w-4 text-primary animate-spin" />,
      description: options?.description,
    });
  },

  /**
   * Show a promise toast that updates based on promise state
   */
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: unknown) => string);
    }
  ) => {
    return toast.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
    });
  },

  /**
   * Show a toast with an action button
   */
  action: (
    message: string,
    action: { label: string; onClick: () => void },
    options?: { description?: string; duration?: number }
  ) => {
    toast(message, {
      description: options?.description,
      duration: options?.duration ?? 5000,
      action: {
        label: action.label,
        onClick: action.onClick,
      },
    });
  },

  /**
   * Dismiss a specific toast or all toasts
   */
  dismiss: (toastId?: string | number) => {
    toast.dismiss(toastId);
  },
};

// Re-export for use in components
export { toast };
