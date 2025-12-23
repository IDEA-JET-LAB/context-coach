/**
 * Batch Processor - Story 17-3: Batch Import Processing
 *
 * Handles batch upload of prompts to the server with retry logic.
 * Processes prompts in configurable batches (default: 100) and
 * implements exponential backoff for transient errors.
 *
 * Key functions:
 * - importProject: Import all sessions from a project directory
 * - uploadBatchWithRetry: Upload a batch with retry logic
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { extractPairsFromSession } from './parser';
import { addFingerprints } from './dedup';
import type {
  PromptWithFingerprint,
  BatchUploadResult,
  ImportResult,
  BatchUploadRequest,
} from './types';

/** Batch size for uploads (PRD requirement) */
export const BATCH_SIZE = 100;

/** Maximum number of retry attempts */
export const MAX_RETRIES = 3;

/** Retry delays in milliseconds (exponential backoff) */
export const RETRY_DELAYS = [1000, 2000, 4000];

/** Configuration for batch uploads */
export interface BatchUploadConfig {
  /** Base API URL */
  apiUrl: string;
  /** Unique import operation ID */
  importId: string;
  /** Team ID for the import */
  teamId: string;
  /** User ID for the import */
  userId: string;
  /** Project path (for context) */
  projectPath?: string;
}

/**
 * Sleep for a specified duration.
 *
 * @param ms - Duration in milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determine if an error is retryable.
 *
 * Non-retryable errors:
 * - Validation errors (400)
 * - Auth errors (401, 403)
 *
 * Retryable errors:
 * - Network errors (fetch failed, ECONNRESET, etc.)
 * - Server errors (500, 502, 503)
 * - Timeout errors
 * - Rate limit errors (429)
 *
 * @param error - The error to check
 * @returns True if the error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Non-retryable: validation errors
  if (message.includes('validation')) return false;

  // Non-retryable: auth errors
  if (message.includes('401') || message.includes('403')) return false;
  if (message.includes('unauthorized') || message.includes('forbidden')) return false;

  // Retryable: network errors
  if (message.includes('network')) return true;
  if (message.includes('econnreset') || message.includes('econnrefused')) return true;
  if (message.includes('fetch failed')) return true;

  // Retryable: server errors
  if (message.includes('500') || message.includes('502') || message.includes('503')) return true;
  if (message.includes('internal server error')) return true;
  if (message.includes('bad gateway') || message.includes('service unavailable')) return true;

  // Retryable: timeout
  if (message.includes('timeout') || message.includes('etimedout')) return true;

  // Retryable: rate limit
  if (message.includes('429') || message.includes('too many requests')) return true;

  // Default: assume retryable for unknown errors
  return true;
}

/**
 * Upload a batch of prompts with retry logic.
 *
 * Implements exponential backoff:
 * - Attempt 1: Immediate
 * - Attempt 2: After 1 second
 * - Attempt 3: After 2 seconds
 * - Attempt 4: After 4 seconds
 *
 * @param batch - Array of prompts with fingerprints
 * @param config - Upload configuration
 * @returns Batch upload result
 */
export async function uploadBatchWithRetry(
  batch: PromptWithFingerprint[],
  config: BatchUploadConfig
): Promise<BatchUploadResult> {
  const endpoint = `${config.apiUrl}/api/import/batch`;

  const payload: BatchUploadRequest = {
    pairs: batch,
    importId: config.importId,
    teamId: config.teamId,
    userId: config.userId,
    projectPath: config.projectPath || '',
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const status = response.status;
        let errorMessage = `HTTP ${status}`;

        try {
          const errorBody = await response.json();
          errorMessage = errorBody.error || errorMessage;
        } catch {
          // Ignore JSON parse errors
        }

        const error = new Error(errorMessage);

        // Don't retry non-retryable errors
        if (!isRetryableError(error)) {
          return { success: false, imported: 0, skipped: 0, error: errorMessage };
        }

        throw error;
      }

      const result = await response.json();
      return {
        success: true,
        imported: result.imported || 0,
        skipped: result.skipped || 0,
      };
    } catch (error) {
      const err = error as Error;

      // Check if error is retryable
      if (!isRetryableError(err)) {
        return { success: false, imported: 0, skipped: 0, error: err.message };
      }

      // Last attempt failed
      if (attempt === MAX_RETRIES) {
        return {
          success: false,
          imported: 0,
          skipped: 0,
          error: `Failed after ${MAX_RETRIES} retries: ${err.message}`,
        };
      }

      // Log retry attempt
      console.warn(
        `[import/batch] Upload attempt ${attempt + 1} failed, retrying in ${RETRY_DELAYS[attempt]}ms:`,
        err.message
      );

      // Wait before retry with exponential backoff
      await sleep(RETRY_DELAYS[attempt]!);
    }
  }

  // Should never reach here, but TypeScript needs a return
  return { success: false, imported: 0, skipped: 0, error: 'Unknown error' };
}

