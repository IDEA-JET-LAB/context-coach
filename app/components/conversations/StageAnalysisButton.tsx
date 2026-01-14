/**
 * StageAnalysisButton - Story 31-6
 *
 * Button to trigger stage analysis for a project.
 * Shows processing state and success/error feedback.
 * Includes option to re-analyze already completed sessions.
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, BarChart3, ChevronDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface StageAnalysisButtonProps {
  /** Project ID to analyze */
  projectId: string;
  /** When stages were last analyzed */
  lastAnalyzedAt: string | null;
  /** Callback after successful analysis */
  onAnalysisComplete?: () => void;
}

interface AnalysisResult {
  sessionsProcessed: number;
  sessionsSucceeded: number;
  sessionsFailed: number;
  totalProjectSessions: number;
  alreadyAnalyzedSessions: number;
}

/**
 * Button that triggers stage analysis for a project.
 *
 * @example
 * <StageAnalysisButton
 *   projectId="123"
 *   lastAnalyzedAt="2026-01-14T10:00:00Z"
 *   onAnalysisComplete={() => refetch()}
 * />
 */
export function StageAnalysisButton({
  projectId,
  lastAnalyzedAt,
  onAnalysisComplete,
}: StageAnalysisButtonProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async (reanalyze: boolean = false) => {
    setIsAnalyzing(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/analyze-stages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reanalyze }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "Analysis failed");
      }

      const result = await response.json();
      const data = result.data as AnalysisResult;

      // Show appropriate toast based on results
      if (data.sessionsProcessed === 0) {
        // No sessions were processed - explain why
        if (data.totalProjectSessions === 0) {
          toast.info("No Sessions Found", {
            description: "This project has no conversations yet. Start using Claude Code with this project's API key to capture sessions.",
            duration: 6000,
          });
        } else if (data.alreadyAnalyzedSessions === data.totalProjectSessions && !reanalyze) {
          toast.info("All Sessions Already Analyzed", {
            description: `All ${data.totalProjectSessions} session${data.totalProjectSessions !== 1 ? "s" : ""} have been analyzed. Use 'Re-analyze All' to re-process them.`,
            duration: 5000,
          });
        } else {
          toast.info("No Sessions to Analyze", {
            description: `${data.totalProjectSessions} total sessions, ${data.alreadyAnalyzedSessions} already analyzed.`,
            duration: 4000,
          });
        }
      } else if (data.sessionsFailed === 0) {
        const action = reanalyze ? "re-analyzed" : "analyzed";
        toast.success("Stage Analysis Complete", {
          description: `Successfully ${action} ${data.sessionsSucceeded} session${data.sessionsSucceeded !== 1 ? "s" : ""}.`,
          duration: 5000,
        });
      } else {
        toast.warning("Stage Analysis Completed with Errors", {
          description: `${data.sessionsSucceeded} succeeded, ${data.sessionsFailed} failed.`,
          duration: 5000,
        });
      }

      // Trigger refresh
      onAnalysisComplete?.();
    } catch (error) {
      toast.error("Analysis Failed", {
        description: error instanceof Error ? error.message : "Unknown error",
        duration: 5000,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Last analyzed timestamp */}
      {lastAnalyzedAt && !isAnalyzing && (
        <span className="text-xs text-muted-foreground hidden sm:inline">
          Analyzed{" "}
          {formatDistanceToNow(new Date(lastAnalyzedAt), { addSuffix: true })}
        </span>
      )}

      {/* Dropdown Button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isAnalyzing}
            className="gap-2"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">Analyzing...</span>
                <span className="sm:hidden">...</span>
              </>
            ) : (
              <>
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Analyze Stages</span>
                <span className="sm:hidden">Analyze</span>
                <ChevronDown className="h-3 w-3 ml-1" />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleAnalyze(false)}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Analyze New Sessions
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAnalyze(true)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Re-analyze All Sessions
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
