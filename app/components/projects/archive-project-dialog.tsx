'use client';

import { useState, useCallback } from 'react';
import { AlertTriangle, Loader2, Archive } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useArchiveProject } from '@/lib/hooks/use-archive-project';

interface ArchiveProjectDialogProps {
  projectId: string;
  projectName: string;
}

export function ArchiveProjectDialog({
  projectId,
  projectName,
}: ArchiveProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');

  const { mutate: archiveProject, isPending } = useArchiveProject();

  const isConfirmValid = confirmName === projectName;

  const handleArchive = useCallback(() => {
    if (!isConfirmValid) return;
    archiveProject({ projectId });
  }, [archiveProject, projectId, isConfirmValid]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setConfirmName('');
    }
  }, []);

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Archive className="h-4 w-4 mr-2" />
          Archive Project
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        aria-labelledby="archive-dialog-title"
        aria-describedby="archive-dialog-description"
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            id="archive-dialog-title"
            className="flex items-center gap-2 text-destructive"
          >
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            Archive Project
          </AlertDialogTitle>
          <AlertDialogDescription
            id="archive-dialog-description"
            className="space-y-2"
          >
            <span className="block">
              This will archive the project and immediately invalidate its API key.
            </span>
            <span className="block">
              The project will be removed from your active projects list, but
              historical data will remain accessible.
            </span>
            <span className="block font-medium text-destructive">
              This action cannot be undone.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="confirm-project-name">
              Type <span className="font-mono font-bold">{projectName}</span> to confirm
            </Label>
            <Input
              id="confirm-project-name"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder="Enter project name"
              disabled={isPending}
              aria-label="Confirm project name"
              autoComplete="off"
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleArchive}
            disabled={!isConfirmValid || isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                Archiving...
              </>
            ) : (
              'Archive Project'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
