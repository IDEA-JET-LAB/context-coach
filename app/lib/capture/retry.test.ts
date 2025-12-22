import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  withRetry,
  RetryError,
  DEFAULT_RETRY_CONFIG,
  type RetryConfig,
} from "./retry";

// Mock timers for testing delays
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RetryError", () => {
  it("should have correct name", () => {
    const error = new RetryError("All retries failed", 3, new Error("Original"), 5000);
    expect(error.name).toBe("RetryError");
  });

  it("should store attempts count", () => {
    const error = new RetryError("All retries failed", 3, new Error("Original"), 5000);
    expect(error.attempts).toBe(3);
  });

  it("should store last error", () => {
    const lastError = new Error("Original error");
    const error = new RetryError("All retries failed", 3, lastError, 5000);
    expect(error.lastError).toBe(lastError);
  });

  it("should store total duration", () => {
    const error = new RetryError("All retries failed", 3, new Error("Original"), 5000);
    expect(error.totalDurationMs).toBe(5000);
  });

  it("should be instanceof Error", () => {
    const error = new RetryError("Test", 1, new Error("Test"), 100);
    expect(error instanceof Error).toBe(true);
  });

  it("should be instanceof RetryError", () => {
    const error = new RetryError("Test", 1, new Error("Test"), 100);
    expect(error instanceof RetryError).toBe(true);
  });
});

describe("DEFAULT_RETRY_CONFIG", () => {
  it("should have maxRetries of 3", () => {
    expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
  });

  it("should have delays of [1000, 5000, 15000]", () => {
    expect(DEFAULT_RETRY_CONFIG.delays).toEqual([1000, 5000, 15000]);
  });

  it("should have jitterMs of 500", () => {
    expect(DEFAULT_RETRY_CONFIG.jitterMs).toBe(500);
  });
});

