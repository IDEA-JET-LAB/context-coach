/**
 * Conversation Analysis API - Story 30-7: Interactive Chat Interface
 *
 * POST /api/conversations/[sessionId]/analyze
 *
 * Streams an AI-powered analysis of a conversation session.
 * Uses Anthropic models (Haiku, Sonnet, Opus) to analyze conversation content.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { createScopedLogger } from "@/lib/utils/logger";
import { isValidUuid } from "@/lib/utils/uuid";
import {
  checkRateLimit,
  calculateRetryAfter,
  userRateLimit,
} from "@/lib/rate-limit";
import { extractConversationContent } from "@/lib/analysis/content-extractor";
import {
  analyzeConversationStream,
  type AnthropicModel,
} from "@/lib/analysis/anthropic-client";
import {
  ANALYSIS_SYSTEM_PROMPT,
  estimateCost,
  MODEL_PRICING,
} from "@/lib/analysis/token-estimator";
import { createAnalysis } from "@/lib/repositories/conversation-analysis";
import type { QuestionType } from "@/lib/types/conversation-analysis";
import { verifySessionAccess } from "@/lib/analysis/conversation-stats";

const logger = createScopedLogger("API_CONVERSATION_ANALYZE");

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

/**
 * Request body for analysis endpoint.
 */
interface AnalyzeRequest {
  question: string;
  model: AnthropicModel;
  includePrompts: boolean;
  includeResponses: boolean;
  includeThinking: boolean;
  includeTools: boolean;
  questionType?: QuestionType;
}

/**
 * Validates the request body.
 */
function validateRequest(
  body: unknown
): { valid: true; data: AnalyzeRequest } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be an object" };
  }

  const {
    question,
    model,
    includePrompts,
    includeResponses,
    includeThinking,
    includeTools,
    questionType,
  } = body as Record<string, unknown>;

  if (typeof question !== "string" || question.trim().length === 0) {
    return { valid: false, error: "question is required and must be non-empty" };
  }

  if (question.length > 2000) {
    return { valid: false, error: "question must not exceed 2000 characters" };
  }

  const validModels: AnthropicModel[] = ["haiku", "sonnet", "opus"];
  if (!validModels.includes(model as AnthropicModel)) {
    return {
      valid: false,
      error: `model must be one of: ${validModels.join(", ")}`,
    };
  }

  if (typeof includePrompts !== "boolean") {
    return { valid: false, error: "includePrompts must be a boolean" };
  }

  if (typeof includeResponses !== "boolean") {
    return { valid: false, error: "includeResponses must be a boolean" };
  }

  if (typeof includeThinking !== "boolean") {
    return { valid: false, error: "includeThinking must be a boolean" };
  }

  if (typeof includeTools !== "boolean") {
    return { valid: false, error: "includeTools must be a boolean" };
  }

  const validQuestionTypes: QuestionType[] = [
    "custom",
    "summarize",
    "find_issues",
    "suggestions",
    "deep_dive",
  ];
  if (
    questionType !== undefined &&
    !validQuestionTypes.includes(questionType as QuestionType)
  ) {
    return {
      valid: false,
      error: `questionType must be one of: ${validQuestionTypes.join(", ")}`,
    };
  }

  return {
    valid: true,
    data: {
      question: question.trim(),
      model: model as AnthropicModel,
      includePrompts,
      includeResponses,
      includeThinking,
      includeTools,
      questionType: questionType as QuestionType | undefined,
    },
  };
}

/**
 * POST /api/conversations/[sessionId]/analyze
 *
 * Streams an AI-powered analysis of a conversation.
 *
 * Authorization:
 * - User must be authenticated
 * - User must be a member of the team that owns the session
 *
 * Rate Limiting:
 * - 20 requests per minute per user
 *
 * Request Body:
 * - question: string - The analysis question
 * - model: "haiku" | "sonnet" | "opus" - Model to use
 * - includePrompts: boolean - Include user prompts
 * - includeResponses: boolean - Include AI responses
 * - includeThinking: boolean - Include thinking content
 * - includeTools: boolean - Include tool calls
 * - questionType?: QuestionType - Optional predefined type
 *
 * Response:
 * - 200: Streaming text/plain response
 * - 400: { error: { code: 'INVALID_REQUEST', message } }
 * - 401: { error: { code: 'UNAUTHORIZED', message } }
 * - 403: { error: { code: 'FORBIDDEN', message } }
 * - 404: { error: { code: 'NOT_FOUND', message } }
 * - 429: { error: { code: 'RATE_LIMITED', message } }
 * - 500: { error: { code: 'INTERNAL_ERROR', message } }
 */
