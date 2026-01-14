/**
 * Conversation Analysis Types
 * Story 30-3: Analysis Storage Schema
 *
 * Types for storing and retrieving LLM-powered conversation analyses.
 */

/**
 * Model options for conversation analysis.
 * Maps to Anthropic model tiers.
 */
export type AnalysisModel = 'haiku' | 'sonnet' | 'opus';

/**
 * Predefined question types for quick analysis.
 */
export type QuestionType =
  | 'custom'
  | 'summarize'
  | 'find_issues'
  | 'suggestions'
  | 'deep_dive';

/**
 * A stored conversation analysis record.
 */
export interface ConversationAnalysis {
  /** UUID primary key */
  id: string;

  /** Claude Code session identifier */
  sessionId: string;

  /** Team that owns this analysis */
  teamId: string;

  /** User who requested this analysis */
  userId: string;

  /** The analysis question/prompt submitted */
  question: string;

  /** Predefined question type (null for custom) */
  questionType: QuestionType | null;

  /** The LLM-generated analysis response */
  response: string;

  /** Anthropic model used */
  model: AnalysisModel;

  /** Number of input tokens consumed */
  inputTokens: number;

  /** Number of output tokens generated */
  outputTokens: number;

  /** Estimated cost in cents (USD) */
  estimatedCostCents: number;

  /** Whether user prompts were included in context */
  includedPrompts: boolean;

  /** Whether AI responses were included in context */
  includedResponses: boolean;

  /** Whether thinking/reasoning content was included */
  includedThinking: boolean;

  /** Whether tool usage was included in context */
  includedTools: boolean;

  /** When this analysis was performed */
  createdAt: string;
}

/**
 * Input for creating a new conversation analysis.
 * user_id is derived from the authenticated user.
 */
export interface CreateAnalysisInput {
  /** Claude Code session identifier */
  sessionId: string;

  /** Team ID for access control */
  teamId: string;

  /** The analysis question/prompt */
  question: string;

  /** Optional predefined question type */
  questionType?: QuestionType | null;

  /** The LLM-generated response */
  response: string;

  /** Model used for analysis */
  model: AnalysisModel;

  /** Input tokens consumed */
  inputTokens: number;

  /** Output tokens generated */
  outputTokens: number;

  /** Estimated cost in cents */
  estimatedCostCents: number;

  /** Whether prompts were included */
  includedPrompts: boolean;

  /** Whether responses were included */
  includedResponses: boolean;

  /** Whether thinking was included */
  includedThinking: boolean;

  /** Whether tools were included */
  includedTools: boolean;
}

/**
 * Database row shape (snake_case) for type-safe mapping.
 */
export interface ConversationAnalysisRow {
  id: string;
  session_id: string;
  team_id: string;
  user_id: string;
  question: string;
  question_type: string | null;
  response: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_cents: number | string;
  included_prompts: boolean;
  included_responses: boolean;
  included_thinking: boolean;
  included_tools: boolean;
  created_at: string;
}
