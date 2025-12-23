'use client';

/**
 * Discovery Import Preview Component - Story 17-2
 *
 * Main preview component for the historical import flow.
 * Shows summary statistics and allows users to select projects to import.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ProjectList } from './project-list';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, Download, FolderOpen, Lock, MessageSquare, Clock } from 'lucide-react';
import Link from 'next/link';
import type { DiscoveryResult } from '@/lib/import/types';
import { useImportSelection } from '@/lib/hooks/use-import-selection';

interface DiscoveryImportPreviewProps {
  discoveryResult: DiscoveryResult;
  onImport: (projectPaths: string[]) => void;
  onSkip: () => void;
  isImporting?: boolean;
}

export function DiscoveryImportPreview({
  discoveryResult,
  onImport,
  onSkip,
  isImporting = false,
}: DiscoveryImportPreviewProps) {
  const [showProjects, setShowProjects] = useState(false);

  const {
    selectedPaths,
    stats,
    toggleProject,
    selectAll,
    deselectAll,
    allSelected,
    clearStorage,
  } = useImportSelection(discoveryResult.projects);

  const handleImportAll = () => {
    onImport(discoveryResult.projects.map((p) => p.normalizedPath));
    clearStorage();
  };

  const handleImportSelected = () => {
    onImport(selectedPaths);
    clearStorage();
  };

  const handleSkip = () => {
    clearStorage();
    onSkip();
  };

  const dateRangeText = discoveryResult.dateRange.oldest
    ? formatDistanceToNow(discoveryResult.dateRange.oldest)
    : '30 days';

  return (
    <Card className="max-w-2xl mx-auto" data-testid="discovery-import-preview">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome to Contextor!</CardTitle>
        <CardDescription className="text-base mt-4">
          We detected{' '}
          <span className="font-semibold text-foreground" data-testid="total-prompts">
            {discoveryResult.totalPrompts.toLocaleString()}
          </span>{' '}
          prompts from the last {dateRangeText} across{' '}
          <span className="font-semibold text-foreground" data-testid="total-projects">
            {discoveryResult.totalProjects}
          </span>{' '}
          project{discoveryResult.totalProjects !== 1 ? 's' : ''}.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Main message */}
        <p className="text-center text-muted-foreground">
          Would you like to import and analyze your prompt history? This provides immediate
          insights into your prompting patterns.
        </p>

        {/* Stats summary */}
        <div
          className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-surface border border-border"
          data-testid="stats-summary"
        >
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
              <FolderOpen className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs uppercase tracking-wide">Projects</span>
            </div>
            <p className="text-xl font-bold text-foreground" data-testid="stats-projects">
              {showProjects
                ? stats.projectCount.toLocaleString()
                : discoveryResult.totalProjects.toLocaleString()}
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs uppercase tracking-wide">Sessions</span>
            </div>
            <p className="text-xl font-bold text-foreground" data-testid="stats-sessions">
              {showProjects
                ? stats.sessionCount.toLocaleString()
                : discoveryResult.totalSessions.toLocaleString()}
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs uppercase tracking-wide">Prompts</span>
            </div>
            <p className="text-xl font-bold text-foreground" data-testid="stats-prompts">
              {showProjects
                ? stats.promptCount.toLocaleString()
                : discoveryResult.totalPrompts.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Project list (expanded) */}
        {showProjects && (
          <ProjectList
            projects={discoveryResult.projects}
            selectedPaths={selectedPaths}
            onToggle={toggleProject}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
            allSelected={allSelected}
          />
        )}

        {/* Selection summary when project list is shown */}
        {showProjects && (
          <div className="text-sm text-center text-muted-foreground" data-testid="selection-summary">
            {selectedPaths.length} of {discoveryResult.totalProjects} projects selected (
            {stats.promptCount.toLocaleString()} prompts)
          </div>
        )}

        {/* Privacy information */}
        <div
          className="flex items-start gap-3 p-3 rounded-lg bg-surface border border-border"
          data-testid="privacy-notice"
        >
          <Lock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">
            Your prompt history stays private. Data is stored securely and only accessible to you
            and your team.{' '}
            <Link
              href="/docs"
              className="underline hover:text-foreground transition-colors"
              data-testid="privacy-link"
            >
              Learn more about our privacy practices
            </Link>
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {!showProjects ? (
            <>
              <Button
                size="lg"
                onClick={handleImportAll}
                disabled={isImporting}
                data-testid="import-all-button"
              >
                <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                Import All
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setShowProjects(true)}
                disabled={isImporting}
                data-testid="select-projects-button"
              >
                <FolderOpen className="h-4 w-4 mr-2" aria-hidden="true" />
                Select Projects
              </Button>
            </>
          ) : (
            <Button
              size="lg"
              onClick={handleImportSelected}
              disabled={isImporting || selectedPaths.length === 0}
              data-testid="import-selected-button"
            >
              <Download className="h-4 w-4 mr-2" aria-hidden="true" />
              Import Selected ({selectedPaths.length})
            </Button>
          )}
          <Button
            size="lg"
            variant="ghost"
            onClick={handleSkip}
            disabled={isImporting}
            data-testid="skip-button"
          >
            Skip for Now
          </Button>
        </div>

        {/* Skipped directories warning */}
        {discoveryResult.skippedDirectories.length > 0 && (
          <div
            className="flex items-start gap-2 p-3 rounded-lg bg-score-medium/10 border border-score-medium/20"
            data-testid="skipped-warning"
          >
            <AlertTriangle className="h-4 w-4 text-score-medium shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">
              {discoveryResult.skippedDirectories.length} director
              {discoveryResult.skippedDirectories.length !== 1 ? 'ies were' : 'y was'} skipped due
              to permission issues
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
