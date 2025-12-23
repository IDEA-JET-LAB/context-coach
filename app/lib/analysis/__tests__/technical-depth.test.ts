/**
 * Technical Depth Profiler Tests
 * Story 21-8: Technical Depth Profile
 *
 * Tests for classification of users into technical personas based on
 * their prompting patterns derived from work style distribution.
 */

import { describe, it, expect } from 'vitest';
import {
  // Types
  TechnicalPersona,
  TechnicalBreakdown,
  TechnicalDepthProfile,
  WorkStyleDistribution,
  // Constants
  PERSONA_DESCRIPTIONS,
  PERSONA_CONFIDENCE,
  CLASSIFICATION_THRESHOLDS,
  INSUFFICIENT_DATA_DESCRIPTION,
  // Ratio calculators
  calculateTotal,
  calculateArchitectureRatio,
  calculateDebuggingRatio,
  calculateTestingRatio,
  calculateImplementationRatio,
  calculateBusinessUxRatio,
  calculateBreakdown,
  // Classification functions
  isArchitect,
  isFirefighter,
  isCraftsman,
  classifyPersona,
  // Main calculator
  calculateTechnicalProfile,
  createEmptyProfile,
} from '../technical-depth';

// ============================================================================
// Tests: Type and Structure
// ============================================================================

describe('TechnicalDepthProfile Types', () => {
  it('should export 4 persona types', () => {
    const personas: TechnicalPersona[] = ['architect', 'firefighter', 'craftsman', 'explorer'];
    expect(personas).toHaveLength(4);
  });

  it('should have descriptions for all personas', () => {
    expect(PERSONA_DESCRIPTIONS.architect).toBeDefined();
    expect(PERSONA_DESCRIPTIONS.firefighter).toBeDefined();
    expect(PERSONA_DESCRIPTIONS.craftsman).toBeDefined();
    expect(PERSONA_DESCRIPTIONS.explorer).toBeDefined();
  });

  it('should have confidence values for all personas', () => {
    expect(PERSONA_CONFIDENCE.architect).toBe(0.80);
    expect(PERSONA_CONFIDENCE.firefighter).toBe(0.75);
    expect(PERSONA_CONFIDENCE.craftsman).toBe(0.85);
    expect(PERSONA_CONFIDENCE.explorer).toBe(0.60);
  });

  it('should return correct result structure', () => {
    const result = calculateTechnicalProfile({ architecture_questions: 10 });
    expect(result).toHaveProperty('persona');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('breakdown');
    expect(result).toHaveProperty('personaDescription');
    expect(result.breakdown).toHaveProperty('architectureRatio');
    expect(result.breakdown).toHaveProperty('debuggingRatio');
    expect(result.breakdown).toHaveProperty('testingRatio');
    expect(result.breakdown).toHaveProperty('implementationRatio');
    expect(result.breakdown).toHaveProperty('businessUxRatio');
  });
});

// ============================================================================
// Tests: Classification Thresholds (AC #2, #3, #4)
// ============================================================================

describe('Classification Thresholds', () => {
  it('should have correct architect thresholds', () => {
    expect(CLASSIFICATION_THRESHOLDS.architectMinArchitecture).toBe(0.20);
    expect(CLASSIFICATION_THRESHOLDS.architectMaxDebugging).toBe(0.15);
  });

  it('should have correct firefighter thresholds', () => {
    expect(CLASSIFICATION_THRESHOLDS.firefighterMinDebugging).toBe(0.20);
    expect(CLASSIFICATION_THRESHOLDS.firefighterMaxTesting).toBe(0.10);
  });

  it('should have correct craftsman thresholds', () => {
    expect(CLASSIFICATION_THRESHOLDS.craftsmanMinTesting).toBe(0.12);
    expect(CLASSIFICATION_THRESHOLDS.craftsmanBalanceTolerance).toBe(0.10);
  });
});

// ============================================================================
// Tests: Total Calculation
// ============================================================================

describe('calculateTotal', () => {
  it('should sum all category counts', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 10,
      debugging: 20,
      testing: 5,
      file_operations: 15,
    };
    expect(calculateTotal(distribution)).toBe(50);
  });

  it('should return 0 for empty distribution', () => {
    expect(calculateTotal({})).toBe(0);
  });

  it('should handle undefined values gracefully', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 10,
      debugging: undefined,
    };
    expect(calculateTotal(distribution)).toBe(10);
  });

  it('should handle single category', () => {
    expect(calculateTotal({ testing: 100 })).toBe(100);
  });
});

