'use client';

import { useState } from 'react';
import { useInvitations, useRevokeInvitation, type Invitation } from '@/lib/hooks/use-invitations';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Loader2, XCircle } from 'lucide-react';

interface PendingInvitationsListProps {
  teamId: string;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Expired';
  if (diffDays === 1) return 'Expires tomorrow';
  return `Expires in ${diffDays} days`;
}

function InvitationRow({
  invitation,
  teamId,
}: {
  invitation: Invitation;
  teamId: string;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { mutate: revokeInvitation, isPending } = useRevokeInvitation(teamId);

  const handleRevoke = () => {
    revokeInvitation(invitation.id, {
      onSettled: () => {
        setIsDialogOpen(false);
      },
    });
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{invitation.email}</TableCell>
      <TableCell>{formatDate(invitation.created_at)}</TableCell>
      <TableCell className="text-muted-foreground">
        {formatRelativeTime(invitation.expires_at)}
      </TableCell>
      <TableCell className="text-right">
        <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-1" />
                  Revoke
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke Invitation</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to revoke the invitation for{' '}
                <strong>{invitation.email}</strong>? They will no longer be able to join
                the team using this invitation link.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRevoke}
                disabled={isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Revoking...
                  </>
                ) : (
                  'Revoke Invitation'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

export function PendingInvitationsList({ teamId }: PendingInvitationsListProps) {
  const { data: invitations, isLoading, error } = useInvitations(teamId);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-6 text-destructive">
        Failed to load invitations
      </div>
    );
  }

  if (!invitations || invitations.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        No pending invitations
      </div>
    );
  }

  return (
    <div aria-live="polite" aria-label="Pending invitations list">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Invited</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.map((invitation) => (
            <InvitationRow
              key={invitation.id}
              invitation={invitation}
              teamId={teamId}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
