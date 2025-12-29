import { describe, it, expect } from "vitest";
import {
  responseCaptureSchema,
  toolUsedSchema,
  usageSchema,
  mapResponseValidationError,
  type ResponseCaptureRequest,
} from "../response-capture";

describe("toolUsedSchema", () => {
  it("should accept valid tool", () => {
    const result = toolUsedSchema.safeParse({
      name: "Read",
      id: "toolu_01234567890abcdef",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty name", () => {
    const result = toolUsedSchema.safeParse({
      name: "",
      id: "toolu_01234567890abcdef",
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty id", () => {
    const result = toolUsedSchema.safeParse({
      name: "Read",
      id: "",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing name", () => {
    const result = toolUsedSchema.safeParse({
      id: "toolu_01234567890abcdef",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing id", () => {
    const result = toolUsedSchema.safeParse({
      name: "Read",
    });
    expect(result.success).toBe(false);
  });
});

describe("usageSchema", () => {
  it("should accept valid usage with required fields only", () => {
    const result = usageSchema.safeParse({
      input_tokens: 1000,
      output_tokens: 500,
    });
    expect(result.success).toBe(true);
  });

  it("should accept valid usage with optional cache fields", () => {
    const result = usageSchema.safeParse({
      input_tokens: 1000,
      output_tokens: 500,
      cache_creation_input_tokens: 200,
      cache_read_input_tokens: 800,
    });
    expect(result.success).toBe(true);
  });

  it("should reject negative input_tokens", () => {
    const result = usageSchema.safeParse({
      input_tokens: -1,
      output_tokens: 500,
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative output_tokens", () => {
    const result = usageSchema.safeParse({
      input_tokens: 1000,
      output_tokens: -1,
    });
    expect(result.success).toBe(false);
  });

  it("should reject non-integer tokens", () => {
    const result = usageSchema.safeParse({
      input_tokens: 1000.5,
      output_tokens: 500,
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative cache_creation_input_tokens", () => {
    const result = usageSchema.safeParse({
      input_tokens: 1000,
      output_tokens: 500,
      cache_creation_input_tokens: -1,
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative cache_read_input_tokens", () => {
    const result = usageSchema.safeParse({
      input_tokens: 1000,
      output_tokens: 500,
      cache_read_input_tokens: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("responseCaptureSchema", () => {
  const validRequest: ResponseCaptureRequest = {
    session_id: "session_550e8400-e29b-41d4-a716-446655440000",
    message_uuid: "msg_01234567890abcdef",
    response_text: "Here is my response to your question.",
    tools_used: [
      { name: "Read", id: "toolu_01" },
      { name: "Edit", id: "toolu_02" },
    ],
    model: "claude-opus-4-5-20251101",
    usage: {
      input_tokens: 5000,
      output_tokens: 2000,
    },
    stop_reason: "end_turn",
    timestamp: "2025-12-26T10:30:00.000Z",
  };

  it("should accept valid request", () => {
    const result = responseCaptureSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it("should accept request with thinking_summary", () => {
    const request = {
      ...validRequest,
      thinking_summary: "I analyzed the code structure and found...",
      thinking_word_count: 150,
    };
    const result = responseCaptureSchema.safeParse(request);
    expect(result.success).toBe(true);
  });

  it("should accept request with cache stats", () => {
    const request = {
      ...validRequest,
      usage: {
        ...validRequest.usage,
        cache_creation_input_tokens: 1000,
        cache_read_input_tokens: 4000,
      },
    };
    const result = responseCaptureSchema.safeParse(request);
    expect(result.success).toBe(true);
  });

  it("should accept request with empty tools_used array", () => {
    const request = {
      ...validRequest,
      tools_used: [],
    };
    const result = responseCaptureSchema.safeParse(request);
    expect(result.success).toBe(true);
  });

  it("should default tools_used to empty array if not provided", () => {
    const request = {
      session_id: validRequest.session_id,
      message_uuid: validRequest.message_uuid,
      response_text: validRequest.response_text,
      model: validRequest.model,
      usage: validRequest.usage,
      stop_reason: validRequest.stop_reason,
      timestamp: validRequest.timestamp,
    };
    const result = responseCaptureSchema.safeParse(request);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tools_used).toEqual([]);
    }
  });

  it("should default response_text to empty string if not provided", () => {
    const request = {
      session_id: validRequest.session_id,
      message_uuid: validRequest.message_uuid,
      tools_used: [],
      model: validRequest.model,
      usage: validRequest.usage,
      stop_reason: validRequest.stop_reason,
      timestamp: validRequest.timestamp,
    };
    const result = responseCaptureSchema.safeParse(request);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.response_text).toBe("");
    }
  });

  describe("session_id validation", () => {
    it("should reject empty session_id", () => {
      const request = { ...validRequest, session_id: "" };
      const result = responseCaptureSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it("should reject missing session_id", () => {
      const { session_id: _, ...request } = validRequest;
      const result = responseCaptureSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  describe("message_uuid validation", () => {
    it("should reject empty message_uuid", () => {
      const request = { ...validRequest, message_uuid: "" };
      const result = responseCaptureSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it("should reject missing message_uuid", () => {
      const { message_uuid: _, ...request } = validRequest;
      const result = responseCaptureSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  describe("model validation", () => {
    it("should reject empty model", () => {
      const request = { ...validRequest, model: "" };
      const result = responseCaptureSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it("should reject missing model", () => {
      const { model: _, ...request } = validRequest;
      const result = responseCaptureSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  describe("stop_reason validation", () => {
    it("should reject empty stop_reason", () => {
      const request = { ...validRequest, stop_reason: "" };
      const result = responseCaptureSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it("should reject missing stop_reason", () => {
      const { stop_reason: _, ...request } = validRequest;
      const result = responseCaptureSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it("should accept various stop_reason values", () => {
      const stopReasons = ["end_turn", "max_tokens", "tool_use", "stop_sequence"];
      for (const stop_reason of stopReasons) {
        const request = { ...validRequest, stop_reason };
        const result = responseCaptureSchema.safeParse(request);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("timestamp validation", () => {
    it("should reject invalid timestamp format", () => {
      const request = { ...validRequest, timestamp: "not-a-date" };
      const result = responseCaptureSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it("should reject missing timestamp", () => {
      const { timestamp: _, ...request } = validRequest;
      const result = responseCaptureSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it("should accept valid ISO 8601 timestamps", () => {
      const timestamps = [
        "2025-12-26T10:30:00.000Z",
        "2025-12-26T10:30:00Z",
        "2025-01-01T00:00:00.000Z",
      ];
      for (const timestamp of timestamps) {
        const request = { ...validRequest, timestamp };
        const result = responseCaptureSchema.safeParse(request);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("thinking_summary validation", () => {
    it("should accept thinking_summary up to 500 chars", () => {
      const request = {
        ...validRequest,
        thinking_summary: "a".repeat(500),
      };
      const result = responseCaptureSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it("should reject thinking_summary over 500 chars", () => {
      const request = {
        ...validRequest,
        thinking_summary: "a".repeat(501),
      };
      const result = responseCaptureSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it("should accept empty thinking_summary", () => {
      const request = {
        ...validRequest,
        thinking_summary: "",
      };
      const result = responseCaptureSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });

  describe("thinking_word_count validation", () => {
    it("should reject negative thinking_word_count", () => {
      const request = {
        ...validRequest,
        thinking_word_count: -1,
      };
      const result = responseCaptureSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it("should accept zero thinking_word_count", () => {
      const request = {
        ...validRequest,
        thinking_word_count: 0,
      };
      const result = responseCaptureSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });

  describe("usage validation", () => {
    it("should reject missing usage", () => {
      const { usage: _, ...request } = validRequest;
      const result = responseCaptureSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it("should reject usage with missing input_tokens", () => {
      const request = {
        ...validRequest,
        usage: { output_tokens: 500 },
      };
      const result = responseCaptureSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it("should reject usage with missing output_tokens", () => {
      const request = {
        ...validRequest,
        usage: { input_tokens: 1000 },
      };
      const result = responseCaptureSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });
});

describe("mapResponseValidationError", () => {
  it("should include field path in message for nested fields", () => {
    const result = responseCaptureSchema.safeParse({
      session_id: "session_123",
      message_uuid: "msg_123",
      model: "claude",
      usage: { input_tokens: -1, output_tokens: 100 },
      stop_reason: "end_turn",
      timestamp: "2025-12-26T10:30:00Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const error = mapResponseValidationError(result.error);
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.message).toContain("input_tokens");
    }
  });

  it("should include field path for top-level errors", () => {
    const result = responseCaptureSchema.safeParse({
      session_id: "",
      message_uuid: "msg_123",
      model: "claude",
      usage: { input_tokens: 100, output_tokens: 100 },
      stop_reason: "end_turn",
      timestamp: "2025-12-26T10:30:00Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const error = mapResponseValidationError(result.error);
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.message).toContain("session_id");
    }
  });

  it("should handle multiple validation errors (returns first)", () => {
    const result = responseCaptureSchema.safeParse({
      session_id: "",
      message_uuid: "",
      model: "",
      usage: { input_tokens: -1, output_tokens: -1 },
      stop_reason: "",
      timestamp: "invalid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const error = mapResponseValidationError(result.error);
      expect(error.code).toBe("VALIDATION_ERROR");
      // Should have some message from the first error
      expect(error.message.length).toBeGreaterThan(0);
    }
  });
});