export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const { sessionId: sessionIdParam } = await context.params;

    // ========================================================================
    // Step 1: Validate session ID is present
    // ========================================================================
    if (!sessionIdParam) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_SESSION_ID",
            message: "Session ID is required",
          },
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // Step 2: Authenticate user
    // ========================================================================
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        { status: 401 }
      );
    }

    // ========================================================================
    // Step 3: Resolve session identifier to UUID
    // The sessionIdParam can be either:
    //   - A database UUID (id column)
    //   - A Claude Code session_id (which can also be a UUID!)
    // Use admin client to bypass RLS (access is verified in step 5)
    // We need BOTH id (for internal lookups) and session_id (for FK storage)
    // ========================================================================
    let sessionId: string; // Database UUID for internal lookups
    let sessionIdText: string; // Text session_id for FK storage
    const adminSupabase = createAdminClient();

    if (isValidUuid(sessionIdParam)) {
      // UUID format - could be database id OR session_id column
      // Check BOTH columns like getConversationThread does
      const { data: session, error: lookupError } = await adminSupabase
        .from("sessions")
        .select("id, session_id")
        .or(`id.eq.${sessionIdParam},session_id.eq.${sessionIdParam}`)
        .single();

      if (lookupError || !session) {
        return NextResponse.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Session not found",
            },
          },
          { status: 404 }
        );
      }
      sessionId = session.id;
      sessionIdText = session.session_id;
    } else {
      // Not a UUID, lookup by session_id column only
      const { data: session, error: lookupError } = await adminSupabase
        .from("sessions")
        .select("id, session_id")
        .eq("session_id", sessionIdParam)
        .single();

      if (lookupError || !session) {
        return NextResponse.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Session not found",
            },
          },
          { status: 404 }
        );
      }
      sessionId = session.id;
      sessionIdText = session.session_id;
    }

    // ========================================================================
    // Step 4: Check rate limit
    // ========================================================================
    const rateLimitResult = await checkRateLimit(userRateLimit, user.id);

    if (!rateLimitResult.success) {
      const retryAfter = calculateRetryAfter(rateLimitResult.reset);
      logger.warn("Rate limit exceeded", { userId: user.id });

      return NextResponse.json(
        {
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

    // ========================================================================
    // Step 4: Parse and validate request body
    // ========================================================================
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
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
          error: {
            code: "INVALID_REQUEST",
            message: validation.error,
          },
        },
        { status: 400 }
      );
    }

    const {
      question,
      model,
      includePrompts,
      includeResponses,
      includeThinking,
      includeTools,
      questionType,
    } = validation.data;

    // ========================================================================
    // Step 5: Verify access to this session and get team ID
    // Use admin client to bypass RLS for access check
    // ========================================================================
    const accessResult = await verifySessionAccess(adminSupabase, sessionId, user.id);

    if (!accessResult.hasAccess) {
      if (accessResult.error === "Session not found") {
        return NextResponse.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Session not found",
            },
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have access to this session",
          },
        },
        { status: 403 }
      );
    }

    // Fetch teamId from session (verifySessionAccess already verified it exists)
    const { data: session } = await adminSupabase
      .from("sessions")
      .select("team_id")
      .eq("id", sessionId)
      .single();

    const teamId = session?.team_id;

    // ========================================================================
    // Step 6: Extract conversation content
    // Use admin client to bypass RLS for content extraction
    // ========================================================================
    const content = await extractConversationContent(adminSupabase, sessionId, {
      includePrompts,
      includeResponses,
      includeThinking,
      includeTools,
    });

    if (content.metadata.promptCount === 0) {
      return NextResponse.json(
        {
          error: {
            code: "NO_CONTENT",
            message: "No messages found in this conversation",
          },
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // Step 7: Build analysis prompt
    // ========================================================================
    const userPrompt = `## Conversation Transcript

${content.transcript}

## Your Task

${question}`;

    logger.log("Starting conversation analysis", {
      sessionId,
      userId: user.id,
      model,
      questionLength: question.length,
      transcriptLength: content.transcript.length,
      turnCount: content.metadata.turnCount,
    });

    // ========================================================================
    // Step 8: Stream response from Anthropic
    // ========================================================================
    const encoder = new TextEncoder();
    let fullResponse = "";
    let inputTokens = 0;
    let outputTokens = 0;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of analyzeConversationStream({
            systemPrompt: ANALYSIS_SYSTEM_PROMPT,
            userPrompt,
            config: {
              model,
              maxTokens: 4096,
              temperature: 0,
              timeout: 60000, // 60 second timeout for streaming
            },
          })) {
            if (chunk.type === "text" && chunk.content) {
              fullResponse += chunk.content;
              controller.enqueue(encoder.encode(chunk.content));
            } else if (chunk.type === "done" && chunk.usage) {
              inputTokens = chunk.usage.inputTokens;
              outputTokens = chunk.usage.outputTokens;
            } else if (chunk.type === "error") {
              logger.error("Stream error", undefined, { error: chunk.error });
              controller.enqueue(
                encoder.encode(`\n\n[Error: ${chunk.error}]`)
              );
            }
          }

          // ================================================================
          // Step 9: Save analysis to database
          // ================================================================
          if (fullResponse.length > 0) {
            try {
              // Calculate cost
              const pricing = MODEL_PRICING[model];
              const estimatedCostCents =
                (inputTokens / 1_000_000) * pricing.input * 100 +
                (outputTokens / 1_000_000) * pricing.output * 100;

              await createAnalysis(adminSupabase, user.id, {
                sessionId: sessionIdText, // Use TEXT session_id for FK constraint
                teamId,
                question,
                questionType: questionType ?? "custom",
                response: fullResponse,
                model,
                inputTokens,
                outputTokens,
                estimatedCostCents,
                includedPrompts: includePrompts,
                includedResponses: includeResponses,
                includedThinking: includeThinking,
                includedTools: includeTools,
              });

              logger.log("Analysis saved", {
                sessionId,
                userId: user.id,
                model,
                inputTokens,
                outputTokens,
                estimatedCostCents: estimatedCostCents.toFixed(4),
              });
            } catch (saveError) {
              // Log but don't fail the request - user already got the response
              logger.error("Failed to save analysis", saveError, {
                sessionId,
                userId: user.id,
              });
            }
          }

          controller.close();
        } catch (error) {
          logger.error("Stream processing error", error);
          controller.enqueue(
            encoder.encode("\n\n[Error: Failed to process response]")
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    logger.error("Unexpected error in conversation analyze API", error);

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

/**
 * GET /api/conversations/[sessionId]/analyze
 *
 * Returns past analyses for a conversation session.
 *
 * Authorization:
 * - User must be authenticated
 * - User must be a member of the team that owns the session
 *
 * Response:
 * - 200: { data: ConversationAnalysis[] }
 * - 400: { error: { code: 'INVALID_SESSION_ID', message } }
 * - 401: { error: { code: 'UNAUTHORIZED', message } }
 * - 403: { error: { code: 'FORBIDDEN', message } }
 * - 404: { error: { code: 'NOT_FOUND', message } }
 * - 500: { error: { code: 'INTERNAL_ERROR', message } }
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const { sessionId: sessionIdParam } = await context.params;

    // Validate session ID is present
    if (!sessionIdParam) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_SESSION_ID",
            message: "Session ID is required",
          },
        },
        { status: 400 }
      );
    }

    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        { status: 401 }
      );
    }

    // Resolve session identifier to UUID
    // The sessionIdParam can be either:
    //   - A database UUID (id column)
    //   - A Claude Code session_id (which can also be a UUID!)
    // Use admin client to bypass RLS (access is verified separately)
    // We need BOTH id (for internal lookups) and session_id (for querying analyses)
    let sessionId: string; // Database UUID for internal lookups
    let sessionIdText: string; // Text session_id for querying analyses table
    const adminSupabase = createAdminClient();

    if (isValidUuid(sessionIdParam)) {
      // UUID format - could be database id OR session_id column
      // Check BOTH columns like getConversationThread does
      const { data: session, error: lookupError } = await adminSupabase
        .from("sessions")
        .select("id, session_id")
        .or(`id.eq.${sessionIdParam},session_id.eq.${sessionIdParam}`)
        .single();

      if (lookupError || !session) {
        return NextResponse.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Session not found",
            },
          },
          { status: 404 }
        );
      }
      sessionId = session.id;
      sessionIdText = session.session_id;
    } else {
      // Not a UUID, lookup by session_id column only
      const { data: session, error: lookupError } = await adminSupabase
        .from("sessions")
        .select("id, session_id")
        .eq("session_id", sessionIdParam)
        .single();

      if (lookupError || !session) {
        return NextResponse.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Session not found",
            },
          },
          { status: 404 }
        );
      }
      sessionId = session.id;
      sessionIdText = session.session_id;
    }

    // Verify access to this session using admin client
    const accessResult = await verifySessionAccess(adminSupabase, sessionId, user.id);

    if (!accessResult.hasAccess) {
      if (accessResult.error === "Session not found") {
        return NextResponse.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Session not found",
            },
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have access to this session",
          },
        },
        { status: 403 }
      );
    }

    // Fetch analyses from repository using admin client
    // Use sessionIdText because the table's FK references sessions.session_id
    const { getAnalysesForSession } = await import(
      "@/lib/repositories/conversation-analysis"
    );
    const analyses = await getAnalysesForSession(adminSupabase, sessionIdText);

    return NextResponse.json({
      data: analyses,
    });
  } catch (error) {
    logger.error("Unexpected error in conversation analyze GET API", error);

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
