/**
 * Import System - Epic 17
 *
 * Historical import functionality for Claude Code transcripts.
 */

// Types
export type {
  DiscoveredProject,
  DiscoveryOptions,
  DiscoveryResult,
  SkippedDirectory,
  TranscriptFileInfo,
  ProjectTranscriptsResult,
  ImportState,
  // Story 17-3: Parser and batch types
  ParsedMessage,
  BatchUploadRequest,
  BatchUploadResponse,
  OrchestratorProgress,
  OrchestratorResult,
  // Story 17-4: Deduplication types
  BatchUploadResult,
  ImportResult,
  PromptResponsePair,
  PromptWithFingerprint,
  DedupResult,
} from './types';

// Discovery functions
export {
  discoverProjects,
  getProjectTranscripts,
  getClaudeProjectsDir,
  getDefaultDateRange,
  isWithinDateRange,
  denormalizePath,
  normalizePath,
  isPathSafe,
  validatePathFormat,
  estimatePromptCount,
  claudeProjectsExist,
} from './discover';

// Fingerprint functions (Story 17-4)
export {
  generatePromptFingerprint,
  normalizeText,
} from './fingerprint';

// Deduplication functions (Story 17-4)
export {
  filterDuplicates,
  addFingerprints,
  checkExistingFingerprints,
} from './dedup';

// Parser functions (Story 17-3)
export {
  extractPairsFromSession,
  parseJsonlFile,
  extractUserContent,
  extractAssistantContent,
  extractTokens,
  pairMessages,
} from './parser';

// Batch processor (Story 17-3)
export {
  BATCH_SIZE,
  MAX_RETRIES,
  RETRY_DELAYS,
  importProject,
  uploadBatch,
  uploadBatchWithRetry,
  sleep,
  isRetryableError,
} from './batch';
export type { BatchUploadConfig } from './batch';

// Orchestrator (Story 17-3)
export {
  importProjects,
  createImportId,
  estimateTimeRemaining,
} from './orchestrator';
