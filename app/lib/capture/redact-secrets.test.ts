import { describe, it, expect } from "vitest";
import { redactSecrets, type RedactionResult } from "./redact-secrets";

describe("redactSecrets", () => {
  describe("return type", () => {
    it("should return correct structure with redactedText, redactionCount, and redactedPatterns", () => {
      const result = redactSecrets("no secrets here");
      expect(result).toHaveProperty("redactedText");
      expect(result).toHaveProperty("redactionCount");
      expect(result).toHaveProperty("redactedPatterns");
      expect(typeof result.redactedText).toBe("string");
      expect(typeof result.redactionCount).toBe("number");
      expect(Array.isArray(result.redactedPatterns)).toBe(true);
    });
  });

  describe("no secrets", () => {
    it("should return original text unchanged when no secrets present", () => {
      const input = "This is a normal prompt with no secrets";
      const result = redactSecrets(input);
      expect(result.redactedText).toBe(input);
      expect(result.redactionCount).toBe(0);
      expect(result.redactedPatterns).toEqual([]);
    });

    it("should handle empty string", () => {
      const result = redactSecrets("");
      expect(result.redactedText).toBe("");
      expect(result.redactionCount).toBe(0);
      expect(result.redactedPatterns).toEqual([]);
    });
  });

  describe("Stripe keys", () => {
    it("should redact sk_live_ keys", () => {
      const input = "My key is sk_live_4eC39HqLyjWDarjtT1zdp7dc";
      const result = redactSecrets(input);
      expect(result.redactedText).toBe("My key is [REDACTED]");
      expect(result.redactionCount).toBe(1);
      expect(result.redactedPatterns).toContain("stripe_key");
    });

    it("should redact sk_test_ keys", () => {
      const input = "Test key: sk_test_4eC39HqLyjWDarjtT1zdp7dc";
      const result = redactSecrets(input);
      expect(result.redactedText).toBe("Test key: [REDACTED]");
      expect(result.redactionCount).toBe(1);
      expect(result.redactedPatterns).toContain("stripe_key");
    });

    it("should redact pk_live_ keys", () => {
      const input = "Publishable: pk_live_4eC39HqLyjWDarjtT1zdp7dc";
      const result = redactSecrets(input);
      expect(result.redactedText).toBe("Publishable: [REDACTED]");
      expect(result.redactionCount).toBe(1);
      expect(result.redactedPatterns).toContain("stripe_key");
    });

    it("should redact pk_test_ keys", () => {
      const input = "pk_test_4eC39HqLyjWDarjtT1zdp7dc is my test key";
      const result = redactSecrets(input);
      expect(result.redactedText).toBe("[REDACTED] is my test key");
      expect(result.redactionCount).toBe(1);
      expect(result.redactedPatterns).toContain("stripe_key");
    });

    it("should redact multiple Stripe keys", () => {
      const input =
        "Keys: sk_live_abc123def456ghi789jkl012 and pk_test_xyz789abc123def456ghi012";
      const result = redactSecrets(input);
      expect(result.redactedText).toBe("Keys: [REDACTED] and [REDACTED]");
      expect(result.redactionCount).toBe(2);
    });
  });

  describe("AWS keys", () => {
    it("should redact AWS access key IDs (AKIA prefix)", () => {
      const input = "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE";
      const result = redactSecrets(input);
      expect(result.redactedText).toContain("[REDACTED]");
      expect(result.redactionCount).toBeGreaterThanOrEqual(1);
      expect(result.redactedPatterns).toContain("aws_access_key");
    });

    it("should redact AWS secret access keys (40 char alphanumeric)", () => {
      const input =
        "AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
      const result = redactSecrets(input);
      expect(result.redactedText).toContain("[REDACTED]");
      expect(result.redactionCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("OpenAI keys", () => {
    it("should redact OpenAI API keys (sk- prefix, 48+ chars)", () => {
      const input =
        "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGH";
      const result = redactSecrets(input);
      expect(result.redactedText).toContain("[REDACTED]");
      expect(result.redactionCount).toBeGreaterThanOrEqual(1);
      expect(result.redactedPatterns).toContain("openai_key");
    });

    it("should not redact short sk- prefixed strings", () => {
      const input = "Variable sk-short is not an API key";
      const result = redactSecrets(input);
      expect(result.redactedText).toBe(input);
      expect(result.redactionCount).toBe(0);
    });
  });

  describe("JWT tokens", () => {
    it("should redact JWT tokens (eyJ...eyJ...)", () => {
      const input =
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
      const result = redactSecrets(input);
      expect(result.redactedText).toBe("Bearer [REDACTED]");
      expect(result.redactionCount).toBe(1);
      expect(result.redactedPatterns).toContain("jwt");
    });

    it("should handle JWT without Bearer prefix", () => {
      const input =
        "Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
      const result = redactSecrets(input);
      expect(result.redactedText).toBe("Token: [REDACTED]");
      expect(result.redactionCount).toBe(1);
      expect(result.redactedPatterns).toContain("jwt");
    });
  });

  describe("URL passwords", () => {
    it("should redact passwords in URLs (://user:password@host)", () => {
      const input = "Connect to postgres://admin:secretpassword@localhost:5432/db";
      const result = redactSecrets(input);
      expect(result.redactedText).toBe(
        "Connect to postgres://admin:[REDACTED]@localhost:5432/db"
      );
      expect(result.redactionCount).toBe(1);
      expect(result.redactedPatterns).toContain("url_password");
    });

    it("should handle multiple URL passwords", () => {
      const input =
        "DB: postgres://user:pass123@host1:5432 and redis://app:secret@host2:6379";
      const result = redactSecrets(input);
      expect(result.redactedText).toBe(
        "DB: postgres://user:[REDACTED]@host1:5432 and redis://app:[REDACTED]@host2:6379"
      );
      expect(result.redactionCount).toBe(2);
    });

    it("should preserve URL without password", () => {
      const input = "Visit https://example.com/path";
      const result = redactSecrets(input);
      expect(result.redactedText).toBe(input);
      expect(result.redactionCount).toBe(0);
    });
  });

  describe("Bearer and Basic auth", () => {
    it("should redact Bearer tokens in Authorization headers", () => {
      const input =
        'Authorization: Bearer abc123xyz456def789ghi012jkl345mno678pqr901stu234vwx567yz';
      const result = redactSecrets(input);
      expect(result.redactedText).toBe("Authorization: Bearer [REDACTED]");
      expect(result.redactionCount).toBe(1);
      expect(result.redactedPatterns).toContain("bearer_token");
    });

    it("should redact Basic auth tokens", () => {
      const input = "Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=";
      const result = redactSecrets(input);
      expect(result.redactedText).toBe("Authorization: Basic [REDACTED]");
      expect(result.redactionCount).toBe(1);
      expect(result.redactedPatterns).toContain("basic_auth");
    });
  });

  describe("environment variables", () => {
    it("should redact SECRET_KEY=value patterns", () => {
      const input = "Set SECRET_KEY=mysupersecretvalue123";
      const result = redactSecrets(input);
      expect(result.redactedText).toBe("Set SECRET_KEY=[REDACTED]");
      expect(result.redactionCount).toBe(1);
      expect(result.redactedPatterns).toContain("env_var");
    });

    it("should redact API_TOKEN with quotes", () => {
      const input = 'export API_TOKEN="my-secret-token-value"';
      const result = redactSecrets(input);
      expect(result.redactedText).toBe("export API_TOKEN=[REDACTED]");
      expect(result.redactionCount).toBe(1);
      expect(result.redactedPatterns).toContain("env_var");
    });

    it("should redact DATABASE_PASSWORD patterns", () => {
      const input = "DATABASE_PASSWORD=p@ssw0rd!123";
      const result = redactSecrets(input);
      expect(result.redactedText).toBe("DATABASE_PASSWORD=[REDACTED]");
      expect(result.redactionCount).toBe(1);
    });

    it("should redact AWS_SECRET_KEY patterns", () => {
      const input = "AWS_SECRET_KEY=wJalrXUtnFEMIKEYabcdefghijklmnop";
      const result = redactSecrets(input);
      expect(result.redactedText).toBe("AWS_SECRET_KEY=[REDACTED]");
      expect(result.redactionCount).toBe(1);
    });

    it("should redact CREDENTIAL values", () => {
      const input = "SUPABASE_SERVICE_ROLE_KEY=myservicerolekey123";
      const result = redactSecrets(input);
      expect(result.redactedText).toBe("SUPABASE_SERVICE_ROLE_KEY=[REDACTED]");
      expect(result.redactionCount).toBe(1);
    });
  });

  describe("generic API key patterns", () => {
    it("should redact api_key=value patterns", () => {
      const input = "Use api_key=abc123secret456";
      const result = redactSecrets(input);
      expect(result.redactedText).toBe("Use api_key=[REDACTED]");
      expect(result.redactionCount).toBe(1);
      expect(result.redactedPatterns).toContain("generic_api_key");
    });

    it("should redact apikey=value patterns", () => {
      const input = "apikey=mysecretapikey123";
      const result = redactSecrets(input);
      expect(result.redactedText).toBe("apikey=[REDACTED]");
      expect(result.redactionCount).toBe(1);
    });

    it("should redact api-key: value patterns", () => {
      const input = "api-key: supersecretkey456";
      const result = redactSecrets(input);
      expect(result.redactedText).toBe("api-key: [REDACTED]");
      expect(result.redactionCount).toBe(1);
    });
  });

  describe("combined secrets", () => {
    it("should redact multiple different secret types in one prompt", () => {
      const input = `
        Config:
        STRIPE_KEY=sk_live_abc123def456ghi789jkl012mno
        DATABASE_URL=postgres://user:secret123@db.example.com:5432/mydb
        JWT=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.signature123
        api_key=myapikey123
      `;
      const result = redactSecrets(input);
      expect(result.redactedText).not.toContain("sk_live_");
      expect(result.redactedText).not.toContain("secret123");
      expect(result.redactedText).not.toContain("myapikey123");
      expect(result.redactionCount).toBeGreaterThanOrEqual(4);
      expect(result.redactedPatterns.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("false positives handling", () => {
    it("should not redact the literal string [REDACTED]", () => {
      const input = "The value was already [REDACTED] by the system";
      const result = redactSecrets(input);
      expect(result.redactedText).toBe(input);
      expect(result.redactionCount).toBe(0);
    });

    it("should handle code comments mentioning secret formats", () => {
      const input =
        "// Stripe keys start with sk_live_ or sk_test_ prefix";
      const result = redactSecrets(input);
      // This is a comment, not an actual key - no alphanumeric suffix
      expect(result.redactionCount).toBe(0);
    });

    it("should not redact placeholder examples", () => {
      const input = "Replace YOUR_API_KEY with your actual key";
      const result = redactSecrets(input);
      // YOUR_API_KEY is not followed by = and value
      expect(result.redactionCount).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("should handle null-like edge cases gracefully", () => {
      // TypeScript should prevent null/undefined, but test runtime safety
      const result = redactSecrets("");
      expect(result.redactedText).toBe("");
    });

    it("should handle very long prompts efficiently", () => {
      const longText = "Normal text without secrets. ".repeat(5000);
      const start = performance.now();
      const result = redactSecrets(longText);
      const duration = performance.now() - start;

      expect(result.redactedText).toBe(longText);
      expect(result.redactionCount).toBe(0);
      // Should complete in reasonable time (< 100ms for ~150KB text)
      expect(duration).toBeLessThan(100);
    });

    it("should handle prompts with special regex characters", () => {
      const input = "Pattern: [a-z]+ and (test|prod) with $ and ^";
      const result = redactSecrets(input);
      expect(result.redactedText).toBe(input);
      expect(result.redactionCount).toBe(0);
    });

    it("should handle unicode and emoji", () => {
      const input = "Emoji: API_KEY=mysecret123 and text";
      const result = redactSecrets(input);
      expect(result.redactedText).toBe("Emoji: API_KEY=[REDACTED] and text");
    });
  });

  describe("pattern identification", () => {
    it("should return unique pattern types in redactedPatterns", () => {
      const input =
        "sk_live_abc123def456ghi789jkl012 and sk_test_xyz789abc123def456ghi012";
      const result = redactSecrets(input);
      // Both are stripe keys, should only appear once in patterns
      expect(result.redactedPatterns.filter((p) => p === "stripe_key").length).toBe(1);
    });
  });
});
