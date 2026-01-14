/**
 * ProjectSwitcher - Global project selector in the header
 *
 * Allows users to select a project, which persists in the URL
 * and affects filtering across pages like Conversations.
 * Project-specific tabs (Conversations, Stages, Settings) are shown
 * via the ProjectTabs component when a project is selected.
 */

'use client';

import { Check, ChevronDown, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjects } from '@/lib/hooks/use-projects';
import { useSelectedProject } from '@/lib/hooks/use-selected-project';

export function ProjectSwitcher() {
  const { data, isPending: isLoadingProjects, error } = useProjects();
  const { projectId, setProjectId, hasProject } = useSelectedProject();

  // Extract projects array from response
  const projects = data?.projects;

  // Find the currently selected project
  const currentProject = projects?.find((p) => p.id === projectId);

  // Loading state
  if (isLoadingProjects) {
    return <Skeleton className="h-9 w-36" data-testid="project-switcher-skeleton" />;
  }

  // Error state
  if (error) {
    return (
      <Button variant="ghost" disabled size="sm">
        <FolderKanban className="mr-2 h-4 w-4" />
        Projects
      </Button>
    );
  }

  // No projects
  if (!projects?.length) {
    return (
      <Button variant="ghost" disabled size="sm">
        <FolderKanban className="mr-2 h-4 w-4" />
        No Projects
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Select project"
          aria-haspopup="menu"
          data-testid="project-switcher-dropdown"
          className="max-w-[200px]"
        >
          <FolderKanban className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">
            {currentProject?.name || 'All Projects'}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {/* All Projects option */}
        <DropdownMenuItem
          onClick={() => setProjectId(null)}
          className="flex items-center justify-between cursor-pointer"
          aria-selected={!hasProject}
          data-testid="project-option-all"
        >
          <span>All Projects</span>
          {!hasProject && (
            <Check className="h-4 w-4" aria-label="Currently selected" />
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Individual projects */}
        {projects.map((project) => (
          <DropdownMenuItem
            key={project.id}
            onClick={() => setProjectId(project.id)}
            className="flex items-center justify-between cursor-pointer"
            aria-selected={project.id === projectId}
            data-testid={`project-option-${project.id}`}
          >
            <span className="truncate">{project.name}</span>
            {project.id === projectId && (
              <Check className="h-4 w-4 shrink-0" aria-label="Currently selected" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
