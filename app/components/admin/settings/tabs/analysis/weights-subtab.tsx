import { WeightConfiguration } from '@/components/admin/weight-configuration';
import { InlineAlert } from '@/components/feedback';
import { getCurrentWeights } from '@/lib/services/scoring-weights';

/**
 * Weights Subtab
 *
 * Scoring weight configuration.
 */
export async function WeightsSubtab() {
  const result = await getCurrentWeights();

  if (!result.success) {
    return (
      <div data-testid="weights-subtab" className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Configure scoring weights for prompt analysis dimensions.
        </p>
        <InlineAlert
          variant="error"
          title="Failed to load weights"
          message={result.error.message}
        />
      </div>
    );
  }

  const { dimensions, config_id, is_active } = result.data;

  // Convert dimensions to weights record
  const weightsRecord = dimensions.reduce(
    (acc, dim) => {
      acc[dim.id] = dim.weight;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div data-testid="weights-subtab" className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Configure scoring weights for prompt analysis dimensions.
      </p>

      <WeightConfiguration
        weights={weightsRecord}
        dimensions={dimensions}
        readOnly={!is_active}
        isLocked={!is_active}
        lockedReason={!is_active ? 'Only active configurations can be edited' : undefined}
      />
    </div>
  );
}