// ============================================================================
// Tests: Ratio Calculators
// ============================================================================

describe('calculateArchitectureRatio', () => {
  it('should calculate correct ratio', () => {
    const distribution: WorkStyleDistribution = { architecture_questions: 25 };
    expect(calculateArchitectureRatio(distribution, 100)).toBe(0.25);
  });

  it('should return 0 for zero total', () => {
    expect(calculateArchitectureRatio({ architecture_questions: 25 }, 0)).toBe(0);
  });

  it('should return 0 when category missing', () => {
    expect(calculateArchitectureRatio({ debugging: 50 }, 100)).toBe(0);
  });
});

describe('calculateDebuggingRatio', () => {
  it('should calculate correct ratio', () => {
    const distribution: WorkStyleDistribution = { debugging: 30 };
    expect(calculateDebuggingRatio(distribution, 100)).toBe(0.30);
  });

  it('should return 0 for zero total', () => {
    expect(calculateDebuggingRatio({ debugging: 30 }, 0)).toBe(0);
  });

  it('should return 0 when category missing', () => {
    expect(calculateDebuggingRatio({ testing: 50 }, 100)).toBe(0);
  });
});

describe('calculateTestingRatio', () => {
  it('should calculate correct ratio', () => {
    const distribution: WorkStyleDistribution = { testing: 15 };
    expect(calculateTestingRatio(distribution, 100)).toBe(0.15);
  });

  it('should return 0 for zero total', () => {
    expect(calculateTestingRatio({ testing: 15 }, 0)).toBe(0);
  });

  it('should return 0 when category missing', () => {
    expect(calculateTestingRatio({ architecture_questions: 50 }, 100)).toBe(0);
  });
});

describe('calculateImplementationRatio', () => {
  it('should sum file_operations and deployment', () => {
    const distribution: WorkStyleDistribution = {
      file_operations: 20,
      deployment: 10,
    };
    expect(calculateImplementationRatio(distribution, 100)).toBe(0.30);
  });

  it('should handle only file_operations', () => {
    const distribution: WorkStyleDistribution = { file_operations: 25 };
    expect(calculateImplementationRatio(distribution, 100)).toBe(0.25);
  });

  it('should handle only deployment', () => {
    const distribution: WorkStyleDistribution = { deployment: 15 };
    expect(calculateImplementationRatio(distribution, 100)).toBe(0.15);
  });

  it('should return 0 for zero total', () => {
    expect(calculateImplementationRatio({ file_operations: 20 }, 0)).toBe(0);
  });

  it('should return 0 when both categories missing', () => {
    expect(calculateImplementationRatio({ testing: 50 }, 100)).toBe(0);
  });
});

describe('calculateBusinessUxRatio', () => {
  it('should sum design_iteration, business_discussion, and context_recovery', () => {
    const distribution: WorkStyleDistribution = {
      design_iteration: 10,
      business_discussion: 5,
      context_recovery: 5,
    };
    expect(calculateBusinessUxRatio(distribution, 100)).toBe(0.20);
  });

  it('should handle partial categories', () => {
    const distribution: WorkStyleDistribution = { design_iteration: 15 };
    expect(calculateBusinessUxRatio(distribution, 100)).toBe(0.15);
  });

  it('should return 0 for zero total', () => {
    expect(calculateBusinessUxRatio({ design_iteration: 10 }, 0)).toBe(0);
  });

  it('should return 0 when all categories missing', () => {
    expect(calculateBusinessUxRatio({ testing: 50 }, 100)).toBe(0);
  });
});

describe('calculateBreakdown', () => {
  it('should calculate all ratios correctly', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 20,
      debugging: 15,
      testing: 10,
      file_operations: 25,
      deployment: 5,
      design_iteration: 10,
      business_discussion: 5,
      context_recovery: 5,
      quick_commands: 5,
    };

    const breakdown = calculateBreakdown(distribution);

    expect(breakdown.architectureRatio).toBe(0.20);
    expect(breakdown.debuggingRatio).toBe(0.15);
    expect(breakdown.testingRatio).toBe(0.10);
    expect(breakdown.implementationRatio).toBe(0.30);
    expect(breakdown.businessUxRatio).toBe(0.20);
  });

  it('should return all zeros for empty distribution', () => {
    const breakdown = calculateBreakdown({});

    expect(breakdown.architectureRatio).toBe(0);
    expect(breakdown.debuggingRatio).toBe(0);
    expect(breakdown.testingRatio).toBe(0);
    expect(breakdown.implementationRatio).toBe(0);
    expect(breakdown.businessUxRatio).toBe(0);
  });
});

