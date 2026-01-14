/**
 * Content Extractor Tests
 * Story 30-5: Conversation Content Extraction
 *
 * Tests for the conversation content extraction service.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractConversationContent,
  extractRawContent,
  formatTranscript,
  truncateText,
  formatTime,
  summarizeToolCall,
  lookupSessionBySessionId,
  type ExtractionOptions,
  type ConversationMessage,
  type ToolCall,
} from "../content-extractor";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// Mock Setup
// ============================================================================

const VALID_SESSION_ID = "11111111-1111-1111-1111-111111111111";

/**
 * Creates a mock Supabase client with configurable responses
 */
function createMockSupabase(config: {
  prompts?: Record<string, unknown>[];
  promptsError?: { message: string } | null;
  responses?: Record<string, Record<string, unknown>[]>;
  responsesError?: { message: string } | null;
  sessionLookup?: { id: string } | null;
  sessionLookupError?: { message: string } | null;
}): SupabaseClient {
  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "prompts") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockImplementation(() => ({
          order: vi.fn().mockResolvedValue({
            data: config.prompts ?? [],
            error: config.promptsError ?? null,
          }),
        })),
      };
    }

    if (table === "sessions") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: config.sessionLookup ?? null,
          error: config.sessionLookupError ?? null,
        }),
      };
    }

    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
  });

  const mockRpc = vi.fn().mockImplementation((funcName: string, params: Record<string, unknown>) => {
    if (funcName === "get_decrypted_response_by_prompt") {
      const promptId = params.p_prompt_id as string;
      const responseData = config.responses?.[promptId] ?? [];
      return Promise.resolve({
        data: responseData,
        error: config.responsesError ?? null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  });

  return {
    from: mockFrom,
    rpc: mockRpc,
  } as unknown as SupabaseClient;
}

// ============================================================================
// Test Data
// ============================================================================

const SAMPLE_PROMPTS = [
  {
    id: "prompt-1",
    text: "Help me create a function to calculate factorial",
    sequence_number: 1,
    created_at: "2025-01-09T10:23:00.000Z",
  },
  {
    id: "prompt-2",
    text: "Now add error handling for negative numbers",
    sequence_number: 2,
    created_at: "2025-01-09T10:25:00.000Z",
  },
  {
    id: "prompt-3",
    text: "Can you also add memoization?",
    sequence_number: 3,
    created_at: "2025-01-09T10:27:00.000Z",
  },
];

const SAMPLE_RESPONSES: Record<string, Record<string, unknown>[]> = {
  "prompt-1": [
    {
      id: "response-1",
      prompt_id: "prompt-1",
      response_text: "Here is a factorial function implementation...",
      tools_used: ["Read", "Edit"],
      has_thinking: true,
      thinking_summary: "User wants a factorial function. I should consider both iterative and recursive approaches.",
      created_at: "2025-01-09T10:23:30.000Z",
    },
  ],
  "prompt-2": [
    {
      id: "response-2",
      prompt_id: "prompt-2",
      response_text: "I have added input validation for negative numbers.",
      tools_used: ["Edit"],
      has_thinking: false,
      thinking_summary: null,
      created_at: "2025-01-09T10:25:30.000Z",
    },
  ],
  "prompt-3": [
    {
      id: "response-3",
      prompt_id: "prompt-3",
      response_text: "Added memoization using a Map for caching results.",
      tools_used: ["Read", "Edit", "Bash"],
      has_thinking: true,
      thinking_summary: "Memoization will improve performance for repeated calculations.",
      created_at: "2025-01-09T10:27:30.000Z",
    },
  ],
};

const DEFAULT_OPTIONS: ExtractionOptions = {
  includePrompts: true,
  includeResponses: true,
  includeThinking: true,
  includeTools: true,
};

// ============================================================================
// Main Extraction Function Tests
// ============================================================================

describe("extractConversationContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should extract complete conversation with all options enabled", async () => {
    const supabase = createMockSupabase({
      prompts: SAMPLE_PROMPTS,
      responses: SAMPLE_RESPONSES,
    });

    const result = await extractConversationContent(
      supabase,
      VALID_SESSION_ID,
      DEFAULT_OPTIONS
    );

    expect(result.metadata.sessionId).toBe(VALID_SESSION_ID);
    expect(result.metadata.promptCount).toBe(3);
    expect(result.metadata.responseCount).toBe(3);
    expect(result.metadata.turnCount).toBe(3);
    expect(result.metadata.includedThinking).toBe(true);
    expect(result.metadata.includedTools).toBe(true);
  });

  it("should extract only prompts when responses disabled", async () => {
    const supabase = createMockSupabase({
      prompts: SAMPLE_PROMPTS,
      responses: SAMPLE_RESPONSES,
    });

    const result = await extractConversationContent(supabase, VALID_SESSION_ID, {
      includePrompts: true,
      includeResponses: false,
      includeThinking: false,
      includeTools: false,
    });

    expect(result.rawContent.prompts).toHaveLength(3);
    expect(result.rawContent.responses).toHaveLength(0);
    expect(result.transcript).toContain("USER:");
    expect(result.transcript).not.toContain("A:");
  });

  it("should extract only responses when prompts disabled", async () => {
    const supabase = createMockSupabase({
      prompts: SAMPLE_PROMPTS,
      responses: SAMPLE_RESPONSES,
    });

    const result = await extractConversationContent(supabase, VALID_SESSION_ID, {
      includePrompts: false,
      includeResponses: true,
      includeThinking: false,
      includeTools: false,
    });

    expect(result.rawContent.prompts).toHaveLength(0);
    expect(result.rawContent.responses).toHaveLength(3);
    expect(result.transcript).not.toContain("USER:");
    expect(result.transcript).toContain("A:");
  });

  it("should include thinking content when enabled", async () => {
    const supabase = createMockSupabase({
      prompts: SAMPLE_PROMPTS,
      responses: SAMPLE_RESPONSES,
    });

    const result = await extractConversationContent(supabase, VALID_SESSION_ID, {
      includePrompts: true,
      includeResponses: true,
      includeThinking: true,
      includeTools: false,
    });

    expect(result.rawContent.thinking.length).toBeGreaterThan(0);
    expect(result.transcript).toContain("[Thinking]:");
  });

  it("should exclude thinking content when disabled", async () => {
    const supabase = createMockSupabase({
      prompts: SAMPLE_PROMPTS,
      responses: SAMPLE_RESPONSES,
    });

    const result = await extractConversationContent(supabase, VALID_SESSION_ID, {
      includePrompts: true,
      includeResponses: true,
      includeThinking: false,
      includeTools: false,
    });

    expect(result.rawContent.thinking).toHaveLength(0);
    expect(result.transcript).not.toContain("[Thinking]:");
  });

  it("should include tool calls when enabled", async () => {
    const supabase = createMockSupabase({
      prompts: SAMPLE_PROMPTS,
      responses: SAMPLE_RESPONSES,
    });

    const result = await extractConversationContent(supabase, VALID_SESSION_ID, {
      includePrompts: true,
      includeResponses: true,
      includeThinking: false,
      includeTools: true,
    });

    expect(result.rawContent.tools.length).toBeGreaterThan(0);
    expect(result.transcript).toContain("[Used tools:");
  });

  it("should exclude tool calls when disabled", async () => {
    const supabase = createMockSupabase({
      prompts: SAMPLE_PROMPTS,
      responses: SAMPLE_RESPONSES,
    });

    const result = await extractConversationContent(supabase, VALID_SESSION_ID, {
      includePrompts: true,
      includeResponses: true,
      includeThinking: false,
      includeTools: false,
    });

    expect(result.rawContent.tools).toHaveLength(0);
    expect(result.transcript).not.toContain("[Used tools:");
  });

  it("should return empty content for empty conversation", async () => {
    const supabase = createMockSupabase({
      prompts: [],
      responses: {},
    });

    const result = await extractConversationContent(
      supabase,
      VALID_SESSION_ID,
      DEFAULT_OPTIONS
    );

    expect(result.metadata.promptCount).toBe(0);
    expect(result.metadata.responseCount).toBe(0);
    expect(result.metadata.turnCount).toBe(0);
    expect(result.transcript).toBe("");
    expect(result.rawContent.prompts).toHaveLength(0);
    expect(result.rawContent.responses).toHaveLength(0);
  });

  it("should throw error for invalid session ID", async () => {
    const supabase = createMockSupabase({ prompts: [] });

    await expect(
      extractConversationContent(supabase, "invalid-id", DEFAULT_OPTIONS)
    ).rejects.toThrow("Invalid session ID format");
  });

  it("should throw error when prompts query fails", async () => {
    const supabase = createMockSupabase({
      promptsError: { message: "Database error" },
    });

    await expect(
      extractConversationContent(supabase, VALID_SESSION_ID, DEFAULT_OPTIONS)
    ).rejects.toThrow("Failed to fetch prompts");
  });

  it("should handle prompts without responses", async () => {
    const supabase = createMockSupabase({
      prompts: SAMPLE_PROMPTS,
      responses: {}, // No responses
    });

    const result = await extractConversationContent(
      supabase,
      VALID_SESSION_ID,
      DEFAULT_OPTIONS
    );

    expect(result.metadata.promptCount).toBe(3);
    expect(result.metadata.responseCount).toBe(0);
    expect(result.metadata.turnCount).toBe(0);
  });

  it("should calculate correct time range", async () => {
    const supabase = createMockSupabase({
      prompts: SAMPLE_PROMPTS,
      responses: SAMPLE_RESPONSES,
    });

    const result = await extractConversationContent(
      supabase,
      VALID_SESSION_ID,
      DEFAULT_OPTIONS
    );

    expect(result.metadata.timeRange.start).toBe("2025-01-09T10:23:00.000Z");
    // Last message is response-3 at 10:27:30
    expect(result.metadata.timeRange.end).toBe("2025-01-09T10:27:30.000Z");
  });
});

