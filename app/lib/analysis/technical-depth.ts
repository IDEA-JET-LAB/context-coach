/**
 * Technical Depth Profiler for Contextor
 * Story 21-8: Technical Depth Profile
 *
 * Classifies users into technical personas based on their prompting patterns:
 * - architect: High-level thinker focused on design decisions
 * - firefighter: Reactive problem solver, often in fix-it mode
 * - craftsman: Balanced approach with strong quality focus
 * - explorer: Experimental approach with diverse patterns
 *
 * Uses work style distribution data from Story 21-2 to calculate ratios.
 */

import { WorkStyleCategory } from './work-style-classifier';

/**
 * The four technical personas for user classification.
 */
export type TechnicalPersona = 'architect' | 'firefighter' | 'craftsman' | 'explorer';

/**
 * Breakdown of work style ratios used for profile calculation.
 */
export interface TechnicalBreakdown {
  /** Ratio of architecture_questions prompts */
  architectureRatio: number;
  /** Ratio of debugging prompts */
  debuggingRatio: number;
  /** Ratio of testing prompts */
  testingRatio: number;
  /** Ratio of implementation (file_operations + deployment) prompts */
  implementationRatio: number;
  /** Ratio of business/UX focus (design_iteration + business_discussion + context_recovery) prompts */
  businessUxRatio: number;
}

/**
 * Result of technical depth profile calculation.
 */
export interface TechnicalDepthProfile {
  /** The classified persona */
  persona: TechnicalPersona;
  /** Confidence score from 0.0 to 1.0 */
  confidence: number;
  /** Breakdown of work style ratios */
  breakdown: TechnicalBreakdown;
  /** Human-readable description of the persona */
  personaDescription: string;
}

/**
 * Work style distribution input type.
 * Maps work style category names to their counts.
 */
export type WorkStyleDistribution = Partial<Record<WorkStyleCategory, number>>;

/**
 * Persona descriptions for each technical profile.
 */
export const PERSONA_DESCRIPTIONS: Record<TechnicalPersona, string> = {
  architect: 'High-level thinker focused on design decisions and system structure',
  firefighter: 'Reactive problem solver, often in fix-it mode',
  craftsman: 'Balanced approach with strong quality focus',
  explorer: 'Experimental approach with diverse prompting patterns',
};

/**
 * Description for insufficient data scenario.
 */
export const INSUFFICIENT_DATA_DESCRIPTION = 'Not enough data to determine profile';

/**
 * Confidence thresholds for each persona type.
 */
export const PERSONA_CONFIDENCE: Record<TechnicalPersona, number> = {
  architect: 0.80,
  firefighter: 0.75,
  craftsman: 0.85,
  explorer: 0.60,
};

/**
 * Classification thresholds per AC requirements.
 */
export const CLASSIFICATION_THRESHOLDS = {
  /** Architect: architectureRatio > 0.2 */
  architectMinArchitecture: 0.20,
  /** Architect: debuggingRatio < 0.15 */
  architectMaxDebugging: 0.15,
  /** Firefighter: debuggingRatio > 0.2 */
  firefighterMinDebugging: 0.20,
  /** Firefighter: testingRatio < 0.10 */
  firefighterMaxTesting: 0.10,
  /** Craftsman: testingRatio > 0.12 */
  craftsmanMinTesting: 0.12,
  /** Craftsman: balance tolerance for arch vs implementation */
  craftsmanBalanceTolerance: 0.10,
} as const;

/**
 * Calculates the total count from a work style distribution.
 *
 * @param distribution - Work style category counts
 * @returns Total prompt count
 */
export function calculateTotal(distribution: WorkStyleDistribution): number {
  return Object.values(distribution).reduce((sum, count) => sum + (count || 0), 0);
}

/**
 * Calculates the architecture ratio from distribution.
 *
 * @param distribution - Work style category counts
 * @param total - Total prompt count
 * @returns Ratio of architecture prompts (0-1)
 */
export function calculateArchitectureRatio(
  distribution: WorkStyleDistribution,
  total: number
): number {
  if (total === 0) return 0;
  return (distribution.architecture_questions || 0) / total;
}

/**
 * Calculates the debugging ratio from distribution.
 *
 * @param distribution - Work style category counts
 * @param total - Total prompt count
 * @returns Ratio of debugging prompts (0-1)
 */
export function calculateDebuggingRatio(
  distribution: WorkStyleDistribution,
  total: number
): number {
  if (total === 0) return 0;
  return (distribution.debugging || 0) / total;
}

/**
 * Calculates the testing ratio from distribution.
 *
 * @param distribution - Work style category counts
 * @param total - Total prompt count
 * @returns Ratio of testing prompts (0-1)
 */
export function calculateTestingRatio(
  distribution: WorkStyleDistribution,
  total: number
): number {
  if (total === 0) return 0;
  return (distribution.testing || 0) / total;
}

/**
 * Calculates the implementation ratio from distribution.
 * Implementation = file_operations + deployment
 *
 * @param distribution - Work style category counts
 * @param total - Total prompt count
 * @returns Ratio of implementation prompts (0-1)
 */
export function calculateImplementationRatio(
  distribution: WorkStyleDistribution,
  total: number
): number {
  if (total === 0) return 0;
  const fileOps = distribution.file_operations || 0;
  const deployment = distribution.deployment || 0;
  return (fileOps + deployment) / total;
}

/**
 * Calculates the business/UX focus ratio from distribution.
 *
 * Per AC #8: businessUxRatio = (documentation + refactoring + learning) / total
 *
 * Since current work style categories don't include documentation/refactoring/learning,
 * we use: design_iteration + business_discussion + context_recovery as proxy
 * These represent non-technical, user-facing or meta-level activities.
 *
 * @param distribution - Work style category counts
 * @param total - Total prompt count
 * @returns Ratio of business/UX focus prompts (0-1)
 */
