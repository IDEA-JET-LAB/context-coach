# Story 22.8: Statistical Significance Calculation

Status: Ready

## Story

**As a** system,
**I want** to calculate statistical significance of A/B experiment results using t-tests and effect size,
**So that** super admins can make data-driven decisions about which configuration performs better.

## Acceptance Criteria

1. **Given** an experiment has reached minimum sample sizes
   **When** statistics are calculated
   **Then** a two-sample t-test is performed on mean scores
   **And** a p-value is computed

2. **Given** the p-value is below the significance threshold
   **When** the results are displayed
   **Then** the experiment is marked as having a statistically significant result
   **And** the winning variant is identified

3. **Given** the experiment has results
   **When** effect size is calculated
   **Then** Cohen's d is computed for practical significance
   **And** the effect is categorized (small/medium/large)

4. **Given** the experiment is analyzing
   **When** confidence intervals are computed
   **Then** 95% CI for the difference in means is shown
   **And** the interval width indicates precision

5. **Given** sample sizes are unequal
   **When** t-test is performed
   **Then** Welch's t-test (unequal variances) is used
   **And** the result accounts for the imbalance

6. **Given** an experiment meets completion criteria
   **When** auto-promote is enabled
   **Then** the winning variant's config is automatically activated
   **And** the experiment status changes to completed

## Dependencies

- **Story 22.6**: A/B Experiment Creation (experiment data model)
- **Story 22.7**: A/B Traffic Splitting (sample collection)
- **Story 22.9**: Experiment Results Dashboard (display results)

## Tasks / Subtasks

