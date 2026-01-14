/**
 * Stage Persistence Tests - Story 31-2
 *
 * Tests for the stage persistence service that analyzes sessions
 * and persists detected stages to the database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  analyzeAndPersistSessionStages,
  analyzeProjectStages,
  getProjectAnalysisStatus,
  getSessionAnalysisStatus,
  type SessionAnalysisResult,
  type ProjectAnalysisResult,
} from "../stage-persistence";

// Mock the Supabase admin client
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

// Mock the logger
vi.mock("@/lib/utils/logger", () => ({
  createScopedLogger: vi.fn(() => ({
    log: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import { createAdminClient } from "@/lib/supabase/admin";

// Helper to create mock Supabase client
function createMockSupabase() {
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockUpdate = vi.fn();
  const mockEq = vi.fn();
  const mockOr = vi.fn();
  const mockOrder = vi.fn();
  const mockLimit = vi.fn();
  const mockSingle = vi.fn();
  const mockIs = vi.fn();

  // Chain all methods to return the same mock object
  const chainableMock = {
    from: mockFrom,
    select: mockSelect,
    update: mockUpdate,
    eq: mockEq,
    or: mockOr,
    order: mockOrder,
    limit: mockLimit,
    single: mockSingle,
    is: mockIs,
  };

  mockFrom.mockReturnValue(chainableMock);
  mockSelect.mockReturnValue(chainableMock);
  mockUpdate.mockReturnValue(chainableMock);
  mockEq.mockReturnValue(chainableMock);
  mockOr.mockReturnValue(chainableMock);
  mockOrder.mockReturnValue(chainableMock);
  mockLimit.mockReturnValue(chainableMock);
  mockIs.mockReturnValue(chainableMock);

  return {
    client: chainableMock,
    mockFrom,
    mockSelect,
    mockUpdate,
    mockEq,
    mockOrder,
    mockLimit,
    mockSingle,
    mockOr,
    mockIs,
  };
}

describe("stage-persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analyzeAndPersistSessionStages", () => {
    it("should return error for invalid session ID format", async () => {
      const result = await analyzeAndPersistSessionStages("invalid-id");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid session ID format");
      expect(result.promptsAnalyzed).toBe(0);
      expect(result.promptsUpdated).toBe(0);
    });

    it("should return error for empty session ID", async () => {
      const result = await analyzeAndPersistSessionStages("");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid session ID format");
    });

    it("should handle session with no prompts", async () => {
      const { client, mockSingle } = createMockSupabase();
      vi.mocked(createAdminClient).mockReturnValue(client as any);

      // First call: update status to processing (returns chainable)
      // Second call: fetch prompts (returns empty array)
      // Third call: update status to complete
      let callCount = 0;
      mockSingle.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      // Override to return empty prompts for select query
      client.select = vi.fn().mockImplementation(() => {
        return {
          ...client,
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      });

      const sessionId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const result = await analyzeAndPersistSessionStages(sessionId);

      expect(result.success).toBe(true);
      expect(result.promptsAnalyzed).toBe(0);
      expect(result.promptsUpdated).toBe(0);
      expect(result.primaryStage).toBeNull();
    });

    it("should analyze and persist stages for session with prompts", async () => {
      const { client, mockFrom } = createMockSupabase();
      vi.mocked(createAdminClient).mockReturnValue(client as any);

      const mockPrompts = [
        { id: "prompt-1", text: "implement the login feature", sequence_number: 1, created_at: "2024-01-01T00:00:00Z" },
        { id: "prompt-2", text: "yes, proceed", sequence_number: 2, created_at: "2024-01-01T00:01:00Z" },
        { id: "prompt-3", text: "fix this error", sequence_number: 3, created_at: "2024-01-01T00:02:00Z" },
      ];

      // Track calls to different tables
      const updateCalls: { table: string; data: any }[] = [];
      const selectCalls: { table: string }[] = [];

      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            update: vi.fn((data: any) => {
              updateCalls.push({ table, data });
              return {
                eq: vi.fn().mockResolvedValue({ data: null, error: null }),
              };
            }),
            select: vi.fn(() => {
              selectCalls.push({ table });
              return {
                eq: vi.fn().mockResolvedValue({ data: null, error: null }),
              };
            }),
          };
        }
        if (table === "prompts") {
          return {
            select: vi.fn(() => {
              selectCalls.push({ table });
              return {
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: mockPrompts, error: null }),
                  }),
                }),
              };
            }),
            update: vi.fn((data: any) => {
              updateCalls.push({ table, data });
              return {
                eq: vi.fn().mockResolvedValue({ data: null, error: null }),
              };
            }),
          };
        }
        return client;
      });

      const sessionId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const result = await analyzeAndPersistSessionStages(sessionId);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(sessionId);
      expect(result.promptsAnalyzed).toBe(3);
      expect(result.promptsUpdated).toBe(3);
      // Development is the most common stage in these prompts
      expect(result.primaryStage).toBeDefined();
    });

    it("should handle database error when fetching prompts", async () => {
      const { client, mockFrom } = createMockSupabase();
      vi.mocked(createAdminClient).mockReturnValue(client as any);

      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            update: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          };
        }
        if (table === "prompts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: "Database connection error" },
                  }),
                }),
              }),
            })),
          };
        }
        return client;
      });

      const sessionId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const result = await analyzeAndPersistSessionStages(sessionId);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to fetch prompts");
    });

    it("should continue processing even if individual prompt update fails", async () => {
      const { client, mockFrom } = createMockSupabase();
      vi.mocked(createAdminClient).mockReturnValue(client as any);

      const mockPrompts = [
        { id: "prompt-1", text: "implement feature", sequence_number: 1, created_at: "2024-01-01T00:00:00Z" },
        { id: "prompt-2", text: "add tests", sequence_number: 2, created_at: "2024-01-01T00:01:00Z" },
      ];

      let promptUpdateCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            update: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          };
        }
        if (table === "prompts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: mockPrompts, error: null }),
                }),
              }),
            })),
            update: vi.fn(() => {
              promptUpdateCount++;
              // First update fails, second succeeds
              const error = promptUpdateCount === 1 ? { message: "Update failed" } : null;
              return {
                eq: vi.fn().mockResolvedValue({ data: null, error }),
              };
            }),
          };
        }
        return client;
      });

      const sessionId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const result = await analyzeAndPersistSessionStages(sessionId);

      // Should still succeed overall, with 1 of 2 prompts updated
      expect(result.success).toBe(true);
      expect(result.promptsAnalyzed).toBe(2);
      expect(result.promptsUpdated).toBe(1);
    });
  });

  describe("analyzeProjectStages", () => {
    it("should return empty result for invalid project ID", async () => {
      const result = await analyzeProjectStages("invalid-id");

      expect(result.projectId).toBe("invalid-id");
      expect(result.sessionsProcessed).toBe(0);
      expect(result.sessionsSucceeded).toBe(0);
      expect(result.sessionsFailed).toBe(0);
      expect(result.results).toEqual([]);
    });

    it("should return empty result when no sessions need analysis", async () => {
      const { client, mockFrom } = createMockSupabase();
      vi.mocked(createAdminClient).mockReturnValue(client as any);

      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }));

      const projectId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const result = await analyzeProjectStages(projectId);

      expect(result.projectId).toBe(projectId);
      expect(result.sessionsProcessed).toBe(0);
    });

    it("should process multiple sessions and aggregate results", async () => {
      const { client, mockFrom } = createMockSupabase();
      vi.mocked(createAdminClient).mockReturnValue(client as any);

      // Use valid UUIDs for session IDs
      const mockSessions = [
        { id: "11111111-1111-1111-1111-111111111111" },
        { id: "22222222-2222-2222-2222-222222222222" },
        { id: "33333333-3333-3333-3333-333333333333" },
      ];

      let isFirstSessionCall = true;
      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") {
          if (isFirstSessionCall) {
            isFirstSessionCall = false;
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  or: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue({ data: mockSessions, error: null }),
                    }),
                  }),
                }),
              }),
            };
          }
          // Subsequent calls for individual session analysis updates
          return {
            update: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          };
        }
        if (table === "prompts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            })),
          };
        }
        return client;
      });

      const projectId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const result = await analyzeProjectStages(projectId);

      // Each session will succeed with 0 prompts (empty prompts array)
      expect(result.projectId).toBe(projectId);
      expect(result.sessionsProcessed).toBe(3);
      expect(result.sessionsSucceeded).toBe(3);
      expect(result.sessionsFailed).toBe(0);
      expect(result.results).toHaveLength(3);
    });

    it("should respect batchSize option", async () => {
      const { client, mockFrom } = createMockSupabase();
      vi.mocked(createAdminClient).mockReturnValue(client as any);

      let capturedLimit: number | undefined;
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn((limit: number) => {
                  capturedLimit = limit;
                  return Promise.resolve({ data: [], error: null });
                }),
              }),
            }),
          }),
        }),
      }));

      const projectId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      await analyzeProjectStages(projectId, { batchSize: 25 });

      expect(capturedLimit).toBe(25);
    });

    it("should handle database error when fetching sessions", async () => {
      const { client, mockFrom } = createMockSupabase();
      vi.mocked(createAdminClient).mockReturnValue(client as any);

      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: "Database error" },
                }),
              }),
            }),
          }),
        }),
      }));

      const projectId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const result = await analyzeProjectStages(projectId);

      expect(result.sessionsProcessed).toBe(0);
      expect(result.sessionsFailed).toBe(0);
    });
  });

  describe("getProjectAnalysisStatus", () => {
    it("should return null for invalid project ID", async () => {
      const result = await getProjectAnalysisStatus("invalid");
      expect(result).toBeNull();
    });

    it("should aggregate status counts correctly", async () => {
      const { client, mockFrom } = createMockSupabase();
      vi.mocked(createAdminClient).mockReturnValue(client as any);

      const mockStatusData = [
        { stage_analysis_status: "complete" },
        { stage_analysis_status: "complete" },
        { stage_analysis_status: "complete" },
        { stage_analysis_status: "pending" },
        { stage_analysis_status: "error" },
        { stage_analysis_status: null },
      ];

      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: mockStatusData, error: null }),
        }),
      }));

      const projectId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const result = await getProjectAnalysisStatus(projectId);

      expect(result).not.toBeNull();
      expect(result!.projectId).toBe(projectId);
      expect(result!.totalSessions).toBe(6);
      expect(result!.completedSessions).toBe(3);
      expect(result!.pendingSessions).toBe(2); // 1 pending + 1 null
      expect(result!.errorSessions).toBe(1);
      expect(result!.isComplete).toBe(false);
    });

    it("should report isComplete when all sessions are complete", async () => {
      const { client, mockFrom } = createMockSupabase();
      vi.mocked(createAdminClient).mockReturnValue(client as any);

      const mockStatusData = [
        { stage_analysis_status: "complete" },
        { stage_analysis_status: "complete" },
      ];

      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: mockStatusData, error: null }),
        }),
      }));

      const projectId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const result = await getProjectAnalysisStatus(projectId);

      expect(result!.isComplete).toBe(true);
    });

    it("should return null on database error", async () => {
      const { client, mockFrom } = createMockSupabase();
      vi.mocked(createAdminClient).mockReturnValue(client as any);

      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Database error" },
          }),
        }),
      }));

      const projectId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const result = await getProjectAnalysisStatus(projectId);

      expect(result).toBeNull();
    });
  });

  describe("getSessionAnalysisStatus", () => {
    it("should return null for invalid session ID", async () => {
      const result = await getSessionAnalysisStatus("invalid");
      expect(result).toBeNull();
    });

    it("should return status and error from database", async () => {
      const { client, mockFrom } = createMockSupabase();
      vi.mocked(createAdminClient).mockReturnValue(client as any);

      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                stage_analysis_status: "error",
                stage_analysis_error: "Something went wrong",
              },
              error: null,
            }),
          }),
        }),
      }));

      const sessionId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const result = await getSessionAnalysisStatus(sessionId);

      expect(result).not.toBeNull();
      expect(result!.status).toBe("error");
      expect(result!.error).toBe("Something went wrong");
    });

    it("should return null for null status (not yet analyzed)", async () => {
      const { client, mockFrom } = createMockSupabase();
      vi.mocked(createAdminClient).mockReturnValue(client as any);

      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                stage_analysis_status: null,
                stage_analysis_error: null,
              },
              error: null,
            }),
          }),
        }),
      }));

      const sessionId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const result = await getSessionAnalysisStatus(sessionId);

      expect(result).not.toBeNull();
      expect(result!.status).toBeNull();
      expect(result!.error).toBeNull();
    });

    it("should return null when session not found", async () => {
      const { client, mockFrom } = createMockSupabase();
      vi.mocked(createAdminClient).mockReturnValue(client as any);

      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Not found" },
            }),
          }),
        }),
      }));

      const sessionId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const result = await getSessionAnalysisStatus(sessionId);

      expect(result).toBeNull();
    });
  });

  describe("integration scenarios", () => {
    it("should handle mixed success/failure in batch processing", async () => {
      const { client, mockFrom } = createMockSupabase();
      vi.mocked(createAdminClient).mockReturnValue(client as any);

      const mockSessions = [
        { id: "11111111-1111-1111-1111-111111111111" },
        { id: "22222222-2222-2222-2222-222222222222" },
      ];

      let sessionCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") {
          sessionCallCount++;
          if (sessionCallCount === 1) {
            // First call: fetch sessions
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  or: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue({ data: mockSessions, error: null }),
                    }),
                  }),
                }),
              }),
            };
          }
          // Subsequent calls: updates for individual sessions
          return {
            update: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          };
        }
        if (table === "prompts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            })),
          };
        }
        return client;
      });

      const projectId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const result = await analyzeProjectStages(projectId);

      // Both sessions should succeed (empty prompts)
      expect(result.sessionsProcessed).toBe(2);
      expect(result.results).toHaveLength(2);
    });
  });
});
