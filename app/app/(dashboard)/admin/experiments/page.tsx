import { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Beaker, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InlineAlert } from '@/components/feedback';
import { ExperimentCard } from '@/components/admin/experiment-card';
import { getExperiments } from '@/lib/services/experiments';
import type { ExperimentStatus } from '@/lib/types/experiments';

export const metadata: Metadata = {
  title: 'A/B Experiments | Admin | Contextor',
  description: 'Manage A/B experiments for analysis configuration testing',
};

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

type StatusFilter = ExperimentStatus | 'all' | undefined;

export default async function AdminExperimentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const result = await getExperiments();
  const statusFilter = params.status as StatusFilter;

  // Count experiments by status
  const statusCounts = {
    all: result.success ? result.data.length : 0,
    draft: 0,
    running: 0,
    paused: 0,
    completed: 0,
  };

  if (result.success) {
    result.data.forEach((exp) => {
      if (exp.status === 'draft') statusCounts.draft++;
      else if (exp.status === 'running') statusCounts.running++;
      else if (exp.status === 'paused') statusCounts.paused++;
      else if (exp.status === 'completed' || exp.status === 'analyzing') statusCounts.completed++;
    });
  }

  // Filter experiments by status
  const filteredExperiments = result.success
    ? result.data.filter((exp) => {
        if (!statusFilter || statusFilter === 'all') return true;
        if (statusFilter === 'completed') {
          return exp.status === 'completed' || exp.status === 'analyzing';
        }
        return exp.status === statusFilter;
      })
    : [];

  return (
    <div data-testid="experiments-page" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Beaker className="h-6 w-6" />
            A/B Experiments
          </h2>
          <p className="text-muted-foreground">
            Test configuration changes with controlled experiments
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/experiments/new">
            <Plus className="mr-2 h-4 w-4" />
            New Experiment
          </Link>
        </Button>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Link href="/admin/experiments">
          <Badge
            variant={!statusFilter || statusFilter === 'all' ? 'default' : 'outline'}
            className="cursor-pointer"
          >
            All ({statusCounts.all})
          </Badge>
        </Link>
        <Link href="/admin/experiments?status=draft">
          <Badge
            variant={statusFilter === 'draft' ? 'default' : 'outline'}
            className="cursor-pointer"
          >
            Draft ({statusCounts.draft})
          </Badge>
        </Link>
        <Link href="/admin/experiments?status=running">
          <Badge
            variant={statusFilter === 'running' ? 'default' : 'outline'}
            className="cursor-pointer bg-green-500/20 text-green-500 hover:bg-green-500/30"
          >
            Running ({statusCounts.running})
          </Badge>
        </Link>
        <Link href="/admin/experiments?status=paused">
          <Badge
            variant={statusFilter === 'paused' ? 'default' : 'outline'}
            className="cursor-pointer bg-amber-500/20 text-amber-500 hover:bg-amber-500/30"
          >
            Paused ({statusCounts.paused})
          </Badge>
        </Link>
        <Link href="/admin/experiments?status=completed">
          <Badge
            variant={statusFilter === 'completed' ? 'default' : 'outline'}
            className="cursor-pointer"
          >
            Completed ({statusCounts.completed})
          </Badge>
        </Link>
      </div>

      {/* Experiment List */}
      {result.success ? (
        filteredExperiments.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredExperiments.map((experiment) => (
              <ExperimentCard key={experiment.id} experiment={experiment} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Beaker className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground">No experiments found</h3>
            <p className="text-muted-foreground mt-1 mb-4">
              {statusFilter
                ? `No ${statusFilter} experiments yet`
                : 'Create your first experiment to start testing'}
            </p>
            {!statusFilter && (
              <Button asChild>
                <Link href="/admin/experiments/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Experiment
                </Link>
              </Button>
            )}
          </div>
        )
      ) : (
        <InlineAlert
          variant="error"
          title="Failed to load experiments"
          message={result.error.message}
        />
      )}
    </div>
  );
}
