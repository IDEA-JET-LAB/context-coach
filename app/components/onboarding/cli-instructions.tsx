'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { showToast } from '@/components/feedback';
import { useInstallToken } from '@/lib/hooks/use-install-token';

interface CliInstructionsProps {
  projectId?: string;
}

export function CliInstructions({ projectId }: CliInstructionsProps) {
  const [copied, setCopied] = useState(false);
  const { data, isPending, error } = useInstallToken(projectId);

  const token = data?.token;
  const command = token ? `npx @contextor/cli init "${token}"` : null;

  const copyCommand = async () => {
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      showToast.success('Command copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast.error('Failed to copy command');
    }
  };

  // Handle error state
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">
              Unable to generate install token
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {error.message}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground mb-3">
        Run this command in your project directory:
      </p>

      <div className="flex items-center gap-2 rounded-md bg-background p-3 font-mono text-sm">
        {isPending ? (
          <div className="h-5 w-full animate-pulse rounded bg-muted" />
        ) : command ? (
          <>
            <code className="flex-1 text-teal-500 overflow-x-auto">
              {command}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyCommand}
              className="shrink-0"
              aria-label={copied ? 'Copied' : 'Copy command to clipboard'}
            >
              {copied ? (
                <Check className="h-4 w-4 text-teal-500" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </>
        ) : (
          <span className="text-muted-foreground">Loading...</span>
        )}
      </div>

      {data?.expiresAt && (
        <p className="mt-2 text-xs text-muted-foreground">
          Token expires at {new Date(data.expiresAt).toLocaleTimeString()}
        </p>
      )}

      <a
        href="https://docs.contextor.com/cli"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        View full documentation
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </a>
    </div>
  );
}
