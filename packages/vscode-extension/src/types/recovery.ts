/**
 * Recovery Types - Story 18-3
 *
 * TypeScript interfaces for recovery prompt generation.
 * Used to generate contextual prompts that help users resume interrupted sessions.
 */

/**
 * Request payload for the recovery API endpoint.
 */
export interface RecoveryRequest {
  /** Recent conversation messages from the session */
  messages: RecoveryMessage[];
  /** Files that were read, written, or modified during the session */
  filesAffected?: string[];
  /** Last tool that was used before interruption */
  lastTool?: string;
}

/**
 * A message from the session transcript for recovery analysis.
 */
export interface RecoveryMessage {
  /** Type of message: user, assistant, tool_use, tool_result */
  type: string;
  /** Content of the message (truncated for API) */
  content: string;
}

/**
 * AI-generated summary of the session context.
 */
export interface RecoverySummary {
  /** What the user was working on (max 100 chars) */
  task: string;
  /** The last completed action (max 100 chars) */
  lastAction: string;
  /** What was left to do, or "None" if work appears complete (max 100 chars) */
  pending: string;
}

/**
 * Response from the recovery API endpoint.
 */
export interface RecoveryApiResponse {
  /** Whether the request was successful */
  success: boolean;
  /** The generated summary (present if success is true) */
  summary?: RecoverySummary;
  /** Error information (present if success is false) */
  error?: {
    code: string;
    message: string;
  };
}

/**
 * A generated recovery prompt for resuming a session.
 */
export interface RecoveryPrompt {
  /** Session identifier this prompt was generated for */
  sessionId: string;
  /** The generated prompt text */
  prompt: string;
  /** When this prompt was generated */
  generatedAt: Date;
  /** Whether this prompt was generated using AI or local template */
  isAIGenerated: boolean;
}

/**
 * Cache entry for stored recovery prompts.
 */
export interface RecoveryPromptCacheEntry {
  /** The recovery prompt data */
  prompt: RecoveryPrompt;
  /** Hash of the snapshot used to generate this prompt */
  snapshotHash: string;
  /** When this cache entry expires (1 hour from creation) */
  expiresAt: Date;
}

/**
 * Serialized cache entry for storage.
 */
export interface SerializedRecoveryPromptCacheEntry {
  /** The recovery prompt data with serialized dates */
  prompt: {
    sessionId: string;
    prompt: string;
    generatedAt: string;
    isAIGenerated: boolean;
  };
  /** Hash of the snapshot used to generate this prompt */
  snapshotHash: string;
  /** When this cache entry expires (ISO string) */
  expiresAt: string;
}

/**
 * Constants for recovery prompt generation.
 */
export const RECOVERY_CONSTANTS = {
  /** Maximum prompt length in characters */
  MAX_PROMPT_LENGTH: 500,
  /** Maximum task/action description length */
  MAX_DESCRIPTION_LENGTH: 100,
  /** Maximum number of messages to send to API */
  MAX_MESSAGES_FOR_API: 20,
  /** Cache expiry time in milliseconds (1 hour) */
  CACHE_EXPIRY_MS: 60 * 60 * 1000,
  /** API timeout in milliseconds */
  API_TIMEOUT_MS: 5000,
  /** Storage prefix for cache entries */
  CACHE_STORAGE_PREFIX: "contextor.recovery.",
} as const;
