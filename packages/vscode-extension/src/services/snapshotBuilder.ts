/**
 * Snapshot Builder Service - Story 18-2
 *
 * Builds comprehensive snapshots of interrupted session state.
 * Extracts messages, file operations, tool usage, conversation context, and git state.
 *
 * Features:
 * - Extracts last 20 messages with truncation
 * - Identifies file read/write/edit/search operations
 * - Tracks tool usage with invocation counts
 * - Detects pending operations (tool_use without tool_result)
 * - Extracts initial and current task context
 * - Captures git branch and operation state
 */

import * as fs from "fs";
import * as readline from "readline";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import type { InterruptedSession } from "../types/interruptedSession";
import type {
  SessionStateSnapshot,
  SummarizedMessage,
  FileOperation,
  ToolUsageSummary,
  PendingOperation,
  ConversationContext,
  GitContext,
  ExtendedTranscriptMessage,
} from "../types/sessionState";
import {
  FILE_TOOLS,
  SNAPSHOT_CONSTANTS,
} from "../types/sessionState";

const execAsync = promisify(exec);

/**
 * Error patterns to look for in messages.
 */
const ERROR_PATTERNS = [
  /error:/i,
  /failed:/i,
  /exception:/i,
  /traceback/i,
  /cannot/i,
  /unable to/i,
  /permission denied/i,
  /not found/i,
  /does not exist/i,
];

/**
 * Blocker patterns to identify issues.
 */
const BLOCKER_PATTERNS = [
  /blocked/i,
  /stuck/i,
  /waiting for/i,
  /need to/i,
  /requires/i,
  /missing/i,
  /can't proceed/i,
];

/**
 * Git command patterns to detect git operations.
 */
const GIT_COMMAND_PATTERN = /(?:git\s+)([\w-]+)/g;
const GIT_BRANCH_PATTERN = /(?:git\s+(?:checkout|switch)\s+(?:-b\s+)?|git\s+branch\s+)([a-zA-Z0-9/_.-]+)/g;

/**
 * Builds a session state snapshot from an interrupted session.
 *
 * @param session - The interrupted session to build a snapshot for
 * @returns Promise<SessionStateSnapshot> - The complete snapshot
 */
export async function buildSessionSnapshot(
  session: InterruptedSession
): Promise<SessionStateSnapshot> {
  const messages = await extractRecentMessages(session.sessionPath);
  const filesAffected = extractFileOperations(messages);
  const toolsUsed = extractToolUsage(messages);
  const pendingOperations = findPendingOperations(messages);
  const conversationContext = extractConversationContext(messages);
  const gitContext = await extractGitContext(messages, session.sessionPath);

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + SNAPSHOT_CONSTANTS.EXPIRY_DAYS * 24 * 60 * 60 * 1000
  );

  return {
    sessionId: session.sessionId,
    capturedAt: now,
    recentMessages: messages,
    filesAffected,
    toolsUsed,
    pendingOperations,
    conversationContext,
    gitContext,
    expiresAt,
  };
}

/**
 * Extracts the last N messages from a session file.
 * Uses streaming to handle large files efficiently.
 */
export async function extractRecentMessages(
  sessionPath: string,
  maxMessages: number = SNAPSHOT_CONSTANTS.MAX_RECENT_MESSAGES
): Promise<SummarizedMessage[]> {
  const messages: SummarizedMessage[] = [];

  return new Promise((resolve) => {
    const stream = fs.createReadStream(sessionPath, { encoding: "utf-8" });
    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    const cleanup = () => {
      rl.close();
      stream.destroy();
    };

    rl.on("line", (line) => {
      if (!line.trim()) return;

      try {
        const msg = JSON.parse(line) as ExtendedTranscriptMessage;
        const summarized = summarizeMessage(msg);

        if (summarized) {
          messages.push(summarized);
          // Keep only the last N messages
          if (messages.length > maxMessages) {
            messages.shift();
          }
        }
      } catch {
        // Skip unparseable lines
      }
    });

    rl.on("close", () => {
      cleanup();
      resolve(messages);
    });

    rl.on("error", () => {
      cleanup();
      resolve(messages);
    });

    stream.on("error", () => {
      cleanup();
      resolve(messages);
    });
  });
}

/**
 * Converts a raw transcript message to a summarized message.
 */
