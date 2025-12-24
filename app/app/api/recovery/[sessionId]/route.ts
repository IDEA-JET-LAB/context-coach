/**
 * Recovery API - Story 18-3
 *
 * POST /api/recovery/[sessionId]
 *
 * Generates AI-powered summaries of interrupted session context
 * to help users resume their work seamlessly.
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import {
  recoveryRateLimit,
  checkRateLimit,
  calculateRetryAfter,
} from "@/lib/rate-limit";
import { createScopedLogger } from "@/lib/utils/logger";

const logger = createScopedLogger("RECOVERY_API");

/**
 * Request payload for recovery prompt generation.
 */
interface RecoveryRequest {
  messages: Array<{ type: string; content: string }>;
  filesAffected?: string[];
  lastTool?: string;
}

/**
 * AI-generated summary of the session context.
 */
interface RecoverySummary {
  task: string;
  lastAction: string;
  pending: string;
}

/**
 * System prompt for AI analysis.
 */
const AI_SYSTEM_PROMPT = `Analyze this Claude Code session transcript and provide a brief summary.
Return JSON with exactly these fields:
- task: What was the user working on? (1 sentence, max 100 chars)
- lastAction: What was the last completed action? (1 sentence, max 100 chars)
- pending: What was left to do? (1 sentence, or "None" if work appears complete)

Be concise and focus on the most important information.`;

/**
 * Validates the request payload.
 */
function validateRequest(
  body: unknown
): { valid: true; data: RecoveryRequest } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be an object" };
  }

  const { messages, filesAffected, lastTool } = body as Record<string, unknown>;

  if (!Array.isArray(messages)) {
    return { valid: false, error: "messages must be an array" };
  }

  if (messages.length === 0) {
    return { valid: false, error: "messages array cannot be empty" };
  }

  // Validate each message has type and content
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || typeof msg !== "object") {
      return { valid: false, error: `messages[${i}] must be an object` };
    }
    if (typeof (msg as Record<string, unknown>).type !== "string") {
      return { valid: false, error: `messages[${i}].type must be a string` };
    }
    if (typeof (msg as Record<string, unknown>).content !== "string") {
      return {
        valid: false,
        error: `messages[${i}].content must be a string`,
      };
    }
  }

  // Validate optional fields
  if (filesAffected !== undefined && !Array.isArray(filesAffected)) {
    return { valid: false, error: "filesAffected must be an array" };
  }

  if (lastTool !== undefined && typeof lastTool !== "string") {
    return { valid: false, error: "lastTool must be a string" };
  }

  return {
    valid: true,
    data: {
      messages: messages as Array<{ type: string; content: string }>,
      filesAffected: filesAffected as string[] | undefined,
      lastTool: lastTool as string | undefined,
    },
  };
}

/**
 * Validates the AI response structure.
 */
function validateAIResponse(
  response: unknown
): { valid: true; data: RecoverySummary } | { valid: false } {
  if (!response || typeof response !== "object") {
    return { valid: false };
  }

  const { task, lastAction, pending } = response as Record<string, unknown>;

  if (
    typeof task !== "string" ||
    typeof lastAction !== "string" ||
    typeof pending !== "string"
  ) {
    return { valid: false };
  }

  return {
    valid: true,
    data: {
      task: task.slice(0, 100),
      lastAction: lastAction.slice(0, 100),
      pending: pending.slice(0, 100),
    },
  };
}

/**
 * Calls OpenAI to generate a session summary.
 */
async function generateAISummary(
  messages: Array<{ type: string; content: string }>
): Promise<RecoverySummary | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    logger.warn("OpenAI API key not configured");
    return null;
  }

  // Prepare transcript for AI
  const transcript = messages
    .map((m) => `[${m.type}]: ${m.content.slice(0, 500)}`)
    .join("\n\n");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: AI_SYSTEM_PROMPT },
          { role: "user", content: `Session transcript:\n\n${transcript}` },
        ],
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.error("OpenAI API error", undefined, {
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      logger.warn("Empty response from OpenAI");
      return null;
    }

    // Parse and validate JSON response
    try {
      const parsed = JSON.parse(content);
      const validation = validateAIResponse(parsed);

      if (!validation.valid) {
        logger.warn("Invalid AI response structure", { content });
        return null;
      }

      return validation.data;
    } catch (parseError) {
      logger.warn("Failed to parse AI response", { content });
      return null;
    }
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      logger.warn("OpenAI API call timed out");
      return null;
    }

    logger.error("OpenAI API call failed", error);
    return null;
  }
}

/**
 * POST /api/recovery/[sessionId]
 *
 * Generates an AI-powered summary of an interrupted session.
 *
 * Request Body:
 * - messages: Array<{ type: string; content: string }> - Recent session messages
 * - filesAffected?: string[] - Files that were read/written/modified
 * - lastTool?: string - Last tool that was used
 *
 * Response:
 * - 200: { success: true, summary: RecoverySummary }
 * - 400: { success: false, error: { code: 'INVALID_REQUEST', message } }
 * - 401: { success: false, error: { code: 'UNAUTHORIZED', message } }
 * - 429: { success: false, error: { code: 'RATE_LIMITED', message } }
 * - 500: { success: false, error: { code: 'INTERNAL_ERROR', message } }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Not authenticated",
          },
        },
        { status: 401 }
      );
    }

    // Check rate limit
    const rateLimitResult = await checkRateLimit(recoveryRateLimit, user.id);

    if (!rateLimitResult.success) {
      const retryAfter = calculateRetryAfter(rateLimitResult.reset);
      logger.warn("Rate limit exceeded", { userId: user.id });

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Please try again later.",
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfter,
            "X-RateLimit-Limit": String(rateLimitResult.limit),
            "X-RateLimit-Remaining": String(rateLimitResult.remaining),
            "X-RateLimit-Reset": String(rateLimitResult.reset),
          },
        }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Invalid JSON in request body",
          },
        },
        { status: 400 }
      );
    }

    const validation = validateRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: validation.error,
          },
        },
        { status: 400 }
      );
    }

    const { messages } = validation.data;

    // Limit messages to last 20
    const recentMessages = messages.slice(-20);

    logger.log("Generating recovery summary", {
      userId: user.id,
      sessionId,
      messageCount: recentMessages.length,
    });

    // Generate AI summary
    const summary = await generateAISummary(recentMessages);

    if (!summary) {
      // Return a generic fallback summary if AI fails
      logger.warn("AI summary generation failed, returning fallback", {
        userId: user.id,
        sessionId,
      });

      // Extract first user message as fallback task
      const firstUserMessage = recentMessages.find((m) => m.type === "user");
      const fallbackTask = firstUserMessage
        ? firstUserMessage.content.slice(0, 100)
        : "Previous session task";

      return NextResponse.json({
        success: true,
        summary: {
          task: fallbackTask,
          lastAction: "Session was interrupted",
          pending: "Resume from where you left off",
        },
        isAIGenerated: false,
      });
    }

    logger.log("Recovery summary generated successfully", {
      userId: user.id,
      sessionId,
    });

    return NextResponse.json({
      success: true,
      summary,
      isAIGenerated: true,
    });
  } catch (error) {
    logger.error("Unexpected error in recovery API", error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        },
      },
      { status: 500 }
    );
  }
}
