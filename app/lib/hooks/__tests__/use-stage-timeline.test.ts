import { describe, it, expect } from "vitest";
import { stageTimelineKeys } from "../use-stage-timeline";

/**
 * Tests for use-stage-timeline.ts - Story 31-8
 *
 * These tests validate:
 * 1. Query key factory patterns for cache management
 * 2. Type exports for external consumers
 */

describe("Stage Timeline Query Keys - Story 31-8", () => {
  describe("stageTimelineKeys.all", () => {
    it("should return base stage-timeline key", () => {
      expect(stageTimelineKeys.all).toEqual(["stage-timeline"]);
    });
  });

  describe("stageTimelineKeys.project", () => {
    it("should return project key with projectId", () => {
      const projectId = "project-123";
      const key = stageTimelineKeys.project(projectId);

      expect(key).toEqual(["stage-timeline", "project-123"]);
    });

    it("should return project key with UUID projectId", () => {
      const projectId = "550e8400-e29b-41d4-a716-446655440000";
      const key = stageTimelineKeys.project(projectId);

      expect(key).toEqual(["stage-timeline", "550e8400-e29b-41d4-a716-446655440000"]);
    });

    it("should return different keys for different projects", () => {
      const key1 = stageTimelineKeys.project("project-1");
      const key2 = stageTimelineKeys.project("project-2");

      expect(key1).not.toEqual(key2);
    });
  });

  describe("stageTimelineKeys.filtered", () => {
    it("should return filtered key with all parameters", () => {
      const key = stageTimelineKeys.filtered("project-123", "7d", "day");

      expect(key).toEqual(["stage-timeline", "project-123", "7d", "day"]);
    });

    it("should return filtered key with 30d range and weekly granularity", () => {
      const key = stageTimelineKeys.filtered("project-456", "30d", "week");

      expect(key).toEqual(["stage-timeline", "project-456", "30d", "week"]);
    });

    it("should return filtered key with all time range", () => {
      const key = stageTimelineKeys.filtered("project-789", "all", "day");

      expect(key).toEqual(["stage-timeline", "project-789", "all", "day"]);
    });

    it("should return different keys for different ranges", () => {
      const key7d = stageTimelineKeys.filtered("project-123", "7d", "day");
      const key30d = stageTimelineKeys.filtered("project-123", "30d", "day");
      const keyAll = stageTimelineKeys.filtered("project-123", "all", "day");

      expect(key7d).not.toEqual(key30d);
      expect(key30d).not.toEqual(keyAll);
      expect(key7d).not.toEqual(keyAll);
    });

    it("should return different keys for different granularities", () => {
      const keyDaily = stageTimelineKeys.filtered("project-123", "30d", "day");
      const keyWeekly = stageTimelineKeys.filtered("project-123", "30d", "week");

      expect(keyDaily).not.toEqual(keyWeekly);
    });
  });

  describe("Query Key Hierarchy", () => {
    it("should allow invalidating all stage timeline queries", () => {
      // Simulating React Query's invalidateQueries behavior
      const allKey = stageTimelineKeys.all;
      const projectKey = stageTimelineKeys.project("project-1");
      const filteredKey = stageTimelineKeys.filtered("project-1", "30d", "day");

      // All keys should start with the base key
      expect(projectKey.slice(0, 1)).toEqual(allKey);
      expect(filteredKey.slice(0, 1)).toEqual(allKey);
    });

    it("should allow invalidating a specific project's timeline queries", () => {
      const projectKey = stageTimelineKeys.project("project-1");
      const filtered7d = stageTimelineKeys.filtered("project-1", "7d", "day");
      const filtered30d = stageTimelineKeys.filtered("project-1", "30d", "week");

      // Filtered keys should start with the project key
      expect(filtered7d.slice(0, 2)).toEqual(projectKey);
      expect(filtered30d.slice(0, 2)).toEqual(projectKey);
    });

    it("project keys should extend base key", () => {
      const baseKey = stageTimelineKeys.all;
      const projectKey = stageTimelineKeys.project("test-project");

      expect(projectKey.length).toBe(baseKey.length + 1);
      expect(projectKey[0]).toBe(baseKey[0]);
    });

    it("filtered keys should extend project key", () => {
      const projectKey = stageTimelineKeys.project("test-project");
      const filteredKey = stageTimelineKeys.filtered("test-project", "30d", "day");

      expect(filteredKey.length).toBe(projectKey.length + 2);
      expect(filteredKey[0]).toBe(projectKey[0]);
      expect(filteredKey[1]).toBe(projectKey[1]);
    });
  });

  describe("Type Safety", () => {
    it("should accept valid range values", () => {
      // These should compile without error
      const key7d = stageTimelineKeys.filtered("project", "7d", "day");
      const key30d = stageTimelineKeys.filtered("project", "30d", "day");
      const keyAll = stageTimelineKeys.filtered("project", "all", "day");

      expect(key7d[2]).toBe("7d");
      expect(key30d[2]).toBe("30d");
      expect(keyAll[2]).toBe("all");
    });

    it("should accept valid granularity values", () => {
      // These should compile without error
      const keyDay = stageTimelineKeys.filtered("project", "7d", "day");
      const keyWeek = stageTimelineKeys.filtered("project", "7d", "week");

      expect(keyDay[3]).toBe("day");
      expect(keyWeek[3]).toBe("week");
    });
  });
});