export function summarizeMessage(
  msg: ExtendedTranscriptMessage
): SummarizedMessage | null {
  const validTypes = ["user", "assistant", "tool_use", "tool_result"];

  if (!validTypes.includes(msg.type)) {
    return null;
  }

  const content = extractMessageContent(msg);
  const truncatedContent = truncateContent(
    content,
    SNAPSHOT_CONSTANTS.MAX_CONTENT_LENGTH
  );

  return {
    uuid: msg.uuid || generateUuid(),
    type: msg.type as SummarizedMessage["type"],
    content: truncatedContent,
    timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined,
  };
}

/**
 * Extracts text content from a message.
 */
export function extractMessageContent(msg: ExtendedTranscriptMessage): string {
  const content = msg.content;

  // Handle string content
  if (typeof content === "string") {
    return content;
  }

  // Handle tool_use messages - format tool name and args
  if (msg.type === "tool_use") {
    const toolInfo = msg.toolName || "unknown tool";
    const args = msg.toolInput
      ? JSON.stringify(msg.toolInput).substring(0, 500)
      : "";
    return `[Tool: ${toolInfo}] ${args}`;
  }

  // Handle message wrapper format (common in Claude Code transcripts)
  if (
    typeof content === "object" &&
    content !== null &&
    "message" in (content as Record<string, unknown>)
  ) {
    const message = (content as Record<string, unknown>)
      .message as Record<string, unknown>;
    const messageContent = message?.content;

    if (typeof messageContent === "string") {
      return messageContent;
    }

    if (Array.isArray(messageContent)) {
      return extractFromContentArray(messageContent);
    }
  }

  // Handle array content
  if (Array.isArray(content)) {
    return extractFromContentArray(content);
  }

  // Handle object content
  if (typeof content === "object" && content !== null) {
    return JSON.stringify(content).substring(0, 1000);
  }

  return "";
}

/**
 * Extracts text from a content array.
 */
function extractFromContentArray(content: unknown[]): string {
  return content
    .filter(
      (c): c is { type: string; text: string } =>
        typeof c === "object" &&
        c !== null &&
        (c as Record<string, unknown>).type === "text" &&
        typeof (c as Record<string, unknown>).text === "string"
    )
    .map((c) => c.text)
    .join("\n");
}

/**
 * Truncates content to a maximum length.
 */
export function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.substring(0, maxLength - 3) + "...";
}

/**
 * Extracts file operations from messages.
 */
export function extractFileOperations(
  messages: SummarizedMessage[]
): FileOperation[] {
  const fileOps = new Map<string, FileOperation>();

  for (const msg of messages) {
    if (msg.type !== "tool_use") continue;

    // Parse tool info from content
    const toolMatch = msg.content.match(/\[Tool:\s*(\w+)\]/);
    if (!toolMatch) continue;

    const toolName = toolMatch[1];
    const operation = FILE_TOOLS[toolName];

    if (!operation) continue;

    // Extract file paths from the content
    const paths = extractFilePaths(msg.content);

    for (const filePath of paths) {
      const existing = fileOps.get(filePath);
      if (!existing || (msg.timestamp && msg.timestamp > existing.lastAccessed)) {
        fileOps.set(filePath, {
          path: filePath,
          operation,
          lastAccessed: msg.timestamp || new Date(),
        });
      }
    }
  }

  return Array.from(fileOps.values());
}

/**
 * Extracts file paths from message content.
 */
