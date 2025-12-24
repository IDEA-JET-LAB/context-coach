/**
 * Unit tests for Clipboard Service - Story 18-5
 *
 * Tests cover:
 * - Successful clipboard copy operations
 * - Empty/invalid input handling
 * - Error handling for clipboard failures
 * - ClipboardService class methods
 */

import { copyToClipboard, ClipboardService, createClipboardService } from "../clipboardService";

// Mock VS Code module
const mockWriteText = jest.fn();
const mockReadText = jest.fn();

jest.mock("vscode", () => ({
  env: {
    clipboard: {
      writeText: (...args: unknown[]) => mockWriteText(...args),
      readText: (...args: unknown[]) => mockReadText(...args),
    },
  },
}), { virtual: true });

const createMockOutputChannel = () => ({
  appendLine: jest.fn(),
  dispose: jest.fn(),
});

describe("copyToClipboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteText.mockResolvedValue(undefined);
  });

  describe("input validation", () => {
    it("should return error for empty string", async () => {
      const result = await copyToClipboard("");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Empty text provided");
      expect(mockWriteText).not.toHaveBeenCalled();
    });

    it("should return error for null input", async () => {
      const result = await copyToClipboard(null as unknown as string);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Empty text provided");
    });

    it("should return error for undefined input", async () => {
      const result = await copyToClipboard(undefined as unknown as string);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Empty text provided");
    });

    it("should return error for non-string input", async () => {
      const result = await copyToClipboard(123 as unknown as string);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid text type");
    });

    it("should return error for whitespace-only string", async () => {
      const result = await copyToClipboard("   \n\t  ");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Empty prompt after trimming");
    });
  });

  describe("successful operations", () => {
    it("should copy text successfully", async () => {
      const text = "Hello, world!";
      const result = await copyToClipboard(text);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockWriteText).toHaveBeenCalledWith(text);
    });

    it("should handle text with whitespace", async () => {
      const text = "  Hello, world!  ";
      const result = await copyToClipboard(text);

      expect(result.success).toBe(true);
      // The original text (with whitespace) should be copied
      expect(mockWriteText).toHaveBeenCalledWith(text);
    });

    it("should handle multi-line text", async () => {
      const text = "Line 1\nLine 2\nLine 3";
      const result = await copyToClipboard(text);

      expect(result.success).toBe(true);
      expect(mockWriteText).toHaveBeenCalledWith(text);
    });

    it("should handle special characters", async () => {
      const text = "Special chars: <script>alert('XSS')</script>";
      const result = await copyToClipboard(text);

      expect(result.success).toBe(true);
      expect(mockWriteText).toHaveBeenCalledWith(text);
    });

    it("should handle unicode characters", async () => {
      const text = "Unicode: \u{1F600} \u{1F389} \u4E2D\u6587";
      const result = await copyToClipboard(text);

      expect(result.success).toBe(true);
      expect(mockWriteText).toHaveBeenCalledWith(text);
    });

    it("should handle very long text", async () => {
      const text = "x".repeat(100000);
      const result = await copyToClipboard(text);

      expect(result.success).toBe(true);
      expect(mockWriteText).toHaveBeenCalledWith(text);
    });
  });

  describe("error handling", () => {
    it("should handle clipboard write failure", async () => {
      mockWriteText.mockRejectedValueOnce(new Error("Clipboard access denied"));

      const result = await copyToClipboard("test");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Clipboard access denied");
    });

    it("should handle unknown error type", async () => {
      mockWriteText.mockRejectedValueOnce("string error");

      const result = await copyToClipboard("test");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown clipboard error");
    });

    it("should handle Error subclass", async () => {
      class CustomError extends Error {
        constructor() {
          super("Custom error message");
          this.name = "CustomError";
        }
      }
      mockWriteText.mockRejectedValueOnce(new CustomError());

      const result = await copyToClipboard("test");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Custom error message");
    });
  });
});

describe("ClipboardService", () => {
  let service: ClipboardService;
  let mockOutputChannel: ReturnType<typeof createMockOutputChannel>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteText.mockResolvedValue(undefined);
    mockReadText.mockResolvedValue("");
    service = createClipboardService();
    mockOutputChannel = createMockOutputChannel();
  });

  describe("initialization", () => {
    it("should create a new instance", () => {
      expect(service).toBeInstanceOf(ClipboardService);
    });

    it("should initialize with output channel", () => {
      service.initialize(mockOutputChannel as unknown as import("vscode").OutputChannel);

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("ClipboardService initialized")
      );
    });
  });

  describe("copy", () => {
    beforeEach(() => {
      service.initialize(mockOutputChannel as unknown as import("vscode").OutputChannel);
    });

    it("should copy text successfully", async () => {
      const result = await service.copy("test text");

      expect(result.success).toBe(true);
      expect(mockWriteText).toHaveBeenCalledWith("test text");
    });

    it("should log successful copy", async () => {
      await service.copy("test text");

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Copied 9 characters to clipboard")
      );
    });

    it("should log failed copy", async () => {
      mockWriteText.mockRejectedValueOnce(new Error("Failed"));

      await service.copy("test");

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Clipboard copy failed: Failed")
      );
    });
  });

  describe("read", () => {
    it("should read from clipboard", async () => {
      mockReadText.mockResolvedValueOnce("clipboard content");

      const result = await service.read();

      expect(result).toBe("clipboard content");
    });

    it("should return null on read error", async () => {
      mockReadText.mockRejectedValueOnce(new Error("Read failed"));

      const result = await service.read();

      expect(result).toBeNull();
    });
  });
});

describe("createClipboardService", () => {
  it("should create a new ClipboardService instance", () => {
    const service = createClipboardService();
    expect(service).toBeInstanceOf(ClipboardService);
  });
});
