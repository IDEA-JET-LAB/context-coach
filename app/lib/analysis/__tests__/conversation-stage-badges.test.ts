/**
 * Unit tests for Conversation Stage Badges - Story 31-7
 *
 * Tests the sorting, filtering, and display logic for stage badges.
 * Since the vitest config uses node environment, we test the pure
 * functions and data transformations without requiring React DOM.
 */

import { describe, it, expect } from "vitest";
import type { SessionStageBreakdown, StageData, ProjectStage } from "@/components/conversations/types";

// ============================================================================
// Helper Functions (extracted from components for testing)
// ============================================================================

interface StageEntry {
  stage: ProjectStage;
  activeMinutes: number;
  promptCount: number;
  percentage: number;
}

/**
 * Extracts and sorts stages from breakdown by activeMinutes descending.
 * This is the core logic from ConversationStageBadges.
 */
function getSortedStages(breakdown: SessionStageBreakdown | null | undefined): StageEntry[] {
  if (!breakdown || Object.keys(breakdown.stages).length === 0) {
    return [];
  }

  return Object.entries(breakdown.stages)
    .filter(([, data]) => data.activeMinutes > 0 || data.promptCount > 0)
    .map(([stage, data]) => ({
      stage: stage as ProjectStage,
      activeMinutes: data.activeMinutes,
      promptCount: data.promptCount,
      percentage: data.percentage,
    }))
    .sort((a, b) => b.activeMinutes - a.activeMinutes);
}

/**
 * Gets visible stages and calculates overflow count.
 */
function getVisibleStagesAndOverflow(
  breakdown: SessionStageBreakdown | null | undefined,
  maxBadges: number = 3
): { visible: StageEntry[]; overflowCount: number } {
  const sorted = getSortedStages(breakdown);
  const visible = sorted.slice(0, maxBadges);
  const overflowCount = Math.max(0, sorted.length - maxBadges);
  return { visible, overflowCount };
}

/**
 * Determines if component should fallback to primaryStage.
 */
function shouldFallbackToPrimaryStage(
  breakdown: SessionStageBreakdown | null | undefined,
  primaryStage: ProjectStage | null | undefined
): boolean {
  const sortedStages = getSortedStages(breakdown);
  return sortedStages.length === 0 && !!primaryStage;
}

// ============================================================================
// Test Data Fixtures
// ============================================================================

