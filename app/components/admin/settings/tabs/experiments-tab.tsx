'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Beaker, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InlineAlert } from '@/components/feedback';
import { ExperimentCard } from '@/components/admin/experiment-card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ExperimentWithVariants, ExperimentStatus } from '@/lib/types/experiments';

interface ExperimentsTabProps {
  searchParams: {
    status?: string;
  };
}

type StatusFilter = ExperimentStatus | 'all' | undefined;

interface ExperimentsResponse {
  data: ExperimentWithVariants[];
}

function ExperimentsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-48" />
      ))}
    </div>
  );
}

/**
 * Experiments Tab
 *
 * A/B testing experiment management.
 */
export function ExperimentsTab({ searchParams }: ExperimentsTabProps) {
  const router = useRouter();
  const urlSearchParams = useSearchParams();
  const statusFilter = (searchParams.status as StatusFilter) || 'all';

  const [experiments, setExperiments] = useState<ExperimentWithVariants[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExperiments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/experiments');
      if (!response.ok) {
        throw new Error('Failed to fetch experiments');
      }
      const data: ExperimentsResponse = await response.json();
      setExperiments(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExperiments();
  }, [fetchExperiments]);

  // Count experiments by status
  const statusCounts = {
    all: experiments.length,
    draft: 0,
    running: 0,
    paused: 0,
    completed: 0,
  };

  experiments.forEach((exp) => {
    if (exp.status === 'draft') statusCounts.draft++;
    else if (exp.status === 'running') statusCounts.running++;
    else if (exp.status === 'paused') statusCounts.paused++;
    else if (exp.status === 'completed' || exp.status === 'analyzing') statusCounts.completed++;
  });

  // Filter experiments by status
  const filteredExperiments = experiments.filter((exp) => {
    if (!statusFilter || statusFilter === 'all') return true;
    if (statusFilter === 'completed') {
      return exp.status === 'completed' || exp.status === 'analyzing';
    }
    return exp.status === statusFilter;
  });

  const handleStatusChange = (status: string) => {
    const params = new URLSearchParams(urlSearchParams.toString());
    params.set('tab', 'experiments');
    if (status !== 'all') {
      params.set('status', status);
    } else {
      params.delete('status');
    }
    router.push(`/admin/settings?${params.toString()}`);
  };

  return (
    <div data-testid="experiments-tab" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Beaker className="h-5 w-5" />
            A/B Experiments
          </h2>
          <p className="text-muted-foreground text-sm">
            Test configuration changes with controlled experiments
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/settings/experiments/new">
            <Plus className="mr-2 h-4 w-4" />
            New Experiment
          </Link>
        </Button>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Badge
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => handleStatusChange('all')}
        >
          All ({statusCounts.all})
        </Badge>
        <Badge
          variant={statusFilter === 'draft' ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => handleStatusChange('draft')}
        >
          Draft ({statusCounts.draft})
        </Badge>
        <Badge
          variant={statusFilter === 'running' ? 'default' : 'outline'}
          className="cursor-pointer bg-green-500/20 text-green-500 hover:bg-green-500/30"
          onClick={() => handleStatusChange('running')}
        >
          Running ({statusCounts.running})
        </Badge>
        <Badge
          variant={statusFilter === 'paused' ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => handleStatusChange('paused')}
        >
          Paused ({statusCounts.paused})
        </Badge>
        <Badge
          variant={statusFilter === 'completed' ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => handleStatusChange('completed')}
        >
          Completed ({statusCounts.completed})
        </Badge>
      </div>

      {/* Error */}
      {error && <InlineAlert variant="error" message={error} />}

      {/* Experiments Grid */}
      {isLoading ? (
        <ExperimentsSkeleton />
      ) : filteredExperiments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Beaker className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>No experiments found.</p>
          {statusFilter !== 'all' && (
            <p className="text-sm mt-2">
              Try changing the status filter or create a new experiment.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredExperiments.map((experiment) => (
            <ExperimentCard
              key={experiment.id}
              experiment={experiment}
            />
          ))}
        </div>
      )}
    </div>
  );
}