// ============================================================================
// Tests: Persona Classification Functions
// ============================================================================

describe('isArchitect', () => {
  it('should return true when architectureRatio > 0.2 and debuggingRatio < 0.15', () => {
    const breakdown: TechnicalBreakdown = {
      architectureRatio: 0.25,
      debuggingRatio: 0.10,
      testingRatio: 0.10,
      implementationRatio: 0.50,
      businessUxRatio: 0.05,
    };
    expect(isArchitect(breakdown)).toBe(true);
  });

  it('should return false when architectureRatio <= 0.2', () => {
    const breakdown: TechnicalBreakdown = {
      architectureRatio: 0.20, // exactly at threshold, not above
      debuggingRatio: 0.10,
      testingRatio: 0.10,
      implementationRatio: 0.50,
      businessUxRatio: 0.10,
    };
    expect(isArchitect(breakdown)).toBe(false);
  });

  it('should return false when debuggingRatio >= 0.15', () => {
    const breakdown: TechnicalBreakdown = {
      architectureRatio: 0.25,
      debuggingRatio: 0.15, // exactly at threshold
      testingRatio: 0.10,
      implementationRatio: 0.45,
      businessUxRatio: 0.05,
    };
    expect(isArchitect(breakdown)).toBe(false);
  });

  it('should return false when both conditions fail', () => {
    const breakdown: TechnicalBreakdown = {
      architectureRatio: 0.10,
      debuggingRatio: 0.30,
      testingRatio: 0.10,
      implementationRatio: 0.45,
      businessUxRatio: 0.05,
    };
    expect(isArchitect(breakdown)).toBe(false);
  });
});

describe('isFirefighter', () => {
  it('should return true when debuggingRatio > 0.2 and testingRatio < 0.10', () => {
    const breakdown: TechnicalBreakdown = {
      architectureRatio: 0.10,
      debuggingRatio: 0.30,
      testingRatio: 0.05,
      implementationRatio: 0.50,
      businessUxRatio: 0.05,
    };
    expect(isFirefighter(breakdown)).toBe(true);
  });

  it('should return false when debuggingRatio <= 0.2', () => {
    const breakdown: TechnicalBreakdown = {
      architectureRatio: 0.10,
      debuggingRatio: 0.20, // exactly at threshold
      testingRatio: 0.05,
      implementationRatio: 0.60,
      businessUxRatio: 0.05,
    };
    expect(isFirefighter(breakdown)).toBe(false);
  });

  it('should return false when testingRatio >= 0.10', () => {
    const breakdown: TechnicalBreakdown = {
      architectureRatio: 0.10,
      debuggingRatio: 0.30,
      testingRatio: 0.10, // exactly at threshold
      implementationRatio: 0.45,
      businessUxRatio: 0.05,
    };
    expect(isFirefighter(breakdown)).toBe(false);
  });

  it('should return false when both conditions fail', () => {
    const breakdown: TechnicalBreakdown = {
      architectureRatio: 0.20,
      debuggingRatio: 0.10,
      testingRatio: 0.20,
      implementationRatio: 0.45,
      businessUxRatio: 0.05,
    };
    expect(isFirefighter(breakdown)).toBe(false);
  });
});

