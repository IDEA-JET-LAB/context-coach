/**
 * Unit tests for token estimation utilities
 * Story 25-4: Conversation Context Endpoint
 */

import { describe, it, expect } from "vitest";
import {
  estimateTokens,
  truncateToTokens,
  getTokenBudgetUsage,
  wouldExceedBudget,
} from "../token-estimation";

describe("estimateTokens", () => {
  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("returns 0 for null/undefined-ish values", () => {
    expect(estimateTokens(null as unknown as string)).toBe(0);
    expect(estimateTokens(undefined as unknown as string)).toBe(0);
  });

  it("estimates tokens for single word", () => {
    const result = estimateTokens("hello");
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(2); // ~1.3 tokens
  });

  it("estimates tokens for short sentence", () => {
    const result = estimateTokens("Hello world, how are you today?");
    // 6 words * 1.3 = ~8 tokens
    expect(result).toBeGreaterThanOrEqual(7);
    expect(result).toBeLessThanOrEqual(10);
  });

  it("estimates tokens for longer text", () => {
    const text =
      "This is a longer piece of text that contains multiple sentences. It should have more tokens than a short sentence. The estimation should scale roughly linearly with word count.";
    const result = estimateTokens(text);
    // ~30 words * 1.3 = ~39 tokens
    expect(result).toBeGreaterThanOrEqual(30);
    expect(result).toBeLessThanOrEqual(50);
  });

  it("handles text with extra whitespace", () => {
    const normalText = "one two three four";
    const spaceyText = "one   two    three     four";

    // Should have similar token counts since we split on whitespace
    const normalTokens = estimateTokens(normalText);
    const spaceyTokens = estimateTokens(spaceyText);

    expect(normalTokens).toBe(spaceyTokens);
  });

  it("handles text with newlines and tabs", () => {
    const text = "one\ntwo\tthree\n\nfour";
    const result = estimateTokens(text);
    // 4 words * 1.3 = ~5 tokens
    expect(result).toBeGreaterThanOrEqual(4);
    expect(result).toBeLessThanOrEqual(6);
  });

  it("handles code snippets", () => {
    const code = `function hello() {
      console.log("Hello world");
      return true;
    }`;
    const result = estimateTokens(code);
    // Code has fewer words but should still estimate
    expect(result).toBeGreaterThan(0);
  });
});

describe("truncateToTokens", () => {
  it("returns empty string for empty input", () => {
    const result = truncateToTokens("", 100);
    expect(result.text).toBe("");
    expect(result.truncated).toBe(false);
    expect(result.tokenCount).toBe(0);
  });

  it("returns original text if within budget", () => {
    const text = "Hello world";
    const result = truncateToTokens(text, 100);

    expect(result.text).toBe(text);
    expect(result.truncated).toBe(false);
    expect(result.tokenCount).toBeGreaterThan(0);
  });

  it("truncates text that exceeds budget", () => {
    const text =
      "This is a very long piece of text that should definitely exceed a small token budget. We want to make sure it gets truncated properly.";
    const result = truncateToTokens(text, 5);

    expect(result.text.length).toBeLessThan(text.length);
    expect(result.truncated).toBe(true);
    // Token count might be slightly over due to estimation imprecision
    expect(result.tokenCount).toBeLessThan(estimateTokens(text));
  });

  it("tries to end at sentence boundary", () => {
    const text =
      "First sentence here. Second sentence is also here. Third sentence at the end.";
    const result = truncateToTokens(text, 10);

    // Should end at a period if possible
    expect(result.truncated).toBe(true);
    expect(result.text.endsWith(".") || result.text.endsWith("...")).toBe(true);
  });

  it("handles text with no sentence boundaries", () => {
    const text = "word word word word word word word word word word word word";
    const result = truncateToTokens(text, 5);

    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThan(text.length);
  });

  it("handles very small token budget", () => {
    const text = "Hello world, this is a test";
    const result = truncateToTokens(text, 1);

    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThan(text.length);
  });

  it("handles zero token budget", () => {
    const text = "Hello world";
    const result = truncateToTokens(text, 0);

    expect(result.text).toBe("");
    expect(result.truncated).toBe(true);
    expect(result.tokenCount).toBe(0);
  });

  it("handles negative token budget", () => {
    const text = "Hello world";
    const result = truncateToTokens(text, -10);

    expect(result.text).toBe("");
    expect(result.truncated).toBe(true);
    expect(result.tokenCount).toBe(0);
  });
});

describe("getTokenBudgetUsage", () => {
  it("returns 0 for no tokens used", () => {
    expect(getTokenBudgetUsage(0, 100)).toBe(0);
  });

  it("returns 100 for full budget used", () => {
    expect(getTokenBudgetUsage(100, 100)).toBe(100);
  });

  it("returns 50 for half budget used", () => {
    expect(getTokenBudgetUsage(50, 100)).toBe(50);
  });

  it("caps at 100 for over-budget", () => {
    expect(getTokenBudgetUsage(150, 100)).toBe(100);
  });

  it("returns 100 for zero budget", () => {
    expect(getTokenBudgetUsage(10, 0)).toBe(100);
  });

  it("rounds to nearest integer", () => {
    expect(getTokenBudgetUsage(33, 100)).toBe(33);
    expect(getTokenBudgetUsage(34, 100)).toBe(34);
  });
});

describe("wouldExceedBudget", () => {
  it("returns false when within budget", () => {
    expect(wouldExceedBudget(50, 30, 100)).toBe(false);
  });

  it("returns false when exactly at budget", () => {
    expect(wouldExceedBudget(50, 50, 100)).toBe(false);
  });

  it("returns true when would exceed budget", () => {
    expect(wouldExceedBudget(50, 51, 100)).toBe(true);
  });

  it("returns true when already over budget", () => {
    expect(wouldExceedBudget(100, 10, 50)).toBe(true);
  });

  it("handles zero budget", () => {
    expect(wouldExceedBudget(0, 1, 0)).toBe(true);
  });
});
