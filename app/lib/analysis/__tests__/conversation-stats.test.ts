/**
 * Conversation Statistics Tests
 * Story 30-2: Deterministic Stats Service
 *
 * Tests for the conversation statistics calculation service.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateConversationStats,
  verifySessionAccess,
  CONTEXT_WINDOW_SIZE,
  type ConversationStats,
} from "../conversation-stats";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// Mock Setup
// ============================================================================

/**
 * Creates a mock Supabase client with configurable responses
 */
function createMockSupabase(overrides: {
  session?: Record<string, unknown> | null;
  sessionError?: { message: string } | null;
  prompts?: Record<string, unknown>[];
  promptsError?: { message: string } | null;
  linkedResponses?: Record<string, unknown>[];
  linkedResponsesError?: { message: string } | null;
  sessionResponses?: Record<string, unknown>[];
  sessionResponsesError?: { message: string } | null;
  teamMembership?: { id: string } | null;
  teamMembershipError?: { message: string } | null;
}): SupabaseClient {
  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "sessions") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: overrides.session ?? null,
          error: overrides.sessionError ?? null,
        }),
      };
    }

    if (table === "prompts") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({
          data: overrides.prompts ?? [],
          error: overrides.promptsError ?? null,
        }),
      };
    }

    if (table === "prompt_responses") {
      // Track which filters are applied
      let isLinkedQuery = false;
      let isSessionQuery = false;

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((field: string) => {
          if (field === "session_uuid") {
            isSessionQuery = true;
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            then: vi.fn().mockImplementation(() => {
              if (isSessionQuery) {
                return Promise.resolve({
                  data: overrides.sessionResponses ?? [],
                  error: overrides.sessionResponsesError ?? null,
                });
              }
              return Promise.resolve({
                data: overrides.linkedResponses ?? [],
                error: overrides.linkedResponsesError ?? null,
              });
            }),
          };
        }),
        in: vi.fn().mockImplementation(() => {
          isLinkedQuery = true;
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            then: vi.fn().mockResolvedValue({
              data: overrides.linkedResponses ?? [],
              error: overrides.linkedResponsesError ?? null,
            }),
          };
        }),
        is: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation(() => {
          if (isSessionQuery) {
            return Promise.resolve({
              data: overrides.sessionResponses ?? [],
              error: overrides.sessionResponsesError ?? null,
            });
          }
          return Promise.resolve({
            data: overrides.linkedResponses ?? [],
            error: overrides.linkedResponsesError ?? null,
          });
        }),
      };
    }

    if (table === "team_members") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: overrides.teamMembership ?? null,
          error: overrides.teamMembershipError ?? null,
        }),
      };
    }

    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });

  return {
    from: mockFrom,
  } as unknown as SupabaseClient;
}

/**
 * Creates a properly structured mock Supabase client for prompts query
 */
function createMockSupabaseForStats(config: {
  session: Record<string, unknown>;
  prompts: Record<string, unknown>[];
  responses: Record<string, unknown>[];
}): SupabaseClient {
  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "sessions") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: config.session,
          error: null,
        }),
      };
    }

    if (table === "prompts") {
      const mockOrder = vi.fn().mockImplementation(() => ({
        order: vi.fn().mockResolvedValue({
          data: config.prompts,
          error: null,
        }),
      }));

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: mockOrder,
      };
    }

    if (table === "prompt_responses") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: config.responses,
          error: null,
        }),
        is: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };
    }

    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
  });

  return {
    from: mockFrom,
  } as unknown as SupabaseClient;
}

// ============================================================================
// Test Data
// ============================================================================

const VALID_SESSION_ID = "11111111-1111-1111-1111-111111111111";
const VALID_USER_ID = "22222222-2222-2222-2222-222222222222";
const VALID_TEAM_ID = "33333333-3333-3333-3333-333333333333";

const SAMPLE_SESSION = {
  id: VALID_SESSION_ID,
  started_at: "2025-01-09T10:00:00Z",
  ended_at: "2025-01-09T11:00:00Z",
  end_reason: "completed",
  total_prompts: 10,
  primary_stage: "development",
  team_id: VALID_TEAM_ID,
};

