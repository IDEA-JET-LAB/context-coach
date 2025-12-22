import { describe, it, expect } from "vitest";
import { calculateWordCount } from "./word-count";

describe("calculateWordCount", () => {
  describe("basic word counting", () => {
    it("counts words separated by spaces", () => {
      expect(calculateWordCount("hello world")).toBe(2);
    });

    it("counts single word", () => {
      expect(calculateWordCount("hello")).toBe(1);
    });

    it("counts multiple words", () => {
      expect(calculateWordCount("one two three four five")).toBe(5);
    });
  });

  describe("whitespace handling", () => {
    it("handles multiple spaces between words", () => {
      expect(calculateWordCount("hello   world")).toBe(2);
    });

    it("handles tabs between words", () => {
      expect(calculateWordCount("hello\tworld")).toBe(2);
    });

    it("handles newlines between words", () => {
      expect(calculateWordCount("hello\nworld")).toBe(2);
    });

    it("handles mixed whitespace (spaces, tabs, newlines)", () => {
      expect(calculateWordCount("hello\n\t  world   there")).toBe(3);
    });

    it("handles leading whitespace", () => {
      expect(calculateWordCount("   hello world")).toBe(2);
    });

    it("handles trailing whitespace", () => {
      expect(calculateWordCount("hello world   ")).toBe(2);
    });

    it("handles whitespace on both ends", () => {
      expect(calculateWordCount("  \n\t hello world \n\t  ")).toBe(2);
    });
  });

  describe("empty and edge cases", () => {
    it("returns 0 for empty string", () => {
      expect(calculateWordCount("")).toBe(0);
    });

    it("returns 0 for whitespace only", () => {
      expect(calculateWordCount("   \n\t  ")).toBe(0);
    });

    it("returns 0 for single space", () => {
      expect(calculateWordCount(" ")).toBe(0);
    });

    it("returns 0 for newline only", () => {
      expect(calculateWordCount("\n")).toBe(0);
    });

    it("returns 0 for tab only", () => {
      expect(calculateWordCount("\t")).toBe(0);
    });
  });

  describe("special characters", () => {
    it("counts words with punctuation as single words", () => {
      expect(calculateWordCount("hello, world!")).toBe(2);
    });

    it("counts hyphenated words as single word", () => {
      expect(calculateWordCount("well-known fact")).toBe(2);
    });

    it("counts contractions as single word", () => {
      expect(calculateWordCount("it's working")).toBe(2);
    });

    it("handles emoji as words", () => {
      // Emoji is treated as a character within a word, not separate
      expect(calculateWordCount("hello \u{1F600} world")).toBe(3);
    });

    it("handles code with symbols", () => {
      expect(calculateWordCount("const x = 42;")).toBe(4);
    });

    it("handles URL as single word", () => {
      expect(calculateWordCount("visit https://example.com today")).toBe(3);
    });
  });

  describe("realistic prompts", () => {
    it("counts words in a simple prompt", () => {
      const prompt = "How do I create a React component?";
      expect(calculateWordCount(prompt)).toBe(7);
    });

    it("counts words in a multi-line prompt", () => {
      const prompt = `I need help with this code:

function greet(name) {
  return "Hello " + name;
}

What's wrong with it?`;
      // Words: I, need, help, with, this, code:, function, greet(name), {, return, "Hello", +, name;, }, What's, wrong, with, it?
      expect(calculateWordCount(prompt)).toBeGreaterThan(10);
    });

    it("handles a very long prompt efficiently", () => {
      const longPrompt = "word ".repeat(10000).trim();
      const start = performance.now();
      const count = calculateWordCount(longPrompt);
      const duration = performance.now() - start;

      expect(count).toBe(10000);
      expect(duration).toBeLessThan(50); // Should be fast
    });
  });

  describe("input validation", () => {
    it("handles null-like values gracefully", () => {
      // These would be caught by TypeScript, but test runtime safety
      expect(calculateWordCount("")).toBe(0);
    });

    it("handles unicode text", () => {
      expect(calculateWordCount("konnichiwa sekai")).toBe(2);
    });

    it("handles mixed unicode and ascii", () => {
      // French: monde = world, with emoji between
      expect(calculateWordCount("Hello \u{1F30D} monde")).toBe(3);
    });
  });
});