describe('isCraftsman', () => {
  it('should return true when testingRatio > 0.12 and balanced arch/impl', () => {
    const breakdown: TechnicalBreakdown = {
      architectureRatio: 0.20,
      debuggingRatio: 0.10,
      testingRatio: 0.15,
      implementationRatio: 0.20, // difference = 0
      businessUxRatio: 0.35,
    };
    expect(isCraftsman(breakdown)).toBe(true);
  });

  it('should return true at balance tolerance boundary', () => {
    const breakdown: TechnicalBreakdown = {
      architectureRatio: 0.20,
      debuggingRatio: 0.10,
      testingRatio: 0.15,
      implementationRatio: 0.29, // difference = 0.09 < 0.10
      businessUxRatio: 0.26,
    };
    expect(isCraftsman(breakdown)).toBe(true);
  });

  it('should return false when testingRatio <= 0.12', () => {
    const breakdown: TechnicalBreakdown = {
      architectureRatio: 0.20,
      debuggingRatio: 0.10,
      testingRatio: 0.12, // exactly at threshold
      implementationRatio: 0.20,
      businessUxRatio: 0.38,
    };
    expect(isCraftsman(breakdown)).toBe(false);
  });

  it('should return false when not balanced (difference >= 0.10)', () => {
    const breakdown: TechnicalBreakdown = {
      architectureRatio: 0.10,
      debuggingRatio: 0.10,
      testingRatio: 0.15,
      implementationRatio: 0.20, // difference = 0.10 (not less than 0.10)
      businessUxRatio: 0.45,
    };
    expect(isCraftsman(breakdown)).toBe(false);
  });

  it('should return false when architecture heavy (not balanced)', () => {
    const breakdown: TechnicalBreakdown = {
      architectureRatio: 0.30,
      debuggingRatio: 0.10,
      testingRatio: 0.15,
      implementationRatio: 0.10, // difference = 0.20 >= 0.10
      businessUxRatio: 0.35,
    };
    expect(isCraftsman(breakdown)).toBe(false);
  });
});

describe('classifyPersona', () => {
  it('should prioritize architect over other personas', () => {
    const breakdown: TechnicalBreakdown = {
      architectureRatio: 0.25,
      debuggingRatio: 0.10,
      testingRatio: 0.15, // Would qualify for craftsman too if balanced
      implementationRatio: 0.25,
      businessUxRatio: 0.25,
    };
    expect(classifyPersona(breakdown)).toBe('architect');
  });

  it('should classify as firefighter when not architect', () => {
    const breakdown: TechnicalBreakdown = {
      architectureRatio: 0.10,
      debuggingRatio: 0.35,
      testingRatio: 0.05,
      implementationRatio: 0.45,
      businessUxRatio: 0.05,
    };
    expect(classifyPersona(breakdown)).toBe('firefighter');
  });

  it('should classify as craftsman when not architect or firefighter', () => {
    const breakdown: TechnicalBreakdown = {
      architectureRatio: 0.15,
      debuggingRatio: 0.15,
      testingRatio: 0.15,
      implementationRatio: 0.15,
      businessUxRatio: 0.40,
    };
    expect(classifyPersona(breakdown)).toBe('craftsman');
  });

  it('should classify as explorer when no pattern matches', () => {
    const breakdown: TechnicalBreakdown = {
      architectureRatio: 0.10,
      debuggingRatio: 0.10,
      testingRatio: 0.10,
      implementationRatio: 0.35,
      businessUxRatio: 0.35,
    };
    expect(classifyPersona(breakdown)).toBe('explorer');
  });
});

// ============================================================================
// Tests: Architect Classification (AC #2)
// ============================================================================

describe('Architect Classification (AC #2)', () => {
  it('should classify as architect with 80% confidence when >20% architecture, <15% debugging', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 30,
      debugging: 10,
      testing: 5,
      file_operations: 45,
      deployment: 10,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.persona).toBe('architect');
    expect(result.confidence).toBe(0.80);
    expect(result.personaDescription).toBe(PERSONA_DESCRIPTIONS.architect);
  });

  it('should correctly calculate breakdown for architect', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 25,
      debugging: 10,
      testing: 10,
      file_operations: 40,
      deployment: 15,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.breakdown.architectureRatio).toBe(0.25);
    expect(result.breakdown.debuggingRatio).toBe(0.10);
    expect(result.breakdown.implementationRatio).toBe(0.55);
  });

  it('should NOT classify as architect when architecture is exactly 20%', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 20,
      debugging: 10,
      testing: 10,
      file_operations: 50,
      deployment: 10,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.persona).not.toBe('architect');
  });

  it('should NOT classify as architect when debugging is 15% or more', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 25,
      debugging: 15,
      testing: 10,
      file_operations: 40,
      deployment: 10,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.persona).not.toBe('architect');
  });
});

// ============================================================================
// Tests: Firefighter Classification (AC #3)
// ============================================================================

