'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { disableUser, enableUser, deleteUser } from '@/lib/services/admin-users';
import { Ban, CheckCircle, Trash2, AlertTriangle } from 'lucide-react';

interface UserActionsProps {
  userId: string;
  userEmail: string;
  isDisabled: boolean;
  isSuperAdmin: boolean;
}

export function UserActions({
  userId,
  userEmail,
  isDisabled,
  isSuperAdmin,
}: UserActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Can't modify super admin accounts (for safety)
  if (isSuperAdmin) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Super admin accounts cannot be modified from this interface.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isDisabled ? (
        <EnableAccountDialog
          userId={userId}
          isPending={isPending}
          startTransition={startTransition}
        />
      ) : (
        <DisableAccountDialog
          userId={userId}
          isPending={isPending}
          startTransition={startTransition}
        />
      )}

      <DeleteAccountDialog
        userId={userId}
        userEmail={userEmail}
        isPending={isPending}
        startTransition={startTransition}
        onSuccess={() => router.push('/admin/users')}
      />
    </div>
  );
}

// Disable Account Dialog
function DisableAccountDialog({
  userId,
  isPending,
  startTransition,
}: {
  userId: string;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [open, setOpen] = useState(false);

  async function handleDisable() {
    startTransition(async () => {
      const result = await disableUser(userId);
      if (result.error) {
        toast.error(result.error.message);
      } else {
        toast.success('Account disabled successfully');
        setOpen(false);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          data-testid="disable-account-btn"
          variant="outline"
          className="w-full justify-start text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
        >
          <Ban className="mr-2 h-4 w-4" />
          Disable Account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent data-testid="disable-account-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Disable User Account
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will prevent the user from logging in. Their data will be preserved
            but inaccessible. You can re-enable the account later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            data-testid="confirm-disable-btn"
            onClick={handleDisable}
            disabled={isPending}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isPending ? 'Disabling...' : 'Disable Account'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Enable Account Dialog
function EnableAccountDialog({
  userId,
  isPending,
  startTransition,
}: {
  userId: string;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [open, setOpen] = useState(false);

  async function handleEnable() {
    startTransition(async () => {
      const result = await enableUser(userId);
      if (result.error) {
        toast.error(result.error.message);
      } else {
        toast.success('Account enabled successfully');
        setOpen(false);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          data-testid="enable-account-btn"
          variant="outline"
          className="w-full justify-start text-green-500 border-green-500/30 hover:bg-green-500/10"
        >
          <CheckCircle className="mr-2 h-4 w-4" />
          Enable Account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent data-testid="enable-account-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Enable User Account
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will restore the user&apos;s ability to log in and access their data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            data-testid="confirm-enable-btn"
            onClick={handleEnable}
            disabled={isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {isPending ? 'Enabling...' : 'Enable Account'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Delete Account Dialog
function DeleteAccountDialog({
  userId,
  userEmail,
  isPending,
  startTransition,
  onSuccess,
}: {
  userId: string;
  userEmail: string;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');

  const isConfirmed = confirmEmail === userEmail;

  async function handleDelete() {
    startTransition(async () => {
      const result = await deleteUser(userId, confirmEmail);
      if (result.error) {
        toast.error(result.error.message);
      } else {
        toast.success('Account deleted successfully');
        setOpen(false);
        onSuccess();
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        setConfirmEmail('');
      }
    }}>
      <AlertDialogTrigger asChild>
        <Button
          data-testid="delete-account-btn"
          variant="outline"
          className="w-full justify-start text-red-500 border-red-500/30 hover:bg-red-500/10"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent data-testid="delete-account-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete User Account
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The user&apos;s account will be permanently
            deleted and their personal data will be anonymized.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-2">
            Type <strong className="text-foreground">{userEmail}</strong> to confirm:
          </p>
          <Input
            data-testid="delete-email-confirm"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder="Enter user's email"
            className="bg-background border-border"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            data-testid="confirm-delete-btn"
            onClick={handleDelete}
            disabled={!isConfirmed || isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? 'Deleting...' : 'Delete Account'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
