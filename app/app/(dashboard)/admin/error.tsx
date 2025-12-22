'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

/**
 * Admin Error Boundary
 *
 * Catches and displays errors that occur in admin pages.
 * Provides retry functionality and error details for debugging.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console for debugging
    console.error('[Admin] Error boundary caught:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="max-w-md border-destructive/50 bg-destructive/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Something went wrong</CardTitle>
          </div>
          <CardDescription>
            An error occurred while loading this admin page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error.message && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs font-mono text-muted-foreground">
                {error.message}
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={reset} variant="default" className="flex-1">
              Try again
            </Button>
            <Button
              onClick={() => window.location.href = '/admin'}
              variant="outline"
              className="flex-1"
            >
              Go to admin home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
