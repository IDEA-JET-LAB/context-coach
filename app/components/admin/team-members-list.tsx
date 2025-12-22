'use client';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDistanceToNow } from 'date-fns';

interface Member {
  role: string;
  joined_at: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface TeamMembersListProps {
  members: Member[];
}

const roleVariants: Record<string, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  admin: 'secondary',
  member: 'outline',
};

const roleLabels: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};

export function TeamMembersList({ members }: TeamMembersListProps) {
  if (members.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No members in this team</p>
      </div>
    );
  }

  return (
    <div data-testid="team-members-section">
      <h3 className="text-lg font-semibold mb-4">
        Team Members ({members.length})
      </h3>
      <Table aria-label="Team members">
        <TableHeader>
          <TableRow className="border-[#2a2a2a] hover:bg-transparent">
            <TableHead className="text-muted-foreground">Name</TableHead>
            <TableHead className="text-muted-foreground">Email</TableHead>
            <TableHead className="text-muted-foreground">Role</TableHead>
            <TableHead className="text-muted-foreground">Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member, index) => (
            <TableRow key={member.user?.id || index} className="border-[#2a2a2a]">
              <TableCell className="font-medium">
                {member.user?.name ?? 'No name'}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {member.user?.email ?? 'Unknown'}
              </TableCell>
              <TableCell>
                <Badge
                  variant={roleVariants[member.role] ?? 'outline'}
                  data-testid="role-badge"
                >
                  {roleLabels[member.role] ?? member.role}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
