import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Beaker } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InlineAlert } from '@/components/feedback';
import { ExperimentForm } from '@/components/admin/experiment-form';
import { ExperimentDetailView } from '@/components/admin/experiment-detail-view';
import { ExperimentStatusBadge } from '@/components/admin/experiment-status-badge';
import { getExperiment } from '@/lib/services/experiments';
import { getAnalysisConfigs } from '@/lib/services/admin-config';

export const metadata: Metadata = {
  title: 'Experiment Details | Admin | Contextor',
  description: 'View or edit experiment details',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ExperimentDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [experimentResult, configsResult] = await Promise.all([
    getExperiment(id),
    getAnalysisConfigs(),
  ]);

  if (!experimentResult.success) {
    if (experimentResult.error.code === 'NOT_FOUND') {
      notFound();
    }
    return (
      <div className="space-y-6">
        <InlineAlert
          variant="error"
          title="Failed to load experiment"
          message={experimentResult.error.message}
        />
      </div>
    );
  }

  const experiment = experimentResult.data;
  const isDraft = experiment.status === 'draft';

  return (
    <div data-testid="experiment-detail-page" className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/experiments">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Beaker className="h-6 w-6" />
              {experiment.name}
            </h2>
            <ExperimentStatusBadge status={experiment.status} />
          </div>
          <p className="text-muted-foreground line-clamp-1">
            {experiment.hypothesis}
          </p>
        </div>
      </div>

      {/* Content based on status */}
      {isDraft ? (
        // Editable form for draft experiments
        configsResult.success ? (
          <ExperimentForm
            configs={configsResult.data}
            experiment={experiment}
            mode="edit"
          />
        ) : (
          <InlineAlert
            variant="error"
            title="Failed to load configurations"
            message={configsResult.error.message}
          />
        )
      ) : (
        // Read-only view for non-draft experiments
        <ExperimentDetailView experiment={experiment} />
      )}
    </div>
  );
}