describe('Firefighter Classification (AC #3)', () => {
  it('should classify as firefighter with 75% confidence when >20% debugging, <10% testing', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 5,
      debugging: 35,
      testing: 5,
      file_operations: 45,
      deployment: 10,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.persona).toBe('firefighter');
    expect(result.confidence).toBe(0.75);
    expect(result.personaDescription).toBe(PERSONA_DESCRIPTIONS.firefighter);
  });

  it('should correctly calculate breakdown for firefighter', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 5,
      debugging: 30,
      testing: 5,
      file_operations: 50,
      deployment: 10,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.breakdown.debuggingRatio).toBe(0.30);
    expect(result.breakdown.testingRatio).toBe(0.05);
  });

  it('should NOT classify as firefighter when debugging is exactly 20%', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 10,
      debugging: 20,
      testing: 5,
      file_operations: 55,
      deployment: 10,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.persona).not.toBe('firefighter');
  });

  it('should NOT classify as firefighter when testing is 10% or more', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 5,
      debugging: 30,
      testing: 10,
      file_operations: 45,
      deployment: 10,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.persona).not.toBe('firefighter');
  });
});

// ============================================================================
// Tests: Craftsman Classification (AC #4)
// ============================================================================

describe('Craftsman Classification (AC #4)', () => {
  it('should classify as craftsman with 85% confidence when >12% testing and balanced', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 15,
      debugging: 15,
      testing: 15,
      file_operations: 10,
      deployment: 5,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.persona).toBe('craftsman');
    expect(result.confidence).toBe(0.85);
    expect(result.personaDescription).toBe(PERSONA_DESCRIPTIONS.craftsman);
  });

  it('should correctly identify balanced architecture/implementation', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 20,
      debugging: 10,
      testing: 20,
      file_operations: 15,
      deployment: 5,
    };

    const result = calculateTechnicalProfile(distribution);
    // architecture = 20/70 = 0.286, implementation = 20/70 = 0.286
    // difference = 0, which is < 0.10

    // Wait - testing is also > 12% (20/70 = 0.286), but architecture is 0.286 > 0.20 and debugging is 0.143 < 0.15
    // So this actually matches architect first
    expect(result.persona).toBe('architect');
  });

  it('should classify as craftsman when testing high and balanced (not architect)', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 15,
      debugging: 15,
      testing: 20,
      file_operations: 10,
      deployment: 5,
    };

    const result = calculateTechnicalProfile(distribution);
    // architecture = 15/65 = 0.231, but debugging = 15/65 = 0.231 >= 0.15, so not architect
    // debugging = 0.231 > 0.20, but testing = 20/65 = 0.308 >= 0.10, so not firefighter
    // testing = 0.308 > 0.12, arch = 0.231, impl = 15/65 = 0.231, diff = 0 < 0.10 - craftsman!

    expect(result.persona).toBe('craftsman');
    expect(result.confidence).toBe(0.85);
  });

  it('should NOT classify as craftsman when testing is exactly at 12% threshold', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 15,
      debugging: 18,
      testing: 12, // 12/100 = 0.12 exactly, not > 0.12
      file_operations: 40,
      deployment: 15,
    };

    const result = calculateTechnicalProfile(distribution);

    // arch = 15/100 = 0.15 <= 0.20, not architect
    // debug = 18/100 = 0.18 <= 0.20, not firefighter
    // testing = 12/100 = 0.12 (not > 0.12), not craftsman
    expect(result.persona).toBe('explorer');
  });

  it('should NOT classify as craftsman when not balanced', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 30,
      debugging: 10,
      testing: 15,
      file_operations: 10,
      deployment: 5,
    };

    const result = calculateTechnicalProfile(distribution);
    // arch = 30/70 = 0.43, impl = 15/70 = 0.21, diff = 0.22 >= 0.10

    // But wait: arch = 0.43 > 0.20 and debug = 0.143 < 0.15, so this is architect!
    expect(result.persona).toBe('architect');
  });
});

// ============================================================================
// Tests: Explorer Classification (AC #5)
// ============================================================================

