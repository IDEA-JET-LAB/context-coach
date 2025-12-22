'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLeaveTeam } from '@/lib/hooks/use-team-members';
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
import { Loader2, LogOut } from 'lucide-react';

interface LeaveTeamDialogProps {
  teamId: string;
  teamName: string;
  isLastAdmin?: boolean;
}

export function LeaveTeamDialog({ teamId, teamName, isLastAdmin = false }: LeaveTeamDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { mutate: leaveTeam, isPending } = useLeaveTeam(teamId);

  const handleLeave = () => {
    leaveTeam(undefined, {
      onSuccess: (data) => {
        setIsOpen(false);
        // Redirect to next team or team creation page
        if (data.nextTeam) {
          router.push('/');
        } else {
          router.push('/teams/new');
        }
        router.refresh();
      },
      onError: () => {
        // Error is handled in the hook with toast
      },
    });
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          className="text-destructive border-destructive hover:bg-destructive/10"
          aria-label={`Leave ${teamName}`}
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          Leave Team
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent role="alertdialog" aria-labelledby="leave-dialog-title" aria-describedby="leave-dialog-description">
        <AlertDialogHeader>
          <AlertDialogTitle id="leave-dialog-title">Leave Team</AlertDialogTitle>
          <AlertDialogDescription id="leave-dialog-description">
            {isLastAdmin ? (
              <span className="text-destructive">
                You are the last admin of this team. You must assign another admin before you can
                leave.
              </span>
            ) : (
              <>
                Are you sure you want to leave <strong>{teamName}</strong>? You will lose access
                to all team projects and resources. This action cannot be undone.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleLeave}
            disabled={isPending || isLastAdmin}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            aria-disabled={isLastAdmin}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                <span aria-live="polite">Leaving...</span>
              </>
            ) : (
              'Leave Team'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
