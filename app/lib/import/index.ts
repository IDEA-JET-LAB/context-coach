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