export function calculateBusinessUxRatio(
  distribution: WorkStyleDistribution,
  total: number
): number {
  if (total === 0) return 0;
  const designIteration = distribution.design_iteration || 0;
  const businessDiscussion = distribution.business_discussion || 0;
  const contextRecovery = distribution.context_recovery || 0;
  return (designIteration + businessDiscussion + contextRecovery) / total;
}

/**
 * Calculates all breakdown ratios from a work style distribution.
 *
 * @param distribution - Work style category counts
 * @returns All ratio breakdowns
 */
export function calculateBreakdown(distribution: WorkStyleDistribution): TechnicalBreakdown {
  const total = calculateTotal(distribution);

  return {
    architectureRatio: calculateArchitectureRatio(distribution, total),
    debuggingRatio: calculateDebuggingRatio(distribution, total),
    testingRatio: calculateTestingRatio(distribution, total),
    implementationRatio: calculateImplementationRatio(distribution, total),
    businessUxRatio: calculateBusinessUxRatio(distribution, total),
  };
}

/**
 * Determines if the user matches the architect persona.
 * Rule: architectureRatio > 0.2 AND debuggingRatio < 0.15
 *
 * @param breakdown - Calculated ratios
 * @returns True if user matches architect profile
 */
export function isArchitect(breakdown: TechnicalBreakdown): boolean {
  return (
    breakdown.architectureRatio > CLASSIFICATION_THRESHOLDS.architectMinArchitecture &&
    breakdown.debuggingRatio < CLASSIFICATION_THRESHOLDS.architectMaxDebugging
  );
}

/**
 * Determines if the user matches the firefighter persona.
 * Rule: debuggingRatio > 0.2 AND testingRatio < 0.10
 *
 * @param breakdown - Calculated ratios
 * @returns True if user matches firefighter profile
 */
export function isFirefighter(breakdown: TechnicalBreakdown): boolean {
  return (
    breakdown.debuggingRatio > CLASSIFICATION_THRESHOLDS.firefighterMinDebugging &&
    breakdown.testingRatio < CLASSIFICATION_THRESHOLDS.firefighterMaxTesting
  );
}

/**
 * Determines if the user matches the craftsman persona.
 * Rule: testingRatio > 0.12 AND balanced architecture/implementation
 * (difference between architectureRatio and implementationRatio < 0.10)
 *
 * @param breakdown - Calculated ratios
 * @returns True if user matches craftsman profile
 */
export function isCraftsman(breakdown: TechnicalBreakdown): boolean {
  const isBalanced =
    Math.abs(breakdown.architectureRatio - breakdown.implementationRatio) <
    CLASSIFICATION_THRESHOLDS.craftsmanBalanceTolerance;

  return (
    breakdown.testingRatio > CLASSIFICATION_THRESHOLDS.craftsmanMinTesting && isBalanced
  );
}

/**
 * Classifies a user into a technical persona based on breakdown ratios.
 * Priority order: architect -> firefighter -> craftsman -> explorer
 *
 * @param breakdown - Calculated ratios
 * @returns The classified persona
 */
export function classifyPersona(breakdown: TechnicalBreakdown): TechnicalPersona {
  if (isArchitect(breakdown)) {
    return 'architect';
  }
  if (isFirefighter(breakdown)) {
    return 'firefighter';
  }
  if (isCraftsman(breakdown)) {
    return 'craftsman';
  }
  return 'explorer';
}

/**
 * Creates an empty technical depth profile for zero data scenario.
 *
 * @returns Profile with explorer persona and insufficient data message
 */
export function createEmptyProfile(): TechnicalDepthProfile {
  return {
    persona: 'explorer',
    confidence: 0.30,
    breakdown: {
      architectureRatio: 0,
      debuggingRatio: 0,
      testingRatio: 0,
      implementationRatio: 0,
      businessUxRatio: 0,
    },
    personaDescription: INSUFFICIENT_DATA_DESCRIPTION,
  };
}

/**
 * Calculates the technical depth profile for a user based on their work style distribution.
 *
 * Uses pattern matching to classify users into one of four personas:
 * - architect: >20% architecture, <15% debugging
 * - firefighter: >20% debugging, <10% testing
 * - craftsman: >12% testing, balanced arch/impl
 * - explorer: default for diverse patterns
 *
 * @param workStyleDistribution - Map of work style categories to counts
 * @returns Technical depth profile with persona, confidence, breakdown, and description
 *
 * @example
 * ```ts
 * calculateTechnicalProfile({ architecture_questions: 30, debugging: 10, testing: 5, file_operations: 55 })
 * // => { persona: 'architect', confidence: 0.80, breakdown: {...}, personaDescription: '...' }
 *
 * calculateTechnicalProfile({})
 * // => { persona: 'explorer', confidence: 0.30, breakdown: {...}, personaDescription: 'Not enough data...' }
 * ```
 */
export function calculateTechnicalProfile(
  workStyleDistribution: WorkStyleDistribution
): TechnicalDepthProfile {
  const total = calculateTotal(workStyleDistribution);

  // Handle zero total case
  if (total === 0) {
    return createEmptyProfile();
  }

  // Calculate breakdown ratios
  const breakdown = calculateBreakdown(workStyleDistribution);

  // Classify persona
  const persona = classifyPersona(breakdown);

  // Get confidence and description for the persona
  const confidence = PERSONA_CONFIDENCE[persona];
  const personaDescription = PERSONA_DESCRIPTIONS[persona];

  return {
    persona,
    confidence,
    breakdown,
    personaDescription,
  };
}