// ============================================================================
// extractRawContent Tests
// ============================================================================

describe("extractRawContent", () => {
  const sampleMessages: ConversationMessage[] = [
    {
      id: "msg-1",
      role: "user",
      timestamp: "2025-01-09T10:00:00Z",
      sequenceNumber: 1,
      content: "Hello, help me with X",
    },
    {
      id: "msg-2",
      role: "assistant",
      timestamp: "2025-01-09T10:00:30Z",
      sequenceNumber: 1,
      content: "I can help you with X",
      thinkingText: "User needs help with X",
      toolCalls: [{ name: "Read", input: { file_path: "/test.ts" } }],
    },
    {
      id: "msg-3",
      role: "user",
      timestamp: "2025-01-09T10:01:00Z",
      sequenceNumber: 2,
      content: "Thanks, now help with Y",
    },
    {
      id: "msg-4",
      role: "assistant",
      timestamp: "2025-01-09T10:01:30Z",
      sequenceNumber: 2,
      content: "Here is Y",
      toolCalls: [{ name: "Edit", input: { file_path: "/test.ts" } }],
    },
  ];

  it("should extract all content when all options enabled", () => {
    const result = extractRawContent(sampleMessages, {
      includePrompts: true,
      includeResponses: true,
      includeThinking: true,
      includeTools: true,
    });

    expect(result.prompts).toHaveLength(2);
    expect(result.responses).toHaveLength(2);
    expect(result.thinking).toHaveLength(1); // Only msg-2 has thinking
    expect(result.tools).toHaveLength(2);
  });

  it("should extract only prompts when responses disabled", () => {
    const result = extractRawContent(sampleMessages, {
      includePrompts: true,
      includeResponses: false,
      includeThinking: false,
      includeTools: false,
    });

    expect(result.prompts).toEqual(["Hello, help me with X", "Thanks, now help with Y"]);
    expect(result.responses).toHaveLength(0);
    expect(result.thinking).toHaveLength(0);
    expect(result.tools).toHaveLength(0);
  });

  it("should extract only responses when prompts disabled", () => {
    const result = extractRawContent(sampleMessages, {
      includePrompts: false,
      includeResponses: true,
      includeThinking: false,
      includeTools: false,
    });

    expect(result.prompts).toHaveLength(0);
    expect(result.responses).toEqual(["I can help you with X", "Here is Y"]);
  });

  it("should handle empty messages array", () => {
    const result = extractRawContent([], DEFAULT_OPTIONS);

    expect(result.prompts).toHaveLength(0);
    expect(result.responses).toHaveLength(0);
    expect(result.thinking).toHaveLength(0);
    expect(result.tools).toHaveLength(0);
  });

  it("should handle messages without thinking or tools", () => {
    const messagesWithoutExtras: ConversationMessage[] = [
      {
        id: "msg-1",
        role: "user",
        timestamp: "2025-01-09T10:00:00Z",
        sequenceNumber: 1,
        content: "Hello",
      },
      {
        id: "msg-2",
        role: "assistant",
        timestamp: "2025-01-09T10:00:30Z",
        sequenceNumber: 1,
        content: "Hi there",
        // No thinkingText or toolCalls
      },
    ];

    const result = extractRawContent(messagesWithoutExtras, DEFAULT_OPTIONS);

    expect(result.prompts).toHaveLength(1);
    expect(result.responses).toHaveLength(1);
    expect(result.thinking).toHaveLength(0);
    expect(result.tools).toHaveLength(0);
  });
});