describe("withRetry", () => {
  describe("success on first attempt", () => {
    it("should return result immediately on success", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      const isRetryable = vi.fn().mockReturnValue(true);

      const promise = withRetry(fn, isRetryable);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.result).toBe("success");
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(isRetryable).not.toHaveBeenCalled();
    });

    it("should return attempts count of 1 on first success", async () => {
      const fn = vi.fn().mockResolvedValue("data");

      const promise = withRetry(fn, () => true);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.attempts).toBe(1);
    });

    it("should include total duration in result", async () => {
      const fn = vi.fn().mockResolvedValue("data");

      const promise = withRetry(fn, () => true);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(typeof result.totalDurationMs).toBe("number");
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("success after retries", () => {
    it("should succeed after one retry", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Transient error"))
        .mockResolvedValue("success");
      const isRetryable = vi.fn().mockReturnValue(true);
      const config: RetryConfig = { maxRetries: 3, delays: [100], jitterMs: 0 };

      const promise = withRetry(fn, isRetryable, config);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.result).toBe("success");
      expect(result.attempts).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should succeed after two retries", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Error 1"))
        .mockRejectedValueOnce(new Error("Error 2"))
        .mockResolvedValue("success");
      const isRetryable = vi.fn().mockReturnValue(true);
      const config: RetryConfig = { maxRetries: 3, delays: [100, 100], jitterMs: 0 };

      const promise = withRetry(fn, isRetryable, config);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.result).toBe("success");
      expect(result.attempts).toBe(3);
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe("permanent errors (non-retryable)", () => {
    it("should throw immediately for non-retryable errors", async () => {
      const originalError = new Error("Permanent error");
      const fn = vi.fn().mockRejectedValue(originalError);
      const isRetryable = vi.fn().mockReturnValue(false);

      const promise = withRetry(fn, isRetryable);

      await expect(promise).rejects.toThrow(originalError);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(isRetryable).toHaveBeenCalledWith(originalError);
    });

    it("should not wait for retry delay on permanent error", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Permanent"));
      const isRetryable = vi.fn().mockReturnValue(false);
      const config: RetryConfig = { maxRetries: 3, delays: [10000], jitterMs: 0 };

      const promise = withRetry(fn, isRetryable, config);

      // Should reject immediately without waiting for timers
      await expect(promise).rejects.toThrow("Permanent");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should throw the original error type for permanent errors", async () => {
      class CustomError extends Error {
        constructor(message: string, public code: string) {
          super(message);
        }
      }
      const customError = new CustomError("Custom permanent", "CUSTOM_CODE");
      const fn = vi.fn().mockRejectedValue(customError);
      const isRetryable = vi.fn().mockReturnValue(false);

      const promise = withRetry(fn, isRetryable);

      await expect(promise).rejects.toThrow(customError);
      await expect(promise).rejects.toBeInstanceOf(CustomError);
    });
  });

  describe("all retries exhausted", () => {
    it("should throw RetryError when all retries fail", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Always fails"));
      const isRetryable = vi.fn().mockReturnValue(true);
      const config: RetryConfig = { maxRetries: 3, delays: [10, 10, 10], jitterMs: 0 };

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      let caughtError: unknown;
      const promise = withRetry(fn, isRetryable, config).catch((error) => {
        caughtError = error;
      });

      await vi.runAllTimersAsync();
      await promise;

      expect(caughtError).toBeInstanceOf(RetryError);
      expect(fn).toHaveBeenCalledTimes(3);
      consoleSpy.mockRestore();
    });

    it("should include attempt count in RetryError", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Fails"));
      const isRetryable = vi.fn().mockReturnValue(true);
      const config: RetryConfig = { maxRetries: 3, delays: [10, 10, 10], jitterMs: 0 };

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      let caughtError: unknown;
      const promise = withRetry(fn, isRetryable, config).catch((error) => {
        caughtError = error;
      });

      await vi.runAllTimersAsync();
      await promise;

      expect(caughtError).toBeInstanceOf(RetryError);
      expect((caughtError as RetryError).attempts).toBe(3);

      consoleSpy.mockRestore();
    });

    it("should include last error in RetryError", async () => {
      const lastError = new Error("Final failure");
      const fn = vi.fn().mockRejectedValue(lastError);
      const isRetryable = vi.fn().mockReturnValue(true);
      const config: RetryConfig = { maxRetries: 2, delays: [10], jitterMs: 0 };

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      let caughtError: unknown;
      const promise = withRetry(fn, isRetryable, config).catch((error) => {
        caughtError = error;
      });

      await vi.runAllTimersAsync();
      await promise;

      expect(caughtError).toBeInstanceOf(RetryError);
      expect((caughtError as RetryError).lastError.message).toBe("Final failure");

      consoleSpy.mockRestore();
    });

    it("should include total duration in RetryError", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Fails"));
      const isRetryable = vi.fn().mockReturnValue(true);
      const config: RetryConfig = { maxRetries: 2, delays: [10], jitterMs: 0 };

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      let caughtError: unknown;
      const promise = withRetry(fn, isRetryable, config).catch((error) => {
        caughtError = error;
      });

      await vi.runAllTimersAsync();
      await promise;

      expect(caughtError).toBeInstanceOf(RetryError);
      expect(typeof (caughtError as RetryError).totalDurationMs).toBe("number");
      expect((caughtError as RetryError).totalDurationMs).toBeGreaterThanOrEqual(0);

      consoleSpy.mockRestore();
    });
  });

  describe("delay and backoff", () => {
    it("should use delays from config", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Retry 1"))
        .mockRejectedValueOnce(new Error("Retry 2"))
        .mockResolvedValue("success");
      const isRetryable = vi.fn().mockReturnValue(true);
      const config: RetryConfig = { maxRetries: 3, delays: [100, 200, 300], jitterMs: 0 };

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const promise = withRetry(fn, isRetryable, config);

      // First call fails immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);

      // First retry after 100ms
      await vi.advanceTimersByTimeAsync(100);
      expect(fn).toHaveBeenCalledTimes(2);

      // Second retry after 200ms
      await vi.advanceTimersByTimeAsync(200);
      expect(fn).toHaveBeenCalledTimes(3);

      await promise;
      consoleSpy.mockRestore();
    });

    it("should use last delay if index exceeds array", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("1"))
        .mockRejectedValueOnce(new Error("2"))
        .mockRejectedValueOnce(new Error("3"))
        .mockRejectedValueOnce(new Error("4"))
        .mockResolvedValue("success");
      const isRetryable = vi.fn().mockReturnValue(true);
      // Only 2 delays configured but 5 attempts
      const config: RetryConfig = { maxRetries: 5, delays: [100, 200], jitterMs: 0 };

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const promise = withRetry(fn, isRetryable, config);
      await vi.runAllTimersAsync();
      await promise;

      expect(fn).toHaveBeenCalledTimes(5);
      consoleSpy.mockRestore();
    });
  });

  describe("jitter", () => {
    it("should add random jitter to delays", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Retry"))
        .mockResolvedValue("success");
      const isRetryable = vi.fn().mockReturnValue(true);
      const config: RetryConfig = { maxRetries: 3, delays: [1000], jitterMs: 500 };

      // Mock Math.random to return 0.5 (250ms jitter)
      const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const promise = withRetry(fn, isRetryable, config);

      // Should log delay of ~1250ms (1000 + 0.5*500)
      await vi.runAllTimersAsync();
      await promise;

      // Check the JSON log contains delayMs of 1250
      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.delayMs).toBe(1250);

      randomSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it("should not add jitter when jitterMs is 0", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Retry"))
        .mockResolvedValue("success");
      const isRetryable = vi.fn().mockReturnValue(true);
      const config: RetryConfig = { maxRetries: 3, delays: [1000], jitterMs: 0 };

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const promise = withRetry(fn, isRetryable, config);
      await vi.runAllTimersAsync();
      await promise;

      // Check the JSON log contains exact delayMs of 1000 (no jitter)
      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.delayMs).toBe(1000);

      consoleSpy.mockRestore();
    });

    it("should not add jitter when jitterMs is undefined", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Retry"))
        .mockResolvedValue("success");
      const isRetryable = vi.fn().mockReturnValue(true);
      const config: RetryConfig = { maxRetries: 3, delays: [1000] };

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const promise = withRetry(fn, isRetryable, config);
      await vi.runAllTimersAsync();
      await promise;

      // Check the JSON log contains exact delayMs of 1000 (no jitter when undefined)
      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.delayMs).toBe(1000);

      consoleSpy.mockRestore();
    });
  });

  describe("logging", () => {
    it("should log retry attempts", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Error"))
        .mockResolvedValue("success");
      const isRetryable = vi.fn().mockReturnValue(true);
      const config: RetryConfig = { maxRetries: 3, delays: [100], jitterMs: 0 };

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const promise = withRetry(fn, isRetryable, config);
      await vi.runAllTimersAsync();
      await promise;

      // Check the JSON log format with structured data
      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.context).toBe("RETRY");
      expect(logData.message).toContain("Retry attempt");
      expect(logData.attempt).toBe(1);
      expect(logData.maxRetries).toBe(3);

      consoleSpy.mockRestore();
    });

    it("should not log sensitive error details", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Secret API key: sk_live_123"))
        .mockResolvedValue("success");
      const isRetryable = vi.fn().mockReturnValue(true);
      const config: RetryConfig = { maxRetries: 3, delays: [100], jitterMs: 0 };

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const promise = withRetry(fn, isRetryable, config);
      await vi.runAllTimersAsync();
      await promise;

      // Check that no log contains the secret
      for (const call of consoleSpy.mock.calls) {
        const logMessage = String(call[0]);
        expect(logMessage).not.toContain("sk_live_123");
        expect(logMessage).not.toContain("Secret API key");
      }

      consoleSpy.mockRestore();
    });
  });

  describe("error handling edge cases", () => {
    it("should handle non-Error thrown values", async () => {
      const fn = vi.fn().mockRejectedValue("string error");
      const isRetryable = vi.fn().mockReturnValue(true);
      const config: RetryConfig = { maxRetries: 2, delays: [10], jitterMs: 0 };

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Attach catch handler before running timers to prevent unhandled rejection
      let caughtError: unknown;
      const promise = withRetry(fn, isRetryable, config).catch((error) => {
        caughtError = error;
      });

      await vi.runAllTimersAsync();
      await promise;

      expect(caughtError).toBeInstanceOf(RetryError);
      expect((caughtError as RetryError).lastError.message).toBe("string error");

      consoleSpy.mockRestore();
    });

    it("should handle undefined thrown value", async () => {
      const fn = vi.fn().mockRejectedValue(undefined);
      const isRetryable = vi.fn().mockReturnValue(true);
      const config: RetryConfig = { maxRetries: 2, delays: [10], jitterMs: 0 };

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      let caughtError: unknown;
      const promise = withRetry(fn, isRetryable, config).catch((error) => {
        caughtError = error;
      });

      await vi.runAllTimersAsync();
      await promise;

      expect(caughtError).toBeInstanceOf(RetryError);
      expect((caughtError as RetryError).lastError.message).toBe("undefined");

      consoleSpy.mockRestore();
    });

    it("should handle null thrown value", async () => {
      const fn = vi.fn().mockRejectedValue(null);
      const isRetryable = vi.fn().mockReturnValue(true);
      const config: RetryConfig = { maxRetries: 2, delays: [10], jitterMs: 0 };

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      let caughtError: unknown;
      const promise = withRetry(fn, isRetryable, config).catch((error) => {
        caughtError = error;
      });

      await vi.runAllTimersAsync();
      await promise;

      expect(caughtError).toBeInstanceOf(RetryError);
      expect((caughtError as RetryError).lastError.message).toBe("null");

      consoleSpy.mockRestore();
    });
  });

  describe("uses default config when not provided", () => {
    it("should use DEFAULT_RETRY_CONFIG", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Error"))
        .mockResolvedValue("success");
      const isRetryable = vi.fn().mockReturnValue(true);

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const promise = withRetry(fn, isRetryable);

      // Should wait for default first delay (1000ms + up to 500ms jitter)
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);

      await vi.runAllTimersAsync();
      await promise;

      // Check the JSON log format with default config values
      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.attempt).toBe(1);
      expect(logData.maxRetries).toBe(3); // DEFAULT_RETRY_CONFIG.maxRetries
      expect(logData.delayMs).toBeGreaterThanOrEqual(1000); // Base delay
      expect(logData.delayMs).toBeLessThanOrEqual(1500); // Base + max jitter

      consoleSpy.mockRestore();
    });
  });
});
