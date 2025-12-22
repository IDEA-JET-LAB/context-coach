import { Metadata } from 'next';
import { AnalysisConfigForm } from '@/components/admin/analysis-config-form';

export const metadata: Metadata = {
  title: 'Create Analysis Config | Admin | Contextor',
  description: 'Create a new analysis configuration version',
};

export default function NewConfigPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Create New Configuration</h2>
        <p className="text-muted-foreground">
          Define a new analysis configuration for scoring prompts
        </p>
      </div>

      <AnalysisConfigForm mode="create" />
    </div>
  );
}