export function extractFilePaths(content: string): string[] {
  const paths: string[] = [];

  // Look for file_path in JSON
  const filePathMatch = content.match(/"file_path"\s*:\s*"([^"]+)"/);
  if (filePathMatch) {
    paths.push(filePathMatch[1]);
  }

  // Look for path in JSON
  const pathMatch = content.match(/"path"\s*:\s*"([^"]+)"/);
  if (pathMatch && !paths.includes(pathMatch[1])) {
    paths.push(pathMatch[1]);
  }

  // Look for patterns that look like absolute paths
  const absolutePathPattern = /(?:^|[\s"'])(\/?(?:[\w.-]+\/)+[\w.-]+\.\w+)(?:[\s"']|$)/g;
  let match;
  while ((match = absolutePathPattern.exec(content)) !== null) {
    const potentialPath = match[1];
    if (potentialPath.includes("/") && !paths.includes(potentialPath)) {
      paths.push(potentialPath);
    }
  }

  return paths;
}

/**
 * Extracts tool usage statistics from messages.
 */
export function extractToolUsage(
  messages: SummarizedMessage[]
): ToolUsageSummary[] {
  const toolStats = new Map<string, ToolUsageSummary>();

  for (const msg of messages) {
    if (msg.type !== "tool_use") continue;

    // Parse tool info from content
    const toolMatch = msg.content.match(/\[Tool:\s*(\w+)\]/);
    if (!toolMatch) continue;

    const toolName = toolMatch[1];
    const existing = toolStats.get(toolName);

    // Try to extract args from the content after the tool name
    const argsStart = msg.content.indexOf("]") + 1;
    let args: Record<string, unknown> = {};
    if (argsStart > 0) {
      const argsStr = msg.content.substring(argsStart).trim();
      try {
        args = JSON.parse(argsStr);
      } catch {
        // If not valid JSON, store as raw content
        args = { raw: argsStr.substring(0, 200) };
      }
    }

    if (existing) {
      existing.count++;
      existing.lastArgs = args;
      existing.lastInvokedAt = msg.timestamp || new Date();
    } else {
      toolStats.set(toolName, {
        name: toolName,
        count: 1,
        lastArgs: args,
        lastInvokedAt: msg.timestamp || new Date(),
      });
    }
  }

  return Array.from(toolStats.values()).sort((a, b) => b.count - a.count);
}

/**
 * Finds tool_use messages that don't have matching tool_result.
 */
export function findPendingOperations(
  messages: SummarizedMessage[]
): PendingOperation[] {
  const pending: PendingOperation[] = [];
  const toolUseMessages: SummarizedMessage[] = [];
  const completedToolIds = new Set<string>();

  // First pass: collect all tool_use messages and completed tool IDs
  for (const msg of messages) {
    if (msg.type === "tool_use") {
      toolUseMessages.push(msg);
    } else if (msg.type === "tool_result") {
      // Try to find the tool ID from the message
      const toolIdMatch = msg.content.match(/"toolUseId"\s*:\s*"([^"]+)"/);
      if (toolIdMatch) {
        completedToolIds.add(toolIdMatch[1]);
      }
      // Also consider any tool_result as completing the most recent tool_use
      // if we don't have explicit ID matching
    }
  }

  // For simplicity, consider the last tool_use as potentially pending
  // if there's no tool_result after it
  let lastToolUseIndex = -1;
  let hasToolResultAfter = false;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.type === "tool_use" && lastToolUseIndex === -1) {
      lastToolUseIndex = i;
    }
    if (msg.type === "tool_result" && lastToolUseIndex === -1) {
      hasToolResultAfter = true;
    }
  }

  if (lastToolUseIndex !== -1 && !hasToolResultAfter) {
    const msg = messages[lastToolUseIndex];
    const toolMatch = msg.content.match(/\[Tool:\s*(\w+)\]/);
    if (toolMatch) {
      const argsStart = msg.content.indexOf("]") + 1;
      let args: Record<string, unknown> = {};
      if (argsStart > 0) {
        const argsStr = msg.content.substring(argsStart).trim();
        try {
          args = JSON.parse(argsStr);
        } catch {
          args = { raw: argsStr.substring(0, 200) };
        }
      }

      pending.push({
        toolName: toolMatch[1],
        args,
        startedAt: msg.timestamp || new Date(),
      });
    }
  }

  return pending;
}

/**
 * Extracts conversation context from messages.
 */
