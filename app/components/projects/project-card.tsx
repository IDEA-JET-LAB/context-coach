'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SourceBadge } from '@/components/conversations/SourceBadge';
import { FolderKanban, Clock } from 'lucide-react';
import Link from 'next/link';
import type { Project } from '@/types/project';
import { maskApiKey } from '@/lib/utils/api-key';

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const createdDate = new Date(project.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">{project.name}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <SourceBadge source={project.isImported ? "imported" : "live"} size="sm" />
              {project.is_archived && (
                <Badge variant="secondary">Archived</Badge>
              )}
            </div>
          </div>
          {project.description && (
            <CardDescription className="line-clamp-2">
              {project.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Created {createdDate}</span>
            </div>
            <div className="font-mono text-xs bg-muted px-2 py-1 rounded w-fit">
              {project.api_key_prefix
                ? maskApiKey(project.api_key_prefix)
                : 'No API key (archived)'}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
