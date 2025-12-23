/**
 * Default Weight Configuration
 *
 * Provides default values for scoring dimension weights.
 */

export const DEFAULT_DIMENSION_WEIGHTS: Record<string, number> = {
  clarity: 20,
  context: 20,
  specificity: 25,
  goal: 20,
  constraints: 15,
};

export const DIMENSION_CONSTRAINTS: Record<string, { min: number; max: number }> = {
  clarity: { min: 5, max: 50 },
  context: { min: 5, max: 50 },
  specificity: { min: 5, max: 50 },
  goal: { min: 5, max: 50 },
  constraints: { min: 5, max: 50 },
};

/**
 * Get the default weight for a dimension by name.
 * Returns 20 if the dimension is not found.
 */
export function getDefaultWeight(dimensionName: string): number {
  const normalizedName = dimensionName.toLowerCase().replace(/[\s_-]+/g, '');
  return DEFAULT_DIMENSION_WEIGHTS[normalizedName] ?? 20;
}

/**
 * Get all default weights as an array of {name, weight} objects.
 */
export function getDefaultWeightsArray(): Array<{ name: string; weight: number }> {
  return Object.entries(DEFAULT_DIMENSION_WEIGHTS).map(([name, weight]) => ({
    name,
    weight,
  }));
}

/**
 * Calculate if weights are balanced (sum to 100).
 */
export function areWeightsBalanced(weights: number[]): boolean {
  return weights.reduce((sum, w) => sum + w, 0) === 100;
}

/**
 * Auto-balance weights to sum to 100.
 * Distributes remainder to first N dimensions.
 */
export function autoBalanceWeights(
  dimensions: Array<{ id: string; enabled: boolean; weight: number }>
): Array<{ id: string; weight: number }> {
  const enabledDimensions = dimensions.filter((d) => d.enabled);
  const disabledDimensions = dimensions.filter((d) => !d.enabled);

  if (enabledDimensions.length === 0) {
    return dimensions.map((d) => ({ id: d.id, weight: 0 }));
  }

  const baseWeight = Math.floor(100 / enabledDimensions.length);
  const remainder = 100 % enabledDimensions.length;

  let assignedRemainder = 0;
  const balancedEnabled = enabledDimensions.map((d) => {
    const extra = assignedRemainder < remainder ? 1 : 0;
    assignedRemainder++;
    return { id: d.id, weight: baseWeight + extra };
  });

  const balancedDisabled = disabledDimensions.map((d) => ({
    id: d.id,
    weight: 0,
  }));

  return [...balancedEnabled, ...balancedDisabled];
}
