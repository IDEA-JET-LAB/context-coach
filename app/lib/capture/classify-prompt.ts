/**
 * Prompt Classification Module for Contextor Capture Pipeline
 *
 * Classifies prompts into three types:
 * - 'prompt': Regular prompts (analyzed)
 * - 'command': Pure slash commands like /commit, /dev (skipped)
 * - 'command_with_prompt': Commands with text like "/dev help me" (analyzed)
 *
 * Story 5.7: Command Prompt Classification
 */

/**
 * The type of prompt classification.
 */
export type PromptType = "prompt" | "command" | "command_with_prompt";

/**
 * Result of classifying a prompt.
 */
export interface PromptClassification {
  /** The classification type */
  type: PromptType;
  /** The command portion if present (e.g., "/dev") */
  commandPart?: string;
  /** The prompt portion to analyze (original text for 'prompt', extracted text for 'command_with_prompt') */
  promptPart?: string;
  /** Whether this prompt should be analyzed */
  shouldAnalyze: boolean;
  /** The analysis status to use */
  analysisStatus: "pending" | "skipped";
}

/**
 * Regex to match slash commands.
 * Matches: /command, /command:subcommand, /agent-name:command
 * Examples: /commit, /dev, /review-pr, /bmad:bmm:agents:dev
 */
const COMMAND_REGEX = /^(\/[a-zA-Z][a-zA-Z0-9_:-]*)\s*(.*)/;

/**
 * Regex to match pure numeric/ID arguments (not meaningful text).
 * Examples: "123", "456 789", "pr-123"
 */
const NUMERIC_ARGS_REGEX = /^[\d\s-]*$/;

/**
 * Minimum length for text after command to be considered "meaningful".
 * Short args like "123" or "fix" are likely IDs, not prompts.
 */
const MIN_MEANINGFUL_TEXT_LENGTH = 10;

/**
 * Classifies a prompt into one of three types.
 *
 * @param text - The raw prompt text
 * @returns Classification result with type, parts, and analysis flags
 *
 * @example
 * ```ts
 * // Regular prompt
 * classifyPrompt("Help me fix this bug")
 * // => { type: 'prompt', promptPart: 'Help me fix this bug', shouldAnalyze: true, analysisStatus: 'pending' }
 *
 * // Pure command
 * classifyPrompt("/commit")
 * // => { type: 'command', commandPart: '/commit', shouldAnalyze: false, analysisStatus: 'skipped' }
 *
 * // Command with prompt
 * classifyPrompt("/dev help me implement OAuth authentication")
 * // => { type: 'command_with_prompt', commandPart: '/dev', promptPart: 'help me implement OAuth authentication', shouldAnalyze: true, analysisStatus: 'pending' }
 * ```
 */
export function classifyPrompt(text: string): PromptClassification {
  const trimmed = text.trim();

  // Not a command - regular prompt
  if (!trimmed.startsWith("/")) {
    return {
      type: "prompt",
      promptPart: trimmed,
      shouldAnalyze: true,
      analysisStatus: "pending",
    };
  }

  // Try to match command pattern
  const match = trimmed.match(COMMAND_REGEX);

  // Just a slash or invalid command format
  if (!match) {
    return {
      type: "command",
      shouldAnalyze: false,
      analysisStatus: "skipped",
    };
  }

  const [, command, remainder = ""] = match;
  const remainderTrimmed = remainder.trim();

  // Pure command - no text after, or just whitespace
  if (!remainderTrimmed) {
    return {
      type: "command",
      commandPart: command,
      shouldAnalyze: false,
      analysisStatus: "skipped",
    };
  }

  // Command with just numeric/ID args (e.g., "/review-pr 123")
  if (NUMERIC_ARGS_REGEX.test(remainderTrimmed)) {
    return {
      type: "command",
      commandPart: command,
      shouldAnalyze: false,
      analysisStatus: "skipped",
    };
  }

  // Command with short args - likely an ID or flag, not a prompt
  if (remainderTrimmed.length < MIN_MEANINGFUL_TEXT_LENGTH) {
    return {
      type: "command",
      commandPart: command,
      shouldAnalyze: false,
      analysisStatus: "skipped",
    };
  }

  // Command followed by meaningful prompt text
  return {
    type: "command_with_prompt",
    commandPart: command,
    promptPart: remainderTrimmed,
    shouldAnalyze: true,
    analysisStatus: "pending",
  };
}