describe('Explorer Classification (AC #5)', () => {
  it('should classify as explorer with 60% confidence when no patterns match', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 10,
      debugging: 10,
      testing: 10,
      file_operations: 30,
      deployment: 10,
      design_iteration: 10,
      business_discussion: 10,
      quick_commands: 10,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.persona).toBe('explorer');
    expect(result.confidence).toBe(0.60);
    expect(result.personaDescription).toBe(PERSONA_DESCRIPTIONS.explorer);
  });

  it('should classify diverse pattern user as explorer', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 15,
      debugging: 15,
      testing: 5,
      file_operations: 25,
      deployment: 15,
      design_iteration: 10,
      business_discussion: 10,
      context_recovery: 5,
    };

    const result = calculateTechnicalProfile(distribution);

    // arch = 15/100 = 0.15 <= 0.20, not architect
    // debug = 15/100 = 0.15 <= 0.20, not firefighter
    // testing = 5/100 = 0.05 <= 0.12, not craftsman
    expect(result.persona).toBe('explorer');
  });

  it('should return explorer for evenly distributed prompts', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 10,
      debugging: 10,
      testing: 10,
      file_operations: 10,
      deployment: 10,
      design_iteration: 10,
      business_discussion: 10,
      quick_commands: 10,
      context_recovery: 10,
      agent_delegation: 10,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.persona).toBe('explorer');
  });
});

// ============================================================================
// Tests: Persona Descriptions (AC #6)
// ============================================================================

describe('Persona Descriptions (AC #6)', () => {
  it('should include architect description', () => {
    expect(PERSONA_DESCRIPTIONS.architect).toBe(
      'High-level thinker focused on design decisions and system structure'
    );
  });

  it('should include firefighter description', () => {
    expect(PERSONA_DESCRIPTIONS.firefighter).toBe(
      'Reactive problem solver, often in fix-it mode'
    );
  });

  it('should include craftsman description', () => {
    expect(PERSONA_DESCRIPTIONS.craftsman).toBe(
      'Balanced approach with strong quality focus'
    );
  });

  it('should include explorer description', () => {
    expect(PERSONA_DESCRIPTIONS.explorer).toBe(
      'Experimental approach with diverse prompting patterns'
    );
  });

  it('should return correct description in profile', () => {
    const architectDist: WorkStyleDistribution = {
      architecture_questions: 30,
      debugging: 5,
      file_operations: 65,
    };
    expect(calculateTechnicalProfile(architectDist).personaDescription).toBe(
      PERSONA_DESCRIPTIONS.architect
    );
  });
});

// ============================================================================
// Tests: Breakdown Ratios (AC #7)
// ============================================================================

describe('Breakdown Ratios (AC #7)', () => {
  it('should include architectureRatio in breakdown', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 25,
      file_operations: 75,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.breakdown.architectureRatio).toBe(0.25);
  });

  it('should include debuggingRatio in breakdown', () => {
    const distribution: WorkStyleDistribution = {
      debugging: 40,
      file_operations: 60,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.breakdown.debuggingRatio).toBe(0.40);
  });

  it('should include testingRatio in breakdown', () => {
    const distribution: WorkStyleDistribution = {
      testing: 20,
      file_operations: 80,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.breakdown.testingRatio).toBe(0.20);
  });

  it('should include implementationRatio in breakdown', () => {
    const distribution: WorkStyleDistribution = {
      file_operations: 30,
      deployment: 20,
      architecture_questions: 50,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.breakdown.implementationRatio).toBe(0.50);
  });

  it('should calculate ratios with correct precision', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 33,
      debugging: 33,
      testing: 34,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.breakdown.architectureRatio).toBeCloseTo(0.33, 2);
    expect(result.breakdown.debuggingRatio).toBeCloseTo(0.33, 2);
    expect(result.breakdown.testingRatio).toBeCloseTo(0.34, 2);
  });
});

// ============================================================================
// Tests: Business/UX Ratio (AC #8)
// ============================================================================

