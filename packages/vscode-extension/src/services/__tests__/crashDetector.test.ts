/**
 * Unit tests for CrashDetector Service - Story 18-1 (Simplified)
 *
 * Tests cover:
 * - Listing recent session files
 * - Extracting metadata (slug, lastPrompt, cwd, gitBranch)
 * - Sorting by modification time
 * - Respecting recentSessionsLimit
 * - Graceful handling of missing directories and corrupted files
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  CrashDetector,
  getClaudeProjectsDir,
  extractSessionId,
  directoryExistsSync,
  extractUserContent,
  truncateText,
} from "../crashDetector";
import type { TranscriptMessage } from "../../types/interruptedSession";
import { DEFAULT_CRASH_DETECTION_CONFIG } from "../../types/interruptedSession";

// Mock VS Code module
jest.mock("vscode", () => ({
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn((_key: string, defaultValue: unknown) => defaultValue),
    })),
    onDidChangeConfiguration: jest.fn(() => ({ dispose: jest.fn() })),
  },
  window: {
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      dispose: jest.fn(),
    })),
  },
  EventEmitter: jest.fn().mockImplementation(() => ({
    event: jest.fn((_listener: (e: unknown) => void) => {
      return { dispose: jest.fn() };
    }),
    fire: jest.fn(),
    dispose: jest.fn(),
  })),
}));

describe("CrashDetector", () => {
  let crashDetector: CrashDetector;
  let tempDir: string;
  let projectDir: string;

  beforeEach(() => {
    // Reset singleton
    CrashDetector.resetInstance();
    crashDetector = CrashDetector.getInstance();

    // Create temp directory structure
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "crash-detector-test-"));
    projectDir = path.join(tempDir, "-Users-test-project");
    fs.mkdirSync(projectDir, { recursive: true });
  });

  afterEach(() => {
    crashDetector.dispose();
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("Singleton Pattern", () => {
    it("should return same instance on multiple calls", () => {
      const instance1 = CrashDetector.getInstance();
      const instance2 = CrashDetector.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should create new instance after resetInstance()", () => {
      const instance1 = CrashDetector.getInstance();
      CrashDetector.resetInstance();
      const instance2 = CrashDetector.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("Helper Functions", () => {
    describe("getClaudeProjectsDir", () => {
      it("should return default path using home directory", () => {
        const result = getClaudeProjectsDir();
        expect(result).toBe(path.join(os.homedir(), ".claude/projects"));
      });

      it("should return custom path when provided", () => {
        const customPath = "/custom/path";
        const result = getClaudeProjectsDir(customPath);
        expect(result).toBe(customPath);
      });
    });

    describe("extractSessionId", () => {
      it("should extract session ID from file path", () => {
        const filePath = "/path/to/abc123-def456.jsonl";
        expect(extractSessionId(filePath)).toBe("abc123-def456");
      });

      it("should handle UUID-formatted session IDs", () => {
        const filePath =
          "/path/to/550e8400-e29b-41d4-a716-446655440000.jsonl";
        expect(extractSessionId(filePath)).toBe(
          "550e8400-e29b-41d4-a716-446655440000"
        );
      });
    });

    describe("directoryExistsSync", () => {
      it("should return true for existing directory", () => {
        expect(directoryExistsSync(tempDir)).toBe(true);
      });

      it("should return false for non-existing directory", () => {
        expect(directoryExistsSync("/non/existing/path")).toBe(false);
      });

      it("should return false for file path", () => {
        const filePath = path.join(tempDir, "test.txt");
        fs.writeFileSync(filePath, "test");
        expect(directoryExistsSync(filePath)).toBe(false);
      });
    });

    describe("truncateText", () => {
      it("should return text unchanged if under limit", () => {
        expect(truncateText("Short text", 100)).toBe("Short text");
      });

      it("should truncate with ellipsis if over limit", () => {
        const longText = "This is a very long text that exceeds the limit";
        const result = truncateText(longText, 20);
        expect(result).toBe("This is a very lo...");
        expect(result.length).toBe(20);
      });

      it("should normalize whitespace", () => {
        expect(truncateText("  Multiple   spaces  ", 100)).toBe("Multiple spaces");
      });
    });

    describe("extractUserContent", () => {
      it("should extract string content", () => {
        const msg: TranscriptMessage = {
          type: "user",
          content: "Hello world",
        };
        expect(extractUserContent(msg)).toBe("Hello world");
      });

      it("should extract content from array format", () => {
        const msg: TranscriptMessage = {
          type: "user",
          content: [
            { type: "text", text: "First part" },
            { type: "text", text: "Second part" },
          ],
        };
        expect(extractUserContent(msg)).toBe("First part\nSecond part");
      });

      it("should return empty string for undefined content", () => {
        const msg: TranscriptMessage = {
          type: "user",
        };
        expect(extractUserContent(msg)).toBe("");
      });

      it("should filter out non-text array items", () => {
        const msg: TranscriptMessage = {
          type: "user",
          content: [
            { type: "text", text: "Text content" },
            { type: "image", data: "base64..." },
          ],
        };
        expect(extractUserContent(msg)).toBe("Text content");
      });
    });
  });

  describe("Recent Session Listing", () => {
    const createSessionFile = (
      filename: string,
      content: string,
      mtimeOffset: number = 0
    ) => {
      const filePath = path.join(projectDir, filename);
      fs.writeFileSync(filePath, content);
      // Set modification time
      const now = Date.now();
      const mtime = new Date(now - mtimeOffset);
      fs.utimesSync(filePath, mtime, mtime);
      return filePath;
    };

    it("should list recent sessions", async () => {
      const sessionContent = [
        JSON.stringify({ type: "user", content: "Help me with code", slug: "test-slug", cwd: "/test/path" }),
        JSON.stringify({ type: "assistant", content: "Sure, I can help" }),
      ].join("\n");

      createSessionFile("session1.jsonl", sessionContent, 20 * 60 * 1000); // 20 minutes ago

      const result = await crashDetector.detectInterruptedSessions({
        baseDir: tempDir,
        recentSessionsLimit: 5,
        maxAge: 60,
      });

      expect(result.interruptedSessions.length).toBe(1);
      expect(result.interruptedSessions[0].sessionId).toBe("session1");
      expect(result.interruptedSessions[0].slug).toBe("test-slug");
      expect(result.interruptedSessions[0].lastPrompt).toBe("Help me with code");
      expect(result.interruptedSessions[0].cwd).toBe("/test/path");
    });

    it("should respect recentSessionsLimit", async () => {
      // Create 10 sessions
      for (let i = 0; i < 10; i++) {
        const content = JSON.stringify({
          type: "user",
          content: `Session ${i}`,
          slug: `slug-${i}`,
        });
        createSessionFile(`session-${i}.jsonl`, content, (i + 1) * 60 * 1000);
      }

      const result = await crashDetector.detectInterruptedSessions({
        baseDir: tempDir,
        recentSessionsLimit: 3,
        maxAge: 1440,
      });

      expect(result.interruptedSessions.length).toBe(3);
    });

    it("should skip old sessions (beyond max age)", async () => {
      const sessionContent = JSON.stringify({
        type: "user",
        content: "Old work",
        slug: "old-slug",
      });

      createSessionFile("old.jsonl", sessionContent, 120 * 60 * 1000); // 2 hours ago

      const result = await crashDetector.detectInterruptedSessions({
        baseDir: tempDir,
        recentSessionsLimit: 5,
        maxAge: 60, // Only look at last hour
      });

      expect(result.interruptedSessions.length).toBe(0);
      expect(result.skippedFiles).toBeGreaterThanOrEqual(1);
    });

    it("should extract last tool used", async () => {
      const sessionContent = [
        JSON.stringify({ type: "user", content: "Run a command", slug: "tool-test" }),
        JSON.stringify({ type: "tool_use", toolName: "bash" }),
        JSON.stringify({ type: "tool_result", content: "Output" }),
        JSON.stringify({ type: "user", content: "Another request" }),
      ].join("\n");

      createSessionFile("with-tool.jsonl", sessionContent, 20 * 60 * 1000);

      const result = await crashDetector.detectInterruptedSessions({
        baseDir: tempDir,
        recentSessionsLimit: 5,
        maxAge: 60,
      });

      expect(result.interruptedSessions.length).toBe(1);
      expect(result.interruptedSessions[0].lastToolUsed).toBe("bash");
    });

    it("should count messages correctly", async () => {
      const sessionContent = [
        JSON.stringify({ type: "user", content: "First", slug: "count-test" }),
        JSON.stringify({ type: "assistant", content: "Reply 1" }),
        JSON.stringify({ type: "user", content: "Second" }),
        JSON.stringify({ type: "assistant", content: "Reply 2" }),
        JSON.stringify({ type: "user", content: "Third" }),
      ].join("\n");

      createSessionFile("multi-msg.jsonl", sessionContent, 20 * 60 * 1000);

      const result = await crashDetector.detectInterruptedSessions({
        baseDir: tempDir,
        recentSessionsLimit: 5,
        maxAge: 60,
      });

      expect(result.interruptedSessions.length).toBe(1);
      expect(result.interruptedSessions[0].messageCount).toBe(5);
      expect(result.interruptedSessions[0].lastPrompt).toBe("Third");
    });

    it("should extract gitBranch", async () => {
      const sessionContent = [
        JSON.stringify({ type: "user", content: "Test", slug: "branch-test", gitBranch: "feature/test" }),
      ].join("\n");

      createSessionFile("with-branch.jsonl", sessionContent, 20 * 60 * 1000);

      const result = await crashDetector.detectInterruptedSessions({
        baseDir: tempDir,
        recentSessionsLimit: 5,
        maxAge: 60,
      });

      expect(result.interruptedSessions[0].gitBranch).toBe("feature/test");
    });

    it("should truncate long prompts", async () => {
      const longPrompt = "A".repeat(200);
      const sessionContent = JSON.stringify({
        type: "user",
        content: longPrompt,
        slug: "long-prompt",
      });

      createSessionFile("long-prompt.jsonl", sessionContent, 20 * 60 * 1000);

      const result = await crashDetector.detectInterruptedSessions({
        baseDir: tempDir,
        recentSessionsLimit: 5,
        maxAge: 60,
      });

      expect(result.interruptedSessions[0].lastPrompt.length).toBe(100);
      expect(result.interruptedSessions[0].lastPrompt.endsWith("...")).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle missing ~/.claude directory gracefully", async () => {
      const result = await crashDetector.detectInterruptedSessions({
        baseDir: "/non/existing/claude/projects",
        recentSessionsLimit: 5,
        maxAge: 60,
      });

      expect(result.interruptedSessions.length).toBe(0);
      expect(result.errors.length).toBe(0);
      expect(result.totalFilesScanned).toBe(0);
    });

    it("should handle corrupted JSONL files gracefully", async () => {
      const corruptedContent = [
        "not valid json",
        "{ broken json without closing brace",
        JSON.stringify({ type: "user", content: "Valid message", slug: "corrupt-test" }),
      ].join("\n");

      const filePath = path.join(projectDir, "corrupted.jsonl");
      fs.writeFileSync(filePath, corruptedContent);
      const mtime = new Date(Date.now() - 20 * 60 * 1000);
      fs.utimesSync(filePath, mtime, mtime);

      const result = await crashDetector.detectInterruptedSessions({
        baseDir: tempDir,
        recentSessionsLimit: 5,
        maxAge: 60,
      });

      // Should still process valid lines
      expect(result.interruptedSessions.length).toBe(1);
      expect(result.interruptedSessions[0].messageCount).toBe(1);
    });

    it("should skip empty sessions (0 messages)", async () => {
      const filePath = path.join(projectDir, "empty.jsonl");
      fs.writeFileSync(filePath, "");
      const mtime = new Date(Date.now() - 20 * 60 * 1000);
      fs.utimesSync(filePath, mtime, mtime);

      const result = await crashDetector.detectInterruptedSessions({
        baseDir: tempDir,
        recentSessionsLimit: 5,
        maxAge: 60,
      });

      expect(result.interruptedSessions.length).toBe(0);
    });

    it("should handle files with only whitespace", async () => {
      const filePath = path.join(projectDir, "whitespace.jsonl");
      fs.writeFileSync(filePath, "   \n\n   \n");
      const mtime = new Date(Date.now() - 20 * 60 * 1000);
      fs.utimesSync(filePath, mtime, mtime);

      const result = await crashDetector.detectInterruptedSessions({
        baseDir: tempDir,
        recentSessionsLimit: 5,
        maxAge: 60,
      });

      expect(result.interruptedSessions.length).toBe(0);
    });
  });

  describe("Performance", () => {
    it("should scan 100 files in under 2 seconds", async () => {
      // Create 100 small session files
      for (let i = 0; i < 100; i++) {
        const content = JSON.stringify({
          type: "user",
          content: `Test prompt ${i}`,
          slug: `test-slug-${i}`,
        });
        const filePath = path.join(projectDir, `session-${i}.jsonl`);
        fs.writeFileSync(filePath, content);
        const mtime = new Date(Date.now() - 20 * 60 * 1000);
        fs.utimesSync(filePath, mtime, mtime);
      }

      const startTime = Date.now();

      const result = await crashDetector.detectInterruptedSessions({
        baseDir: tempDir,
        recentSessionsLimit: 100,
        maxAge: 60,
      });

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000);
      expect(result.totalFilesScanned).toBe(100);
    });
  });

  describe("Configuration", () => {
    const createSessionFile = (
      filename: string,
      content: string,
      mtimeOffset: number = 0
    ) => {
      const filePath = path.join(projectDir, filename);
      fs.writeFileSync(filePath, content);
      const now = Date.now();
      const mtime = new Date(now - mtimeOffset);
      fs.utimesSync(filePath, mtime, mtime);
      return filePath;
    };

    it("should respect maxAge setting", async () => {
      const sessionContent = JSON.stringify({
        type: "user",
        content: "Test",
        slug: "age-test",
      });

      // Create file that is 90 minutes old
      createSessionFile("older.jsonl", sessionContent, 90 * 60 * 1000);

      // With 60 min max age, should be skipped
      const result1 = await crashDetector.detectInterruptedSessions({
        baseDir: tempDir,
        recentSessionsLimit: 5,
        maxAge: 60,
      });
      expect(result1.interruptedSessions.length).toBe(0);

      // With 120 min max age, should be included
      const result2 = await crashDetector.detectInterruptedSessions({
        baseDir: tempDir,
        recentSessionsLimit: 5,
        maxAge: 120,
      });
      expect(result2.interruptedSessions.length).toBe(1);
    });
  });

  describe("Scan State", () => {
    it("should prevent concurrent scans", async () => {
      // Create a large file to ensure scan takes some time
      const largeContent = Array(1000)
        .fill(JSON.stringify({ type: "user", content: "Test", slug: "concurrent-test" }))
        .join("\n");

      const filePath = path.join(projectDir, "large.jsonl");
      fs.writeFileSync(filePath, largeContent);
      const mtime = new Date(Date.now() - 20 * 60 * 1000);
      fs.utimesSync(filePath, mtime, mtime);

      // Start first scan
      const scan1Promise = crashDetector.detectInterruptedSessions({
        baseDir: tempDir,
        recentSessionsLimit: 5,
        maxAge: 60,
      });

      // Check that scan is in progress
      expect(crashDetector.isScanInProgress()).toBe(true);

      // Complete first scan
      await scan1Promise;

      expect(crashDetector.isScanInProgress()).toBe(false);
    });

    it("should cache last scan result", async () => {
      const sessionContent = JSON.stringify({
        type: "user",
        content: "Test",
        slug: "cache-test",
      });

      const filePath = path.join(projectDir, "cached.jsonl");
      fs.writeFileSync(filePath, sessionContent);
      const mtime = new Date(Date.now() - 20 * 60 * 1000);
      fs.utimesSync(filePath, mtime, mtime);

      // Initially no cached result
      expect(crashDetector.getLastScanResult()).toBeNull();

      await crashDetector.detectInterruptedSessions({
        baseDir: tempDir,
        recentSessionsLimit: 5,
        maxAge: 60,
      });

      // Should now have cached result
      const cached = crashDetector.getLastScanResult();
      expect(cached).not.toBeNull();
      expect(cached?.interruptedSessions.length).toBe(1);
    });
  });

  describe("Multiple Projects", () => {
    it("should scan multiple project directories", async () => {
      // Create a second project directory
      const project2Dir = path.join(tempDir, "-Users-test-project2");
      fs.mkdirSync(project2Dir, { recursive: true });

      // Add session to first project
      const content1 = JSON.stringify({ type: "user", content: "Project 1", slug: "p1-slug" });
      const file1 = path.join(projectDir, "p1-session.jsonl");
      fs.writeFileSync(file1, content1);
      const mtime1 = new Date(Date.now() - 20 * 60 * 1000);
      fs.utimesSync(file1, mtime1, mtime1);

      // Add session to second project
      const content2 = JSON.stringify({ type: "user", content: "Project 2", slug: "p2-slug" });
      const file2 = path.join(project2Dir, "p2-session.jsonl");
      fs.writeFileSync(file2, content2);
      const mtime2 = new Date(Date.now() - 25 * 60 * 1000);
      fs.utimesSync(file2, mtime2, mtime2);

      const result = await crashDetector.detectInterruptedSessions({
        baseDir: tempDir,
        recentSessionsLimit: 10,
        maxAge: 60,
      });

      expect(result.interruptedSessions.length).toBe(2);
      expect(result.totalFilesScanned).toBe(2);
    });

    it("should skip hidden directories", async () => {
      // Create a hidden directory
      const hiddenDir = path.join(tempDir, ".hidden-project");
      fs.mkdirSync(hiddenDir, { recursive: true });

      // Add session to hidden directory
      const content = JSON.stringify({ type: "user", content: "Hidden", slug: "hidden-slug" });
      const file = path.join(hiddenDir, "hidden-session.jsonl");
      fs.writeFileSync(file, content);
      const mtime = new Date(Date.now() - 20 * 60 * 1000);
      fs.utimesSync(file, mtime, mtime);

      const result = await crashDetector.detectInterruptedSessions({
        baseDir: tempDir,
        recentSessionsLimit: 5,
        maxAge: 60,
      });

      // Should not include the hidden directory session
      const hiddenSession = result.interruptedSessions.find((s) =>
        s.sessionPath.includes(".hidden-project")
      );
      expect(hiddenSession).toBeUndefined();
    });
  });

  describe("Result Sorting", () => {
    it("should sort sessions by last activity (most recent first)", async () => {
      // Create sessions with different ages
      const sessions = [
        { name: "oldest", age: 50 },
        { name: "middle", age: 30 },
        { name: "newest", age: 20 },
      ];

      for (const session of sessions) {
        const content = JSON.stringify({
          type: "user",
          content: `Session ${session.name}`,
          slug: `${session.name}-slug`,
        });
        const file = path.join(projectDir, `${session.name}.jsonl`);
        fs.writeFileSync(file, content);
        const mtime = new Date(Date.now() - session.age * 60 * 1000);
        fs.utimesSync(file, mtime, mtime);
      }

      const result = await crashDetector.detectInterruptedSessions({
        baseDir: tempDir,
        recentSessionsLimit: 10,
        maxAge: 60,
      });

      expect(result.interruptedSessions.length).toBe(3);
      expect(result.interruptedSessions[0].sessionId).toBe("newest");
      expect(result.interruptedSessions[1].sessionId).toBe("middle");
      expect(result.interruptedSessions[2].sessionId).toBe("oldest");
    });
  });

  describe("Default Configuration Values", () => {
    it("should have correct default values", () => {
      expect(DEFAULT_CRASH_DETECTION_CONFIG.recentSessionsLimit).toBe(5);
      expect(DEFAULT_CRASH_DETECTION_CONFIG.maxAge).toBe(10080); // 7 days
      expect(DEFAULT_CRASH_DETECTION_CONFIG.autoScan).toBe(true);
      expect(DEFAULT_CRASH_DETECTION_CONFIG.fileTimeout).toBe(5000);
      expect(DEFAULT_CRASH_DETECTION_CONFIG.concurrency).toBe(10);
    });
  });

  describe("Fallback Slug", () => {
    it("should use sessionId as slug when slug not present", async () => {
      // Session without slug field
      const content = JSON.stringify({ type: "user", content: "No slug" });
      const file = path.join(projectDir, "no-slug-session.jsonl");
      fs.writeFileSync(file, content);
      const mtime = new Date(Date.now() - 20 * 60 * 1000);
      fs.utimesSync(file, mtime, mtime);

      const result = await crashDetector.detectInterruptedSessions({
        baseDir: tempDir,
        recentSessionsLimit: 5,
        maxAge: 60,
      });

      expect(result.interruptedSessions[0].slug).toBe("no-slug-session");
    });
  });
});