// ============================================================================
// formatTranscript Tests
// ============================================================================

describe("formatTranscript", () => {
  it("should format messages into transcript format", () => {
    const messages: ConversationMessage[] = [
      {
        id: "msg-1",
        role: "user",
        timestamp: "2025-01-09T10:23:00.000Z",
        sequenceNumber: 1,
        content: "Help me with this",
      },
      {
        id: "msg-2",
        role: "assistant",
        timestamp: "2025-01-09T10:23:30.000Z",
        sequenceNumber: 1,
        content: "Here is the solution",
        thinkingText: "This is my reasoning",
        toolCalls: [{ name: "Read", input: {} }, { name: "Edit", input: {} }],
      },
    ];

    const transcript = formatTranscript(messages, DEFAULT_OPTIONS);

    expect(transcript).toContain("[Turn 1 -");
    expect(transcript).toContain("USER: Help me with this");
    expect(transcript).toContain("A: Here is the solution");
    expect(transcript).toContain("[Thinking]: This is my reasoning");
    expect(transcript).toContain("[Used tools: Read, Edit]");
  });

  it("should increment turn numbers correctly", () => {
    const messages: ConversationMessage[] = [
      { id: "1", role: "user", timestamp: "2025-01-09T10:00:00Z", sequenceNumber: 1, content: "Turn 1" },
      { id: "2", role: "assistant", timestamp: "2025-01-09T10:00:30Z", sequenceNumber: 1, content: "Response 1" },
      { id: "3", role: "user", timestamp: "2025-01-09T10:01:00Z", sequenceNumber: 2, content: "Turn 2" },
      { id: "4", role: "assistant", timestamp: "2025-01-09T10:01:30Z", sequenceNumber: 2, content: "Response 2" },
      { id: "5", role: "user", timestamp: "2025-01-09T10:02:00Z", sequenceNumber: 3, content: "Turn 3" },
    ];

    const transcript = formatTranscript(messages, DEFAULT_OPTIONS);

    expect(transcript).toContain("[Turn 1 -");
    expect(transcript).toContain("[Turn 2 -");
    expect(transcript).toContain("[Turn 3 -");
  });

  it("should exclude prompts when option disabled", () => {
    const messages: ConversationMessage[] = [
      { id: "1", role: "user", timestamp: "2025-01-09T10:00:00Z", sequenceNumber: 1, content: "My prompt" },
      { id: "2", role: "assistant", timestamp: "2025-01-09T10:00:30Z", sequenceNumber: 1, content: "My response" },
    ];

    const transcript = formatTranscript(messages, {
      includePrompts: false,
      includeResponses: true,
      includeThinking: false,
      includeTools: false,
    });

    expect(transcript).not.toContain("USER:");
    expect(transcript).not.toContain("My prompt");
    expect(transcript).toContain("A: My response");
  });

  it("should exclude responses when option disabled", () => {
    const messages: ConversationMessage[] = [
      { id: "1", role: "user", timestamp: "2025-01-09T10:00:00Z", sequenceNumber: 1, content: "My prompt" },
      { id: "2", role: "assistant", timestamp: "2025-01-09T10:00:30Z", sequenceNumber: 1, content: "My response" },
    ];

    const transcript = formatTranscript(messages, {
      includePrompts: true,
      includeResponses: false,
      includeThinking: false,
      includeTools: false,
    });

    expect(transcript).toContain("USER: My prompt");
    expect(transcript).not.toContain("A:");
    expect(transcript).not.toContain("My response");
  });

  it("should handle empty messages array", () => {
    const transcript = formatTranscript([], DEFAULT_OPTIONS);
    expect(transcript).toBe("");
  });

  it("should truncate long thinking text", () => {
    const longThinking = "A".repeat(300);
    const messages: ConversationMessage[] = [
      { id: "1", role: "user", timestamp: "2025-01-09T10:00:00Z", sequenceNumber: 1, content: "Prompt" },
      {
        id: "2",
        role: "assistant",
        timestamp: "2025-01-09T10:00:30Z",
        sequenceNumber: 1,
        content: "Response",
        thinkingText: longThinking,
      },
    ];

    const transcript = formatTranscript(messages, DEFAULT_OPTIONS);

    expect(transcript).toContain("[Thinking]:");
    expect(transcript).toContain("...");
    // Should be truncated to 200 chars + "..."
    expect(transcript.includes(longThinking)).toBe(false);
  });
});