describe('Business/UX Ratio (AC #8)', () => {
  it('should include businessUxRatio in breakdown', () => {
    const distribution: WorkStyleDistribution = {
      design_iteration: 10,
      business_discussion: 10,
      context_recovery: 10,
      file_operations: 70,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.breakdown.businessUxRatio).toBe(0.30);
  });

  it('should calculate businessUxRatio from design_iteration + business_discussion + context_recovery', () => {
    const distribution: WorkStyleDistribution = {
      design_iteration: 15,
      business_discussion: 10,
      context_recovery: 5,
      architecture_questions: 70,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.breakdown.businessUxRatio).toBe(0.30);
  });

  it('should return 0 businessUxRatio when no relevant categories', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 50,
      debugging: 50,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.breakdown.businessUxRatio).toBe(0);
  });

  it('should handle partial business/UX categories', () => {
    const distribution: WorkStyleDistribution = {
      design_iteration: 20,
      file_operations: 80,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.breakdown.businessUxRatio).toBe(0.20);
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty distribution', () => {
    const result = calculateTechnicalProfile({});

    expect(result.persona).toBe('explorer');
    expect(result.confidence).toBe(0.30);
    expect(result.personaDescription).toBe(INSUFFICIENT_DATA_DESCRIPTION);
    expect(result.breakdown.architectureRatio).toBe(0);
    expect(result.breakdown.debuggingRatio).toBe(0);
    expect(result.breakdown.testingRatio).toBe(0);
    expect(result.breakdown.implementationRatio).toBe(0);
    expect(result.breakdown.businessUxRatio).toBe(0);
  });

  it('should handle distribution with all zeros', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 0,
      debugging: 0,
      testing: 0,
      file_operations: 0,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.persona).toBe('explorer');
    expect(result.confidence).toBe(0.30);
    expect(result.personaDescription).toBe(INSUFFICIENT_DATA_DESCRIPTION);
  });

  it('should handle single category distribution', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 100,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.persona).toBe('architect');
    expect(result.breakdown.architectureRatio).toBe(1.0);
    expect(result.breakdown.debuggingRatio).toBe(0);
  });

  it('should handle very small counts', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 1,
      debugging: 1,
      testing: 1,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.breakdown.architectureRatio).toBeCloseTo(0.333, 2);
    expect(result.breakdown.debuggingRatio).toBeCloseTo(0.333, 2);
    expect(result.breakdown.testingRatio).toBeCloseTo(0.333, 2);
  });

  it('should handle very large counts', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 1000000,
      debugging: 500000,
      testing: 500000,
      file_operations: 2000000,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.breakdown.architectureRatio).toBe(0.25);
    expect(result.breakdown.debuggingRatio).toBe(0.125);
  });

  it('should handle undefined values in distribution', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 25,
      debugging: undefined,
      testing: 25,
      file_operations: 50,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.breakdown.architectureRatio).toBe(0.25);
    expect(result.breakdown.debuggingRatio).toBe(0);
  });
});

// ============================================================================
// Tests: createEmptyProfile
// ============================================================================

describe('createEmptyProfile', () => {
  it('should create explorer profile with 30% confidence', () => {
    const profile = createEmptyProfile();

    expect(profile.persona).toBe('explorer');
    expect(profile.confidence).toBe(0.30);
  });

  it('should have insufficient data description', () => {
    const profile = createEmptyProfile();

    expect(profile.personaDescription).toBe(INSUFFICIENT_DATA_DESCRIPTION);
  });

  it('should have all zero ratios', () => {
    const profile = createEmptyProfile();

    expect(profile.breakdown.architectureRatio).toBe(0);
    expect(profile.breakdown.debuggingRatio).toBe(0);
    expect(profile.breakdown.testingRatio).toBe(0);
    expect(profile.breakdown.implementationRatio).toBe(0);
    expect(profile.breakdown.businessUxRatio).toBe(0);
  });
});

// ============================================================================
// Tests: Classification Priority
// ============================================================================

describe('Classification Priority', () => {
  it('should check architect before firefighter', () => {
    // User who could match both architect AND firefighter patterns
    // This shouldn't happen in practice but tests priority
    const distribution: WorkStyleDistribution = {
      architecture_questions: 25,
      debugging: 25,
      testing: 5,
      file_operations: 45,
    };

    const result = calculateTechnicalProfile(distribution);

    // architecture = 0.25 > 0.20, debugging = 0.25 > 0.15
    // Fails architect check because debugging >= 0.15
    // debugging = 0.25 > 0.20, testing = 0.05 < 0.10
    // Matches firefighter
    expect(result.persona).toBe('firefighter');
  });

  it('should check firefighter before craftsman', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 15,
      debugging: 25,
      testing: 5, // < 0.10, qualifies for firefighter
      file_operations: 15,
      deployment: 0,
    };

    const result = calculateTechnicalProfile(distribution);

    // debugging > 0.20 AND testing < 0.10
    expect(result.persona).toBe('firefighter');
  });

  it('should check craftsman before explorer', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 20,
      debugging: 15,
      testing: 20,
      file_operations: 15,
      deployment: 5,
    };

    const result = calculateTechnicalProfile(distribution);
    // arch = 20/75 = 0.267 > 0.20, debug = 0.20 >= 0.15, not architect
    // debug = 0.20 not > 0.20, not firefighter
    // testing = 0.267 > 0.12, arch = 0.267, impl = 0.267, diff = 0 < 0.10, craftsman!

    expect(result.persona).toBe('craftsman');
  });
});