const SAMPLE_PROMPTS = [
  {
    id: "prompt-1",
    input_tokens: 100,
    output_tokens: 500,
    sequence_number: 1,
  },
  {
    id: "prompt-2",
    input_tokens: 150,
    output_tokens: 600,
    sequence_number: 2,
  },
  {
    id: "prompt-3",
    input_tokens: 200,
    output_tokens: 800,
    sequence_number: 3,
  },
];

const SAMPLE_RESPONSES = [
  {
    id: "response-1",
    prompt_id: "prompt-1",
    tool_count: 2,
    tools_used: ["Read", "Edit"],
    tokens_in: 100,
    tokens_out: 500,
    model: "claude-3-opus",
    stop_reason: "end_turn",
  },
  {
    id: "response-2",
    prompt_id: "prompt-2",
    tool_count: 1,
    tools_used: ["Bash"],
    tokens_in: 150,
    tokens_out: 600,
    model: "claude-3-opus",
    stop_reason: "git commit created",
  },
  {
    id: "response-3",
    prompt_id: "prompt-3",
    tool_count: 3,
    tools_used: ["Read", "Edit", "Task"],
    tokens_in: 200,
    tokens_out: 800,
    model: "claude-3-opus",
    stop_reason: "end_turn",
  },
];

// ============================================================================
// Tests
// ============================================================================