// ============================================================================
// truncateText Tests
// ============================================================================

describe("truncateText", () => {
  it("should not truncate text shorter than max length", () => {
    expect(truncateText("Hello", 10)).toBe("Hello");
    expect(truncateText("Hello", 5)).toBe("Hello");
  });

  it("should truncate text longer than max length with ellipsis", () => {
    expect(truncateText("Hello World", 5)).toBe("Hello...");
    expect(truncateText("Hello World", 8)).toBe("Hello Wo...");
  });

  it("should handle empty string", () => {
    expect(truncateText("", 10)).toBe("");
  });

  it("should handle null/undefined gracefully", () => {
    expect(truncateText(null as unknown as string, 10)).toBe("");
    expect(truncateText(undefined as unknown as string, 10)).toBe("");
  });

  it("should use default max length of 200", () => {
    const longText = "A".repeat(250);
    const result = truncateText(longText);
    expect(result).toBe("A".repeat(200) + "...");
  });

  it("should handle exact boundary correctly", () => {
    expect(truncateText("12345", 5)).toBe("12345");
    expect(truncateText("123456", 5)).toBe("12345...");
  });
});

// ============================================================================
// formatTime Tests
// ============================================================================

describe("formatTime", () => {
  it("should format ISO timestamp to readable time", () => {
    // Note: This test may be timezone-dependent
    const result = formatTime("2025-01-09T10:23:45.000Z");
    // Result depends on local timezone, but should be in format "X:XX AM/PM"
    expect(result).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i);
  });

  it("should handle afternoon times", () => {
    const result = formatTime("2025-01-09T15:30:00.000Z");
    expect(result).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i);
  });

  it("should handle invalid timestamp gracefully", () => {
    expect(formatTime("invalid")).toBe("Unknown time");
    expect(formatTime("")).toBe("Unknown time");
  });

  it("should handle midnight correctly", () => {
    const result = formatTime("2025-01-09T00:00:00.000Z");
    expect(result).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i);
  });
});

