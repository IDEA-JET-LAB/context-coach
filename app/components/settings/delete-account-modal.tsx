'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { deleteAccount } from '@/lib/api/account';

interface DeleteAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
}

export function DeleteAccountModal({
  open,
  onOpenChange,
  userEmail,
}: DeleteAccountModalProps) {
  const [confirmEmail, setConfirmEmail] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmailMatch = confirmEmail === userEmail;

  async function handleDelete() {
    if (!isEmailMatch) return;

    setIsDeleting(true);
    setError(null);

    try {
      const result = await deleteAccount(confirmEmail);

      if (!result.success) {
        setError(result.error?.message || 'Failed to delete account');
        setIsDeleting(false);
        return;
      }

      // Sign out the user (session is already invalid but clear local state)
      const supabase = createClient();
      await supabase.auth.signOut();

      // Use window.location for a full page redirect to ensure it happens
      // after signOut completes and bypasses any middleware redirects
      window.location.href = '/?account_deleted=true';
    } catch (err) {
      console.error('[DeleteAccountModal] Unexpected error:', err);
      setError('An unexpected error occurred. Please try again.');
      setIsDeleting(false);
    }
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isDeleting) {
      onOpenChange(isOpen);
      if (!isOpen) {
        // Reset state when closing
        setConfirmEmail('');
        setError(null);
      }
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent data-testid="delete-account-modal">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2 text-left">
            This action cannot be undone. This will permanently delete your account and remove all your data including:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="list-disc pl-6 text-sm text-muted-foreground space-y-1">
          <li>Your profile and settings</li>
          <li>All your captured prompts and analysis</li>
          <li>Your membership in all teams</li>
        </ul>

        <div className="space-y-4 pt-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="confirm-email">
              Type <span className="font-semibold">{userEmail}</span> to confirm
            </Label>
            <Input
              id="confirm-email"
              type="email"
              placeholder="Enter your email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              disabled={isDeleting}
              data-testid="confirm-email-input"
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isEmailMatch || isDeleting}
            data-testid="confirm-delete-button"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Account'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
