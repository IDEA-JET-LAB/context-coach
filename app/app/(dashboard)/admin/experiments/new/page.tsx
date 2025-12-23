import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, Beaker } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InlineAlert } from '@/components/feedback';
import { ExperimentForm } from '@/components/admin/experiment-form';
import { getAnalysisConfigs } from '@/lib/services/admin-config';

export const metadata: Metadata = {
  title: 'New Experiment | Admin | Contextor',
  description: 'Create a new A/B experiment',
};

export default async function NewExperimentPage() {
  const configsResult = await getAnalysisConfigs();

  return (
    <div data-testid="new-experiment-page" className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/experiments">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Beaker className="h-6 w-6" />
            New Experiment
          </h2>
          <p className="text-muted-foreground">
            Create a new A/B experiment to test configuration changes
          </p>
        </div>
      </div>

      {/* Form */}
      {configsResult.success ? (
        configsResult.data.length >= 2 ? (
          <ExperimentForm configs={configsResult.data} mode="create" />
        ) : (
          <InlineAlert
            variant="warning"
            title="Not enough configurations"
            message="You need at least 2 analysis configurations to create an experiment. Create more configurations first."
          />
        )
      ) : (
        <InlineAlert
          variant="error"
          title="Failed to load configurations"
          message={configsResult.error.message}
        />
      )}
    </div>
  );
}