// ============================================================================
// summarizeToolCall Tests
// ============================================================================

describe("summarizeToolCall", () => {
  it("should summarize Read tool with file_path", () => {
    const tool: ToolCall = {
      name: "Read",
      input: { file_path: "/src/index.ts" },
    };
    const result = summarizeToolCall(tool);
    expect(result.name).toBe("Read");
    expect(result.inputSummary).toBe("/src/index.ts");
  });

  it("should summarize Edit tool with file_path", () => {
    const tool: ToolCall = {
      name: "Edit",
      input: { file_path: "/src/component.tsx" },
    };
    const result = summarizeToolCall(tool);
    expect(result.name).toBe("Edit");
    expect(result.inputSummary).toBe("/src/component.tsx");
  });

  it("should summarize Bash tool with truncated command", () => {
    const longCommand = "npm run build && npm test && npm run lint && npm run deploy";
    const tool: ToolCall = {
      name: "Bash",
      input: { command: longCommand },
    };
    const result = summarizeToolCall(tool);
    expect(result.name).toBe("Bash");
    expect(result.inputSummary.length).toBeLessThanOrEqual(53); // 50 + "..."
    expect(result.inputSummary).toContain("npm run build");
  });

  it("should summarize Grep tool with pattern", () => {
    const tool: ToolCall = {
      name: "Grep",
      input: { pattern: "TODO|FIXME" },
    };
    const result = summarizeToolCall(tool);
    expect(result.name).toBe("Grep");
    expect(result.inputSummary).toBe("TODO|FIXME");
  });

  it("should summarize Task tool with subagent_type", () => {
    const tool: ToolCall = {
      name: "Task",
      input: { subagent_type: "general-purpose" },
    };
    const result = summarizeToolCall(tool);
    expect(result.name).toBe("Task");
    expect(result.inputSummary).toBe("general-purpose");
  });

  it("should summarize Task tool with type fallback", () => {
    const tool: ToolCall = {
      name: "Task",
      input: { type: "research" },
    };
    const result = summarizeToolCall(tool);
    expect(result.name).toBe("Task");
    expect(result.inputSummary).toBe("research");
  });

  it("should summarize Glob tool with pattern", () => {
    const tool: ToolCall = {
      name: "Glob",
      input: { pattern: "**/*.ts" },
    };
    const result = summarizeToolCall(tool);
    expect(result.name).toBe("Glob");
    expect(result.inputSummary).toBe("**/*.ts");
  });

  it("should summarize Write tool with file_path", () => {
    const tool: ToolCall = {
      name: "Write",
      input: { file_path: "/new-file.ts" },
    };
    const result = summarizeToolCall(tool);
    expect(result.name).toBe("Write");
    expect(result.inputSummary).toBe("/new-file.ts");
  });

  it("should handle unknown tool with JSON stringified input", () => {
    const tool: ToolCall = {
      name: "CustomTool",
      input: { foo: "bar", baz: 123 },
    };
    const result = summarizeToolCall(tool);
    expect(result.name).toBe("CustomTool");
    expect(result.inputSummary).toContain("foo");
  });

  it("should handle tool with empty input", () => {
    const tool: ToolCall = {
      name: "Read",
      input: {},
    };
    const result = summarizeToolCall(tool);
    expect(result.name).toBe("Read");
    expect(result.inputSummary).toBe("file");
  });

  it("should handle case-insensitive tool names", () => {
    const tools: ToolCall[] = [
      { name: "read", input: { file_path: "/test.ts" } },
      { name: "EDIT", input: { file_path: "/test.ts" } },
      { name: "Bash", input: { command: "ls" } },
    ];

    const results = tools.map(summarizeToolCall);
    expect(results[0].inputSummary).toBe("/test.ts");
    expect(results[1].inputSummary).toBe("/test.ts");
    expect(results[2].inputSummary).toBe("ls");
  });

  it("should truncate long unknown tool inputs", () => {
    const tool: ToolCall = {
      name: "UnknownTool",
      input: { data: "A".repeat(100) },
    };
    const result = summarizeToolCall(tool);
    expect(result.inputSummary.length).toBeLessThanOrEqual(53);
  });
});

