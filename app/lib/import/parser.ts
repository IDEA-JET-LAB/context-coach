/**
 * JSONL Parser - Story 17-3: Batch Import Processing
 *
 * Parses Claude Code JSONL transcript files and extracts prompt-response pairs.
 * Uses streaming to handle large files efficiently.
 *
 * Key functions:
 * - extractPairsFromSession: Main entry point for parsing a session file
 * - parseJsonlFile: Streams and parses JSONL into messages
 * - pairMessages: Matches user prompts with assistant responses
 */

import * as readline from 'readline';
import * as fs from 'fs';
import type { ParsedMessage, PromptResponsePair } from './types';

/**
 * Extract text content from a user message.
 *
 * Handles both string content and array content formats:
 * - String: { content: "text" }
 * - Array: { content: [{ type: "text", text: "..." }, ...] }
 *
 * @param msg - The parsed JSONL message object
 * @returns The extracted text content
 */
export function extractUserContent(msg: Record<string, unknown>): string {
  const message = msg.message as Record<string, unknown> | undefined;
  if (!message) return '';

  const content = message.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((c): c is { type: string; text: string } =>
        typeof c === 'object' && c !== null && (c as Record<string, unknown>).type === 'text'
      )
      .map((c) => c.text)
      .join('\n');
  }

  return '';
}

/**
 * Extract text content from an assistant message.
 *
 * Same as extractUserContent but for assistant responses.
 * Filters out tool_use blocks and only extracts text.
 *
 * @param msg - The parsed JSONL message object
 * @returns The extracted text content
 */
export function extractAssistantContent(msg: Record<string, unknown>): string {
  const message = msg.message as Record<string, unknown> | undefined;
  if (!message) return '';

  const content = message.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((c): c is { type: string; text: string } =>
        typeof c === 'object' && c !== null && (c as Record<string, unknown>).type === 'text'
      )
      .map((c) => c.text)
      .join('\n');
  }

  return '';
}

/**
 * Extract token usage from an assistant message.
 *
 * @param msg - The parsed JSONL message object
 * @returns Token usage object or undefined if not available
 */
export function extractTokens(msg: Record<string, unknown>): { input: number; output: number } | undefined {
  const message = msg.message as Record<string, unknown> | undefined;
  if (!message) return undefined;

  const usage = message.usage as Record<string, unknown> | undefined;
  if (!usage) return undefined;

  return {
    input: (typeof usage.input_tokens === 'number' ? usage.input_tokens : 0),
    output: (typeof usage.output_tokens === 'number' ? usage.output_tokens : 0),
  };
}

/**
 * Parse a JSONL file using streaming.
 *
 * Reads the file line by line to avoid loading entire file into memory.
 * Skips empty lines and malformed JSON (logs warning but continues).
 *
 * @param filePath - Path to the JSONL file
 * @returns Array of parsed messages (user and assistant only)
 */
export async function parseJsonlFile(filePath: string): Promise<ParsedMessage[]> {
  return new Promise((resolve, reject) => {
    const messages: ParsedMessage[] = [];
    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      // Skip empty or whitespace-only lines
      if (!line.trim()) return;

      try {
        const msg = JSON.parse(line) as Record<string, unknown>;

        if (msg.type === 'user') {
          messages.push({
            type: 'user',
            content: extractUserContent(msg),
            timestamp: msg.timestamp as string,
            uuid: msg.uuid as string | undefined,
          });
        } else if (msg.type === 'assistant') {
          const message = msg.message as Record<string, unknown> | undefined;
          messages.push({
            type: 'assistant',
            content: extractAssistantContent(msg),
            timestamp: msg.timestamp as string,
            model: message?.model as string | undefined,
            tokens: extractTokens(msg),
          });
        }
        // Ignore other message types (system, tool_result, etc.)
      } catch {
        // Log and skip malformed lines
        console.warn(`[import/parser] Skipping malformed line in ${filePath}:`, line.substring(0, 100));
      }
    });

    rl.on('close', () => {
      stream.destroy();
      resolve(messages);
    });

    rl.on('error', (err) => {
      stream.destroy();
      reject(err);
    });

    stream.on('error', (err) => {
      rl.close();
      reject(err);
    });
  });
}

/**
 * Pair user messages with subsequent assistant responses.
 *
 * Matching rules:
 * - Each user message becomes a prompt
 * - If the next message is an assistant message, it becomes the response
 * - If there's no assistant message (interrupted session), response is undefined
 * - Orphan assistant messages (no preceding user) are skipped
 *
 * @param messages - Array of parsed messages
 * @returns Array of prompt-response pairs
 */
export function pairMessages(messages: ParsedMessage[]): PromptResponsePair[] {
  const pairs: PromptResponsePair[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;

    if (msg.type === 'user') {
      // Check if next message is an assistant response
      const nextMsg = messages[i + 1];
      const response = nextMsg?.type === 'assistant' ? nextMsg : undefined;

      pairs.push({
        prompt: {
          text: msg.content,
          timestamp: msg.timestamp,
          uuid: msg.uuid,
        },
        response: response
          ? {
              text: response.content,
              timestamp: response.timestamp,
              model: response.model,
              tokens: response.tokens,
            }
          : undefined,
      });
    }
    // Skip standalone assistant messages (orphans)
  }

  return pairs;
}

/**
 * Extract prompt-response pairs from a session JSONL file.
 *
 * Main entry point for parsing. Combines parsing and pairing:
 * 1. Parse JSONL file using streaming
 * 2. Pair user messages with assistant responses
 *
 * @param sessionPath - Path to the session JSONL file
 * @returns Array of prompt-response pairs
 *
 * @example
 * ```ts
 * const pairs = await extractPairsFromSession('/path/to/session.jsonl');
 * for (const pair of pairs) {
 *   console.log(`Prompt: ${pair.prompt.text}`);
 *   console.log(`Response: ${pair.response?.text ?? 'No response'}`);
 * }
 * ```
 */
export async function extractPairsFromSession(sessionPath: string): Promise<PromptResponsePair[]> {
  const messages = await parseJsonlFile(sessionPath);
  return pairMessages(messages);
}
