"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Folder, Check, Plus, X, ChevronDown, ChevronUp } from "lucide-react";

interface Project {
  id: string;
  name: string;
}

interface ProjectMappingCardProps {
  claudePath: string;
  matchedProject?: Project;
  confidence?: number;
  availableProjects: Project[];
  onSelect: (projectId: string | null) => void;
  onCreateNew: (projectName: string) => void;
  onSkip: () => void;
  isSkipped?: boolean;
  className?: string;
}

/**
 * ProjectMappingCard - Individual project path to Contextor project mapping
 *
 * Used in import flow to map Claude Code project paths to existing
 * or new Contextor projects.
 */
export function ProjectMappingCard({
  claudePath,
  matchedProject,
  confidence,
  availableProjects,
  onSelect,
  onCreateNew,
  onSkip,
  isSkipped = false,
  className,
}: ProjectMappingCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    matchedProject?.id || null
  );

  // Extract project name from path for "Create New" suggestion
  const pathParts = claudePath.split("/").filter(Boolean);
  const suggestedName = pathParts[pathParts.length - 1] || "New Project";

  const handleProjectChange = (value: string) => {
    if (value === "create-new") {
      onCreateNew(suggestedName);
    } else if (value === "none") {
      setSelectedProjectId(null);
      onSelect(null);
    } else {
      setSelectedProjectId(value);
      onSelect(value);
    }
  };

  const getConfidenceBadge = () => {
    if (!confidence) return null;

    if (confidence >= 0.9) {
      return (
        <Badge variant="outline" className="bg-score-high/10 text-score-high border-score-high/30">
          {Math.round(confidence * 100)}% match
        </Badge>
      );
    } else if (confidence >= 0.7) {
      return (
        <Badge variant="outline" className="bg-score-medium/10 text-score-medium border-score-medium/30">
          {Math.round(confidence * 100)}% match
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="bg-muted text-muted-foreground">
          {Math.round(confidence * 100)}% match
        </Badge>
      );
    }
  };

  if (isSkipped) {
    return (
      <Card className={cn("opacity-60", className)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-mono text-muted-foreground truncate">
                {claudePath}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Skipped</Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onSelect(null);
                }}
              >
                Undo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(className)}>
      <CardContent className="p-4">
        {/* Path Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-mono truncate" title={claudePath}>
                {claudePath}
              </span>
            </div>
          </div>
          {getConfidenceBadge()}
        </div>

        {/* Mapping Section */}
        <div className="mt-3">
          {matchedProject && confidence && confidence >= 0.9 ? (
            // High confidence auto-match
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-score-high" />
              <span className="text-sm">
                Mapped to{" "}
                <span className="font-medium">{matchedProject.name}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                Change
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 ml-1" />
                ) : (
                  <ChevronDown className="h-4 w-4 ml-1" />
                )}
              </Button>
            </div>
          ) : (
            // Needs mapping or low confidence
            <div className="flex items-center gap-2">
              <Select
                value={selectedProjectId || "none"}
                onValueChange={handleProjectChange}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">No mapping</span>
                  </SelectItem>
                  <SelectItem value="create-new">
                    <span className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Create "{suggestedName}"
                    </span>
                  </SelectItem>
                  {availableProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSkip}
                title="Skip this project"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Expanded change section for high-confidence matches */}
          {isExpanded && (
            <div className="mt-3 pt-3 border-t">
              <Select
                value={selectedProjectId || "none"}
                onValueChange={handleProjectChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a different project..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">No mapping</span>
                  </SelectItem>
                  <SelectItem value="create-new">
                    <span className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Create "{suggestedName}"
                    </span>
                  </SelectItem>
                  {availableProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 mt-2">
                <Checkbox
                  id={`skip-${claudePath}`}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onSkip();
                    }
                  }}
                />
                <label
                  htmlFor={`skip-${claudePath}`}
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  Skip this project
                </label>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ProjectMappingCard;