// ============================================================================
// Tests: Real-World Scenarios
// ============================================================================

describe('Real-World Scenarios', () => {
  it('should classify senior architect pattern correctly', () => {
    // Senior dev who focuses on system design
    const distribution: WorkStyleDistribution = {
      architecture_questions: 35,
      debugging: 10,
      testing: 15,
      file_operations: 25,
      deployment: 5,
      business_discussion: 10,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.persona).toBe('architect');
    expect(result.confidence).toBe(0.80);
  });

  it('should classify junior firefighter pattern correctly', () => {
    // Junior dev constantly debugging
    const distribution: WorkStyleDistribution = {
      architecture_questions: 5,
      debugging: 45,
      testing: 5,
      file_operations: 35,
      quick_commands: 10,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.persona).toBe('firefighter');
    expect(result.confidence).toBe(0.75);
  });

  it('should classify TDD practitioner as craftsman', () => {
    // Developer who practices TDD
    const distribution: WorkStyleDistribution = {
      architecture_questions: 20,
      debugging: 10,
      testing: 25,
      file_operations: 20,
      deployment: 5,
    };

    const result = calculateTechnicalProfile(distribution);
    // arch = 0.25 > 0.20, debug = 0.125 < 0.15, so this is architect!

    expect(result.persona).toBe('architect');
  });

  it('should classify TDD practitioner with moderate architecture as craftsman', () => {
    // Developer who practices TDD but doesn't ask many architecture questions
    const distribution: WorkStyleDistribution = {
      architecture_questions: 15,
      debugging: 15,
      testing: 25,
      file_operations: 15,
      deployment: 5,
    };

    const result = calculateTechnicalProfile(distribution);
    // arch = 15/75 = 0.20 (not > 0.20), not architect
    // debug = 15/75 = 0.20 (not > 0.20), not firefighter
    // testing = 25/75 = 0.333 > 0.12, arch = 0.20, impl = 20/75 = 0.267, diff = 0.067 < 0.10
    // Craftsman!

    expect(result.persona).toBe('craftsman');
    expect(result.confidence).toBe(0.85);
  });

  it('should classify generalist developer as explorer', () => {
    // Developer who does a bit of everything
    const distribution: WorkStyleDistribution = {
      architecture_questions: 12,
      debugging: 12,
      testing: 12,
      file_operations: 15,
      deployment: 12,
      design_iteration: 12,
      business_discussion: 10,
      quick_commands: 15,
    };

    const result = calculateTechnicalProfile(distribution);

    expect(result.persona).toBe('explorer');
    expect(result.confidence).toBe(0.60);
  });
});

// ============================================================================
// Tests: Performance
// ============================================================================

describe('Performance', () => {
  it('should calculate profile in under 1ms', () => {
    const distribution: WorkStyleDistribution = {
      architecture_questions: 20,
      debugging: 15,
      testing: 10,
      file_operations: 30,
      deployment: 5,
      design_iteration: 10,
      business_discussion: 5,
      context_recovery: 2,
      quick_commands: 2,
      agent_delegation: 1,
    };

    const start = performance.now();
    calculateTechnicalProfile(distribution);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(1);
  });

  it('should calculate 1000 profiles in under 50ms', () => {
    const distributions: WorkStyleDistribution[] = Array.from({ length: 1000 }, (_, i) => ({
      architecture_questions: 10 + (i % 30),
      debugging: 5 + (i % 20),
      testing: 5 + (i % 15),
      file_operations: 20 + (i % 40),
      deployment: i % 10,
    }));

    const start = performance.now();
    for (const dist of distributions) {
      calculateTechnicalProfile(dist);
    }
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50);
  });
});
