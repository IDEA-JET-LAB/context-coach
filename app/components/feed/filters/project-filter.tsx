'use client';

import { FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjects } from '@/lib/hooks/use-projects';

interface ProjectFilterProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

export function ProjectFilter({ value, onChange }: ProjectFilterProps) {
  const { data: projectsData } = useProjects();
  const projects = projectsData?.projects ?? [];

  return (
    <Select
      value={value ?? 'all'}
      onValueChange={(v) => onChange(v === 'all' ? undefined : v)}
    >
      <SelectTrigger
        className="w-[180px] bg-card border-border"
        aria-label="Filter by project"
      >
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="All projects" />
        </div>
      </SelectTrigger>
      <SelectContent className="bg-card border-border">
        <SelectItem value="all">All projects</SelectItem>
        {projects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
