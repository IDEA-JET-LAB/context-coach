import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  requestToStoreParams,
  type StoreResponseParams,
} from "../store-response";
import type { ResponseCaptureRequest } from "@/lib/validations/response-capture";

// Mock the supabase admin client
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    rpc: vi.fn(() => ({
      data: "response-id-123",
      error: null,
    })),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          is: vi.fn(() => ({
            limit: vi.fn(() => ({
              single: vi.fn(() => ({
                data: { id: "response-id-123" },
                error: null,
              })),
            })),
          })),
        })),
      })),
    })),
  })),
}));

describe("requestToStoreParams", () => {
  const mockRequest: ResponseCaptureRequest = {
    session_id: "session_550e8400-e29b-41d4-a716-446655440000",
    message_uuid: "msg_01234567890abcdef",
    response_text: "Here is my response to your question.",
    thinking_summary: "I analyzed the code...",
    thinking_word_count: 150,
    tools_used: [
      { name: "Read", id: "toolu_01" },
      { name: "Edit", id: "toolu_02" },
    ],
    model: "claude-opus-4-5-20251101",
    usage: {
      input_tokens: 5000,
      output_tokens: 2000,
      cache_creation_input_tokens: 1000,
      cache_read_input_tokens: 4000,
    },
    stop_reason: "end_turn",
    timestamp: "2025-12-26T10:30:00.000Z",
  };

  const sessionUuid = "db-session-uuid-123";

  it("should convert request to store params correctly", () => {
    const params = requestToStoreParams(mockRequest, sessionUuid);

    expect(params.sessionUuid).toBe(sessionUuid);
    expect(params.messageUuid).toBe(mockRequest.message_uuid);
    expect(params.responseText).toBe(mockRequest.response_text);
    expect(params.thinkingSummary).toBe(mockRequest.thinking_summary);
    expect(params.thinkingWordCount).toBe(mockRequest.thinking_word_count);
    expect(params.toolsUsed).toEqual(mockRequest.tools_used);
    expect(params.model).toBe(mockRequest.model);
    expect(params.usage).toEqual(mockRequest.usage);
    expect(params.stopReason).toBe(mockRequest.stop_reason);
  });

  it("should handle request without optional fields", () => {
    const requestWithoutOptional: ResponseCaptureRequest = {
      session_id: mockRequest.session_id,
      message_uuid: mockRequest.message_uuid,
      response_text: mockRequest.response_text,
      tools_used: [],
      model: mockRequest.model,
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
      },
      stop_reason: mockRequest.stop_reason,
      timestamp: mockRequest.timestamp,
    };

    const params = requestToStoreParams(requestWithoutOptional, sessionUuid);

    expect(params.thinkingSummary).toBeUndefined();
    expect(params.thinkingWordCount).toBeUndefined();
    expect(params.toolsUsed).toEqual([]);
    expect(params.usage.cache_creation_input_tokens).toBeUndefined();
    expect(params.usage.cache_read_input_tokens).toBeUndefined();
  });

  it("should preserve all tool information", () => {
    const params = requestToStoreParams(mockRequest, sessionUuid);

    expect(params.toolsUsed).toHaveLength(2);
    expect(params.toolsUsed[0]).toEqual({ name: "Read", id: "toolu_01" });
    expect(params.toolsUsed[1]).toEqual({ name: "Edit", id: "toolu_02" });
  });

  it("should handle empty response_text", () => {
    const requestWithEmptyText: ResponseCaptureRequest = {
      ...mockRequest,
      response_text: "",
    };

    const params = requestToStoreParams(requestWithEmptyText, sessionUuid);

    expect(params.responseText).toBe("");
  });
});

describe("StoreResponseParams type", () => {
  it("should have correct structure", () => {
    const params: StoreResponseParams = {
      sessionUuid: "session-uuid",
      messageUuid: "msg-uuid",
      responseText: "response",
      toolsUsed: [],
      model: "claude",
      usage: {
        input_tokens: 100,
        output_tokens: 50,
      },
      stopReason: "end_turn",
    };

    expect(params.sessionUuid).toBeDefined();
    expect(params.messageUuid).toBeDefined();
    expect(params.responseText).toBeDefined();
    expect(params.toolsUsed).toBeDefined();
    expect(params.model).toBeDefined();
    expect(params.usage).toBeDefined();
    expect(params.stopReason).toBeDefined();
  });

  it("should allow optional thinking fields", () => {
    const paramsWithThinking: StoreResponseParams = {
      sessionUuid: "session-uuid",
      messageUuid: "msg-uuid",
      responseText: "response",
      thinkingSummary: "I thought about...",
      thinkingWordCount: 100,
      toolsUsed: [],
      model: "claude",
      usage: {
        input_tokens: 100,
        output_tokens: 50,
      },
      stopReason: "end_turn",
    };

    expect(paramsWithThinking.thinkingSummary).toBe("I thought about...");
    expect(paramsWithThinking.thinkingWordCount).toBe(100);
  });

  it("should allow optional cache fields in usage", () => {
    const paramsWithCache: StoreResponseParams = {
      sessionUuid: "session-uuid",
      messageUuid: "msg-uuid",
      responseText: "response",
      toolsUsed: [],
      model: "claude",
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 20,
        cache_read_input_tokens: 80,
      },
      stopReason: "end_turn",
    };

    expect(paramsWithCache.usage.cache_creation_input_tokens).toBe(20);
    expect(paramsWithCache.usage.cache_read_input_tokens).toBe(80);
  });
});