// ============================================================================
// lookupSessionBySessionId Tests
// ============================================================================

describe("lookupSessionBySessionId", () => {
  it("should return database UUID for valid session_id", async () => {
    const supabase = createMockSupabase({
      sessionLookup: { id: VALID_SESSION_ID },
    });

    const result = await lookupSessionBySessionId(
      supabase,
      "session_abc123"
    );

    expect(result).toBe(VALID_SESSION_ID);
  });

  it("should return null for non-existent session_id", async () => {
    const supabase = createMockSupabase({
      sessionLookup: null,
      sessionLookupError: { message: "No rows returned" },
    });

    const result = await lookupSessionBySessionId(
      supabase,
      "session_nonexistent"
    );

    expect(result).toBeNull();
  });
});

// ============================================================================
// Edge Cases and Integration Tests
// ============================================================================

describe("Edge Cases", () => {
  it("should handle response with null response_text", async () => {
    const supabase = createMockSupabase({
      prompts: [SAMPLE_PROMPTS[0]],
      responses: {
        "prompt-1": [
          {
            id: "response-1",
            prompt_id: "prompt-1",
            response_text: null,
            tools_used: ["Read"],
            has_thinking: false,
            thinking_summary: null,
            created_at: "2025-01-09T10:23:30.000Z",
          },
        ],
      },
    });

    const result = await extractConversationContent(
      supabase,
      VALID_SESSION_ID,
      DEFAULT_OPTIONS
    );

    expect(result.metadata.responseCount).toBe(1);
    // Response content should be empty string, not crash
    expect(result.rawContent.responses[0]).toBe("");
  });

  it("should handle response with null tools_used", async () => {
    const supabase = createMockSupabase({
      prompts: [SAMPLE_PROMPTS[0]],
      responses: {
        "prompt-1": [
          {
            id: "response-1",
            prompt_id: "prompt-1",
            response_text: "Response text",
            tools_used: null,
            has_thinking: false,
            thinking_summary: null,
            created_at: "2025-01-09T10:23:30.000Z",
          },
        ],
      },
    });

    const result = await extractConversationContent(
      supabase,
      VALID_SESSION_ID,
      DEFAULT_OPTIONS
    );

    expect(result.rawContent.tools).toHaveLength(0);
    expect(result.transcript).not.toContain("[Used tools:");
  });

  it("should handle single prompt without response", async () => {
    const supabase = createMockSupabase({
      prompts: [SAMPLE_PROMPTS[0]],
      responses: {},
    });

    const result = await extractConversationContent(
      supabase,
      VALID_SESSION_ID,
      DEFAULT_OPTIONS
    );

    expect(result.metadata.promptCount).toBe(1);
    expect(result.metadata.responseCount).toBe(0);
    expect(result.metadata.turnCount).toBe(0);
    expect(result.transcript).toContain("USER:");
    expect(result.transcript).not.toContain("A:");
  });

  it("should handle prompts with null sequence_number", async () => {
    const promptsWithNullSeq = [
      {
        id: "prompt-1",
        text: "First prompt",
        sequence_number: null,
        created_at: "2025-01-09T10:00:00.000Z",
      },
      {
        id: "prompt-2",
        text: "Second prompt",
        sequence_number: null,
        created_at: "2025-01-09T10:01:00.000Z",
      },
    ];

    const supabase = createMockSupabase({
      prompts: promptsWithNullSeq,
      responses: {},
    });

    const result = await extractConversationContent(
      supabase,
      VALID_SESSION_ID,
      DEFAULT_OPTIONS
    );

    expect(result.metadata.promptCount).toBe(2);
    expect(result.transcript).toContain("[Turn 1 -");
    expect(result.transcript).toContain("[Turn 2 -");
  });

  it("should preserve order of prompts", async () => {
    const supabase = createMockSupabase({
      prompts: SAMPLE_PROMPTS,
      responses: {},
    });

    const result = await extractConversationContent(
      supabase,
      VALID_SESSION_ID,
      DEFAULT_OPTIONS
    );

    const promptOrder = result.rawContent.prompts;
    expect(promptOrder[0]).toContain("factorial");
    expect(promptOrder[1]).toContain("error handling");
    expect(promptOrder[2]).toContain("memoization");
  });
});

