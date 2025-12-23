/**
 * Transcript Module - Story 15
 *
 * Module for discovering, parsing, and extracting data from Claude Code transcript files.
 */

// Types - Discovery
export type {
  DiscoveredProject,
  DiscoverySummary,
  DiscoveryOptions,
  FileInfo,
} from './types';

// Types - Parser
export type {
  TranscriptMessage,
  TranscriptMessageContent,
  MessageType,
  TokenUsage,
  ContentBlock,
  TextBlock,
  ToolUseBlock,
  ToolResultBlock,
  ThinkingBlock,
  ParseStats,
  ParseResult,
  ParseOptions,
} from './parser';

// Types - Extraction
export type {
  ExtractedPrompt,
  ExtractionStats,
  ExtractionResult,
} from './extract-prompts';

// Discovery functions
export {
  discoverTranscripts,
  getProjectTranscripts,
  denormalizePath,
  normalizePath,
  getClaudeProjectsDir,
  isPathSafe,
  estimatePromptCount,
} from './discover';

// Parser functions
export {
  streamParseTranscript,
  parseTranscript,
  extractContentBlocks,
  extractTextContent,
  extractToolUseBlocks,
  extractToolResultBlocks,
  extractThinkingBlocks,
} from './parser';

// Extraction functions
export {
  extractPrompts,
  extractPromptsFromSession,
  isUserPrompt,
  isToolResult,
} from './extract-prompts';
