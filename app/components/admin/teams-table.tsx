'use client';

import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

interface Team {
  id: string;
  name: string;
  member_count: number;
  project_count: number;
  prompts_count: number;
  created_at: string;
}

interface TeamsTableProps {
  teams: Team[];
  isPending?: boolean;
}

export function TeamsTable({ teams, isPending }: TeamsTableProps) {
  const router = useRouter();

  if (isPending) {
    return <TeamsTableSkeleton />;
  }

  if (teams.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No teams found</p>
      </div>
    );
  }

  return (
    <Table aria-label="Teams list" data-testid="teams-table">
      <TableHeader>
        <TableRow className="border-[#2a2a2a] hover:bg-transparent">
          <TableHead className="text-muted-foreground">Team Name</TableHead>
          <TableHead className="text-right text-muted-foreground">Members</TableHead>
          <TableHead className="text-right text-muted-foreground">Projects</TableHead>
          <TableHead className="text-right text-muted-foreground">Prompts</TableHead>
          <TableHead className="text-muted-foreground">Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {teams.map((team) => (
          <TableRow
            key={team.id}
            className="cursor-pointer border-[#2a2a2a] hover:bg-[#1a1a1a]"
            onClick={() => router.push(`/admin/teams/${team.id}`)}
            tabIndex={0}
            role="button"
            aria-label={`View details for team ${team.name}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                router.push(`/admin/teams/${team.id}`);
              }
            }}
          >
            <TableCell className="font-medium">{team.name}</TableCell>
            <TableCell className="text-right" data-testid="member-count">
              {team.member_count}
            </TableCell>
            <TableCell className="text-right" data-testid="project-count">
              {team.project_count}
            </TableCell>
            <TableCell className="text-right" data-testid="prompts-count">
              {team.prompts_count.toLocaleString()}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDistanceToNow(new Date(team.created_at), { addSuffix: true })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TeamsTableSkeleton() {
  return (
    <Table aria-label="Loading teams" data-testid="teams-table-skeleton">
      <TableHeader>
        <TableRow className="border-[#2a2a2a] hover:bg-transparent">
          <TableHead className="text-muted-foreground">Team Name</TableHead>
          <TableHead className="text-right text-muted-foreground">Members</TableHead>
          <TableHead className="text-right text-muted-foreground">Projects</TableHead>
          <TableHead className="text-right text-muted-foreground">Prompts</TableHead>
          <TableHead className="text-muted-foreground">Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i} className="border-[#2a2a2a]">
            <TableCell>
              <Skeleton className="h-4 w-32 bg-[#2a2a2a]" />
            </TableCell>
            <TableCell className="text-right">
              <Skeleton className="h-4 w-8 ml-auto bg-[#2a2a2a]" />
            </TableCell>
            <TableCell className="text-right">
              <Skeleton className="h-4 w-8 ml-auto bg-[#2a2a2a]" />
            </TableCell>
            <TableCell className="text-right">
              <Skeleton className="h-4 w-12 ml-auto bg-[#2a2a2a]" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-24 bg-[#2a2a2a]" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export { TeamsTableSkeleton };
