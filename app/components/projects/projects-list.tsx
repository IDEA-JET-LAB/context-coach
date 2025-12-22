'use client';

import { useProjects } from '@/lib/hooks/use-projects';
import { ProjectCard } from './project-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FolderKanban, Plus } from 'lucide-react';
import Link from 'next/link';

interface ProjectsListProps {
  isAdmin: boolean;
}

export function ProjectsList({ isAdmin }: ProjectsListProps) {
  const { data, isPending, error } = useProjects();

  if (isPending) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-1/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive">Error loading projects: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  const projects = data?.projects || [];

  if (projects.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <FolderKanban className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle>No Projects Yet</CardTitle>
          <CardDescription>
            {isAdmin
              ? 'Create your first project to start capturing prompts from your repositories.'
              : 'No projects have been created for this team yet. Contact your team admin to create one.'}
          </CardDescription>
        </CardHeader>
        {isAdmin && (
          <CardContent>
            <Button asChild>
              <Link href="/projects/new">
                <Plus className="mr-2 h-4 w-4" />
                Create First Project
              </Link>
            </Button>
          </CardContent>
        )}
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
