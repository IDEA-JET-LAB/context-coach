import { describe, it, expect } from "vitest";
import { classifyPrompt } from "./classify-prompt";

describe("classifyPrompt", () => {
  describe("regular prompts", () => {
    it("classifies text without slash as prompt", () => {
      const result = classifyPrompt("Help me fix this bug");
      expect(result).toEqual({
        type: "prompt",
        promptPart: "Help me fix this bug",
        shouldAnalyze: true,
        analysisStatus: "pending",
      });
    });

    it("classifies text with slash in middle as prompt", () => {
      const result = classifyPrompt("What does /api/users endpoint do?");
      expect(result).toEqual({
        type: "prompt",
        promptPart: "What does /api/users endpoint do?",
        shouldAnalyze: true,
        analysisStatus: "pending",
      });
    });

    it("handles whitespace-only input", () => {
      const result = classifyPrompt("   ");
      expect(result.type).toBe("prompt");
      expect(result.promptPart).toBe("");
    });
  });

  describe("pure commands", () => {
    it("classifies /commit as command", () => {
      const result = classifyPrompt("/commit");
      expect(result).toEqual({
        type: "command",
        commandPart: "/commit",
        shouldAnalyze: false,
        analysisStatus: "skipped",
      });
    });

    it("classifies /dev as command", () => {
      const result = classifyPrompt("/dev");
      expect(result).toEqual({
        type: "command",
        commandPart: "/dev",
        shouldAnalyze: false,
        analysisStatus: "skipped",
      });
    });

    it("classifies /help as command", () => {
      const result = classifyPrompt("/help");
      expect(result).toEqual({
        type: "command",
        commandPart: "/help",
        shouldAnalyze: false,
        analysisStatus: "skipped",
      });
    });

    it("classifies BMAD agent paths as command", () => {
      const result = classifyPrompt("/bmad:bmm:agents:dev");
      expect(result).toEqual({
        type: "command",
        commandPart: "/bmad:bmm:agents:dev",
        shouldAnalyze: false,
        analysisStatus: "skipped",
      });
    });

    it("classifies /review-pr 123 as command (numeric arg)", () => {
      const result = classifyPrompt("/review-pr 123");
      expect(result).toEqual({
        type: "command",
        commandPart: "/review-pr",
        shouldAnalyze: false,
        analysisStatus: "skipped",
      });
    });

    it("classifies command with short args as command", () => {
      const result = classifyPrompt("/commit -m fix");
      expect(result.type).toBe("command");
      expect(result.shouldAnalyze).toBe(false);
    });

    it("handles command with trailing whitespace", () => {
      const result = classifyPrompt("/commit   ");
      expect(result.type).toBe("command");
      expect(result.commandPart).toBe("/commit");
    });

    it("handles just a slash", () => {
      const result = classifyPrompt("/");
      expect(result.type).toBe("command");
      expect(result.shouldAnalyze).toBe(false);
    });
  });

  describe("commands with prompts", () => {
    it("classifies /dev with meaningful text as command_with_prompt", () => {
      const result = classifyPrompt("/dev help me implement OAuth authentication");
      expect(result).toEqual({
        type: "command_with_prompt",
        commandPart: "/dev",
        promptPart: "help me implement OAuth authentication",
        shouldAnalyze: true,
        analysisStatus: "pending",
      });
    });

    it("classifies /commit with description as command_with_prompt", () => {
      const result = classifyPrompt("/commit fix the login validation bug and update tests");
      expect(result).toEqual({
        type: "command_with_prompt",
        commandPart: "/commit",
        promptPart: "fix the login validation bug and update tests",
        shouldAnalyze: true,
        analysisStatus: "pending",
      });
    });

    it("classifies /review-pr with instructions as command_with_prompt", () => {
      const result = classifyPrompt("/review-pr 123 focus on security vulnerabilities");
      expect(result).toEqual({
        type: "command_with_prompt",
        commandPart: "/review-pr",
        promptPart: "123 focus on security vulnerabilities",
        shouldAnalyze: true,
        analysisStatus: "pending",
      });
    });

    it("extracts prompt from BMAD agent with text", () => {
      const result = classifyPrompt("/bmad:bmm:agents:architect design the API structure");
      expect(result.type).toBe("command_with_prompt");
      expect(result.commandPart).toBe("/bmad:bmm:agents:architect");
      expect(result.promptPart).toBe("design the API structure");
    });
  });

  describe("edge cases", () => {
    it("trims input before classification", () => {
      const result = classifyPrompt("  /dev  ");
      expect(result.type).toBe("command");
      expect(result.commandPart).toBe("/dev");
    });

    it("handles newlines in prompt text", () => {
      const result = classifyPrompt("/dev help me with:\n1. Auth\n2. Database");
      expect(result.type).toBe("command_with_prompt");
      expect(result.promptPart).toContain("help me with:");
    });

    it("handles command with exactly minimum length text", () => {
      // 10 chars is the minimum - must be non-numeric text
      const result = classifyPrompt("/dev fix this b");  // "fix this b" = 10 chars
      expect(result.type).toBe("command_with_prompt");
    });

    it("treats text just under minimum as command", () => {
      // 9 chars - should be treated as command
      const result = classifyPrompt("/dev 123456789");
      expect(result.type).toBe("command");
    });
  });
});