describe("Conversation Stats Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Turn Count Tests
  // ==========================================================================
  describe("Turn Count Calculation", () => {
    it("should calculate turn count from number of prompts", async () => {
      const supabase = createMockSupabaseForStats({
        session: SAMPLE_SESSION,
        prompts: SAMPLE_PROMPTS,
        responses: SAMPLE_RESPONSES,
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.turnCount).toBe(3);
    });

    it("should return turn count of 0 for empty conversation", async () => {
      const supabase = createMockSupabaseForStats({
        session: SAMPLE_SESSION,
        prompts: [],
        responses: [],
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.turnCount).toBe(0);
    });

    it("should count single prompt as 1 turn", async () => {
      const supabase = createMockSupabaseForStats({
        session: SAMPLE_SESSION,
        prompts: [SAMPLE_PROMPTS[0]],
        responses: [SAMPLE_RESPONSES[0]],
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.turnCount).toBe(1);
    });
  });

  // ==========================================================================
  // Duration Tests
  // ==========================================================================
  describe("Duration Calculation", () => {
    it("should calculate duration for completed session", async () => {
      const supabase = createMockSupabaseForStats({
        session: {
          ...SAMPLE_SESSION,
          started_at: "2025-01-09T10:00:00Z",
          ended_at: "2025-01-09T10:45:00Z",
        },
        prompts: SAMPLE_PROMPTS,
        responses: SAMPLE_RESPONSES,
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.durationMinutes).toBe(45);
      expect(stats.isOngoing).toBe(false);
    });

    it("should return null duration for ongoing session", async () => {
      const supabase = createMockSupabaseForStats({
        session: {
          ...SAMPLE_SESSION,
          ended_at: null,
        },
        prompts: SAMPLE_PROMPTS,
        responses: SAMPLE_RESPONSES,
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.durationMinutes).toBeNull();
      expect(stats.isOngoing).toBe(true);
    });

    it("should handle 0 minute session", async () => {
      const supabase = createMockSupabaseForStats({
        session: {
          ...SAMPLE_SESSION,
          started_at: "2025-01-09T10:00:00Z",
          ended_at: "2025-01-09T10:00:30Z", // 30 seconds
        },
        prompts: SAMPLE_PROMPTS,
        responses: SAMPLE_RESPONSES,
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.durationMinutes).toBe(1); // Rounds to 1 minute
    });

    it("should handle multi-hour session", async () => {
      const supabase = createMockSupabaseForStats({
        session: {
          ...SAMPLE_SESSION,
          started_at: "2025-01-09T10:00:00Z",
          ended_at: "2025-01-09T13:30:00Z", // 3.5 hours
        },
        prompts: SAMPLE_PROMPTS,
        responses: SAMPLE_RESPONSES,
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.durationMinutes).toBe(210); // 3.5 hours = 210 minutes
    });
  });

  // ==========================================================================
  // Token Aggregation Tests
  // ==========================================================================
  describe("Token Aggregation", () => {
    it("should sum tokens from all prompts", async () => {
      const supabase = createMockSupabaseForStats({
        session: SAMPLE_SESSION,
        prompts: SAMPLE_PROMPTS,
        responses: SAMPLE_RESPONSES,
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      // 100 + 150 + 200 = 450 input
      // 500 + 600 + 800 = 1900 output
      expect(stats.tokens.input).toBe(450);
      expect(stats.tokens.output).toBe(1900);
      expect(stats.tokens.total).toBe(2350);
    });

    it("should handle prompts with null tokens", async () => {
      const supabase = createMockSupabaseForStats({
        session: SAMPLE_SESSION,
        prompts: [
          { id: "p1", input_tokens: 100, output_tokens: 500, sequence_number: 1 },
          { id: "p2", input_tokens: null, output_tokens: null, sequence_number: 2 },
        ],
        responses: [],
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.tokens.input).toBe(100);
      expect(stats.tokens.output).toBe(500);
      expect(stats.tokens.total).toBe(600);
    });

    it("should return zeros for empty conversation", async () => {
      const supabase = createMockSupabaseForStats({
        session: SAMPLE_SESSION,
        prompts: [],
        responses: [],
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.tokens.input).toBe(0);
      expect(stats.tokens.output).toBe(0);
      expect(stats.tokens.total).toBe(0);
    });
  });

  // ==========================================================================
  // Tool Usage Tests
  // ==========================================================================
  describe("Tool Usage Parsing", () => {
    it("should aggregate tool usage across responses", async () => {
      const supabase = createMockSupabaseForStats({
        session: SAMPLE_SESSION,
        prompts: SAMPLE_PROMPTS,
        responses: SAMPLE_RESPONSES,
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      // Read: 2 times (response 1 and 3)
      // Edit: 2 times (response 1 and 3)
      // Bash: 1 time (response 2)
      // Task: 1 time (response 3)
      expect(stats.tools).toContainEqual({ name: "Read", count: 2 });
      expect(stats.tools).toContainEqual({ name: "Edit", count: 2 });
      expect(stats.tools).toContainEqual({ name: "Bash", count: 1 });
      expect(stats.tools).toContainEqual({ name: "Task", count: 1 });
    });

    it("should sort tools by frequency (descending)", async () => {
      const supabase = createMockSupabaseForStats({
        session: SAMPLE_SESSION,
        prompts: SAMPLE_PROMPTS,
        responses: [
          { ...SAMPLE_RESPONSES[0], tools_used: ["Read", "Read", "Read"] },
          { ...SAMPLE_RESPONSES[1], tools_used: ["Edit"] },
        ],
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      // Read should come first (3 uses) then Edit (1 use)
      expect(stats.tools[0].name).toBe("Read");
      expect(stats.tools[0].count).toBe(3);
    });

    it("should handle empty tools_used array", async () => {
      const supabase = createMockSupabaseForStats({
        session: SAMPLE_SESSION,
        prompts: [SAMPLE_PROMPTS[0]],
        responses: [
          { ...SAMPLE_RESPONSES[0], tools_used: [] },
        ],
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.tools).toHaveLength(0);
    });

    it("should handle null tools_used", async () => {
      const supabase = createMockSupabaseForStats({
        session: SAMPLE_SESSION,
        prompts: [SAMPLE_PROMPTS[0]],
        responses: [
          { ...SAMPLE_RESPONSES[0], tools_used: null },
        ],
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.tools).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Agent Detection Tests
  // ==========================================================================
  describe("Agent Detection", () => {
    it("should detect agents from Task tool usage", async () => {
      const supabase = createMockSupabaseForStats({
        session: SAMPLE_SESSION,
        prompts: SAMPLE_PROMPTS,
        responses: [
          { ...SAMPLE_RESPONSES[0], tools_used: ["Task"] },
          { ...SAMPLE_RESPONSES[1], tools_used: ["Task"] },
          { ...SAMPLE_RESPONSES[2], tools_used: ["Read"] }, // No Task
        ],
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.agents.length).toBeGreaterThan(0);
      // Should detect 2 agent invocations
      const totalAgentCount = stats.agents.reduce((sum, a) => sum + a.count, 0);
      expect(totalAgentCount).toBe(2);
    });

    it("should classify agent types from stop_reason hints", async () => {
      const supabase = createMockSupabaseForStats({
        session: SAMPLE_SESSION,
        prompts: SAMPLE_PROMPTS,
        responses: [
          { ...SAMPLE_RESPONSES[0], tools_used: ["Task"], stop_reason: "research complete" },
        ],
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.agents).toContainEqual({ type: "research", count: 1 });
    });

    it("should default to general-purpose when no type hints", async () => {
      const supabase = createMockSupabaseForStats({
        session: SAMPLE_SESSION,
        prompts: SAMPLE_PROMPTS,
        responses: [
          { ...SAMPLE_RESPONSES[0], tools_used: ["Task"], stop_reason: "end_turn" },
        ],
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.agents).toContainEqual({ type: "general-purpose", count: 1 });
    });

    it("should return empty array when no Task tool used", async () => {
      const supabase = createMockSupabaseForStats({
        session: SAMPLE_SESSION,
        prompts: SAMPLE_PROMPTS,
        responses: [
          { ...SAMPLE_RESPONSES[0], tools_used: ["Read", "Edit"] },
        ],
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.agents).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Context Window Tests
  // ==========================================================================
  describe("Context Window Metrics", () => {
    it("should calculate peak context percentage", async () => {
      const supabase = createMockSupabaseForStats({
        session: SAMPLE_SESSION,
        prompts: [
          { id: "p1", input_tokens: 50000, output_tokens: 50000, sequence_number: 1 },
        ],
        responses: [],
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      // 100,000 tokens / 200,000 = 50%
      expect(stats.contextWindow.peakPercentage).toBe(50);
      expect(stats.contextWindow.peakTurn).toBe(1);
    });

    it("should calculate cumulative context usage across turns", async () => {
      const supabase = createMockSupabaseForStats({
        session: SAMPLE_SESSION,
        prompts: [
          { id: "p1", input_tokens: 10000, output_tokens: 10000, sequence_number: 1 }, // 20k
          { id: "p2", input_tokens: 15000, output_tokens: 15000, sequence_number: 2 }, // +30k = 50k
          { id: "p3", input_tokens: 20000, output_tokens: 20000, sequence_number: 3 }, // +40k = 90k
        ],
        responses: [],
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      // Peak at turn 3: 90k / 200k = 45%
      expect(stats.contextWindow.peakPercentage).toBe(45);
      expect(stats.contextWindow.peakTurn).toBe(3);
    });

    it("should calculate average context percentage", async () => {
      const supabase = createMockSupabaseForStats({
        session: SAMPLE_SESSION,
        prompts: [
          { id: "p1", input_tokens: 20000, output_tokens: 0, sequence_number: 1 }, // 10%
          { id: "p2", input_tokens: 20000, output_tokens: 0, sequence_number: 2 }, // 20%
          { id: "p3", input_tokens: 20000, output_tokens: 0, sequence_number: 3 }, // 30%
        ],
        responses: [],
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      // Average: (10 + 20 + 30) / 3 = 20%
      expect(stats.contextWindow.avgPercentage).toBe(20);
    });

    it("should return zeros for empty conversation", async () => {
      const supabase = createMockSupabaseForStats({
        session: SAMPLE_SESSION,
        prompts: [],
        responses: [],
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.contextWindow.peakPercentage).toBe(0);
      expect(stats.contextWindow.peakTurn).toBe(0);
      expect(stats.contextWindow.avgPercentage).toBe(0);
    });
  });

  // ==========================================================================
  // Outcome Detection Tests
  // ==========================================================================
  describe("Outcome Detection", () => {
    it("should detect ongoing session", async () => {
      const supabase = createMockSupabaseForStats({
        session: {
          ...SAMPLE_SESSION,
          ended_at: null,
        },
        prompts: SAMPLE_PROMPTS,
        responses: SAMPLE_RESPONSES,
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.outcome.status).toBe("ongoing");
      expect(stats.outcome.indicators).toContain("Session has not ended");
    });

    it("should detect completed session from end_reason", async () => {
      const supabase = createMockSupabaseForStats({
        session: {
          ...SAMPLE_SESSION,
          end_reason: "completed",
        },
        prompts: SAMPLE_PROMPTS,
        responses: SAMPLE_RESPONSES,
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.outcome.status).toBe("completed");
    });

    it("should detect git commit from response stop_reason", async () => {
      const supabase = createMockSupabaseForStats({
        session: {
          ...SAMPLE_SESSION,
          end_reason: null,
          total_prompts: 3,
        },
        prompts: SAMPLE_PROMPTS,
        responses: [
          { ...SAMPLE_RESPONSES[0], stop_reason: "git commit created successfully" },
        ],
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.outcome.status).toBe("completed");
      expect(stats.outcome.indicators).toContainEqual("Git commit detected");
    });

    it("should detect test execution from response stop_reason", async () => {
      const supabase = createMockSupabaseForStats({
        session: {
          ...SAMPLE_SESSION,
          end_reason: null,
          total_prompts: 3,
        },
        prompts: SAMPLE_PROMPTS,
        responses: [
          { ...SAMPLE_RESPONSES[0], stop_reason: "all tests passed" },
        ],
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.outcome.status).toBe("completed");
      expect(stats.outcome.indicators).toContainEqual("Test execution detected");
    });

    it("should detect error from response stop_reason", async () => {
      const supabase = createMockSupabaseForStats({
        session: {
          ...SAMPLE_SESSION,
          end_reason: null,
          total_prompts: 3,
        },
        prompts: SAMPLE_PROMPTS,
        responses: [
          { ...SAMPLE_RESPONSES[0], stop_reason: "error: build failed" },
        ],
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.outcome.status).toBe("error");
    });

    it("should detect abandoned for short sessions", async () => {
      const supabase = createMockSupabaseForStats({
        session: {
          ...SAMPLE_SESSION,
          end_reason: null,
          total_prompts: 2,
        },
        prompts: [SAMPLE_PROMPTS[0]],
        responses: [SAMPLE_RESPONSES[0]],
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.outcome.status).toBe("abandoned");
    });

    it("should return unknown for ambiguous sessions", async () => {
      const supabase = createMockSupabaseForStats({
        session: {
          ...SAMPLE_SESSION,
          end_reason: null,
          total_prompts: 4, // Not short, not substantial
        },
        prompts: SAMPLE_PROMPTS,
        responses: [
          { ...SAMPLE_RESPONSES[0], stop_reason: "end_turn" }, // No clear signals
        ],
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.outcome.status).toBe("unknown");
    });
  });

  // ==========================================================================
  // Category Tests
  // ==========================================================================
  describe("Category Assignment", () => {
    it("should use primary_stage as category", async () => {
      const supabase = createMockSupabaseForStats({
        session: {
          ...SAMPLE_SESSION,
          primary_stage: "debugging",
        },
        prompts: SAMPLE_PROMPTS,
        responses: SAMPLE_RESPONSES,
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.category).toBe("debugging");
    });

    it("should return null when no primary_stage", async () => {
      const supabase = createMockSupabaseForStats({
        session: {
          ...SAMPLE_SESSION,
          primary_stage: null,
        },
        prompts: SAMPLE_PROMPTS,
        responses: SAMPLE_RESPONSES,
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.category).toBeNull();
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================
  describe("Error Handling", () => {
    it("should throw on invalid session ID format", async () => {
      const supabase = createMockSupabaseForStats({
        session: SAMPLE_SESSION,
        prompts: [],
        responses: [],
      });

      await expect(
        calculateConversationStats(supabase, "invalid-id")
      ).rejects.toThrow("Invalid session ID format");
    });

    it("should throw when session not found", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "No rows returned" },
        }),
      });

      const supabase = { from: mockFrom } as unknown as SupabaseClient;

      await expect(
        calculateConversationStats(supabase, VALID_SESSION_ID)
      ).rejects.toThrow("Session not found");
    });
  });

  // ==========================================================================
  // Edge Case Tests
  // ==========================================================================
  describe("Edge Cases", () => {
    it("should handle prompts without responses", async () => {
      const supabase = createMockSupabaseForStats({
        session: SAMPLE_SESSION,
        prompts: SAMPLE_PROMPTS,
        responses: [], // No responses
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.turnCount).toBe(3);
      expect(stats.tools).toHaveLength(0);
    });

    it("should handle responses without linked prompts", async () => {
      const supabase = createMockSupabaseForStats({
        session: SAMPLE_SESSION,
        prompts: [SAMPLE_PROMPTS[0]],
        responses: [
          { ...SAMPLE_RESPONSES[0], prompt_id: null }, // Unlinked response
        ],
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      expect(stats.turnCount).toBe(1);
    });

    it("should handle mixed linked and unlinked responses", async () => {
      const supabase = createMockSupabaseForStats({
        session: SAMPLE_SESSION,
        prompts: SAMPLE_PROMPTS,
        responses: [
          { ...SAMPLE_RESPONSES[0] }, // Linked
          { ...SAMPLE_RESPONSES[1], prompt_id: null }, // Unlinked
        ],
      });

      const stats = await calculateConversationStats(supabase, VALID_SESSION_ID);

      // Should still calculate tools from all responses
      expect(stats.tools.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Access Verification Tests
// ============================================================================

describe("Session Access Verification", () => {
  it("should allow access for team member", async () => {
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "sessions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { team_id: VALID_TEAM_ID },
            error: null,
          }),
        };
      }
      if (table === "team_members") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: "membership-id" },
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const supabase = { from: mockFrom } as unknown as SupabaseClient;

    const result = await verifySessionAccess(supabase, VALID_SESSION_ID, VALID_USER_ID);

    expect(result.hasAccess).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should deny access for non-team member", async () => {
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "sessions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { team_id: VALID_TEAM_ID },
            error: null,
          }),
        };
      }
      if (table === "team_members") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "No rows returned" },
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const supabase = { from: mockFrom } as unknown as SupabaseClient;

    const result = await verifySessionAccess(supabase, VALID_SESSION_ID, VALID_USER_ID);

    expect(result.hasAccess).toBe(false);
    expect(result.error).toContain("not a member");
  });

  it("should return not found for non-existent session", async () => {
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "sessions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "No rows returned" },
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const supabase = { from: mockFrom } as unknown as SupabaseClient;

    const result = await verifySessionAccess(supabase, VALID_SESSION_ID, VALID_USER_ID);

    expect(result.hasAccess).toBe(false);
    expect(result.error).toBe("Session not found");
  });

  it("should reject invalid session ID format", async () => {
    const supabase = { from: vi.fn() } as unknown as SupabaseClient;

    const result = await verifySessionAccess(supabase, "invalid", VALID_USER_ID);

    expect(result.hasAccess).toBe(false);
    expect(result.error).toBe("Invalid session ID format");
  });

  it("should reject invalid user ID format", async () => {
    const supabase = { from: vi.fn() } as unknown as SupabaseClient;

    const result = await verifySessionAccess(supabase, VALID_SESSION_ID, "invalid");

    expect(result.hasAccess).toBe(false);
    expect(result.error).toBe("Invalid user ID format");
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe("Constants", () => {
  it("should have correct context window size", () => {
    expect(CONTEXT_WINDOW_SIZE).toBe(200_000);
  });
});
