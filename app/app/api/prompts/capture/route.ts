import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, extractApiKey } from "@/lib/api/validate-api-key";
import {
  captureRequestSchema,
  mapValidationError,
} from "@/lib/validations/capture";
import {
  projectRateLimit,
  userRateLimit,
  ipRateLimit,
  checkRateLimit,
  getClientIp,
  calculateRetryAfter,
} from "@/lib/rate-limit";
import { redactSecrets } from "@/lib/capture/redact-secrets";
import { storePrompt, StorageError, FilteredError } from "@/lib/capture/store-prompt";
import { withRetry, RetryError } from "@/lib/capture/retry";
import { isTransientError, classifyError } from "@/lib/capture/errors";
import { createScopedLogger } from "@/lib/utils/logger";

// Create a scoped logger for capture operations
const logger = createScopedLogger("CAPTURE");

/**
 * Triggers the analyze-prompt Edge Function asynchronously.
 * This is a fire-and-forget call - we don't wait for analysis to complete.
 *
 * Security note: Uses SUPABASE_SERVICE_ROLE_KEY because:
 * 1. Edge Functions require authentication to invoke
 * 2. The service role allows the Edge Function to read/write prompts via admin access
 * 3. This key is server-side only (stored in GCP Secret Manager in production)
 * 4. Never exposed to client - only used in this Route Handler
 */
async function triggerAnalysis(promptId: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    logger.warn("Cannot trigger analysis: missing environment variables");
    return;
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/analyze-prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ prompt_id: promptId }),
    });

    if (!response.ok) {
      logger.warn("Analysis trigger failed", {
        status: response.status,
        promptId,
      });
    } else {
      logger.log("Analysis triggered", { promptId });
    }
  } catch (error) {
    // Don't fail the capture if analysis trigger fails
    logger.warn("Analysis trigger error", { promptId, error });
  }
}

/**
 * Creates a rate limit exceeded response.
 */
function rateLimitResponse(reset: number): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests",
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": calculateRetryAfter(reset),
      },
    }
  );
}

/**
 * POST /api/prompts/capture
 *
 * Receives prompts from the CLI hook for storage and analysis.
 *
 * Authorization: Bearer <api_key>
 *
 * Request body:
 * - prompt: string (required) - The prompt text
 * - user_id: string (required) - The user's ID
 * - timestamp: string (required) - ISO 8601 timestamp
 * - metadata: object (optional) - Additional metadata
 *
 * Response:
 * - 201: { data: { id, status: 'pending' } }
 * - 400: { error: { code, message } } - Validation error
 * - 401: { error: { code: 'INVALID_API_KEY', message } }
 * - 429: { error: { code: 'RATE_LIMITED', message } } - Rate limit exceeded (includes Retry-After header)
 * - 500: { error: { code: 'INTERNAL_ERROR', message } }
 */