describe("storeResponse integration", () => {
  // Note: Full integration tests would require a running database
  // These tests verify the function contract and mocking behavior

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call RPC with correct parameters", async () => {
    const { storeResponse } = await import("../store-response");
    const { createAdminClient } = await import("@/lib/supabase/admin");

    const mockRpc = vi.fn().mockResolvedValue({
      data: "response-id-123",
      error: null,
    });

    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      rpc: mockRpc,
    });

    const params: StoreResponseParams = {
      sessionUuid: "session-uuid-123",
      messageUuid: "msg-uuid-456",
      responseText: "This is my response.",
      thinkingSummary: "Analyzed the problem...",
      thinkingWordCount: 50,
      toolsUsed: [{ name: "Read", id: "toolu_01" }],
      model: "claude-opus-4-5-20251101",
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_input_tokens: 100,
        cache_read_input_tokens: 900,
      },
      stopReason: "end_turn",
    };

    await storeResponse(params);

    expect(mockRpc).toHaveBeenCalledWith("insert_encrypted_response", {
      p_prompt_id: null,
      p_response_text: "This is my response.",
      p_tool_count: 1,
      p_tools_used: ["Read"],
      p_model: "claude-opus-4-5-20251101",
      p_tokens_in: 1000,
      p_tokens_out: 500,
      p_has_thinking: true,
      p_thinking_summary: "Analyzed the problem...",
      p_thinking_word_count: 50,
      p_stop_reason: "end_turn",
      p_cache_stats: { creation: 100, read: 900 },
      p_session_uuid: "session-uuid-123",
      p_message_uuid: "msg-uuid-456",
    });
  });

  it("should handle null cache stats when cache fields not provided", async () => {
    const { storeResponse } = await import("../store-response");
    const { createAdminClient } = await import("@/lib/supabase/admin");

    const mockRpc = vi.fn().mockResolvedValue({
      data: "response-id-123",
      error: null,
    });

    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      rpc: mockRpc,
    });

    const params: StoreResponseParams = {
      sessionUuid: "session-uuid-123",
      messageUuid: "msg-uuid-456",
      responseText: "Response",
      toolsUsed: [],
      model: "claude",
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
      },
      stopReason: "end_turn",
    };

    await storeResponse(params);

    expect(mockRpc).toHaveBeenCalledWith(
      "insert_encrypted_response",
      expect.objectContaining({
        p_cache_stats: null,
      })
    );
  });

  it("should set has_thinking to false when no thinking_summary", async () => {
    const { storeResponse } = await import("../store-response");
    const { createAdminClient } = await import("@/lib/supabase/admin");

    const mockRpc = vi.fn().mockResolvedValue({
      data: "response-id-123",
      error: null,
    });

    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      rpc: mockRpc,
    });

    const params: StoreResponseParams = {
      sessionUuid: "session-uuid-123",
      messageUuid: "msg-uuid-456",
      responseText: "Response",
      toolsUsed: [],
      model: "claude",
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
      },
      stopReason: "end_turn",
    };

    await storeResponse(params);

    expect(mockRpc).toHaveBeenCalledWith(
      "insert_encrypted_response",
      expect.objectContaining({
        p_has_thinking: false,
        p_thinking_summary: null,
        p_thinking_word_count: null,
      })
    );
  });

  it("should extract tool names from toolsUsed array", async () => {
    const { storeResponse } = await import("../store-response");
    const { createAdminClient } = await import("@/lib/supabase/admin");

    const mockRpc = vi.fn().mockResolvedValue({
      data: "response-id-123",
      error: null,
    });

    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      rpc: mockRpc,
    });

    const params: StoreResponseParams = {
      sessionUuid: "session-uuid-123",
      messageUuid: "msg-uuid-456",
      responseText: "Response",
      toolsUsed: [
        { name: "Read", id: "toolu_01" },
        { name: "Edit", id: "toolu_02" },
        { name: "Bash", id: "toolu_03" },
      ],
      model: "claude",
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
      },
      stopReason: "end_turn",
    };

    await storeResponse(params);

    expect(mockRpc).toHaveBeenCalledWith(
      "insert_encrypted_response",
      expect.objectContaining({
        p_tool_count: 3,
        p_tools_used: ["Read", "Edit", "Bash"],
      })
    );
  });

  it("should throw error when RPC fails", async () => {
    vi.resetModules();

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn(() => ({
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Database error" },
        }),
      })),
    }));

    const { storeResponse } = await import("../store-response");

    const params: StoreResponseParams = {
      sessionUuid: "session-uuid-123",
      messageUuid: "msg-uuid-456",
      responseText: "Response",
      toolsUsed: [],
      model: "claude",
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
      },
      stopReason: "end_turn",
    };

    await expect(storeResponse(params)).rejects.toThrow(
      "Failed to store response: Database error"
    );
  });

  it("should return response ID on success", async () => {
    vi.resetModules();

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn(() => ({
        rpc: vi.fn().mockResolvedValue({
          data: "new-response-uuid-789",
          error: null,
        }),
      })),
    }));

    const { storeResponse } = await import("../store-response");

    const params: StoreResponseParams = {
      sessionUuid: "session-uuid-123",
      messageUuid: "msg-uuid-456",
      responseText: "Response",
      toolsUsed: [],
      model: "claude",
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
      },
      stopReason: "end_turn",
    };

    const result = await storeResponse(params);

    expect(result.id).toBe("new-response-uuid-789");
  });
});