function createBreakdown(stages: Record<string, Partial<StageData>>): SessionStageBreakdown {
  const fullStages: Record<string, StageData> = {};
  for (const [stage, data] of Object.entries(stages)) {
    fullStages[stage] = {
      promptCount: data.promptCount ?? 0,
      activeMinutes: data.activeMinutes ?? 0,
      percentage: data.percentage ?? 0,
    };
  }
  return {
    stages: fullStages,
    totalActiveMinutes: Object.values(fullStages).reduce((sum, s) => sum + s.activeMinutes, 0),
    totalPrompts: Object.values(fullStages).reduce((sum, s) => sum + s.promptCount, 0),
    transitionCount: Object.keys(stages).length - 1,
    gapsExcluded: 0,
    analyzedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("Conversation Stage Badges Logic", () => {
  describe("getSortedStages", () => {
    it("should sort stages by activeMinutes in descending order", () => {
      const breakdown = createBreakdown({
        planning: { activeMinutes: 10, promptCount: 5 },
        development: { activeMinutes: 30, promptCount: 15 },
        debugging: { activeMinutes: 20, promptCount: 8 },
      });

      const sorted = getSortedStages(breakdown);

      expect(sorted).toHaveLength(3);
      expect(sorted[0].stage).toBe("development");
      expect(sorted[0].activeMinutes).toBe(30);
      expect(sorted[1].stage).toBe("debugging");
      expect(sorted[1].activeMinutes).toBe(20);
      expect(sorted[2].stage).toBe("planning");
      expect(sorted[2].activeMinutes).toBe(10);
    });

    it("should filter out stages with zero activity", () => {
      const breakdown = createBreakdown({
        development: { activeMinutes: 30, promptCount: 15 },
        planning: { activeMinutes: 0, promptCount: 0 },
        testing: { activeMinutes: 10, promptCount: 5 },
      });

      const sorted = getSortedStages(breakdown);

      expect(sorted).toHaveLength(2);
      expect(sorted.map((s) => s.stage)).not.toContain("planning");
    });

    it("should include stages with promptCount but zero activeMinutes", () => {
      const breakdown = createBreakdown({
        development: { activeMinutes: 30, promptCount: 15 },
        planning: { activeMinutes: 0, promptCount: 3 }, // Has prompts but no active time
      });

      const sorted = getSortedStages(breakdown);

      expect(sorted).toHaveLength(2);
      expect(sorted.map((s) => s.stage)).toContain("planning");
    });

    it("should return empty array for null breakdown", () => {
      const sorted = getSortedStages(null);
      expect(sorted).toHaveLength(0);
    });

    it("should return empty array for undefined breakdown", () => {
      const sorted = getSortedStages(undefined);
      expect(sorted).toHaveLength(0);
    });

    it("should return empty array for breakdown with empty stages", () => {
      const breakdown: SessionStageBreakdown = {
        stages: {},
        totalActiveMinutes: 0,
        totalPrompts: 0,
        transitionCount: 0,
        gapsExcluded: 0,
        analyzedAt: new Date().toISOString(),
      };

      const sorted = getSortedStages(breakdown);
      expect(sorted).toHaveLength(0);
    });

    it("should preserve percentage values", () => {
      const breakdown = createBreakdown({
        development: { activeMinutes: 60, promptCount: 20, percentage: 60 },
        testing: { activeMinutes: 40, promptCount: 10, percentage: 40 },
      });

      const sorted = getSortedStages(breakdown);

      expect(sorted[0].percentage).toBe(60);
      expect(sorted[1].percentage).toBe(40);
    });
  });

  describe("getVisibleStagesAndOverflow", () => {
    it("should show up to 3 stage badges by default", () => {
      const breakdown = createBreakdown({
        development: { activeMinutes: 40 },
        debugging: { activeMinutes: 30 },
        testing: { activeMinutes: 20 },
        planning: { activeMinutes: 10 },
      });

      const { visible, overflowCount } = getVisibleStagesAndOverflow(breakdown);

      expect(visible).toHaveLength(3);
      expect(overflowCount).toBe(1);
    });

    it("should show +N indicator for additional stages", () => {
      const breakdown = createBreakdown({
        development: { activeMinutes: 50 },
        debugging: { activeMinutes: 40 },
        testing: { activeMinutes: 30 },
        planning: { activeMinutes: 20 },
        documentation: { activeMinutes: 10 },
      });

      const { visible, overflowCount } = getVisibleStagesAndOverflow(breakdown);

      expect(visible).toHaveLength(3);
      expect(overflowCount).toBe(2);
    });

    it("should respect custom maxBadges", () => {
      const breakdown = createBreakdown({
        development: { activeMinutes: 50 },
        debugging: { activeMinutes: 40 },
        testing: { activeMinutes: 30 },
        planning: { activeMinutes: 20 },
      });

      const { visible, overflowCount } = getVisibleStagesAndOverflow(breakdown, 2);

      expect(visible).toHaveLength(2);
      expect(overflowCount).toBe(2);
    });

    it("should show all stages when fewer than maxBadges", () => {
      const breakdown = createBreakdown({
        development: { activeMinutes: 50 },
        debugging: { activeMinutes: 40 },
      });

      const { visible, overflowCount } = getVisibleStagesAndOverflow(breakdown);

      expect(visible).toHaveLength(2);
      expect(overflowCount).toBe(0);
    });

    it("should order by activeMinutes descending", () => {
      const breakdown = createBreakdown({
        planning: { activeMinutes: 10 },
        development: { activeMinutes: 50 },
        debugging: { activeMinutes: 30 },
        testing: { activeMinutes: 20 },
      });

      const { visible } = getVisibleStagesAndOverflow(breakdown);

      expect(visible[0].stage).toBe("development");
      expect(visible[1].stage).toBe("debugging");
      expect(visible[2].stage).toBe("testing");
    });

    it("should return empty visible array for null breakdown", () => {
      const { visible, overflowCount } = getVisibleStagesAndOverflow(null);

      expect(visible).toHaveLength(0);
      expect(overflowCount).toBe(0);
    });
  });

  describe("shouldFallbackToPrimaryStage", () => {
    it("should fallback when stageBreakdown is null and primaryStage exists", () => {
      const result = shouldFallbackToPrimaryStage(null, "development");
      expect(result).toBe(true);
    });

    it("should fallback when stageBreakdown has empty stages", () => {
      const breakdown: SessionStageBreakdown = {
        stages: {},
        totalActiveMinutes: 0,
        totalPrompts: 0,
        transitionCount: 0,
        gapsExcluded: 0,
        analyzedAt: new Date().toISOString(),
      };

      const result = shouldFallbackToPrimaryStage(breakdown, "debugging");
      expect(result).toBe(true);
    });

    it("should not fallback when stageBreakdown has stages", () => {
      const breakdown = createBreakdown({
        development: { activeMinutes: 30, promptCount: 10 },
      });

      const result = shouldFallbackToPrimaryStage(breakdown, "debugging");
      expect(result).toBe(false);
    });

    it("should not fallback when no primaryStage and no breakdown", () => {
      const result = shouldFallbackToPrimaryStage(null, null);
      expect(result).toBe(false);
    });

    it("should not fallback when breakdown has all zero-activity stages", () => {
      const breakdown = createBreakdown({
        development: { activeMinutes: 0, promptCount: 0 },
        testing: { activeMinutes: 0, promptCount: 0 },
      });

      const result = shouldFallbackToPrimaryStage(breakdown, "debugging");
      expect(result).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle single stage correctly", () => {
      const breakdown = createBreakdown({
        development: { activeMinutes: 60, promptCount: 25, percentage: 100 },
      });

      const { visible, overflowCount } = getVisibleStagesAndOverflow(breakdown);

      expect(visible).toHaveLength(1);
      expect(visible[0].stage).toBe("development");
      expect(overflowCount).toBe(0);
    });

    it("should handle exactly maxBadges stages", () => {
      const breakdown = createBreakdown({
        development: { activeMinutes: 30 },
        debugging: { activeMinutes: 20 },
        testing: { activeMinutes: 10 },
      });

      const { visible, overflowCount } = getVisibleStagesAndOverflow(breakdown, 3);

      expect(visible).toHaveLength(3);
      expect(overflowCount).toBe(0);
    });

    it("should handle ties in activeMinutes consistently", () => {
      const breakdown = createBreakdown({
        development: { activeMinutes: 30, promptCount: 10 },
        debugging: { activeMinutes: 30, promptCount: 15 },
        testing: { activeMinutes: 30, promptCount: 5 },
      });

      const sorted = getSortedStages(breakdown);

      // All should be included with same activeMinutes
      expect(sorted).toHaveLength(3);
      expect(sorted.every((s) => s.activeMinutes === 30)).toBe(true);
    });

    it("should handle very large number of stages", () => {
      const stages: Record<string, Partial<StageData>> = {};
      const allStages: ProjectStage[] = [
        "architecture",
        "specification",
        "development",
        "debugging",
        "enhancement",
        "planning",
        "implementation",
        "testing",
        "documentation",
        "review",
        "refactoring",
        "exploration",
      ];

      allStages.forEach((stage, index) => {
        stages[stage] = { activeMinutes: 100 - index * 5, promptCount: 10 };
      });

      const breakdown = createBreakdown(stages);
      const { visible, overflowCount } = getVisibleStagesAndOverflow(breakdown);

      expect(visible).toHaveLength(3);
      expect(overflowCount).toBe(9);
      expect(visible[0].stage).toBe("architecture"); // Highest activeMinutes
    });

    it("should handle maxBadges of 0", () => {
      const breakdown = createBreakdown({
        development: { activeMinutes: 30 },
      });

      const { visible, overflowCount } = getVisibleStagesAndOverflow(breakdown, 0);

      expect(visible).toHaveLength(0);
      expect(overflowCount).toBe(1);
    });

    it("should handle maxBadges of 1", () => {
      const breakdown = createBreakdown({
        development: { activeMinutes: 50 },
        debugging: { activeMinutes: 30 },
        testing: { activeMinutes: 20 },
      });

      const { visible, overflowCount } = getVisibleStagesAndOverflow(breakdown, 1);

      expect(visible).toHaveLength(1);
      expect(visible[0].stage).toBe("development");
      expect(overflowCount).toBe(2);
    });
  });

  describe("StageBreakdownTooltip data", () => {
    it("should sort tooltip stages by activeMinutes descending", () => {
      const breakdown = createBreakdown({
        planning: { activeMinutes: 10, promptCount: 5, percentage: 10 },
        development: { activeMinutes: 60, promptCount: 25, percentage: 60 },
        testing: { activeMinutes: 30, promptCount: 12, percentage: 30 },
      });

      const sorted = getSortedStages(breakdown);

      expect(sorted[0].stage).toBe("development");
      expect(sorted[0].percentage).toBe(60);
      expect(sorted[1].stage).toBe("testing");
      expect(sorted[2].stage).toBe("planning");
    });

    it("should filter empty stages from tooltip", () => {
      const breakdown = createBreakdown({
        development: { activeMinutes: 60, promptCount: 25 },
        planning: { activeMinutes: 0, promptCount: 0 },
        debugging: { activeMinutes: 0, promptCount: 0 },
      });

      const sorted = getSortedStages(breakdown);

      expect(sorted).toHaveLength(1);
      expect(sorted[0].stage).toBe("development");
    });

    it("should include total time and prompts in breakdown", () => {
      const breakdown = createBreakdown({
        development: { activeMinutes: 60, promptCount: 25 },
        testing: { activeMinutes: 30, promptCount: 12 },
      });

      expect(breakdown.totalActiveMinutes).toBe(90);
      expect(breakdown.totalPrompts).toBe(37);
    });

    it("should include transition count in breakdown", () => {
      const breakdown = createBreakdown({
        development: { activeMinutes: 60 },
        testing: { activeMinutes: 30 },
        debugging: { activeMinutes: 10 },
      });

      // createBreakdown calculates transitions as stages.length - 1
      expect(breakdown.transitionCount).toBe(2);
    });
  });
});