- [ ] **Task 1: Implement two-sample t-test** (AC: #1, #5)
  - [ ] Create `lib/utils/statistics.ts`
  - [ ] Implement Welch's t-test for unequal variances
  - [ ] Calculate t-statistic from sample means and variances
  - [ ] Compute degrees of freedom (Welch-Satterthwaite)
  - [ ] Add unit tests with known values

- [ ] **Task 2: Implement p-value calculation** (AC: #1, #2)
  - [ ] Implement Student's t-distribution CDF
  - [ ] Calculate two-tailed p-value from t-statistic
  - [ ] Handle edge cases (very small/large t-values)
  - [ ] Validate against reference implementations

- [ ] **Task 3: Implement effect size calculation** (AC: #3)
  - [ ] Calculate Cohen's d: (mean1 - mean2) / pooled_std
  - [ ] Categorize effect: small (0.2), medium (0.5), large (0.8)
  - [ ] Handle edge cases (zero variance)
  - [ ] Add interpretation helper

- [ ] **Task 4: Implement confidence interval calculation** (AC: #4)
  - [ ] Calculate 95% CI for difference in means
  - [ ] Use appropriate formula for unequal variances
  - [ ] Return lower bound, upper bound, width
  - [ ] Interpret if CI contains zero

- [ ] **Task 5: Create statistics service** (AC: #1-4)
  - [ ] Create `lib/services/experiment-statistics.ts`
  - [ ] Collect sample data from experiment variants
  - [ ] Call statistical functions
  - [ ] Store results in experiment record

- [ ] **Task 6: Implement significance detection** (AC: #2)
  - [ ] Compare p-value to experiment's threshold
  - [ ] Determine winner based on higher mean score
  - [ ] Handle inconclusive results (p >= threshold)
  - [ ] Set experiment winner_variant field

- [ ] **Task 7: Create completion criteria checker** (AC: #6)
  - [ ] Check minimum sample size per variant
  - [ ] Check minimum experiment duration
  - [ ] Check if statistical significance reached
  - [ ] Return completion status and reason

- [ ] **Task 8: Implement auto-promotion** (AC: #6)
  - [ ] Check if auto_promote_winner is enabled
  - [ ] Verify experiment has significant winner
  - [ ] Activate winning variant's config
  - [ ] Update experiment status to completed
  - [ ] Log promotion to audit trail

- [ ] **Task 9: Create scheduled statistics job** (AC: #1-6)
  - [ ] Create Supabase Edge Function `calculate-experiment-stats`
  - [ ] Run every hour for running experiments
  - [ ] Update mean, std_deviation, sample_count per variant
  - [ ] Calculate p-value and effect size
  - [ ] Check completion criteria

- [ ] **Task 10: Write comprehensive tests** (AC: #1-6)
  - [ ] Create `lib/utils/__tests__/statistics.test.ts`
  - [ ] Test t-test with known values
  - [ ] Test effect size categories
  - [ ] Test confidence intervals
  - [ ] Test with simulated experiment data

## Dev Notes

### Statistical Functions

```typescript
// lib/utils/statistics.ts

/**
 * Sample statistics for a variant
 */
export interface SampleStats {
  n: number;        // Sample size
  mean: number;     // Sample mean
  variance: number; // Sample variance
  stdDev: number;   // Sample standard deviation
}

/**
 * T-test result
 */
export interface TTestResult {
  t_statistic: number;
  degrees_of_freedom: number;
  p_value: number;
  significant: boolean;
  significance_level: number;
}

/**
 * Effect size result
 */
export interface EffectSize {
  cohens_d: number;
  category: 'negligible' | 'small' | 'medium' | 'large';
  interpretation: string;
}

/**
 * Confidence interval
 */
export interface ConfidenceInterval {
  lower: number;
  upper: number;
  width: number;
  contains_zero: boolean;
  confidence_level: number;
}

/**
 * Calculate sample statistics from data array
 */
export function calculateSampleStats(data: number[]): SampleStats {
  const n = data.length;
  if (n === 0) {
    return { n: 0, mean: 0, variance: 0, stdDev: 0 };
  }

  const mean = data.reduce((sum, x) => sum + x, 0) / n;

  // Sample variance (n-1 denominator for unbiased estimate)
  const variance = n > 1
    ? data.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / (n - 1)
    : 0;

  return {
    n,
    mean,
    variance,
    stdDev: Math.sqrt(variance),
  };
}

/**
 * Welch's t-test for two samples with possibly unequal variances
 *
 * @param control - Control group statistics
 * @param variant - Variant group statistics
 * @param alpha - Significance level (default 0.05)
 */
export function welchTTest(
  control: SampleStats,
  variant: SampleStats,
  alpha: number = 0.05
): TTestResult {
  // Can't compute with insufficient data
  if (control.n < 2 || variant.n < 2) {
    return {
      t_statistic: 0,
      degrees_of_freedom: 0,
      p_value: 1,
      significant: false,
      significance_level: alpha,
    };
  }

  // Welch's t-statistic
  const s1_sq_n1 = control.variance / control.n;
  const s2_sq_n2 = variant.variance / variant.n;

  const t = (variant.mean - control.mean) / Math.sqrt(s1_sq_n1 + s2_sq_n2);

  // Welch-Satterthwaite degrees of freedom
  const numerator = Math.pow(s1_sq_n1 + s2_sq_n2, 2);
  const denominator =
    Math.pow(s1_sq_n1, 2) / (control.n - 1) +
    Math.pow(s2_sq_n2, 2) / (variant.n - 1);

  const df = numerator / denominator;

  // Calculate two-tailed p-value
  const p_value = 2 * (1 - studentTCDF(Math.abs(t), df));

  return {
    t_statistic: t,
    degrees_of_freedom: df,
    p_value,
    significant: p_value < alpha,
    significance_level: alpha,
  };
}

/**
 * Student's t-distribution CDF approximation
 * Using the regularized incomplete beta function
 */
export function studentTCDF(t: number, df: number): number {
  // Use approximation for large df
  if (df > 1000) {
    // Approximate with normal distribution
    return normalCDF(t);
  }

  const x = df / (df + t * t);
  const prob = 0.5 * incompleteBeta(df / 2, 0.5, x);

  return t < 0 ? prob : 1 - prob;
}

/**
 * Standard normal CDF (approximation)
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Regularized incomplete beta function (approximation)
 */
function incompleteBeta(a: number, b: number, x: number): number {
  // Use continued fraction approximation
  // This is a simplified version - production should use a robust library
  if (x === 0) return 0;
  if (x === 1) return 1;

  const bt = Math.exp(
    lgamma(a + b) - lgamma(a) - lgamma(b) +
    a * Math.log(x) + b * Math.log(1 - x)
  );

  if (x < (a + 1) / (a + b + 2)) {
    return bt * betaCF(a, b, x) / a;
  } else {
    return 1 - bt * betaCF(b, a, 1 - x) / b;
  }
}

/**
 * Continued fraction for incomplete beta
 */
function betaCF(a: number, b: number, x: number): number {
  const maxIterations = 200;
  const epsilon = 1e-10;

  let c = 1;
  let d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= maxIterations; m++) {
    const m2 = 2 * m;

    // Even step
    let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;

    // Odd step
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1) < epsilon) break;
  }

  return h;
}

/**
 * Log gamma function approximation (Stirling's)
 */
function lgamma(x: number): number {
  const c = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.1208650973866179e-2,
    -0.5395239384953e-5
  ];

  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;

  for (let j = 0; j < 6; j++) {
    ser += c[j] / ++y;
  }

  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

/**
 * Calculate Cohen's d effect size
 */
export function calculateEffectSize(
  control: SampleStats,
  variant: SampleStats
): EffectSize {
  // Pooled standard deviation
  const pooledVar =
    ((control.n - 1) * control.variance + (variant.n - 1) * variant.variance) /
    (control.n + variant.n - 2);
  const pooledStd = Math.sqrt(pooledVar);

  // Cohen's d
  const cohens_d = pooledStd > 0
    ? (variant.mean - control.mean) / pooledStd
    : 0;

  // Categorize effect size
  const absD = Math.abs(cohens_d);
  let category: EffectSize['category'];
  let interpretation: string;

  if (absD < 0.2) {
    category = 'negligible';
    interpretation = 'The difference is too small to be practically meaningful.';
  } else if (absD < 0.5) {
    category = 'small';
    interpretation = 'A small but potentially meaningful difference.';
  } else if (absD < 0.8) {
    category = 'medium';
    interpretation = 'A moderate, practically significant difference.';
  } else {
    category = 'large';
    interpretation = 'A large, clearly meaningful difference.';
  }

  return { cohens_d, category, interpretation };
}

/**
 * Calculate confidence interval for difference in means
 */
export function calculateConfidenceInterval(
  control: SampleStats,
  variant: SampleStats,
  confidenceLevel: number = 0.95
): ConfidenceInterval {
  const alpha = 1 - confidenceLevel;
  const meanDiff = variant.mean - control.mean;

  // Standard error of the difference
  const se = Math.sqrt(control.variance / control.n + variant.variance / variant.n);

  // Degrees of freedom (Welch-Satterthwaite)
  const s1_sq_n1 = control.variance / control.n;
  const s2_sq_n2 = variant.variance / variant.n;
  const df =
    Math.pow(s1_sq_n1 + s2_sq_n2, 2) /
    (Math.pow(s1_sq_n1, 2) / (control.n - 1) + Math.pow(s2_sq_n2, 2) / (variant.n - 1));

  // Critical t-value (approximation for two-tailed test)
  const tCrit = tCriticalValue(df, alpha / 2);

  const margin = tCrit * se;
  const lower = meanDiff - margin;
  const upper = meanDiff + margin;

  return {
    lower,
    upper,
    width: upper - lower,
    contains_zero: lower <= 0 && upper >= 0,
    confidence_level: confidenceLevel,
  };
}

/**
 * Critical t-value approximation
 */
function tCriticalValue(df: number, alpha: number): number {
  // For common values, use lookup or Newton-Raphson inversion
  // This is a rough approximation
  if (df > 100) {
    // Normal approximation for large df
    return 1.96 * (alpha === 0.025 ? 1 : 1.28);
  }

  // Simple approximation for typical cases
  const zAlpha = -normalQuantile(alpha);
  const g1 = (zAlpha * zAlpha * zAlpha + zAlpha) / 4;
  const g2 = (5 * Math.pow(zAlpha, 5) + 16 * zAlpha * zAlpha * zAlpha + 3 * zAlpha) / 96;

  return zAlpha + g1 / df + g2 / (df * df);
}

function normalQuantile(p: number): number {
  // Inverse normal CDF approximation
  const a = [
    -3.969683028665376e1, 2.209460984245205e2,
    -2.759285104469687e2, 1.383577518672690e2,
    -3.066479806614716e1, 2.506628277459239e0
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2,
    -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1,
    -2.400758277161838e0, -2.549732539343734e0,
    4.374664141464968e0, 2.938163982698783e0
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1,
    2.445134137142996e0, 3.754408661907416e0
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q, r;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
}
```

### Statistics Service

```typescript
// lib/services/experiment-statistics.ts

import { createAdminClient } from '@/lib/supabase/admin';
import {
  calculateSampleStats,
  welchTTest,
  calculateEffectSize,
  calculateConfidenceInterval,
  type SampleStats,
  type TTestResult,
  type EffectSize,
  type ConfidenceInterval,
} from '@/lib/utils/statistics';
import { activateConfig } from './config-activation';
import { logAdminAction } from './admin-users';

export interface ExperimentStatistics {
  control: SampleStats;
  variant: SampleStats;
  tTest: TTestResult;
  effectSize: EffectSize;
  confidenceInterval: ConfidenceInterval;
  winner: 'control' | 'variant' | 'inconclusive';
  meetsCompletionCriteria: boolean;
  completionReason: string;
}

/**
 * Calculate statistics for an experiment
 */
export async function calculateExperimentStatistics(
  experimentId: string
): Promise<ExperimentStatistics | null> {
  const supabase = createAdminClient();

  // Get experiment
  const { data: experiment } = await supabase
    .from('experiments')
    .select(`
      id, min_sample_size, min_duration_hours, significance_threshold,
      activated_at, success_metric,
      experiment_variants(variant_name, sample_count, mean_score, std_deviation)
    `)
    .eq('id', experimentId)
    .single();

  if (!experiment) return null;

  const controlVariant = experiment.experiment_variants.find(
    (v: any) => v.variant_name === 'control'
  );
  const testVariant = experiment.experiment_variants.find(
    (v: any) => v.variant_name === 'variant'
  );

  // Get actual score data for each variant
  const { data: controlScores } = await supabase
    .from('prompt_analyses')
    .select('overall_score')
    .eq('experiment_id', experimentId)
    .eq('experiment_variant', 'control');

  const { data: variantScores } = await supabase
    .from('prompt_analyses')
    .select('overall_score')
    .eq('experiment_id', experimentId)
    .eq('experiment_variant', 'variant');

  // Calculate sample statistics
  const controlStats = calculateSampleStats(
    (controlScores || []).map((s: any) => s.overall_score)
  );
  const variantStats = calculateSampleStats(
    (variantScores || []).map((s: any) => s.overall_score)
  );

  // Perform statistical tests
  const tTest = welchTTest(controlStats, variantStats, experiment.significance_threshold);
  const effectSize = calculateEffectSize(controlStats, variantStats);
  const confidenceInterval = calculateConfidenceInterval(controlStats, variantStats);

  // Determine winner
  let winner: 'control' | 'variant' | 'inconclusive' = 'inconclusive';
  if (tTest.significant) {
    winner = variantStats.mean > controlStats.mean ? 'variant' : 'control';
  }

  // Check completion criteria
  const minSampleMet =
    controlStats.n >= experiment.min_sample_size &&
    variantStats.n >= experiment.min_sample_size;

  const activatedAt = new Date(experiment.activated_at);
  const minDurationMet =
    Date.now() - activatedAt.getTime() >= experiment.min_duration_hours * 60 * 60 * 1000;

  const meetsCompletionCriteria = minSampleMet && minDurationMet && tTest.significant;

  let completionReason = '';
  if (!minSampleMet) {
    completionReason = `Need ${experiment.min_sample_size} samples per variant (control: ${controlStats.n}, variant: ${variantStats.n})`;
  } else if (!minDurationMet) {
    completionReason = `Minimum duration not met (${experiment.min_duration_hours} hours required)`;
  } else if (!tTest.significant) {
    completionReason = `Not statistically significant (p=${tTest.p_value.toFixed(4)}, threshold=${experiment.significance_threshold})`;
  } else {
    completionReason = 'All completion criteria met';
  }

  // Update variant statistics in database
  await supabase
    .from('experiment_variants')
    .update({
      mean_score: controlStats.mean,
      std_deviation: controlStats.stdDev,
      sample_count: controlStats.n,
    })
    .eq('experiment_id', experimentId)
    .eq('variant_name', 'control');

  await supabase
    .from('experiment_variants')
    .update({
      mean_score: variantStats.mean,
      std_deviation: variantStats.stdDev,
      sample_count: variantStats.n,
    })
    .eq('experiment_id', experimentId)
    .eq('variant_name', 'variant');

  // Update experiment with results
  await supabase
    .from('experiments')
    .update({
      winner_variant: winner,
      p_value: tTest.p_value,
      effect_size: effectSize.cohens_d,
      confidence_interval: {
        lower: confidenceInterval.lower,
        upper: confidenceInterval.upper,
      },
    })
    .eq('id', experimentId);

  return {
    control: controlStats,
    variant: variantStats,
    tTest,
    effectSize,
    confidenceInterval,
    winner,
    meetsCompletionCriteria,
    completionReason,
  };
}

/**
 * Check and handle experiment completion
 */
export async function checkExperimentCompletion(experimentId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: experiment } = await supabase
    .from('experiments')
    .select('id, status, auto_promote_winner, winner_variant')
    .eq('id', experimentId)
    .single();

  if (!experiment || experiment.status !== 'running') return;

  const stats = await calculateExperimentStatistics(experimentId);
  if (!stats || !stats.meetsCompletionCriteria) return;

  // Move to analyzing state
  await supabase
    .from('experiments')
    .update({ status: 'analyzing' })
    .eq('id', experimentId);

  // If auto-promote enabled and we have a winner
  if (experiment.auto_promote_winner && stats.winner !== 'inconclusive') {
    const { data: winningVariant } = await supabase
      .from('experiment_variants')
      .select('config_id')
      .eq('experiment_id', experimentId)
      .eq('variant_name', stats.winner)
      .single();

    if (winningVariant) {
      await activateConfig(winningVariant.config_id);
      await logAdminAction('system', 'experiment_auto_promoted' as any, {
        experiment_id: experimentId,
        winner: stats.winner,
        config_id: winningVariant.config_id,
      });
    }
  }

  // Complete experiment
  await supabase
    .from('experiments')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', experimentId);
}
```

### Edge Function for Scheduled Stats

```typescript
// supabase/functions/calculate-experiment-stats/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { calculateExperimentStatistics, checkExperimentCompletion } from './statistics.ts';

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all running experiments
    const { data: experiments } = await supabase
      .from('experiments')
      .select('id')
      .eq('status', 'running');

    const results = [];

    for (const experiment of experiments || []) {
      const stats = await calculateExperimentStatistics(experiment.id);
      await checkExperimentCompletion(experiment.id);
      results.push({ id: experiment.id, stats });
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

### Component File Locations

| Component | Path |
|-----------|------|
| Statistics Utilities | `lib/utils/statistics.ts` |
| Statistics Tests | `lib/utils/__tests__/statistics.test.ts` |
| Statistics Service | `lib/services/experiment-statistics.ts` |
| Edge Function | `supabase/functions/calculate-experiment-stats/index.ts` |

### Verification Checklist

After completing this story, verify:
- [ ] T-test produces correct p-values
- [ ] Effect size categorization is accurate
- [ ] Confidence intervals are correctly calculated
- [ ] Winner is identified when significant
- [ ] Inconclusive when not significant
- [ ] Completion criteria all checked
- [ ] Auto-promotion activates winning config
- [ ] Scheduled job runs for all running experiments
- [ ] Statistics stored in experiment record


## Design System Requirements

**MANDATORY:** This story MUST use existing design system components exclusively.

### Pre-Implementation Checklist
- [ ] Reviewed `_bmad-output/DESIGN-SYSTEM-MANDATE.md` for component inventory
- [ ] Checked `/design` route for component examples
- [ ] Identified required components from the inventory below
- [ ] Confirmed no hardcoded colors - using semantic tokens only
- [ ] No new UI patterns needed (or Design Epic story created)

### Required Components
<!-- Dev agent: Fill in specific components needed from DESIGN-SYSTEM-MANDATE.md -->
- Review `/design` route and `components/` directory before implementation
- Use semantic tokens: `bg-surface-*`, `text-content-*`, `border-border-*`

### Styling Rules
- NO hardcoded colors (no `bg-zinc-*`, `text-gray-*`, etc.)
- Use existing components from `components/` directory
- Extend existing components before creating new ones

## Dev Agent Record

### Agent Model Used
{{agent_model_name_version}}

### Completion Notes List
*To be filled by dev agent after implementation*

### Change Log
| Date | Change | Author |
|------|--------|--------|

### File List
*To be filled by dev agent - list all files created/modified*
