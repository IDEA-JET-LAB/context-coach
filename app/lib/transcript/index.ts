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

// Types - Response Extraction (Story 26-4)
export type {
  RawAssistantMessage,
  AssistantMessageInner,
  TextContentBlock,
  ThinkingContentBlock,
  ToolUseContentBlock,
  ToolResultContentBlock,
  ContentBlock as RawContentBlock,
  Usage,
  ToolUse,
  ThinkingResult,
  CacheStats,
  ExtractedResponse as RawExtractedResponse,
} from './extractResponse';

// Response extraction functions (Story 26-4)
export {
  extractResponse,
  extractResponses as extractRawResponses,
  extractTextContent as extractRawTextContent,
  extractThinkingContent,
  extractToolUses,
  extractCacheStats,
  isRawAssistantMessage,
} from './extractResponse';

// Types - Thinking Compressor
export type { ThinkingSummary, ThinkingCompressionResult } from './thinkingCompressor';

// Thinking compression functions
export {
  compressThinking,
  countWords,
  findLastSentenceBoundary,
  findLastWordBoundary,
  MAX_THINKING_LENGTH,
  SENTENCE_BOUNDARY_THRESHOLD,
} from './thinkingCompressor';
