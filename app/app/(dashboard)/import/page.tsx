'use client';

/**
 * Import Page - Story 17-2
 *
 * Main page for the historical import flow.
 * Shows discovery preview and handles import progression.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DiscoveryImportPreview } from '@/components/import/discovery-import-preview';
import { ImportProgress, ImportCompleteSummary } from '@/components/import/import-progress';
import { useImportState } from '@/lib/hooks/use-import-state';
import type { DiscoveryResult, ImportState } from '@/lib/import/types';
import type { ImportProgressState } from '@/components/import/import-progress';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Mock discovery result for development/testing.
 * In production, this would come from an API call.
 */
function getMockDiscoveryResult(): DiscoveryResult {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return {
    projects: [
      {
        path: '/Users/edgars/Projects/my-app',
        normalizedPath: '-Users-edgars-Projects-my-app',
        sessionCount: 12,
        totalPrompts: 245,
        oldestSession: thirtyDaysAgo,
        newestSession: now,
      },
      {
        path: '/Users/edgars/Projects/api-server',
        normalizedPath: '-Users-edgars-Projects-api-server',
        sessionCount: 8,
        totalPrompts: 156,
        oldestSession: thirtyDaysAgo,
        newestSession: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        path: '/Users/edgars/Projects/frontend-dashboard',
        normalizedPath: '-Users-edgars-Projects-frontend-dashboard',
        sessionCount: 15,
        totalPrompts: 312,
        oldestSession: thirtyDaysAgo,
        newestSession: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
    ],
    skippedDirectories: [],
    totalProjects: 3,
    totalSessions: 35,
    totalPrompts: 713,
    dateRange: {
      oldest: thirtyDaysAgo,
      newest: now,
    },
    appliedDateRange: {
      startDate: thirtyDaysAgo,
      endDate: now,
    },
    discoveredAt: now,
  };
}

export default function ImportPage() {
  const router = useRouter();
  const { state, startImporting, updateProgress, completeImport, skip } = useImportState();
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [importProgress, setImportProgress] = useState<ImportProgressState | null>(null);
  const [importStartTime, setImportStartTime] = useState<Date | null>(null);

  useEffect(() => {
    // Fetch discovery results
    // In production, this would call the API. For now, use mock data.
    async function fetchDiscovery() {
      try {
        // Check if there's mock data in sessionStorage for testing
        const mockData = sessionStorage.getItem('contextor-mock-discovery');
        if (mockData) {
          const parsed = JSON.parse(mockData);
          // Convert date strings back to Date objects
          const result: DiscoveryResult = {
            ...parsed,
            projects: parsed.projects.map((p: Record<string, unknown>) => ({
              ...p,
              oldestSession: new Date(p.oldestSession as string),
              newestSession: new Date(p.newestSession as string),
            })),
            dateRange: {
              oldest: new Date(parsed.dateRange.oldest),
              newest: new Date(parsed.dateRange.newest),
            },
            appliedDateRange: {
              startDate: new Date(parsed.appliedDateRange.startDate),
              endDate: new Date(parsed.appliedDateRange.endDate),
            },
            discoveredAt: new Date(parsed.discoveredAt),
          };
          setDiscoveryResult(result);
        } else {
          // Try to fetch from API
          const response = await fetch('/api/import/discover');
          if (response.ok) {
            const data = await response.json();
            setDiscoveryResult(data);
          } else if (response.status === 404) {
            // No discovery data available - use mock for demo
            setDiscoveryResult(getMockDiscoveryResult());
          } else {
            // Redirect to dashboard on error
            router.push('/home');
            return;
          }
        }
      } catch (error) {
        console.error('Failed to fetch discovery data:', error);
        // Use mock data in development
        if (process.env.NODE_ENV === 'development') {
          setDiscoveryResult(getMockDiscoveryResult());
        } else {
          router.push('/home');
          return;
        }
      } finally {
        setLoading(false);
      }
    }

    fetchDiscovery();
  }, [router]);

  const handleImport = async (projectPaths: string[]) => {
    if (!discoveryResult) return;

    const selectedProjects = discoveryResult.projects.filter((p) =>
      projectPaths.includes(p.normalizedPath)
    );
    const totalPrompts = selectedProjects.reduce((sum, p) => sum + p.totalPrompts, 0);

    // Transition to importing state
    startImporting(projectPaths.length);
    setImportStartTime(new Date());

    // Initialize progress state
    const initialProgress: ImportProgressState = {
      status: 'running',
      files: selectedProjects.map((p) => ({
        id: p.normalizedPath,
        name: p.path.split('/').pop() || p.path,
        status: 'pending' as const,
        sessionCount: p.sessionCount,
        sessionsImported: 0,
        promptCount: p.totalPrompts,
        promptsImported: 0,
      })),
      startedAt: new Date(),
      totalSessions: selectedProjects.reduce((sum, p) => sum + p.sessionCount, 0),
      sessionsImported: 0,
      totalPrompts,
      promptsImported: 0,
    };
    setImportProgress(initialProgress);

    // Simulate import progress (in production, this would call the actual import API)
    for (let i = 0; i < selectedProjects.length; i++) {
      // Mark file as importing
      setImportProgress((prev) => {
        if (!prev) return prev;
        const files = prev.files.map((f, idx) =>
          idx === i ? { ...f, status: 'importing' as const, startedAt: new Date() } : f
        );
        return { ...prev, files };
      });

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));

      // Mark file as complete - use project from the outer scope which is guaranteed to exist
      const currentProject = selectedProjects[i]!;
      setImportProgress((prev) => {
        if (!prev) return prev;
        const files = prev.files.map((f, idx) =>
          idx === i
            ? {
                ...f,
                status: 'complete' as const,
                sessionsImported: currentProject.sessionCount,
                promptsImported: currentProject.totalPrompts,
                completedAt: new Date(),
              }
            : f
        );
        const sessionsImported = files.reduce((sum, f) => sum + f.sessionsImported, 0);
        const promptsImported = files.reduce((sum, f) => sum + f.promptsImported, 0);
        return {
          ...prev,
          files,
          sessionsImported,
          promptsImported,
        };
      });

      // Update overall progress
      updateProgress(i + 1);
    }

    // Mark as complete
    setImportProgress((prev) => {
      if (!prev) return prev;
      return { ...prev, status: 'complete', completedAt: new Date() };
    });
    completeImport(
      selectedProjects.reduce((sum, p) => sum + p.sessionCount, 0),
      0,
      0
    );
  };

  const handleSkip = () => {
    skip();
    router.push('/home');
  };

  const handleContinue = () => {
    router.push('/prompts');
  };

  // Loading state
  if (loading) {
    return (
      <div
        className="flex items-center justify-center min-h-[calc(100vh-200px)]"
        data-testid="import-loading"
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Discovering your Claude Code history...</p>
        </div>
      </div>
    );
  }

  // No discovery data - redirect (handled in useEffect)
  if (!discoveryResult) {
    return null;
  }

  // Discovery/Selection phase
  if (state.phase === 'discovery' || state.phase === 'selection') {
    return (
      <div
        className="flex items-center justify-center min-h-[calc(100vh-200px)] p-4"
        data-testid="import-preview-container"
      >
        <DiscoveryImportPreview
          discoveryResult={discoveryResult}
          onImport={handleImport}
          onSkip={handleSkip}
        />
      </div>
    );
  }

  // Importing phase
  if (state.phase === 'importing' && importProgress) {
    return (
      <div className="max-w-2xl mx-auto p-4" data-testid="import-progress-container">
        <Card>
          <CardContent className="pt-6">
            <ImportProgress progress={importProgress} />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Complete phase
  if (state.phase === 'complete' && importProgress) {
    const duration = importStartTime
      ? Math.round((new Date().getTime() - importStartTime.getTime()) / 1000)
      : 0;

    return (
      <div className="max-w-2xl mx-auto p-4" data-testid="import-complete-container">
        <Card>
          <CardContent className="pt-6">
            <ImportCompleteSummary
              sessionsImported={importProgress.sessionsImported}
              promptsImported={importProgress.promptsImported}
              errorCount={importProgress.files.filter((f) => f.status === 'error').length}
              durationSeconds={duration}
              onViewSessions={handleContinue}
              onClose={handleContinue}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Skipped phase - should have redirected
  if (state.phase === 'skipped') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">Import was skipped.</p>
            <Button onClick={() => router.push('/home')}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