// ============================================================================
// Performance/Stress Tests
// ============================================================================

describe("Performance", () => {
  it("should handle conversation with many turns", async () => {
    const manyPrompts = Array.from({ length: 50 }, (_, i) => ({
      id: `prompt-${i}`,
      text: `Prompt number ${i}`,
      sequence_number: i + 1,
      created_at: new Date(2025, 0, 9, 10, i).toISOString(),
    }));

    const manyResponses: Record<string, Record<string, unknown>[]> = {};
    manyPrompts.forEach((p) => {
      manyResponses[p.id] = [
        {
          id: `response-${p.id}`,
          prompt_id: p.id,
          response_text: `Response to ${p.text}`,
          tools_used: ["Read"],
          has_thinking: false,
          thinking_summary: null,
          created_at: new Date(2025, 0, 9, 10, parseInt(p.id.split("-")[1]), 30).toISOString(),
        },
      ];
    });

    const supabase = createMockSupabase({
      prompts: manyPrompts,
      responses: manyResponses,
    });

    const result = await extractConversationContent(
      supabase,
      VALID_SESSION_ID,
      DEFAULT_OPTIONS
    );

    expect(result.metadata.promptCount).toBe(50);
    expect(result.metadata.responseCount).toBe(50);
    expect(result.metadata.turnCount).toBe(50);
    expect(result.transcript.length).toBeGreaterThan(0);
  });
});
