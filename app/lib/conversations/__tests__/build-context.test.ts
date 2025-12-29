/**
 * Unit tests for conversation context builder
 * Story 25-4: Conversation Context Endpoint
 *
 * Note: These tests focus on the formatContextForLLM function and
 * type definitions since buildConversationContext requires database access.
 */

import { describe, it, expect } from "vitest";
import {
  formatContextForLLM,
  type ContextResult,
  type ContextMessage,
  type ContextMetadata,
  type LastResponseSummary,
} from "../build-context";

describe("formatContextForLLM", () => {
  const createMessage = (
    role: "user" | "assistant",
    content: string,
    truncated = false
  ): ContextMessage => ({
    role,
    content,
    tokenCount: 10,
    truncated,
  });

  const createMetadata = (
    overrides: Partial<ContextMetadata> = {}
  ): ContextMetadata => ({
    sessionStage: null,
    hasDebuggingLoop: false,
    messageIndex: 0,
    totalTokens: 100,
    messageCount: 2,
    truncated: false,
    tokenBudget: 10000,
    ...overrides,
  });

  it("formats messages with role labels", () => {
    const context: ContextResult = {
      messages: [
        createMessage("user", "Hello, can you help me?"),
        createMessage("assistant", "Of course! How can I help?"),
      ],
      metadata: createMetadata(),
    };

    const formatted = formatContextForLLM(context);

    expect(formatted).toContain("User: Hello, can you help me?");
    expect(formatted).toContain("Assistant: Of course! How can I help?");
  });

  it("marks truncated messages", () => {
    const context: ContextResult = {
      messages: [
        createMessage("user", "Long message...", true),
        createMessage("assistant", "Response"),
      ],
      metadata: createMetadata(),
    };

    const formatted = formatContextForLLM(context);

    expect(formatted).toContain("[truncated]");
    expect(formatted).toContain("User [truncated]: Long message...");
  });

  it("adds truncation note when context was truncated", () => {
    const context: ContextResult = {
      messages: [createMessage("user", "Hello")],
      metadata: createMetadata({ truncated: true, messageCount: 5 }),
    };

    const formatted = formatContextForLLM(context);

    expect(formatted).toContain("[Context truncated:");
    expect(formatted).toContain("5 most recent messages");
  });

  it("does not add truncation note when not truncated", () => {
    const context: ContextResult = {
      messages: [createMessage("user", "Hello")],
      metadata: createMetadata({ truncated: false }),
    };

    const formatted = formatContextForLLM(context);

    expect(formatted).not.toContain("[Context truncated:");
  });

  it("handles empty messages array", () => {
    const context: ContextResult = {
      messages: [],
      metadata: createMetadata({ messageCount: 0 }),
    };

    const formatted = formatContextForLLM(context);

    expect(formatted).toBe("");
  });

  it("preserves message order", () => {
    const context: ContextResult = {
      messages: [
        createMessage("user", "First message"),
        createMessage("assistant", "First response"),
        createMessage("user", "Second message"),
        createMessage("assistant", "Second response"),
      ],
      metadata: createMetadata({ messageCount: 4 }),
    };

    const formatted = formatContextForLLM(context);

    const lines = formatted.split("\n").filter((l) => l.includes(":"));
    expect(lines[0]).toContain("First message");
    expect(lines[1]).toContain("First response");
    expect(lines[2]).toContain("Second message");
    expect(lines[3]).toContain("Second response");
  });
});

describe("ContextResult type", () => {
  it("accepts valid context with all fields", () => {
    const context: ContextResult = {
      messages: [
        {
          role: "user",
          content: "Hello",
          promptType: "initiating",
          tokenCount: 5,
          truncated: false,
          promptId: "123",
          sequenceNumber: 1,
        },
        {
          role: "assistant",
          content: "Hi there!",
          tokenCount: 10,
          truncated: false,
        },
      ],
      lastResponse: {
        content: "Hi there!",
        thinkingSummary: "User is greeting",
        toolsUsed: ["Read", "Edit"],
        options: ["Option A", "Option B"],
        model: "claude-3-opus",
      },
      metadata: {
        sessionStage: "development",
        hasDebuggingLoop: true,
        messageIndex: 5,
        totalTokens: 150,
        messageCount: 2,
        truncated: false,
        tokenBudget: 10000,
      },
    };

    // Type check passes if this compiles
    expect(context.messages).toHaveLength(2);
    expect(context.lastResponse?.options).toHaveLength(2);
    expect(context.metadata.sessionStage).toBe("development");
  });

  it("accepts minimal context without optional fields", () => {
    const context: ContextResult = {
      messages: [
        {
          role: "user",
          content: "Hello",
          tokenCount: 5,
          truncated: false,
        },
      ],
      metadata: {
        sessionStage: null,
        hasDebuggingLoop: false,
        messageIndex: 1,
        totalTokens: 5,
        messageCount: 1,
        truncated: false,
        tokenBudget: 10000,
      },
    };

    expect(context.lastResponse).toBeUndefined();
  });
});

describe("LastResponseSummary type", () => {
  it("accepts valid last response with all fields", () => {
    const lastResponse: LastResponseSummary = {
      content: "Response content",
      thinkingSummary: "Summary of thinking",
      toolsUsed: ["Bash", "Read", "Write"],
      options: ["Do A", "Do B", "Do C"],
      model: "claude-3-opus-20240229",
    };

    expect(lastResponse.toolsUsed).toHaveLength(3);
    expect(lastResponse.options).toHaveLength(3);
  });

  it("accepts minimal last response", () => {
    const lastResponse: LastResponseSummary = {
      content: "Response",
      toolsUsed: [],
    };

    expect(lastResponse.thinkingSummary).toBeUndefined();
    expect(lastResponse.options).toBeUndefined();
  });
});

describe("ContextMetadata type", () => {
  it("accepts valid metadata with all session stages", () => {
    const stages = [
      "architecture",
      "specification",
      "development",
      "debugging",
      "enhancement",
      "planning",
      "implementation",
      "refactoring",
      "testing",
      "documentation",
      "review",
      "exploration",
      "unknown",
    ] as const;

    for (const stage of stages) {
      const metadata: ContextMetadata = {
        sessionStage: stage,
        hasDebuggingLoop: false,
        messageIndex: 0,
        totalTokens: 0,
        messageCount: 0,
        truncated: false,
        tokenBudget: 10000,
      };

      expect(metadata.sessionStage).toBe(stage);
    }
  });

  it("accepts null session stage", () => {
    const metadata: ContextMetadata = {
      sessionStage: null,
      hasDebuggingLoop: false,
      messageIndex: 0,
      totalTokens: 0,
      messageCount: 0,
      truncated: false,
      tokenBudget: 10000,
    };

    expect(metadata.sessionStage).toBeNull();
  });
});

describe("PromptClassification type", () => {
  it("accepts all valid prompt classifications", () => {
    const classifications = [
      "initiating",
      "continuation",
      "selection",
      "correction",
      "confirmation",
      "clarification",
      "tool_result",
    ] as const;

    const messages: ContextMessage[] = classifications.map((classification) => ({
      role: "user" as const,
      content: "Test",
      promptType: classification,
      tokenCount: 5,
      truncated: false,
    }));

    expect(messages).toHaveLength(7);
  });
});
