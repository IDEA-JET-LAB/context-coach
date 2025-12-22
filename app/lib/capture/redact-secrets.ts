/**
 * Secret Redaction Module for Contextor Capture Pipeline
 *
 * Detects and redacts sensitive information from prompts before storage.
 * This module is called AFTER validation but BEFORE any database write.
 *
 * SECURITY: Original text with secrets is NEVER logged or stored.
 * Only redaction summary (count) is logged.
 */

export interface RedactionResult {
  /** The text with all secrets replaced by [REDACTED] */
  redactedText: string;
  /** Number of secrets that were redacted */
  redactionCount: number;
  /** Types of patterns that were detected (e.g., ['stripe_key', 'jwt']) */
  redactedPatterns: string[];
}

interface PatternConfig {
  name: string;
  pattern: RegExp;
  /** Optional replacer function for patterns that need special handling */
  replacer?: (match: string, ...groups: string[]) => string;
}

/**
 * Pattern definitions for secret detection
 *
 * Order matters - more specific patterns should come before generic ones
 * to avoid double-matching.
 */
const SECRET_PATTERNS: PatternConfig[] = [
  // JWT tokens - must come before other patterns that might match base64
  {
    name: "jwt",
    pattern: /\beyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
  },

  // Stripe keys (live and test, secret and publishable)
  {
    name: "stripe_key",
    pattern: /\b(sk_live_|sk_test_|pk_live_|pk_test_)[a-zA-Z0-9]{24,}\b/g,
  },

  // OpenAI API keys (sk- prefix with 48+ characters)
  {
    name: "openai_key",
    pattern: /\bsk-[a-zA-Z0-9_-]{45,}\b/g,
  },

  // AWS Access Key IDs (AKIA prefix, 20 characters total)
  {
    name: "aws_access_key",
    pattern: /\bAKIA[A-Z0-9]{16}\b/g,
  },

  // URL passwords - ://user:password@host
  // Uses a replacer to only redact the password part
  {
    name: "url_password",
    pattern: /:\/\/([^:@\s]+):([^@\s]+)@/g,
    replacer: (_match: string, user: string, _password: string) => {
      return `://${user}:[REDACTED]@`;
    },
  },

  // Bearer tokens in Authorization context (long alphanumeric strings)
  {
    name: "bearer_token",
    pattern: /\bBearer\s+[a-zA-Z0-9_-]{32,}\b/gi,
    replacer: () => "Bearer [REDACTED]",
  },

  // Basic auth tokens (base64 can end with = padding, so no trailing \b)
  {
    name: "basic_auth",
    pattern: /\bBasic\s+[a-zA-Z0-9+/]{8,}[a-zA-Z0-9+/=]*/gi,
    replacer: () => "Basic [REDACTED]",
  },

  // Generic API key patterns: api_key=, apikey=, api-key:
  // Must come BEFORE env_var to prevent double-matching
  {
    name: "generic_api_key",
    pattern: /\b(api[_-]?key)\s*[=:]\s*["']?[^"'\s\n]+["']?/gi,
    replacer: (_match: string, keyName: string) => {
      if (keyName.includes("-")) {
        return `${keyName}: [REDACTED]`;
      }
      return `${keyName}=[REDACTED]`;
    },
  },

  // Environment variable assignments with sensitive key names
  // Matches: SECRET_KEY=value, export API_TOKEN="value", DATABASE_PASSWORD=...
  // Excludes api_key/apikey patterns (handled above)
  {
    name: "env_var",
    pattern:
      /\b(?!api[_-]?key)([A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|CREDENTIALS)[A-Z0-9_]*)\s*=\s*["']?[^"'\s\n]+["']?/gi,
    replacer: (_match: string, varName: string) => {
      return `${varName}=[REDACTED]`;
    },
  },
];

/**
 * Redacts secrets from the given text.
 *
 * @param text - The input text to scan for secrets
 * @returns Object containing redacted text and metadata
 *
 * @example
 * ```ts
 * const result = redactSecrets("My API key is sk_live_abc123...");
 * // result.redactedText === "My API key is [REDACTED]"
 * // result.redactionCount === 1
 * // result.redactedPatterns === ["stripe_key"]
 * ```
 */
export function redactSecrets(text: string): RedactionResult {
  // Handle empty or falsy input
  if (!text || typeof text !== "string") {
    return {
      redactedText: text ?? "",
      redactionCount: 0,
      redactedPatterns: [],
    };
  }

  let redactedText = text;
  let totalCount = 0;
  const detectedPatterns = new Set<string>();

  // Apply each pattern
  for (const config of SECRET_PATTERNS) {
    try {
      // Reset regex lastIndex for global patterns
      config.pattern.lastIndex = 0;

      // Count matches before replacement
      const matches = redactedText.match(config.pattern);
      if (matches && matches.length > 0) {
        totalCount += matches.length;
        detectedPatterns.add(config.name);

        // Apply replacement
        if (config.replacer) {
          redactedText = redactedText.replace(config.pattern, config.replacer);
        } else {
          redactedText = redactedText.replace(config.pattern, "[REDACTED]");
        }
      }
    } catch (error) {
      // Never throw on regex failure - log and continue
      // In production, this would go to error monitoring
      console.error(`[CAPTURE] redact: pattern ${config.name} failed`, error);
    }
  }

  // Log summary (count only, never content)
  if (totalCount > 0) {
    console.log(`[CAPTURE] redact: removed ${totalCount} secrets`);
  }

  return {
    redactedText,
    redactionCount: totalCount,
    redactedPatterns: Array.from(detectedPatterns),
  };
}
