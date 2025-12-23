'use client';

/**
 * Project List Component - Story 17-2
 *
 * Displays a selectable list of discovered Claude Code projects.
 * Supports select all/deselect all and individual project toggling.
 */

import { Checkbox } from '@/components/ui/checkbox';
import { formatDistanceToNow } from 'date-fns';
import { FolderGit2 } from 'lucide-react';
import type { DiscoveredProject } from '@/lib/import/types';

interface ProjectListProps {
  projects: DiscoveredProject[];
  selectedPaths: string[];
  onToggle: (normalizedPath: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  allSelected: boolean;
}

export function ProjectList({
  projects,
  selectedPaths,
  onToggle,
  onSelectAll,
  onDeselectAll,
  allSelected,
}: ProjectListProps) {
  const selectedSet = new Set(selectedPaths);

  return (
    <div className="space-y-3" data-testid="project-list">
      {/* Header with select all/deselect all */}
      <div className="flex items-center justify-between px-2">
        <span className="text-sm font-medium text-foreground">Projects</span>
        <button
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          type="button"
          data-testid="select-all-button"
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Project list */}
      <div
        className="max-h-[300px] overflow-y-auto rounded-lg border border-border"
        data-testid="project-scroll-area"
      >
        <div className="p-2 space-y-1">
          {projects.map((project) => {
            const isChecked = selectedSet.has(project.normalizedPath);
            return (
              <label
                key={project.normalizedPath}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover cursor-pointer transition-colors"
                data-testid={`project-item-${project.normalizedPath}`}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => onToggle(project.normalizedPath)}
                  aria-label={`Select project ${project.path}`}
                  data-testid={`project-checkbox-${project.normalizedPath}`}
                />
                <FolderGit2 className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium text-foreground truncate"
                    title={project.path}
                  >
                    {project.path}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {project.sessionCount} session{project.sessionCount !== 1 ? 's' : ''} &middot;{' '}
                    {project.totalPrompts.toLocaleString()} prompt
                    {project.totalPrompts !== 1 ? 's' : ''} &middot;{' '}
                    {formatDistanceToNow(project.newestSession, { addSuffix: true })}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
