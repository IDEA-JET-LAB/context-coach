import { describe, it, expect } from "vitest";
import {
  isTransientError,
  classifyError,
  TRANSIENT_ERROR_CODES,
  TRANSIENT_HTTP_CODES,
  PERMANENT_HTTP_CODES,
} from "./errors";

describe("isTransientError", () => {
  describe("non-Error inputs", () => {
    it("should return false for null", () => {
      expect(isTransientError(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isTransientError(undefined)).toBe(false);
    });

    it("should return false for string", () => {
      expect(isTransientError("ECONNRESET")).toBe(false);
    });

    it("should return false for number", () => {
      expect(isTransientError(503)).toBe(false);
    });

    it("should return false for object without Error prototype", () => {
      expect(isTransientError({ code: "ECONNRESET" })).toBe(false);
    });
  });

  describe("network errors (Node.js error codes)", () => {
    it("should return true for ECONNRESET", () => {
      const error = new Error("Connection reset") as NodeJS.ErrnoException;
      error.code = "ECONNRESET";
      expect(isTransientError(error)).toBe(true);
    });

    it("should return true for ETIMEDOUT", () => {
      const error = new Error("Connection timed out") as NodeJS.ErrnoException;
      error.code = "ETIMEDOUT";
      expect(isTransientError(error)).toBe(true);
    });

    it("should return true for ECONNREFUSED", () => {
      const error = new Error("Connection refused") as NodeJS.ErrnoException;
      error.code = "ECONNREFUSED";
      expect(isTransientError(error)).toBe(true);
    });

    it("should return true for EHOSTUNREACH", () => {
      const error = new Error("Host unreachable") as NodeJS.ErrnoException;
      error.code = "EHOSTUNREACH";
      expect(isTransientError(error)).toBe(true);
    });

    it("should return true for ENETUNREACH", () => {
      const error = new Error("Network unreachable") as NodeJS.ErrnoException;
      error.code = "ENETUNREACH";
      expect(isTransientError(error)).toBe(true);
    });

    it("should return true when error message contains ECONNRESET", () => {
      const error = new Error("Request failed: ECONNRESET");
      expect(isTransientError(error)).toBe(true);
    });

    it("should return true when error message contains ETIMEDOUT", () => {
      const error = new Error("Database query ETIMEDOUT after 30s");
      expect(isTransientError(error)).toBe(true);
    });
  });

  describe("HTTP status codes", () => {
    it("should return true for HTTP 429 (Too Many Requests)", () => {
      const error = new Error("Rate limited") as Error & { status: number };
      error.status = 429;
      expect(isTransientError(error)).toBe(true);
    });

    it("should return true for HTTP 503 (Service Unavailable)", () => {
      const error = new Error("Service unavailable") as Error & {
        status: number;
      };
      error.status = 503;
      expect(isTransientError(error)).toBe(true);
    });

    it("should return true for HTTP 504 (Gateway Timeout)", () => {
      const error = new Error("Gateway timeout") as Error & { status: number };
      error.status = 504;
      expect(isTransientError(error)).toBe(true);
    });

    it("should return true for statusCode property (alternative)", () => {
      const error = new Error("Rate limited") as Error & { statusCode: number };
      error.statusCode = 429;
      expect(isTransientError(error)).toBe(true);
    });

    it("should return true when error message contains 503", () => {
      const error = new Error("HTTP error: 503 Service Unavailable");
      expect(isTransientError(error)).toBe(true);
    });

    it("should return true when error message contains 504", () => {
      const error = new Error("Gateway returned 504");
      expect(isTransientError(error)).toBe(true);
    });
  });

  describe("permanent errors (should NOT retry)", () => {
    it("should return false for HTTP 400 (Bad Request)", () => {
      const error = new Error("Bad request") as Error & { status: number };
      error.status = 400;
      expect(isTransientError(error)).toBe(false);
    });

    it("should return false for HTTP 401 (Unauthorized)", () => {
      const error = new Error("Unauthorized") as Error & { status: number };
      error.status = 401;
      expect(isTransientError(error)).toBe(false);
    });

    it("should return false for HTTP 404 (Not Found)", () => {
      const error = new Error("Not found") as Error & { status: number };
      error.status = 404;
      expect(isTransientError(error)).toBe(false);
    });

    it("should return false for HTTP 500 (Internal Server Error) without code", () => {
      const error = new Error("Internal server error") as Error & {
        status: number;
      };
      error.status = 500;
      expect(isTransientError(error)).toBe(false);
    });

    it("should return false for unknown errors", () => {
      const error = new Error("Something went wrong");
      expect(isTransientError(error)).toBe(false);
    });
  });

  describe("all defined transient codes", () => {
    it("should recognize all TRANSIENT_ERROR_CODES", () => {
      for (const code of TRANSIENT_ERROR_CODES) {
        const error = new Error(`Error: ${code}`) as NodeJS.ErrnoException;
        error.code = code;
        expect(isTransientError(error)).toBe(true);
      }
    });

    it("should recognize all TRANSIENT_HTTP_CODES", () => {
      for (const code of TRANSIENT_HTTP_CODES) {
        const error = new Error(`HTTP ${code}`) as Error & { status: number };
        error.status = code;
        expect(isTransientError(error)).toBe(true);
      }
    });
  });
});

describe("classifyError", () => {
  describe("non-Error inputs", () => {
    it("should return unknown category for null", () => {
      const result = classifyError(null);
      expect(result.isTransient).toBe(false);
      expect(result.code).toBe(null);
      expect(result.category).toBe("unknown");
      expect(result.shouldRetry).toBe(false);
    });

    it("should return unknown category for undefined", () => {
      const result = classifyError(undefined);
      expect(result.isTransient).toBe(false);
      expect(result.category).toBe("unknown");
    });

    it("should return unknown category for string", () => {
      const result = classifyError("error string");
      expect(result.category).toBe("unknown");
      expect(result.shouldRetry).toBe(false);
    });
  });

  describe("network errors", () => {
    it("should classify ECONNRESET as network/transient", () => {
      const error = new Error("Connection reset") as NodeJS.ErrnoException;
      error.code = "ECONNRESET";

      const result = classifyError(error);
      expect(result.isTransient).toBe(true);
      expect(result.code).toBe("ECONNRESET");
      expect(result.category).toBe("network");
      expect(result.shouldRetry).toBe(true);
    });

    it("should classify ETIMEDOUT as network/transient", () => {
      const error = new Error("Timed out") as NodeJS.ErrnoException;
      error.code = "ETIMEDOUT";

      const result = classifyError(error);
      expect(result.isTransient).toBe(true);
      expect(result.code).toBe("ETIMEDOUT");
      expect(result.category).toBe("network");
      expect(result.shouldRetry).toBe(true);
    });

    it("should classify unknown network code as non-transient", () => {
      const error = new Error("Unknown error") as NodeJS.ErrnoException;
      error.code = "ENOTFOUND";

      const result = classifyError(error);
      expect(result.isTransient).toBe(false);
      expect(result.code).toBe("ENOTFOUND");
      expect(result.category).toBe("network");
      expect(result.shouldRetry).toBe(false);
    });
  });

  describe("HTTP errors", () => {
    it("should classify 429 as http/transient", () => {
      const error = new Error("Rate limited") as Error & { status: number };
      error.status = 429;

      const result = classifyError(error);
      expect(result.isTransient).toBe(true);
      expect(result.code).toBe("429");
      expect(result.category).toBe("http");
      expect(result.shouldRetry).toBe(true);
    });

    it("should classify 503 as http/transient", () => {
      const error = new Error("Unavailable") as Error & { status: number };
      error.status = 503;

      const result = classifyError(error);
      expect(result.isTransient).toBe(true);
      expect(result.code).toBe("503");
      expect(result.category).toBe("http");
      expect(result.shouldRetry).toBe(true);
    });

    it("should classify 504 as http/transient", () => {
      const error = new Error("Timeout") as Error & { status: number };
      error.status = 504;

      const result = classifyError(error);
      expect(result.isTransient).toBe(true);
      expect(result.code).toBe("504");
      expect(result.category).toBe("http");
      expect(result.shouldRetry).toBe(true);
    });

    it("should classify 400 as http/permanent (no retry)", () => {
      const error = new Error("Bad request") as Error & { status: number };
      error.status = 400;

      const result = classifyError(error);
      expect(result.isTransient).toBe(false);
      expect(result.code).toBe("400");
      expect(result.category).toBe("http");
      expect(result.shouldRetry).toBe(false);
    });

    it("should classify 401 as http/permanent (no retry)", () => {
      const error = new Error("Unauthorized") as Error & { status: number };
      error.status = 401;

      const result = classifyError(error);
      expect(result.isTransient).toBe(false);
      expect(result.code).toBe("401");
      expect(result.category).toBe("http");
      expect(result.shouldRetry).toBe(false);
    });

    it("should classify 404 as http/permanent (no retry)", () => {
      const error = new Error("Not found") as Error & { status: number };
      error.status = 404;

      const result = classifyError(error);
      expect(result.isTransient).toBe(false);
      expect(result.code).toBe("404");
      expect(result.category).toBe("http");
      expect(result.shouldRetry).toBe(false);
    });

    it("should use statusCode property as fallback", () => {
      const error = new Error("Rate limited") as Error & { statusCode: number };
      error.statusCode = 429;

      const result = classifyError(error);
      expect(result.code).toBe("429");
      expect(result.category).toBe("http");
    });
  });

  describe("message-based classification", () => {
    it("should detect ECONNRESET in error message", () => {
      const error = new Error("Request failed: ECONNRESET occurred");

      const result = classifyError(error);
      expect(result.isTransient).toBe(true);
      expect(result.code).toBe("ECONNRESET");
      expect(result.category).toBe("network");
      expect(result.shouldRetry).toBe(true);
    });

    it("should detect 503 in error message", () => {
      const error = new Error("Server returned 503 error");

      const result = classifyError(error);
      expect(result.isTransient).toBe(true);
      expect(result.code).toBe("503");
      expect(result.category).toBe("http");
      expect(result.shouldRetry).toBe(true);
    });
  });

  describe("unknown errors", () => {
    it("should classify generic errors as unknown", () => {
      const error = new Error("Something unexpected happened");

      const result = classifyError(error);
      expect(result.isTransient).toBe(false);
      expect(result.code).toBe(null);
      expect(result.category).toBe("unknown");
      expect(result.shouldRetry).toBe(false);
    });
  });
});

describe("exported constants", () => {
  it("should export TRANSIENT_ERROR_CODES with expected values", () => {
    expect(TRANSIENT_ERROR_CODES).toContain("ECONNRESET");
    expect(TRANSIENT_ERROR_CODES).toContain("ETIMEDOUT");
    expect(TRANSIENT_ERROR_CODES).toContain("ECONNREFUSED");
    expect(TRANSIENT_ERROR_CODES).toContain("EHOSTUNREACH");
    expect(TRANSIENT_ERROR_CODES).toContain("ENETUNREACH");
  });

  it("should export TRANSIENT_HTTP_CODES with expected values", () => {
    expect(TRANSIENT_HTTP_CODES).toContain(429);
    expect(TRANSIENT_HTTP_CODES).toContain(503);
    expect(TRANSIENT_HTTP_CODES).toContain(504);
  });

  it("should export PERMANENT_HTTP_CODES with expected values", () => {
    expect(PERMANENT_HTTP_CODES).toContain(400);
    expect(PERMANENT_HTTP_CODES).toContain(401);
    expect(PERMANENT_HTTP_CODES).toContain(404);
  });
});
