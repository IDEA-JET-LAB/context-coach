/**
 * Session Detection Tests
 * Story 16-2: Session Detection Logic
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isValidSessionId,
  extractSessionId,
  extractSessionIdFromMetadata,
} from "./session-detection";

// Mock the Supabase admin client for tests that need database access
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: { id: "test-uuid" },
              error: null,
            })
          ),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
    rpc: vi.fn(() => Promise.resolve({ error: null })),
  })),
}));

describe("isValidSessionId", () => {
  describe("valid session IDs", () => {
    it("should return true for valid session ID format", () => {
      expect(
        isValidSessionId("session_550e8400-e29b-41d4-a716-446655440000")
      ).toBe(true);
    });

    it("should return true for session ID with uppercase UUID", () => {
      expect(
        isValidSessionId("session_550E8400-E29B-41D4-A716-446655440000")
      ).toBe(true);
    });

    it("should return true for session ID with mixed case UUID", () => {
      expect(
        isValidSessionId("session_550e8400-E29b-41D4-a716-446655440000")
      ).toBe(true);
    });
  });

  describe("invalid session IDs", () => {
    it("should return false for null", () => {
      expect(isValidSessionId(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isValidSessionId(undefined)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isValidSessionId("")).toBe(false);
    });

    it("should return false for plain UUID without prefix", () => {
      expect(isValidSessionId("550e8400-e29b-41d4-a716-446655440000")).toBe(
        false
      );
    });

    it("should return false for wrong prefix", () => {
      expect(
        isValidSessionId("sess_550e8400-e29b-41d4-a716-446655440000")
      ).toBe(false);
    });

    it("should return false for invalid UUID part", () => {
      expect(isValidSessionId("session_not-a-valid-uuid")).toBe(false);
    });

    it("should return false for session_ prefix only", () => {
      expect(isValidSessionId("session_")).toBe(false);
    });

    it("should return false for number", () => {
      expect(isValidSessionId(12345)).toBe(false);
    });

    it("should return false for object", () => {
      expect(isValidSessionId({ sessionId: "test" })).toBe(false);
    });

    it("should return false for array", () => {
      expect(isValidSessionId(["session_xxx"])).toBe(false);
    });
  });
});

describe("extractSessionId", () => {
  const validSessionId = "session_550e8400-e29b-41d4-a716-446655440000";

  describe("null/undefined handling", () => {
    it("should return null for null input", () => {
      expect(extractSessionId(null)).toBeNull();
    });

    it("should return null for undefined input", () => {
      expect(extractSessionId(undefined)).toBeNull();
    });
  });

  describe("top-level sessionId", () => {
    it("should extract valid sessionId from top level", () => {
      expect(extractSessionId({ sessionId: validSessionId })).toBe(
        validSessionId
      );
    });

    it("should return null for invalid sessionId at top level", () => {
      expect(extractSessionId({ sessionId: "invalid" })).toBeNull();
    });

    it("should return null for missing sessionId", () => {
      expect(extractSessionId({ type: "prompt" })).toBeNull();
    });
  });

  describe("nested sessionId in message", () => {
    it("should extract sessionId from message object", () => {
      expect(
        extractSessionId({
          type: "prompt",
          message: { sessionId: validSessionId },
        })
      ).toBe(validSessionId);
    });

    it("should return null for invalid sessionId in message", () => {
      expect(
        extractSessionId({
          type: "prompt",
          message: { sessionId: "invalid" },
        })
      ).toBeNull();
    });

    it("should return null for null message", () => {
      expect(
        extractSessionId({
          type: "prompt",
          message: null,
        })
      ).toBeNull();
    });
  });

  describe("priority handling", () => {
    it("should prefer top-level sessionId over nested", () => {
      const topLevel = "session_11111111-1111-1111-1111-111111111111";
      const nested = "session_22222222-2222-2222-2222-222222222222";
      expect(
        extractSessionId({
          sessionId: topLevel,
          message: { sessionId: nested },
        })
      ).toBe(topLevel);
    });
  });

  describe("non-object inputs", () => {
    it("should return null for string input", () => {
      expect(extractSessionId("session_xxx" as unknown as null)).toBeNull();
    });

    it("should return null for number input", () => {
      expect(extractSessionId(12345 as unknown as null)).toBeNull();
    });

    it("should return null for array input", () => {
      expect(extractSessionId([] as unknown as null)).toBeNull();
    });
  });
});

describe("extractSessionIdFromMetadata", () => {
  const validSessionId = "session_550e8400-e29b-41d4-a716-446655440000";

  describe("null/undefined handling", () => {
    it("should return null for null input", () => {
      expect(extractSessionIdFromMetadata(null)).toBeNull();
    });

    it("should return null for undefined input", () => {
      expect(extractSessionIdFromMetadata(undefined)).toBeNull();
    });
  });

  describe("direct session_id field", () => {
    it("should extract from session_id field", () => {
      expect(
        extractSessionIdFromMetadata({ session_id: validSessionId })
      ).toBe(validSessionId);
    });

    it("should return null for invalid session_id", () => {
      expect(
        extractSessionIdFromMetadata({ session_id: "invalid" })
      ).toBeNull();
    });
  });

  describe("sessionId field (camelCase)", () => {
    it("should extract from sessionId field", () => {
      expect(
        extractSessionIdFromMetadata({ sessionId: validSessionId })
      ).toBe(validSessionId);
    });

    it("should return null for invalid sessionId", () => {
      expect(extractSessionIdFromMetadata({ sessionId: "invalid" })).toBeNull();
    });
  });

  describe("claude_session_id field", () => {
    it("should extract from claude_session_id field", () => {
      expect(
        extractSessionIdFromMetadata({ claude_session_id: validSessionId })
      ).toBe(validSessionId);
    });

    it("should return null for invalid claude_session_id", () => {
      expect(
        extractSessionIdFromMetadata({ claude_session_id: "invalid" })
      ).toBeNull();
    });
  });

  describe("nested context object", () => {
    it("should extract from context.session_id", () => {
      expect(
        extractSessionIdFromMetadata({
          context: { session_id: validSessionId },
        })
      ).toBe(validSessionId);
    });

    it("should extract from context.sessionId", () => {
      expect(
        extractSessionIdFromMetadata({
          context: { sessionId: validSessionId },
        })
      ).toBe(validSessionId);
    });

    it("should return null for invalid session ID in context", () => {
      expect(
        extractSessionIdFromMetadata({
          context: { session_id: "invalid" },
        })
      ).toBeNull();
    });
  });

  describe("priority handling", () => {
    it("should prefer session_id over sessionId", () => {
      const snakeCase = "session_11111111-1111-1111-1111-111111111111";
      const camelCase = "session_22222222-2222-2222-2222-222222222222";
      expect(
        extractSessionIdFromMetadata({
          session_id: snakeCase,
          sessionId: camelCase,
        })
      ).toBe(snakeCase);
    });

    it("should prefer direct fields over nested context", () => {
      const direct = "session_11111111-1111-1111-1111-111111111111";
      const nested = "session_22222222-2222-2222-2222-222222222222";
      expect(
        extractSessionIdFromMetadata({
          session_id: direct,
          context: { session_id: nested },
        })
      ).toBe(direct);
    });
  });

  describe("non-object inputs", () => {
    it("should return null for string input", () => {
      expect(
        extractSessionIdFromMetadata("session_xxx" as unknown as null)
      ).toBeNull();
    });

    it("should return null for array input", () => {
      expect(extractSessionIdFromMetadata([] as unknown as null)).toBeNull();
    });
  });
});
