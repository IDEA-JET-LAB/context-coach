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

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  is_archived: boolean;
  api_key_prefix: string;
}

interface TeamProjectsListProps {
  projects: Project[];
}

export function TeamProjectsList({ projects }: TeamProjectsListProps) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No projects in this team</p>
      </div>
    );
  }

  const activeProjects = projects.filter((p) => !p.is_archived);
  const archivedProjects = projects.filter((p) => p.is_archived);

  return (
    <div data-testid="team-projects-section">
      <h3 className="text-lg font-semibold mb-4">
        Projects ({projects.length})
      </h3>
      <Table aria-label="Team projects">
        <TableHeader>
          <TableRow className="border-[#2a2a2a] hover:bg-transparent">
            <TableHead className="text-muted-foreground">Name</TableHead>
            <TableHead className="text-muted-foreground">Description</TableHead>
            <TableHead className="text-muted-foreground">API Key</TableHead>
            <TableHead className="text-muted-foreground">Status</TableHead>
            <TableHead className="text-muted-foreground">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activeProjects.map((project) => (
            <TableRow key={project.id} className="border-[#2a2a2a]">
              <TableCell className="font-medium">{project.name}</TableCell>
              <TableCell className="text-muted-foreground max-w-xs truncate">
                {project.description ?? '-'}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {project.api_key_prefix}...
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="bg-green-500/20 text-green-500 border-0">
                  Active
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
              </TableCell>
            </TableRow>
          ))}
          {archivedProjects.map((project) => (
            <TableRow key={project.id} className="border-[#2a2a2a] opacity-60">
              <TableCell className="font-medium">{project.name}</TableCell>
              <TableCell className="text-muted-foreground max-w-xs truncate">
                {project.description ?? '-'}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {project.api_key_prefix}...
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-muted-foreground">
                  Archived
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
