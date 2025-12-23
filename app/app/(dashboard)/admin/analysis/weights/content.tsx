'use client';

import { useState, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { showToast } from '@/components/feedback';
import { WeightAdjuster } from '@/components/admin/weight-adjuster';
import { WeightHistory } from '@/components/admin/weight-history';
import { WeightPreview } from '@/components/admin/weight-preview';
import { saveWeights, revertToHistoricalWeights } from '@/lib/services/scoring-weights';
import type { WeightConfiguration, WeightHistoryEntry, DimensionWeight } from '@/lib/types/scoring-weights';
import { Eye } from 'lucide-react';

interface ScoringWeightsContentProps {
  initialWeights: WeightConfiguration;
  initialHistory: WeightHistoryEntry[];
}

export function ScoringWeightsContent({
  initialWeights,
  initialHistory,
}: ScoringWeightsContentProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [currentWeights, setCurrentWeights] = useState<DimensionWeight[]>(initialWeights.dimensions);

  const handleSave = useCallback(
    async (weights: Array<{ dimension_id: string; weight: number; enabled: boolean }>) => {
      setIsSaving(true);

      try {
        const result = await saveWeights({
          config_id: initialWeights.config_id,
          weights,
        });

        if (result.success) {
          // Update local state with new weights
          setCurrentWeights((prev) =>
            prev.map((d) => {
              const updated = weights.find((w) => w.dimension_id === d.id);
              return updated ? { ...d, weight: updated.weight, enabled: updated.enabled } : d;
            })
          );

          // Refresh the page to get updated history
          startTransition(() => {
            router.refresh();
          });

          return { success: true };
        } else {
          return { success: false, error: result.error.message };
        }
      } catch (error) {
        console.error('[ScoringWeights] Save error:', error);
        return { success: false, error: 'An unexpected error occurred' };
      } finally {
        setIsSaving(false);
      }
    },
    [initialWeights.config_id, router]
  );

  const handleRevert = useCallback(
    async (historyEntryId: string) => {
      setIsReverting(true);

      try {
        const result = await revertToHistoricalWeights(historyEntryId);

        if (result.success) {
          showToast.success('Weights reverted successfully');

          // Refresh the page to get updated weights and history
          startTransition(() => {
            router.refresh();
          });

          return { success: true };
        } else {
          showToast.error(result.error.message);
          return { success: false, error: result.error.message };
        }
      } catch (error) {
        console.error('[ScoringWeights] Revert error:', error);
        showToast.error('An unexpected error occurred');
        return { success: false, error: 'An unexpected error occurred' };
      } finally {
        setIsReverting(false);
      }
    },
    [router]
  );

  const handleWeightsChange = useCallback((weights: DimensionWeight[]) => {
    setCurrentWeights(weights);
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main weight adjuster (2/3 width on large screens) */}
      <div className="lg:col-span-2 space-y-6">
        <WeightAdjuster
          dimensions={initialWeights.dimensions}
          onSave={handleSave}
          defaultWeights={initialWeights.dimensions}
          isSaving={isSaving || isPending}
        />

        {/* Preview button */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
            data-testid="preview-impact-button"
          >
            <Eye className="mr-2 h-4 w-4" />
            {showPreview ? 'Hide Preview' : 'Preview Impact'}
          </Button>
        </div>

        {/* Preview panel */}
        {showPreview && (
          <WeightPreview currentWeights={currentWeights} onClose={() => setShowPreview(false)} />
        )}
      </div>

      {/* History sidebar (1/3 width on large screens) */}
      <div className="lg:col-span-1">
        <WeightHistory
          history={initialHistory}
          onRevert={handleRevert}
          isReverting={isReverting || isPending}
        />
      </div>
    </div>
  );
}
