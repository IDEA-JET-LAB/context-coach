import { Metadata } from 'next';
import { requireSuperAdmin } from '@/lib/auth/admin';
import { getCurrentWeights, getWeightHistory } from '@/lib/services/scoring-weights';
import { InlineAlert } from '@/components/feedback';
import { ScoringWeightsContent } from './content';

export const metadata: Metadata = {
  title: 'Scoring Weights | Admin | Contextor',
  description: 'Configure analysis dimension weights for prompt scoring',
};

export default async function ScoringWeightsPage() {
  // Require super admin access
  await requireSuperAdmin();

  // Fetch current weights and history in parallel
  const [weightsResult, historyResult] = await Promise.all([
    getCurrentWeights(),
    getWeightHistory(10),
  ]);

  if (!weightsResult.success) {
    return (
      <div data-testid="weights-page" className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Scoring Weights</h2>
          <p className="text-muted-foreground">
            Configure how each dimension contributes to the overall score
          </p>
        </div>
        <InlineAlert
          variant="error"
          title="Failed to load weights"
          message={weightsResult.error.message}
        />
      </div>
    );
  }

  return (
    <div data-testid="weights-page" className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-foreground">Scoring Weights</h2>
        <p className="text-muted-foreground">
          Configure how each dimension contributes to the overall score
        </p>
        <p className="text-sm text-muted-foreground">
          Active Config: <span className="font-medium text-foreground">{weightsResult.data.config_name}</span>
          {' (v'}{weightsResult.data.config_version}{')'}
        </p>
      </div>

      <ScoringWeightsContent
        initialWeights={weightsResult.data}
        initialHistory={historyResult.success ? historyResult.data : []}
      />
    </div>
  );
}
