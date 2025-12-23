'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useInstallToken } from '@/lib/hooks/use-install-token';

interface CliInstructionsProps {
  projectId?: string;
}

export function CliInstructions({ projectId }: CliInstructionsProps) {
  const [copied, setCopied] = useState(false);
  const { data: token, isPending } = useInstallToken(projectId);

  const command = `npx @contextor/cli init ${token ?? '<YOUR_TOKEN>'}`;

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      toast.success('Command copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy command');
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground mb-3">
        Run this command in your project directory:
      </p>

      <div className="flex items-center gap-2 rounded-md bg-background p-3 font-mono text-sm">
        {isPending ? (
          <div className="h-5 w-full animate-pulse rounded bg-muted" />
        ) : (
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
        )}
      </div>

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
