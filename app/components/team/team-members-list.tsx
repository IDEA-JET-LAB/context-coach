'use client';

import { useState } from 'react';
import {
  useTeamMembers,
  useUpdateMemberRole,
  useRemoveMember,
  type TeamMember,
} from '@/lib/hooks/use-team-members';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmationModal } from '@/components/feedback';
import { MoreHorizontal, Shield, User, Loader2, UserMinus } from 'lucide-react';

interface TeamMembersListProps {
  teamId: string;
  isAdmin: boolean;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function MemberRow({
  member,
  teamId,
  isAdmin,
  currentUserId,
}: {
  member: TeamMember;
  teamId: string;
  isAdmin: boolean;
  currentUserId: string;
}) {
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const { mutate: updateRole, isPending: isUpdatingRole } = useUpdateMemberRole(teamId);
  const { mutate: removeMember, isPending: isRemoving } = useRemoveMember(teamId);

  const isCurrentUser = member.user_id === currentUserId;
  const displayName = member.name || 'Unknown User';

  const handleRoleChange = (newRole: 'member' | 'admin') => {
    updateRole({ memberId: member.id, role: newRole });
  };

  const handleRemove = () => {
    removeMember(member.id, {
      onSettled: () => {
        setIsRemoveDialogOpen(false);
      },
    });
  };

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          {member.avatar_url ? (
            <img
              src={member.avatar_url}
              alt=""
              className="h-8 w-8 rounded-full"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <span className="font-medium">{displayName}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
          {member.role === 'admin' ? (
            <>
              <Shield className="mr-1 h-3 w-3" />
              Admin
            </>
          ) : (
            <>
              <User className="mr-1 h-3 w-3" />
              Member
            </>
          )}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(member.joined_at)}
      </TableCell>
      <TableCell className="text-right">
        {isAdmin && !isCurrentUser && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isUpdatingRole || isRemoving}
                >
                  {isUpdatingRole || isRemoving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MoreHorizontal className="h-4 w-4" />
                  )}
                  <span className="sr-only">Member actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {member.role === 'member' ? (
                  <DropdownMenuItem onClick={() => handleRoleChange('admin')}>
                    <Shield className="mr-2 h-4 w-4" />
                    Make Admin
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => handleRoleChange('member')}>
                    <User className="mr-2 h-4 w-4" />
                    Remove Admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIsRemoveDialogOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <UserMinus className="mr-2 h-4 w-4" />
                  Remove from Team
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <ConfirmationModal
              open={isRemoveDialogOpen}
              onOpenChange={setIsRemoveDialogOpen}
              title="Remove Team Member"
              description={`Are you sure you want to remove ${displayName} from the team? They will lose access to all team resources.`}
              variant="destructive"
              confirmLabel={isRemoving ? 'Removing...' : 'Remove Member'}
              onConfirm={handleRemove}
              loading={isRemoving}
              icon={UserMinus}
            />
          </>
        )}
        {isCurrentUser && (
          <span className="text-sm text-muted-foreground">(You)</span>
        )}
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

export function TeamMembersList({ teamId, isAdmin }: TeamMembersListProps) {
  const { data, isLoading, error } = useTeamMembers(teamId);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-6 text-destructive">
        Failed to load team members
      </div>
    );
  }

  if (!data?.members || data.members.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        No team members found
      </div>
    );
  }

  return (
    <div aria-live="polite" aria-label="Team members list">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              teamId={teamId}
              isAdmin={isAdmin}
              currentUserId={data.currentUserId}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
