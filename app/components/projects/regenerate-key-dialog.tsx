'use client';

import { useState, useCallback } from 'react';
import { AlertTriangle, Copy, Check, Loader2, Key } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { useRegenerateKey } from '@/lib/hooks/use-regenerate-key';
import { toast } from 'sonner';

interface RegenerateKeyDialogProps {
  projectId: string;
}

type DialogState = 'closed' | 'confirm' | 'success';

export function RegenerateKeyDialog({ projectId }: RegenerateKeyDialogProps) {
  const [dialogState, setDialogState] = useState<DialogState>('closed');
  const [newKeyData, setNewKeyData] = useState<{
    apiKey: string;
    installToken: string;
  } | null>(null);
  const [copied, setCopied] = useState<'key' | 'token' | null>(null);

  const { mutate: regenerateKey, isPending } = useRegenerateKey({
    onSuccess: (data) => {
      setNewKeyData({ apiKey: data.apiKey, installToken: data.installToken });
      setDialogState('success');
    },
    onError: () => {
      toast.error('Failed to regenerate API key. Please try again.');
      setDialogState('closed');
    },
  });

  const handleCopy = useCallback(async (text: string, type: 'key' | 'token') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      toast.success(`${type === 'key' ? 'API Key' : 'Install Token'} copied to clipboard`);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback for browsers/environments where clipboard API fails
      toast.error('Failed to copy. Please select and copy manually.');
    }
  }, []);

  const handleClose = useCallback(() => {
    setDialogState('closed');
    setNewKeyData(null);
    setCopied(null);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      setDialogState('confirm');
    } else {
      handleClose();
    }
  }, [handleClose]);

  const handleRegenerate = useCallback(() => {
    regenerateKey({ projectId });
  }, [regenerateKey, projectId]);

  const isOpen = dialogState !== 'closed';

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">
          <Key className="h-4 w-4 mr-2" />
          Regenerate API Key
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        aria-labelledby="regen-dialog-title"
        aria-describedby="regen-dialog-description"
      >
        {dialogState === 'success' && newKeyData ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle id="regen-dialog-title" className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" aria-hidden="true" />
                New API Key Generated
              </AlertDialogTitle>
              <AlertDialogDescription id="regen-dialog-description">
                <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                  Save your API key now - it will not be shown again.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium" htmlFor="api-key-display">
                  API Key
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <code
                    id="api-key-display"
                    className="flex-1 p-2 bg-muted rounded text-sm break-all font-mono"
                  >
                    {newKeyData.apiKey}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleCopy(newKeyData.apiKey, 'key')}
                    aria-label="Copy API key"
                  >
                    {copied === 'key' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium" htmlFor="install-token-display">
                  Install Token
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <code
                    id="install-token-display"
                    className="flex-1 p-2 bg-muted rounded text-xs break-all font-mono max-h-24 overflow-y-auto"
                  >
                    {newKeyData.installToken}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleCopy(newKeyData.installToken, 'token')}
                    aria-label="Copy install token"
                  >
                    {copied === 'token' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogAction onClick={handleClose}>
                I have saved my key
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle
                id="regen-dialog-title"
                className="flex items-center gap-2"
              >
                <AlertTriangle className="h-5 w-5 text-yellow-500" aria-hidden="true" />
                Regenerate API Key
              </AlertDialogTitle>
              <AlertDialogDescription id="regen-dialog-description">
                This will immediately invalidate the current API key. Any CLI
                installations using the old key will stop working until updated
                with the new key.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRegenerate} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                    Regenerating...
                  </>
                ) : (
                  'Regenerate Key'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