/**
 * List all JSONL session files in a project directory.
 *
 * @param projectPath - Path to the project directory
 * @returns Array of absolute paths to JSONL files
 */
async function listSessions(projectPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(projectPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
      .map((entry) => path.join(projectPath, entry.name));
  } catch (error) {
    console.error(`[import/batch] Failed to list sessions in ${projectPath}:`, error);
    return [];
  }
}

/**
 * Import all prompts from a project directory.
 *
 * Processes each JSONL session file, extracts prompts, adds fingerprints,
 * and uploads in batches. Continues processing when individual sessions fail.
 *
 * @param projectPath - Path to the project directory
 * @param config - Upload configuration
 * @param onProgress - Progress callback (session index, total sessions)
 * @returns Import result with success/failure counts
 *
 * @example
 * ```ts
 * const result = await importProject('/path/to/project', config, (done, total) => {
 *   console.log(`Processed ${done}/${total} sessions`);
 * });
 * console.log(`Imported ${result.success}, skipped ${result.skipped}, failed ${result.failed}`);
 * ```
 */
export async function importProject(
  projectPath: string,
  config: BatchUploadConfig,
  onProgress: (processed: number, total: number) => void
): Promise<ImportResult> {
  const sessions = await listSessions(projectPath);
  let success = 0;
  let failed = 0;
  let skipped = 0;
  const failedSessions: string[] = [];

  for (let sessionIndex = 0; sessionIndex < sessions.length; sessionIndex++) {
    const sessionPath = sessions[sessionIndex]!;

    try {
      // Extract pairs from session
      const pairs = await extractPairsFromSession(sessionPath);

      if (pairs.length === 0) {
        // Empty session, skip
        onProgress(sessionIndex + 1, sessions.length);
        continue;
      }

      // Add fingerprints for deduplication
      const pairsWithFingerprints = addFingerprints(config.userId, pairs);

      // Process in batches
      for (let i = 0; i < pairsWithFingerprints.length; i += BATCH_SIZE) {
        const batch = pairsWithFingerprints.slice(i, i + BATCH_SIZE);
        const result = await uploadBatchWithRetry(batch, {
          ...config,
          projectPath,
        });

        if (result.success) {
          success += result.imported;
          skipped += result.skipped;
        } else {
          failed += batch.length;
          console.error(
            `[import/batch] Batch upload failed for session ${sessionPath}:`,
            result.error
          );
        }
      }
    } catch (error) {
      console.error(
        `[import/batch] Failed to process session ${sessionPath}:`,
        error
      );
      failedSessions.push(sessionPath);
      failed += 1;
    }

    onProgress(sessionIndex + 1, sessions.length);
  }

  return { success, failed, skipped, failedSessions };
}

/**
 * Upload a single batch of prompts (for direct use without project scanning).
 *
 * This is useful when pairs are already extracted and fingerprinted.
 *
 * @param batch - Array of prompts with fingerprints
 * @param config - Upload configuration
 * @returns Batch upload result
 */
export async function uploadBatch(
  batch: PromptWithFingerprint[],
  config: BatchUploadConfig
): Promise<BatchUploadResult> {
  return uploadBatchWithRetry(batch, config);
}
