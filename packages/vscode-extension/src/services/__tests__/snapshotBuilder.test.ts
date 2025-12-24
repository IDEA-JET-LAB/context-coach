/**
 * Unit tests for Snapshot Builder Service - Story 18-2
 *
 * Tests cover:
 * - Message extraction and summarization
 * - File operation tracking from tool_use messages
 * - Tool usage statistics
 * - Pending operation detection
 * - Conversation context extraction
 * - Git context extraction
 * - Full snapshot building
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  buildSessionSnapshot,
  extractRecentMessages,
  summarizeMessage,
  extractMessageContent,
  truncateContent,
  extractFileOperations,
  extractFilePaths,
  extractToolUsage,
  findPendingOperations,
  extractConversationContext,
  extractGitContext,
  extractProjectDir,
} from "../snapshotBuilder";
import type { ExtendedTranscriptMessage } from "../../types/sessionState";
import type { SummarizedMessage } from "../../types/sessionState";
import { SNAPSHOT_CONSTANTS } from "../../types/sessionState";
import type { InterruptedSession } from "../../types/interruptedSession";

// Mock child_process for git commands
jest.mock("child_process", () => ({
  exec: jest.fn((cmd, opts, cb) => {
    if (typeof opts === "function") {
      cb = opts;
    }
    if (cmd.includes("git rev-parse")) {
      if (cb) cb(null, { stdout: "main\n", stderr: "" });
    } else {
      if (cb) cb(new Error("Command not found"), { stdout: "", stderr: "" });
    }
  }),
}));

jest.mock("util", () => ({
  ...jest.requireActual("util"),
  promisify: (_fn: unknown) => {
    return async (cmd: string, _opts?: { cwd?: string; timeout?: number }) => {
      if (cmd.includes("git rev-parse")) {
        return { stdout: "main\n", stderr: "" };
      }
      throw new Error("Command failed");
    };
  },
}));

describe("SnapshotBuilder", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snapshot-builder-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("truncateContent", () => {
    it("should return content unchanged if within limit", () => {
      const content = "Short content";
      expect(truncateContent(content, 100)).toBe(content);
    });

    it("should truncate content exceeding limit", () => {
      const content = "A".repeat(100);
      const result = truncateContent(content, 50);
      expect(result.length).toBe(50);
      expect(result.endsWith("...")).toBe(true);
    });

    it("should handle empty content", () => {
      expect(truncateContent("", 100)).toBe("");
    });

    it("should handle content exactly at limit", () => {
      const content = "A".repeat(100);
      expect(truncateContent(content, 100)).toBe(content);
    });
  });

  describe("summarizeMessage", () => {
    it("should summarize user message", () => {
      const msg: ExtendedTranscriptMessage = {
        type: "user",
        uuid: "test-uuid",
        content: "Help me with code",
        timestamp: "2024-01-15T10:00:00Z",
      };

      const result = summarizeMessage(msg);

      expect(result).not.toBeNull();
      expect(result?.type).toBe("user");
      expect(result?.uuid).toBe("test-uuid");
      expect(result?.content).toBe("Help me with code");
      expect(result?.timestamp).toEqual(new Date("2024-01-15T10:00:00Z"));
    });

    it("should summarize assistant message", () => {
      const msg: ExtendedTranscriptMessage = {
        type: "assistant",
        content: "Here is the solution",
      };

      const result = summarizeMessage(msg);
      expect(result?.type).toBe("assistant");
    });

    it("should summarize tool_use message with tool info", () => {
      const msg: ExtendedTranscriptMessage = {
        type: "tool_use",
        toolName: "Read",
        toolInput: { file_path: "/path/to/file.ts" },
      };

      const result = summarizeMessage(msg);
      expect(result?.type).toBe("tool_use");
      expect(result?.content).toContain("[Tool: Read]");
      expect(result?.content).toContain("file_path");
    });

    it("should return null for unsupported message types", () => {
      const msg: ExtendedTranscriptMessage = {
        type: "system",
        content: "System message",
      };

      const result = summarizeMessage(msg);
      expect(result).toBeNull();
    });

    it("should generate UUID if not provided", () => {
      const msg: ExtendedTranscriptMessage = {
        type: "user",
        content: "Test",
      };

      const result = summarizeMessage(msg);
      expect(result?.uuid).toBeDefined();
      expect(result?.uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    });

    it("should truncate long content", () => {
      const longContent = "A".repeat(SNAPSHOT_CONSTANTS.MAX_CONTENT_LENGTH + 100);
      const msg: ExtendedTranscriptMessage = {
        type: "user",
        content: longContent,
      };

      const result = summarizeMessage(msg);
      expect(result?.content.length).toBe(SNAPSHOT_CONSTANTS.MAX_CONTENT_LENGTH);
      expect(result?.content.endsWith("...")).toBe(true);
    });
  });

  describe("extractMessageContent", () => {
    it("should extract string content", () => {
      const msg: ExtendedTranscriptMessage = {
        type: "user",
        content: "Plain text content",
      };
      expect(extractMessageContent(msg)).toBe("Plain text content");
    });

    it("should extract from array content", () => {
      const msg: ExtendedTranscriptMessage = {
        type: "user",
        content: [
          { type: "text", text: "First part" },
          { type: "text", text: "Second part" },
        ],
      };
      expect(extractMessageContent(msg)).toBe("First part\nSecond part");
    });

    it("should extract from message wrapper format", () => {
      const msg: ExtendedTranscriptMessage = {
        type: "user",
        content: {
          message: {
            content: "Wrapped content",
          },
        },
      };
      expect(extractMessageContent(msg)).toBe("Wrapped content");
    });

    it("should format tool_use message", () => {
      const msg: ExtendedTranscriptMessage = {
        type: "tool_use",
        toolName: "Bash",
        toolInput: { command: "ls -la" },
      };

      const result = extractMessageContent(msg);
      expect(result).toContain("[Tool: Bash]");
      expect(result).toContain("command");
    });

    it("should filter non-text array items", () => {
      const msg: ExtendedTranscriptMessage = {
        type: "user",
        content: [
          { type: "text", text: "Text content" },
          { type: "image", data: "base64..." },
        ],
      };
      expect(extractMessageContent(msg)).toBe("Text content");
    });

    it("should handle undefined content", () => {
      const msg: ExtendedTranscriptMessage = {
        type: "user",
      };
      expect(extractMessageContent(msg)).toBe("");
    });
  });

  describe("extractRecentMessages", () => {
    const createSessionFile = (messages: ExtendedTranscriptMessage[]): string => {
      const filePath = path.join(tempDir, "session.jsonl");
      const content = messages.map((m) => JSON.stringify(m)).join("\n");
      fs.writeFileSync(filePath, content);
      return filePath;
    };

    it("should extract messages from session file", async () => {
      const messages: ExtendedTranscriptMessage[] = [
        { type: "user", uuid: "1", content: "First message" },
        { type: "assistant", uuid: "2", content: "Response" },
        { type: "user", uuid: "3", content: "Second message" },
      ];

      const filePath = createSessionFile(messages);
      const result = await extractRecentMessages(filePath);

      expect(result.length).toBe(3);
      expect(result[0].content).toBe("First message");
      expect(result[2].content).toBe("Second message");
    });

    it("should limit to max messages", async () => {
      const messages: ExtendedTranscriptMessage[] = Array.from(
        { length: 30 },
        (_, i) => ({
          type: "user" as const,
          uuid: String(i),
          content: `Message ${i}`,
        })
      );

      const filePath = createSessionFile(messages);
      const result = await extractRecentMessages(filePath, 20);

      expect(result.length).toBe(20);
      // Should have the last 20 messages
      expect(result[0].content).toBe("Message 10");
      expect(result[19].content).toBe("Message 29");
    });

    it("should skip system messages", async () => {
      const messages: ExtendedTranscriptMessage[] = [
        { type: "system", uuid: "1", content: "System init" },
        { type: "user", uuid: "2", content: "User message" },
        { type: "init", uuid: "3", content: "Init data" },
      ];

      const filePath = createSessionFile(messages);
      const result = await extractRecentMessages(filePath);

      expect(result.length).toBe(1);
      expect(result[0].type).toBe("user");
    });

    it("should handle corrupted lines gracefully", async () => {
      const filePath = path.join(tempDir, "corrupted.jsonl");
      const content = [
        JSON.stringify({ type: "user", uuid: "1", content: "Valid" }),
        "not valid json",
        JSON.stringify({ type: "user", uuid: "2", content: "Also valid" }),
      ].join("\n");
      fs.writeFileSync(filePath, content);

      const result = await extractRecentMessages(filePath);
      expect(result.length).toBe(2);
    });

    it("should handle empty file", async () => {
      const filePath = path.join(tempDir, "empty.jsonl");
      fs.writeFileSync(filePath, "");

      const result = await extractRecentMessages(filePath);
      expect(result.length).toBe(0);
    });
  });

  describe("extractFilePaths", () => {
    it("should extract file_path from JSON", () => {
      const content = '{"file_path": "/path/to/file.ts"}';
      const result = extractFilePaths(content);
      expect(result).toContain("/path/to/file.ts");
    });

    it("should extract path from JSON", () => {
      const content = '{"path": "/another/path.js"}';
      const result = extractFilePaths(content);
      expect(result).toContain("/another/path.js");
    });

    it("should extract both file_path and path", () => {
      const content = '{"file_path": "/a.ts", "path": "/b.js"}';
      const result = extractFilePaths(content);
      expect(result).toContain("/a.ts");
      expect(result).toContain("/b.js");
    });

    it("should avoid duplicates", () => {
      const content = '{"file_path": "/same.ts", "path": "/same.ts"}';
      const result = extractFilePaths(content);
      expect(result.filter((p) => p === "/same.ts").length).toBe(1);
    });
  });

  describe("extractFileOperations", () => {
    it("should extract Read operations", () => {
      const messages: SummarizedMessage[] = [
        {
          uuid: "1",
          type: "tool_use",
          content: '[Tool: Read] {"file_path": "/path/to/file.ts"}',
          timestamp: new Date(),
        },
      ];

      const result = extractFileOperations(messages);
      expect(result.length).toBe(1);
      expect(result[0].operation).toBe("read");
      expect(result[0].path).toBe("/path/to/file.ts");
    });

    it("should extract Write operations", () => {
      const messages: SummarizedMessage[] = [
        {
          uuid: "1",
          type: "tool_use",
          content: '[Tool: Write] {"file_path": "/new/file.ts"}',
          timestamp: new Date(),
        },
      ];

      const result = extractFileOperations(messages);
      expect(result.length).toBe(1);
      expect(result[0].operation).toBe("write");
    });

    it("should extract Edit operations", () => {
      const messages: SummarizedMessage[] = [
        {
          uuid: "1",
          type: "tool_use",
          content: '[Tool: Edit] {"file_path": "/edited.ts"}',
          timestamp: new Date(),
        },
      ];

      const result = extractFileOperations(messages);
      expect(result[0].operation).toBe("edit");
    });

    it("should extract Glob and Grep as search", () => {
      const messages: SummarizedMessage[] = [
        {
          uuid: "1",
          type: "tool_use",
          content: '[Tool: Glob] {"pattern": "**/*.ts"}',
          timestamp: new Date(),
        },
        {
          uuid: "2",
          type: "tool_use",
          content: '[Tool: Grep] {"pattern": "function", "path": "/src"}',
          timestamp: new Date(),
        },
      ];

      const result = extractFileOperations(messages);
      expect(result.some((f) => f.operation === "search")).toBe(true);
    });

    it("should deduplicate files and keep most recent timestamp", () => {
      const earlier = new Date("2024-01-01T10:00:00Z");
      const later = new Date("2024-01-01T12:00:00Z");

      const messages: SummarizedMessage[] = [
        {
          uuid: "1",
          type: "tool_use",
          content: '[Tool: Read] {"file_path": "/same/file.ts"}',
          timestamp: earlier,
        },
        {
          uuid: "2",
          type: "tool_use",
          content: '[Tool: Edit] {"file_path": "/same/file.ts"}',
          timestamp: later,
        },
      ];

      const result = extractFileOperations(messages);
      expect(result.length).toBe(1);
      expect(result[0].lastAccessed).toEqual(later);
      expect(result[0].operation).toBe("edit"); // Most recent operation
    });

    it("should ignore non-file tools", () => {
      const messages: SummarizedMessage[] = [
        {
          uuid: "1",
          type: "tool_use",
          content: '[Tool: Bash] {"command": "ls"}',
          timestamp: new Date(),
        },
      ];

      const result = extractFileOperations(messages);
      expect(result.length).toBe(0);
    });
  });

  describe("extractToolUsage", () => {
    it("should count tool usage", () => {
      const messages: SummarizedMessage[] = [
        { uuid: "1", type: "tool_use", content: "[Tool: Read] {}", timestamp: new Date() },
        { uuid: "2", type: "tool_use", content: "[Tool: Read] {}", timestamp: new Date() },
        { uuid: "3", type: "tool_use", content: "[Tool: Write] {}", timestamp: new Date() },
      ];

      const result = extractToolUsage(messages);

      expect(result.length).toBe(2);
      const readTool = result.find((t) => t.name === "Read");
      const writeTool = result.find((t) => t.name === "Write");

      expect(readTool?.count).toBe(2);
      expect(writeTool?.count).toBe(1);
    });

    it("should sort by usage count descending", () => {
      const messages: SummarizedMessage[] = [
        { uuid: "1", type: "tool_use", content: "[Tool: Read] {}", timestamp: new Date() },
        { uuid: "2", type: "tool_use", content: "[Tool: Bash] {}", timestamp: new Date() },
        { uuid: "3", type: "tool_use", content: "[Tool: Bash] {}", timestamp: new Date() },
        { uuid: "4", type: "tool_use", content: "[Tool: Bash] {}", timestamp: new Date() },
      ];

      const result = extractToolUsage(messages);

      expect(result[0].name).toBe("Bash");
      expect(result[0].count).toBe(3);
    });

    it("should capture last args", () => {
      const messages: SummarizedMessage[] = [
        {
          uuid: "1",
          type: "tool_use",
          content: '[Tool: Read] {"file_path": "/first.ts"}',
          timestamp: new Date("2024-01-01T10:00:00Z"),
        },
        {
          uuid: "2",
          type: "tool_use",
          content: '[Tool: Read] {"file_path": "/second.ts"}',
          timestamp: new Date("2024-01-01T11:00:00Z"),
        },
      ];

      const result = extractToolUsage(messages);
      const readTool = result.find((t) => t.name === "Read");

      expect(readTool?.lastArgs).toEqual({ file_path: "/second.ts" });
    });

    it("should handle non-JSON args", () => {
      const messages: SummarizedMessage[] = [
        {
          uuid: "1",
          type: "tool_use",
          content: "[Tool: Bash] some raw command text",
          timestamp: new Date(),
        },
      ];

      const result = extractToolUsage(messages);
      expect(result[0].lastArgs).toHaveProperty("raw");
    });
  });

  describe("findPendingOperations", () => {
    it("should find tool_use without tool_result", () => {
      const messages: SummarizedMessage[] = [
        { uuid: "1", type: "user", content: "Do something", timestamp: new Date() },
        {
          uuid: "2",
          type: "tool_use",
          content: '[Tool: Bash] {"command": "long-running"}',
          timestamp: new Date(),
        },
      ];

      const result = findPendingOperations(messages);
      expect(result.length).toBe(1);
      expect(result[0].toolName).toBe("Bash");
    });

    it("should not flag completed operations", () => {
      const messages: SummarizedMessage[] = [
        { uuid: "1", type: "user", content: "Do something", timestamp: new Date() },
        {
          uuid: "2",
          type: "tool_use",
          content: '[Tool: Read] {"file_path": "/file.ts"}',
          timestamp: new Date(),
        },
        { uuid: "3", type: "tool_result", content: "File content...", timestamp: new Date() },
      ];

      const result = findPendingOperations(messages);
      expect(result.length).toBe(0);
    });

    it("should handle empty messages", () => {
      const result = findPendingOperations([]);
      expect(result.length).toBe(0);
    });
  });

  describe("extractConversationContext", () => {
    it("should extract initial and current task", () => {
      const messages: SummarizedMessage[] = [
        { uuid: "1", type: "user", content: "Help me build an API", timestamp: new Date() },
        { uuid: "2", type: "assistant", content: "Sure", timestamp: new Date() },
        { uuid: "3", type: "user", content: "Now add authentication", timestamp: new Date() },
      ];

      const result = extractConversationContext(messages);
      expect(result.initialTask).toBe("Help me build an API");
      expect(result.currentTask).toBe("Now add authentication");
    });

    it("should extract last action", () => {
      const messages: SummarizedMessage[] = [
        { uuid: "1", type: "user", content: "Do something", timestamp: new Date() },
        { uuid: "2", type: "assistant", content: "Working on it", timestamp: new Date() },
        {
          uuid: "3",
          type: "tool_use",
          content: "[Tool: Write] Created file",
          timestamp: new Date(),
        },
      ];

      const result = extractConversationContext(messages);
      expect(result.lastAction).toContain("[Tool: Write]");
    });

    it("should extract errors", () => {
      const messages: SummarizedMessage[] = [
        { uuid: "1", type: "user", content: "Run tests", timestamp: new Date() },
        {
          uuid: "2",
          type: "tool_result",
          content: "Error: Test failed\nAnother line",
          timestamp: new Date(),
        },
      ];

      const result = extractConversationContext(messages);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain("Error: Test failed");
    });

    it("should extract blockers", () => {
      const messages: SummarizedMessage[] = [
        { uuid: "1", type: "assistant", content: "I need to wait for the API response", timestamp: new Date() },
        { uuid: "2", type: "assistant", content: "Missing required dependency", timestamp: new Date() },
      ];

      const result = extractConversationContext(messages);
      expect(result.blockers.length).toBeGreaterThan(0);
    });

    it("should limit errors and blockers to 5", () => {
      const messages: SummarizedMessage[] = Array.from({ length: 10 }, (_, i) => ({
        uuid: String(i),
        type: "tool_result" as const,
        content: `Error: Problem ${i}`,
        timestamp: new Date(),
      }));

      const result = extractConversationContext(messages);
      expect(result.errors.length).toBeLessThanOrEqual(5);
    });

    it("should truncate long tasks", () => {
      const longTask = "A".repeat(1000);
      const messages: SummarizedMessage[] = [
        { uuid: "1", type: "user", content: longTask, timestamp: new Date() },
      ];

      const result = extractConversationContext(messages);
      expect(result.initialTask.length).toBeLessThanOrEqual(SNAPSHOT_CONSTANTS.MAX_TASK_LENGTH);
    });
  });

  describe("extractGitContext", () => {
    it("should extract git branch from checkout command", async () => {
      const messages: SummarizedMessage[] = [
        {
          uuid: "1",
          type: "tool_use",
          content: '[Tool: Bash] {"command": "git checkout feature-branch"}',
          timestamp: new Date(),
        },
      ];

      const result = await extractGitContext(messages, "/path/to/session.jsonl");
      expect(result?.branch).toBe("feature-branch");
    });

    it("should extract git branch from switch command", async () => {
      const messages: SummarizedMessage[] = [
        {
          uuid: "1",
          type: "tool_use",
          content: '[Tool: Bash] {"command": "git switch -b new-branch"}',
          timestamp: new Date(),
        },
      ];

      const result = await extractGitContext(messages, "/path/to/session.jsonl");
      expect(result?.branch).toBe("new-branch");
    });

    it("should detect uncommitted changes", async () => {
      const messages: SummarizedMessage[] = [
        {
          uuid: "1",
          type: "tool_result",
          content: "Changes not staged for commit:\n  modified: file.ts",
          timestamp: new Date(),
        },
      ];

      const result = await extractGitContext(messages, "/path/to/session.jsonl");
      expect(result?.hasUncommittedChanges).toBe(true);
    });

    it("should capture last git operation", async () => {
      const messages: SummarizedMessage[] = [
        {
          uuid: "1",
          type: "tool_use",
          content: '[Tool: Bash] {"command": "git status"}',
          timestamp: new Date(),
        },
        {
          uuid: "2",
          type: "tool_use",
          content: '[Tool: Bash] {"command": "git commit -m \\"fix\\""} ',
          timestamp: new Date(),
        },
      ];

      const result = await extractGitContext(messages, "/path/to/session.jsonl");
      expect(result?.lastGitOperation).toContain("git commit");
    });

    it("should return null when no git context", async () => {
      const messages: SummarizedMessage[] = [
        { uuid: "1", type: "user", content: "No git here", timestamp: new Date() },
      ];

      // Use a fake session path that won't resolve to a real directory
      const result = await extractGitContext(messages, "/fake/session.jsonl");
      expect(result).toBeNull();
    });
  });

  describe("extractProjectDir", () => {
    it("should convert normalized path to real path", () => {
      const sessionPath = "/home/user/.claude/projects/-Users-john-myproject/session.jsonl";
      const result = extractProjectDir(sessionPath);
      expect(result).toBe("/Users/john/myproject");
    });

    it("should handle deeper paths", () => {
      const sessionPath = "/home/.claude/projects/-Users-john-work-projects-app/s.jsonl";
      const result = extractProjectDir(sessionPath);
      expect(result).toBe("/Users/john/work/projects/app");
    });

    it("should return null for non-normalized paths", () => {
      const sessionPath = "/home/.claude/projects/regular-dir/session.jsonl";
      const result = extractProjectDir(sessionPath);
      expect(result).toBeNull();
    });
  });

  describe("buildSessionSnapshot", () => {
    it("should build complete snapshot from session", async () => {
      const sessionContent = [
        JSON.stringify({ type: "user", uuid: "1", content: "Initial task: build API", timestamp: "2024-01-15T10:00:00Z" }),
        JSON.stringify({ type: "assistant", uuid: "2", content: "I will help you", timestamp: "2024-01-15T10:01:00Z" }),
        JSON.stringify({ type: "tool_use", uuid: "3", toolName: "Read", toolInput: { file_path: "/src/app.ts" }, timestamp: "2024-01-15T10:02:00Z" }),
        JSON.stringify({ type: "tool_result", uuid: "4", content: "File content...", timestamp: "2024-01-15T10:02:01Z" }),
        JSON.stringify({ type: "user", uuid: "5", content: "Now add authentication", timestamp: "2024-01-15T10:03:00Z" }),
      ].join("\n");

      const filePath = path.join(tempDir, "complete-session.jsonl");
      fs.writeFileSync(filePath, sessionContent);

      const session: InterruptedSession = {
        sessionPath: filePath,
        sessionId: "test-session-123",
        slug: "test-session-slug",
        lastActivity: new Date(),
        lastPrompt: "Now add authentication",
        lastToolUsed: "Read",
        messageCount: 5,
      };

      const snapshot = await buildSessionSnapshot(session);

      expect(snapshot.sessionId).toBe("test-session-123");
      expect(snapshot.recentMessages.length).toBe(5);
      expect(snapshot.filesAffected.length).toBe(1);
      expect(snapshot.filesAffected[0].path).toBe("/src/app.ts");
      expect(snapshot.toolsUsed.length).toBe(1);
      expect(snapshot.toolsUsed[0].name).toBe("Read");
      expect(snapshot.conversationContext.initialTask).toContain("Initial task");
      expect(snapshot.conversationContext.currentTask).toContain("authentication");
      expect(snapshot.capturedAt).toBeInstanceOf(Date);
      expect(snapshot.expiresAt.getTime()).toBeGreaterThan(snapshot.capturedAt.getTime());
    });

    it("should handle empty session", async () => {
      const filePath = path.join(tempDir, "empty-session.jsonl");
      fs.writeFileSync(filePath, "");

      const session: InterruptedSession = {
        sessionPath: filePath,
        sessionId: "empty-session",
        slug: "empty-session-slug",
        lastActivity: new Date(),
        lastPrompt: "",
        lastToolUsed: null,
        messageCount: 0,
      };

      const snapshot = await buildSessionSnapshot(session);

      expect(snapshot.sessionId).toBe("empty-session");
      expect(snapshot.recentMessages.length).toBe(0);
      expect(snapshot.filesAffected.length).toBe(0);
      expect(snapshot.toolsUsed.length).toBe(0);
    });

    it("should set correct expiry date", async () => {
      const filePath = path.join(tempDir, "expiry-test.jsonl");
      fs.writeFileSync(filePath, JSON.stringify({ type: "user", content: "Test" }));

      const session: InterruptedSession = {
        sessionPath: filePath,
        sessionId: "expiry-test",
        slug: "expiry-test-slug",
        lastActivity: new Date(),
        lastPrompt: "Test",
        lastToolUsed: null,
        messageCount: 1,
      };

      const before = Date.now();
      const snapshot = await buildSessionSnapshot(session);
      const after = Date.now();

      const expectedMinExpiry = before + SNAPSHOT_CONSTANTS.EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      const expectedMaxExpiry = after + SNAPSHOT_CONSTANTS.EXPIRY_DAYS * 24 * 60 * 60 * 1000;

      expect(snapshot.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMinExpiry);
      expect(snapshot.expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxExpiry);
    });
  });
});