export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const clientIp = getClientIp(request);

    // Check IP rate limit first (protects against brute force before auth)
    const ipLimit = await checkRateLimit(ipRateLimit, clientIp);
    if (!ipLimit.success) {
      logger.warn("IP rate limit exceeded", { clientIp });
      return rateLimitResponse(ipLimit.reset);
    }

    // Extract API key from Authorization header
    const authHeader = request.headers.get("Authorization");
    const apiKey = extractApiKey(authHeader);

    if (!apiKey) {
      logger.warn("Missing or malformed auth header");
      return NextResponse.json(
        {
          error: {
            code: "INVALID_API_KEY",
            message: "Invalid or missing API key",
          },
        },
        { status: 401 }
      );
    }

    // Validate API key
    const keyResult = await validateApiKey(apiKey);
    if (!keyResult.valid) {
      logger.warn("Invalid API key");
      return NextResponse.json(
        {
          error: {
            code: "INVALID_API_KEY",
            message: "Invalid or missing API key",
          },
        },
        { status: 401 }
      );
    }

    // Check project rate limit (after successful auth)
    const projectLimit = await checkRateLimit(
      projectRateLimit,
      keyResult.project_id!
    );
    if (!projectLimit.success) {
      logger.warn("Project rate limit exceeded", {
        projectId: keyResult.project_id,
      });
      return rateLimitResponse(projectLimit.reset);
    }

    // Parse request body with error handling
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      logger.warn("Invalid JSON body");
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Request body must be valid JSON",
          },
        },
        { status: 400 }
      );
    }

    // Check user rate limit if user_id is provided
    // Rate limiting strategy:
    // 1. IP limit (line ~107): First defense against brute force - runs before auth
    // 2. Project limit (line ~146): Runs after auth to prevent per-project abuse
    // 3. User limit (here): Runs after body parse to prevent per-user abuse
    //
    // This runs BEFORE schema validation to ensure rate limiting happens early.
    // We must parse JSON first to extract user_id, but JSON parsing is cheap
    // compared to database operations that follow.
    const bodyObj = body as Record<string, unknown>;
    if (typeof bodyObj?.user_id === "string" && bodyObj.user_id.length > 0) {
      const userLimit = await checkRateLimit(userRateLimit, bodyObj.user_id);
      if (!userLimit.success) {
        logger.warn("User rate limit exceeded", { userId: bodyObj.user_id });
        return rateLimitResponse(userLimit.reset);
      }
    }

    // Validate body schema
    const parsed = captureRequestSchema.safeParse(body);
    if (!parsed.success) {
      const { code, message } = mapValidationError(parsed.error);
      // Log validation failure with length (never log prompt content)
      const promptLength =
        typeof (body as Record<string, unknown>)?.prompt === "string"
          ? ((body as Record<string, unknown>).prompt as string).length
          : 0;
      logger.warn("Validation failed", { errorCode: code, promptLength });
      return NextResponse.json(
        {
          error: {
            code,
            message,
          },
        },
        { status: 400 }
      );
    }

    // Redact secrets from prompt before storage
    const { redactedText, redactionCount } = redactSecrets(parsed.data.prompt);

    // Log redaction summary (count only, never content)
    if (redactionCount > 0) {
      logger.log("Secrets redacted", { redactionCount });
    }

    // Store the prompt in the database with retry logic for transient errors
    try {
      const { result, attempts, totalDurationMs } = await withRetry(
        () =>
          storePrompt({
            team_id: keyResult.team_id!,
            project_id: keyResult.project_id!,
            user_id: parsed.data.user_id,
            text: redactedText,
            metadata: parsed.data.metadata,
          }),
        isTransientError
      );

      // Log successful storage (no PII)
      logger.log("Prompt stored successfully", {
        projectId: keyResult.project_id,
        promptId: result.id,
        promptType: result.prompt_type,
        attempts,
        durationMs: totalDurationMs,
      });

      // Trigger analysis for prompts that need it (not commands)
      // This is async/non-blocking - we don't wait for analysis
      if (result.analysis_status === "pending") {
        // Use void to explicitly ignore the promise
        void triggerAnalysis(result.id);
      }

      // Return success with the database-generated ID
      return NextResponse.json(
        { data: { id: result.id, status: result.analysis_status } },
        { status: 201 }
      );
    } catch (error) {
      // Handle filtered prompts (garbage/system data) - return 200 OK but don't store
      if (error instanceof FilteredError) {
        logger.log("Prompt filtered (system message)", {
          projectId: keyResult.project_id,
        });
        return NextResponse.json(
          { data: { id: null, status: "filtered", reason: "System message filtered" } },
          { status: 200 }
        );
      }

      // Handle retry exhaustion - return 503 with Retry-After header
      if (error instanceof RetryError) {
        logger.error("All retries exhausted", error, {
          attempts: error.attempts,
          durationMs: error.totalDurationMs,
        });
        return NextResponse.json(
          {
            error: {
              code: "SERVICE_UNAVAILABLE",
              message: "Please retry later",
            },
          },
          {
            status: 503,
            headers: {
              "Retry-After": "60",
            },
          }
        );
      }

      // Handle permanent storage errors (non-retryable)
      if (error instanceof StorageError) {
        const classification = classifyError(error);
        logger.error("Storage error", error, {
          errorCode: error.code,
          category: classification.category,
          isTransient: classification.isTransient,
        });
        return NextResponse.json(
          { error: { code: error.code, message: "Failed to store prompt" } },
          { status: 503 }
        );
      }

      throw error;
    }
  } catch (error) {
    logger.error("Unexpected error", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        },
      },
      { status: 500 }
    );
  }
}
