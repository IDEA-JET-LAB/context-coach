/**
 * Deduplication Module - Story 17-4
 *
 * Provides functions for detecting and filtering duplicate prompts during import.
 * Uses fingerprints to identify prompts that already exist in the database.
 *
 * Key Functions:
 * - addFingerprints: Add fingerprints to prompt pairs
 * - checkExistingFingerprints: Check which fingerprints exist in database
 * - filterDuplicates: Complete deduplication flow
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PromptResponsePair,
  PromptWithFingerprint,
  DedupResult,
} from './types';
import { generatePromptFingerprint } from './fingerprint';

/**
 * Chunk size for database queries.
 * PostgreSQL has a limit on the number of parameters in IN clause.
 * 1000 is a safe, performant chunk size.
 */
const CHUNK_SIZE = 1000;

/**
 * Adds fingerprints to prompt pairs for deduplication.
 *
 * Each prompt pair gets a fingerprint computed from:
 * - userId
 * - timestamp (minute precision)
 * - text (first 200 chars, normalized)
 *
 * @param userId - The user's UUID
 * @param pairs - Array of prompt-response pairs
 * @returns Array of pairs with fingerprints added
 *
 * @example
 * const pairsWithFp = addFingerprints('user-id', [
 *   { prompt: { text: 'Hello', timestamp: '2025-01-15T10:30:00Z' } }
 * ]);
 * // pairsWithFp[0].fingerprint = 'a1b2c3d4e5f67890'
 */
export function addFingerprints(
  userId: string,
  pairs: PromptResponsePair[]
): PromptWithFingerprint[] {
  return pairs.map((pair) => ({
    ...pair,
    fingerprint: generatePromptFingerprint(
      userId,
      pair.prompt.timestamp,
      pair.prompt.text
    ),
  }));
}

/**
 * Checks which fingerprints already exist in the database.
 *
 * Handles large arrays by chunking queries to avoid PostgreSQL limits.
 *
 * @param fingerprints - Array of fingerprint strings to check
 * @param supabase - Supabase client instance
 * @returns Set of fingerprints that exist in the database
 * @throws Error if database query fails
 *
 * @example
 * const existing = await checkExistingFingerprints(['abc123', 'def456'], supabase);
 * if (existing.has('abc123')) {
 *   // This fingerprint exists in the database
 * }
 */
export async function checkExistingFingerprints(
  fingerprints: string[],
  supabase: SupabaseClient
): Promise<Set<string>> {
  if (fingerprints.length === 0) {
    return new Set();
  }

  const existingFingerprints = new Set<string>();

  // Query in chunks to avoid PostgreSQL parameter limits
  for (let i = 0; i < fingerprints.length; i += CHUNK_SIZE) {
    const chunk = fingerprints.slice(i, i + CHUNK_SIZE);

    const { data, error } = await supabase
      .from('prompts')
      .select('fingerprint')
      .in('fingerprint', chunk);

    if (error) {
      throw new Error(`Failed to check existing fingerprints: ${error.message}`);
    }

    data?.forEach((row) => {
      if (row.fingerprint) {
        existingFingerprints.add(row.fingerprint);
      }
    });
  }

  return existingFingerprints;
}

/**
 * Filters out duplicate prompts from a batch before import.
 *
 * Performs two levels of deduplication:
 * 1. Database deduplication: Removes prompts that already exist in the database
 * 2. Batch deduplication: Removes duplicates within the batch itself
 *
 * This ensures:
 * - Hook-captured prompts are not re-imported from historical transcripts
 * - Duplicate prompts within a single import batch are consolidated
 *
 * @param userId - The user's UUID
 * @param pairs - Array of prompt-response pairs to filter
 * @param supabase - Supabase client instance
 * @returns Object containing new pairs and duplicate count
 *
 * @example
 * const { newPairs, duplicateCount } = await filterDuplicates(
 *   'user-id',
 *   importedPairs,
 *   supabase
 * );
 * console.log(`Skipping ${duplicateCount} duplicates, importing ${newPairs.length}`);
 */
export async function filterDuplicates(
  userId: string,
  pairs: PromptResponsePair[],
  supabase: SupabaseClient
): Promise<DedupResult> {
  if (pairs.length === 0) {
    return {
      newPairs: [],
      duplicateCount: 0,
    };
  }

  // Step 1: Add fingerprints to all pairs
  const pairsWithFingerprints = addFingerprints(userId, pairs);

  // Step 2: Deduplicate within the batch itself
  // Use a Map to keep only the first occurrence of each fingerprint
  const uniqueByFingerprint = new Map<string, PromptWithFingerprint>();
  let batchDuplicates = 0;

  for (const pair of pairsWithFingerprints) {
    if (!uniqueByFingerprint.has(pair.fingerprint)) {
      uniqueByFingerprint.set(pair.fingerprint, pair);
    } else {
      batchDuplicates++;
    }
  }

  // Step 3: Check which remaining fingerprints exist in database
  const uniqueFingerprints = Array.from(uniqueByFingerprint.keys());
  const existingInDb = await checkExistingFingerprints(
    uniqueFingerprints,
    supabase
  );

  // Step 4: Filter out database duplicates
  const newPairs: PromptWithFingerprint[] = [];
  let dbDuplicates = 0;

  for (const [fingerprint, pair] of uniqueByFingerprint) {
    if (existingInDb.has(fingerprint)) {
      dbDuplicates++;
    } else {
      newPairs.push(pair);
    }
  }

  return {
    newPairs,
    duplicateCount: batchDuplicates + dbDuplicates,
  };
}