export function extractConversationContext(
  messages: SummarizedMessage[]
): ConversationContext {
  let initialTask = "";
  let currentTask = "";
  let lastAction = "";
  const errors: string[] = [];
  const blockers: string[] = [];

  // Find first and last user messages for task context
  for (const msg of messages) {
    if (msg.type === "user") {
      if (!initialTask) {
        initialTask = truncateContent(msg.content, SNAPSHOT_CONSTANTS.MAX_TASK_LENGTH);
      }
      currentTask = truncateContent(msg.content, SNAPSHOT_CONSTANTS.MAX_TASK_LENGTH);
    }

    // Track last action
    if (msg.type === "assistant" || msg.type === "tool_use") {
      lastAction = truncateContent(msg.content, 200);
    }

    // Extract errors
    for (const pattern of ERROR_PATTERNS) {
      if (pattern.test(msg.content)) {
        const errorLine = extractRelevantLine(msg.content, pattern);
        if (errorLine && !errors.includes(errorLine)) {
          errors.push(errorLine);
          if (errors.length >= 5) break;
        }
      }
    }

    // Extract blockers
    for (const pattern of BLOCKER_PATTERNS) {
      if (pattern.test(msg.content)) {
        const blockerLine = extractRelevantLine(msg.content, pattern);
        if (blockerLine && !blockers.includes(blockerLine)) {
          blockers.push(blockerLine);
          if (blockers.length >= 5) break;
        }
      }
    }
  }

  return {
    initialTask,
    currentTask,
    lastAction,
    errors: errors.slice(0, 5),
    blockers: blockers.slice(0, 5),
  };
}

/**
 * Extracts a relevant line containing a pattern match.
 */
function extractRelevantLine(content: string, pattern: RegExp): string {
  const lines = content.split("\n");
  for (const line of lines) {
    if (pattern.test(line)) {
      return truncateContent(line.trim(), 200);
    }
  }
  return "";
}

/**
 * Extracts git context from messages and local git state.
 */
export async function extractGitContext(
  messages: SummarizedMessage[],
  sessionPath: string
): Promise<GitContext | null> {
  let branch = "";
  let lastGitOperation: string | null = null;
  let hasUncommittedChanges = false;

  // Try to extract git info from messages
  for (const msg of messages) {
    // Look for git commands in tool_use messages (Bash tool)
    if (msg.type === "tool_use" && msg.content.includes("git")) {
      // Extract git operation
      const cmdMatch = msg.content.match(GIT_COMMAND_PATTERN);
      if (cmdMatch) {
        lastGitOperation = cmdMatch[0];
      }

      // Extract branch name
      let branchMatch;
      while ((branchMatch = GIT_BRANCH_PATTERN.exec(msg.content)) !== null) {
        branch = branchMatch[1];
      }
      // Reset regex lastIndex for next iteration
      GIT_BRANCH_PATTERN.lastIndex = 0;
    }

    // Look for branch names in tool_result or assistant messages
    if (!branch) {
      const branchNameMatch = msg.content.match(
        /(?:On branch|checked out|switched to|branch\s*['":]?\s*)([a-zA-Z0-9/_-]+)/i
      );
      if (branchNameMatch) {
        branch = branchNameMatch[1];
      }
    }
  }

  // If we couldn't find branch from messages, try local git
  if (!branch) {
    const projectDir = extractProjectDir(sessionPath);
    if (projectDir) {
      try {
        const gitBranch = await getGitBranch(projectDir);
        if (gitBranch) {
          branch = gitBranch;
        }
      } catch {
        // Git not available or not a git repo
      }
    }
  }

  // Check for uncommitted changes from messages
  for (const msg of messages) {
    if (
      msg.content.includes("Changes not staged") ||
      msg.content.includes("Changes to be committed") ||
      msg.content.includes("modified:") ||
      msg.content.includes("Untracked files")
    ) {
      hasUncommittedChanges = true;
      break;
    }
  }

  // If we have any git context, return it
  if (branch || lastGitOperation || hasUncommittedChanges) {
    return {
      branch: branch || "unknown",
      hasUncommittedChanges,
      lastGitOperation,
    };
  }

  return null;
}

/**
 * Extracts the project directory from a session path.
 * Session path format: ~/.claude/projects/-Users-username-project-name/session.jsonl
 */
export function extractProjectDir(sessionPath: string): string | null {
  const projectDir = path.dirname(sessionPath);
  const projectName = path.basename(projectDir);

  // Convert normalized path back to real path
  // e.g., "-Users-username-project" -> "/Users/username/project"
  if (projectName.startsWith("-")) {
    const realPath = "/" + projectName.slice(1).replace(/-/g, "/");
    return realPath;
  }

  return null;
}

/**
 * Gets the current git branch for a directory.
 */
export async function getGitBranch(directory: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync("git rev-parse --abbrev-ref HEAD", {
      cwd: directory,
      timeout: 2000,
    });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Generates a simple UUID for messages without one.
 */
function generateUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
