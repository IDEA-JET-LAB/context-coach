'use client';

import { useState, useCallback } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface InstallCliModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installToken?: string;
}

export function InstallCliModal({
  open,
  onOpenChange,
  installToken,
}: InstallCliModalProps) {
  const [copied, setCopied] = useState(false);

  const installCommand = `npx @contextor/cli init ${installToken || '<YOUR_INSTALL_TOKEN>'}`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(installCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers/environments where clipboard API fails
      console.error('Failed to copy to clipboard');
    }
  }, [installCommand]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Terminal className="h-5 w-5" />
            Install Contextor CLI
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Run this command in your project directory to start capturing
            prompts.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <div className="relative">
            <pre
              className="p-4 bg-background rounded-lg text-sm text-foreground overflow-x-auto"
              data-testid="install-command"
            >
              <code>{installCommand}</code>
            </pre>
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2"
              onClick={handleCopy}
              aria-label={copied ? 'Copied!' : 'Copy command'}
            >
              {copied ? (
                <Check className="h-4 w-4 text-teal-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            After running this command, your prompts will automatically appear
            in your dashboard.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
