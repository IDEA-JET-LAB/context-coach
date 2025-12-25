"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ProjectMappingCard } from "./ProjectMappingCard";
import { Check, AlertTriangle, Folder, Loader2 } from "lucide-react";

interface Project {
  id: string;
  name: string;
}

interface PathMapping {
  claudePath: string;
  matchedProjectId?: string;
  matchedProjectName?: string;
  confidence?: number;
  isAutoMatched?: boolean;
}

interface ProjectMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mappings: Record<string, string | null>) => void;
  pathMappings: PathMapping[];
  availableProjects: Project[];
  onCreateProject: (name: string) => Promise<Project>;
  isLoading?: boolean;
}

/**
 * ProjectMappingModal - Modal for mapping Claude Code project paths to Contextor projects
 *
 * Shown during import when paths need to be mapped to existing or new projects.
 * Groups paths into auto-matched (high confidence) and needs mapping sections.
 */
export function ProjectMappingModal({
  isOpen,
  onClose,
  onConfirm,
  pathMappings,
  availableProjects,
  onCreateProject,
  isLoading = false,
}: ProjectMappingModalProps) {
  // Track user selections/overrides
  const [mappings, setMappings] = useState<Record<string, string | null>>(() => {
    const initial: Record<string, string | null> = {};
    pathMappings.forEach((pm) => {
      if (pm.matchedProjectId && pm.confidence && pm.confidence >= 0.9) {
        initial[pm.claudePath] = pm.matchedProjectId;
      } else {
        initial[pm.claudePath] = null;
      }
    });
    return initial;
  });

  const [skippedPaths, setSkippedPaths] = useState<Set<string>>(new Set());
  const [creatingProject, setCreatingProject] = useState(false);
  const [projects, setProjects] = useState(availableProjects);

  // Split into auto-matched and needs mapping
  const autoMatched = pathMappings.filter(
    (pm) => pm.confidence && pm.confidence >= 0.9
  );
  const needsMapping = pathMappings.filter(
    (pm) => !pm.confidence || pm.confidence < 0.9
  );

  const handleSelect = (path: string, projectId: string | null) => {
    setMappings((prev) => ({ ...prev, [path]: projectId }));
    setSkippedPaths((prev) => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  };

  const handleSkip = (path: string) => {
    setSkippedPaths((prev) => new Set(prev).add(path));
    setMappings((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
  };

  const handleCreateNew = async (path: string, suggestedName: string) => {
    setCreatingProject(true);
    try {
      const newProject = await onCreateProject(suggestedName);
      setProjects((prev) => [...prev, newProject]);
      setMappings((prev) => ({ ...prev, [path]: newProject.id }));
    } finally {
      setCreatingProject(false);
    }
  };

  const handleConfirm = () => {
    // Only include non-skipped paths
    const finalMappings: Record<string, string | null> = {};
    Object.entries(mappings).forEach(([path, projectId]) => {
      if (!skippedPaths.has(path)) {
        finalMappings[path] = projectId;
      }
    });
    onConfirm(finalMappings);
  };

  const mappedCount = Object.values(mappings).filter(
    (v) => v !== null && !skippedPaths.has(Object.keys(mappings).find((k) => mappings[k] === v) || "")
  ).length;

  const totalPaths = pathMappings.length;
  const skippedCount = skippedPaths.size;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Map Projects
          </DialogTitle>
          <DialogDescription>
            We found {totalPaths} Claude Code project{totalPaths !== 1 ? "s" : ""}.
            Please confirm or update the mappings.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {/* Auto-matched section */}
          {autoMatched.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Check className="h-4 w-4 text-score-high" />
                <h3 className="font-medium">
                  Auto-Matched ({autoMatched.length})
                </h3>
                <Badge variant="outline" className="ml-auto">
                  High confidence
                </Badge>
              </div>
              <div className="space-y-2">
                {autoMatched.map((pm) => (
                  <ProjectMappingCard
                    key={pm.claudePath}
                    claudePath={pm.claudePath}
                    matchedProject={
                      pm.matchedProjectId
                        ? {
                            id: pm.matchedProjectId,
                            name: pm.matchedProjectName || "Unknown",
                          }
                        : undefined
                    }
                    confidence={pm.confidence}
                    availableProjects={projects}
                    onSelect={(projectId) =>
                      handleSelect(pm.claudePath, projectId)
                    }
                    onCreateNew={(name) => handleCreateNew(pm.claudePath, name)}
                    onSkip={() => handleSkip(pm.claudePath)}
                    isSkipped={skippedPaths.has(pm.claudePath)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Needs mapping section */}
          {needsMapping.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-score-medium" />
                <h3 className="font-medium">
                  Needs Mapping ({needsMapping.length})
                </h3>
              </div>
              <div className="space-y-2">
                {needsMapping.map((pm) => (
                  <ProjectMappingCard
                    key={pm.claudePath}
                    claudePath={pm.claudePath}
                    matchedProject={
                      pm.matchedProjectId
                        ? {
                            id: pm.matchedProjectId,
                            name: pm.matchedProjectName || "Unknown",
                          }
                        : undefined
                    }
                    confidence={pm.confidence}
                    availableProjects={projects}
                    onSelect={(projectId) =>
                      handleSelect(pm.claudePath, projectId)
                    }
                    onCreateNew={(name) => handleCreateNew(pm.claudePath, name)}
                    onSkip={() => handleSkip(pm.claudePath)}
                    isSkipped={skippedPaths.has(pm.claudePath)}
                  />
                ))}
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {mappedCount} mapped, {skippedCount} skipped
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isLoading || creatingProject}
            >
              {isLoading || creatingProject ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Confirm & Import"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ProjectMappingModal;
