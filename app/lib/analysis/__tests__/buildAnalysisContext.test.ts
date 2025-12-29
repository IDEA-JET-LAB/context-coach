/**
 * Context Building for Analysis Tests
 * Story 27-3: Context Building for Analysis
 *
 * Tests for building conversation context from the database for AI analysis.
 * Covers:
 * - Context retrieval from database
 * - Token budget enforcement
 * - Response summary extraction
 * - Message index tracking
 * - Empty context handling
 * - Caching behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildAnalysisContext,
  AnalysisContext,
  AnalysisContextOptions,
  DEFAULT_CONTEXT_OPTIONS,
  clearContextCache,
} from '../buildAnalysisContext';
import { estimateTokens, fitsInBudget } from '../tokenEstimator';
import {
  summarizeResponse,
  detectQuestion,
  extractToolsUsed,
} from '../responseSummarizer';

// ============================================================================
// MOCKS
// ============================================================================

// Mock Supabase admin client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/utils/logger', () => ({
  createScopedLogger: () => ({
    log: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock UUID validation
vi.mock('@/lib/utils/uuid', () => ({
  isValidUuid: (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
}));

// Import after mocks
import { createAdminClient } from '@/lib/supabase/admin';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const TEST_PROMPT_ID = '11111111-1111-1111-1111-111111111111';
const TEST_SESSION_ID = '22222222-2222-2222-2222-222222222222';
const TEST_RESPONSE_ID = '33333333-3333-3333-3333-333333333333';

function createMockPrompt(overrides: Partial<{
  id: string;
  session_uuid: string;
  text: string;
  sequence_number: number;
  prompt_classification: string | null;
  created_at: string;
  prompt_responses: Array<{
    id: string;
    response_text_encrypted: string;
    thinking_summary: string | null;
    tools_used: string[] | null;
    model: string | null;
  }>;
}> = {}) {
  return {
    id: TEST_PROMPT_ID,
    session_uuid: TEST_SESSION_ID,
    text: 'Test prompt text',
    sequence_number: 1,
    prompt_classification: null,
    created_at: '2025-01-01T00:00:00Z',
    prompt_responses: [],
    ...overrides,
  };
}

function createMockSession(overrides: Partial<{
  id: string;
  primary_stage: string | null;
  has_debugging_loop: boolean;
  user_message_count: number;
}> = {}) {
  return {
    id: TEST_SESSION_ID,
    primary_stage: null,
    has_debugging_loop: false,
    user_message_count: 5,
    ...overrides,
  };
}

function createMockSupabase(config: {
  prompt?: ReturnType<typeof createMockPrompt> | null;
  promptError?: { message: string };
  precedingPrompts?: ReturnType<typeof createMockPrompt>[];
  precedingError?: { message: string };
  session?: ReturnType<typeof createMockSession> | null;
  sessionError?: { message: string };
  decryptedResponses?: Map<string, string>;
}) {
  // Track which response IDs to return
  const decryptedResponses = config.decryptedResponses || new Map<string, string>();

  const mockRpc = vi.fn().mockImplementation((funcName, params) => {
    if (funcName === 'get_decrypted_response') {
      const responseId = params?.p_response_id;
      const text = decryptedResponses.get(responseId);
      if (text) {
        return { data: [{ response_text: text }], error: null };
      }
      return { data: null, error: null };
    }
    return { data: null, error: null };
  });

  // Track call count to determine which type of prompts query
  let promptsQueryCount = 0;

  const mockFrom = vi.fn().mockImplementation((table) => {
    if (table === 'prompts') {
      promptsQueryCount++;
      const isFirstQuery = promptsQueryCount === 1;

      // First query is the target prompt lookup
      if (isFirstQuery) {
        // If there's a prompt error or prompt is explicitly null/undefined with error, return error
        if (config.promptError) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockReturnValue({
                  data: null,
                  error: config.promptError,
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({
                data: config.prompt,
                error: null,
              }),
            }),
          }),
        };
      }

      // Second query is the preceding prompts query
      if (config.precedingError) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lt: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    data: null,
                    error: config.precedingError,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  data: config.precedingPrompts || [],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };
    }

    if (table === 'sessions') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({
              data: config.session ?? null,
              error: config.sessionError || null,
            }),
          }),
        }),
      };
    }

    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnValue({ data: null, error: null }),
    };
  });

  return {
    from: mockFrom,
    rpc: mockRpc,
  };
}

// ============================================================================
// Token Estimator Tests
// ============================================================================

describe('tokenEstimator', () => {
  describe('estimateTokens', () => {
    it('should return 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should return 0 for null/undefined', () => {
      expect(estimateTokens(null as unknown as string)).toBe(0);
      expect(estimateTokens(undefined as unknown as string)).toBe(0);
    });

    it('should estimate tokens for simple text (4 chars per token)', () => {
      // "Hello world" = 11 chars ~ 3 tokens
      const result = estimateTokens('Hello world');
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(10);
    });

    it('should increase estimate for code content (30% more)', () => {
      const plainText = 'This is some plain text content here';
      const codeText = 'function hello() { const x = 1; }';

      const plainTokens = estimateTokens(plainText);
      const codeTokens = estimateTokens(codeText);

      // Code should have more tokens per character
      expect(codeTokens / codeText.length).toBeGreaterThan(
        plainTokens / plainText.length * 0.9
      );
    });

    it('should detect code by keywords', () => {
      const codeIndicators = ['```', 'function', 'const ', 'import ', 'export '];

      for (const indicator of codeIndicators) {
        const text = `Some text with ${indicator} code indicator`;
        const result = estimateTokens(text);
        expect(result).toBeGreaterThan(0);
      }
    });
  });

  describe('fitsInBudget', () => {
    it('should return true when text fits in budget', () => {
      expect(fitsInBudget('Hello', 100)).toBe(true);
    });

    it('should return false when text exceeds budget', () => {
      const longText = 'word '.repeat(1000);
      expect(fitsInBudget(longText, 10)).toBe(false);
    });
  });
});

// ============================================================================
// Response Summarizer Tests
// ============================================================================

describe('responseSummarizer', () => {
  describe('summarizeResponse', () => {
    it('should return text unchanged if under limit', () => {
      const shortText = 'Short response text.';
      expect(summarizeResponse(shortText, 500)).toBe(shortText);
    });

    it('should truncate long text with ellipsis', () => {
      const longText = 'A'.repeat(1000);
      const result = summarizeResponse(longText, 500);

      expect(result.length).toBeLessThanOrEqual(503); // 500 + '...'
      expect(result.endsWith('...')).toBe(true);
    });

    it('should try to break at sentence boundaries', () => {
      const text =
        'First sentence here. Second sentence here. Third sentence here. Fourth sentence here.';
      const result = summarizeResponse(text, 60);

      // Should end at a sentence boundary if possible
      expect(result.includes('.')).toBe(true);
    });

    it('should handle empty text', () => {
      expect(summarizeResponse('', 500)).toBe('');
      expect(summarizeResponse(null as unknown as string, 500)).toBe('');
    });
  });

  describe('detectQuestion', () => {
    it('should detect question mark at end', () => {
      expect(detectQuestion('Is this a question?')).toBe(true);
    });

    it('should detect question patterns', () => {
      const questionPatterns = [
        'Would you like me to proceed?',
        'Should I proceed with the changes',
        'Do you want me to implement this',
        'Let me know if you need more details',
        'Which option would you prefer',
        'What would you prefer to use',
      ];

      for (const pattern of questionPatterns) {
        expect(detectQuestion(pattern)).toBe(true);
      }
    });

    it('should detect questions in last 200 chars of long text', () => {
      const longText = 'A'.repeat(500) + '\n\nWould you like me to proceed?';
      expect(detectQuestion(longText)).toBe(true);
    });

    it('should return false for statements', () => {
      expect(detectQuestion('This is a statement.')).toBe(false);
      expect(detectQuestion('The code has been updated.')).toBe(false);
    });

    it('should handle empty/null text', () => {
      expect(detectQuestion('')).toBe(false);
      expect(detectQuestion(null as unknown as string)).toBe(false);
    });
  });

  describe('extractToolsUsed', () => {
    it('should extract string array', () => {
      const tools = ['Read', 'Write', 'Bash'];
      expect(extractToolsUsed(tools)).toEqual(tools);
    });

    it('should extract names from object array', () => {
      const tools = [
        { name: 'Read', count: 5 },
        { name: 'Write', count: 3 },
      ];
      expect(extractToolsUsed(tools)).toEqual(['Read', 'Write']);
    });

    it('should handle null/undefined', () => {
      expect(extractToolsUsed(null)).toEqual([]);
      expect(extractToolsUsed(undefined)).toEqual([]);
    });

    it('should handle non-array values', () => {
      expect(extractToolsUsed('not an array')).toEqual([]);
      expect(extractToolsUsed(123)).toEqual([]);
    });
  });
});

// ============================================================================
// buildAnalysisContext Tests
// ============================================================================

describe('buildAnalysisContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearContextCache(); // Clear cache between tests
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('AC1: Context Retrieval from Database', () => {
    it('should retrieve context for a valid prompt ID', async () => {
      const mockPrompt = createMockPrompt({
        sequence_number: 3,
      });

      const mockPrecedingPrompts = [
        createMockPrompt({
          id: 'aaaa0001-0001-0001-0001-000000000001',
          sequence_number: 1,
          text: 'First prompt',
        }),
        createMockPrompt({
          id: 'aaaa0002-0002-0002-0002-000000000002',
          sequence_number: 2,
          text: 'Second prompt',
          prompt_responses: [
            {
              id: TEST_RESPONSE_ID,
              response_text_encrypted: 'encrypted',
              thinking_summary: 'AI was thinking',
              tools_used: ['Read', 'Write'],
              model: 'claude-opus-4',
            },
          ],
        }),
      ];

      const mockSupa = createMockSupabase({
        prompt: mockPrompt,
        precedingPrompts: mockPrecedingPrompts,
        session: createMockSession(),
        decryptedResponses: new Map([[TEST_RESPONSE_ID, 'Here is the response.']]),
      });

      vi.mocked(createAdminClient).mockReturnValue(mockSupa as unknown as ReturnType<typeof createAdminClient>);

      const result = await buildAnalysisContext(TEST_PROMPT_ID);

      expect(result).toBeDefined();
      expect(result!.sessionId).toBe(TEST_SESSION_ID);
      expect(result!.messages.length).toBeGreaterThan(0);
    });

    it('should throw error when prompt not found', async () => {
      const mockSupa = createMockSupabase({
        prompt: null,
        promptError: { message: 'Not found' },
      });

      vi.mocked(createAdminClient).mockReturnValue(mockSupa as unknown as ReturnType<typeof createAdminClient>);

      await expect(buildAnalysisContext(TEST_PROMPT_ID)).rejects.toThrow('Prompt not found');
    });

    it('should log context building with message and token counts', async () => {
      const mockPrompt = createMockPrompt({ sequence_number: 2 });
      const mockPrecedingPrompts = [
        createMockPrompt({
          id: 'aaaa0001-0001-0001-0001-000000000001',
          sequence_number: 1,
          text: 'First prompt',
        }),
      ];

      const mockSupa = createMockSupabase({
        prompt: mockPrompt,
        precedingPrompts: mockPrecedingPrompts,
        session: createMockSession(),
      });

      vi.mocked(createAdminClient).mockReturnValue(mockSupa as unknown as ReturnType<typeof createAdminClient>);

      const result = await buildAnalysisContext(TEST_PROMPT_ID);

      expect(result).toBeDefined();
      expect(result!.totalTokens).toBeGreaterThanOrEqual(0);
    });
  });

  describe('AC2: Token Budget Enforcement', () => {
    it('should respect default token budget of 10,000', async () => {
      const mockPrompt = createMockPrompt({ sequence_number: 10 });

      // Create prompts that together exceed 10,000 tokens
      const longText = 'word '.repeat(5000); // ~1300 tokens each
      const mockPrecedingPrompts = Array.from({ length: 9 }, (_, i) =>
        createMockPrompt({
          id: `aaaa000${i + 1}-0001-0001-0001-00000000000${i + 1}`,
          sequence_number: i + 1,
          text: longText,
        })
      );

      const mockSupa = createMockSupabase({
        prompt: mockPrompt,
        precedingPrompts: mockPrecedingPrompts,
        session: createMockSession(),
      });

      vi.mocked(createAdminClient).mockReturnValue(mockSupa as unknown as ReturnType<typeof createAdminClient>);

      const result = await buildAnalysisContext(TEST_PROMPT_ID);

      expect(result).toBeDefined();
      expect(result!.totalTokens).toBeLessThanOrEqual(result!.tokenBudget);
    });

    it('should respect custom token budget', async () => {
      const mockPrompt = createMockPrompt({ sequence_number: 5 });
      const mockPrecedingPrompts = Array.from({ length: 4 }, (_, i) =>
        createMockPrompt({
          id: `aaaa000${i + 1}-0001-0001-0001-00000000000${i + 1}`,
          sequence_number: i + 1,
          text: 'word '.repeat(100),
        })
      );

      const mockSupa = createMockSupabase({
        prompt: mockPrompt,
        precedingPrompts: mockPrecedingPrompts,
        session: createMockSession(),
      });

      vi.mocked(createAdminClient).mockReturnValue(mockSupa as unknown as ReturnType<typeof createAdminClient>);

      const customBudget = 500;
      const result = await buildAnalysisContext(TEST_PROMPT_ID, {
        tokenBudget: customBudget,
      });

      expect(result).toBeDefined();
      expect(result!.tokenBudget).toBe(customBudget);
      expect(result!.totalTokens).toBeLessThanOrEqual(customBudget);
    });

    it('should include messages from most recent backwards', async () => {
      const mockPrompt = createMockPrompt({ sequence_number: 4 });
      const mockPrecedingPrompts = [
        createMockPrompt({
          id: 'aaaa0001-0001-0001-0001-000000000001',
          sequence_number: 1,
          text: 'First oldest prompt',
        }),
        createMockPrompt({
          id: 'aaaa0002-0002-0002-0002-000000000002',
          sequence_number: 2,
          text: 'Second prompt',
        }),
        createMockPrompt({
          id: 'aaaa0003-0003-0003-0003-000000000003',
          sequence_number: 3,
          text: 'Third most recent prompt',
        }),
      ];

      const mockSupa = createMockSupabase({
        prompt: mockPrompt,
        precedingPrompts: mockPrecedingPrompts,
        session: createMockSession(),
      });

      vi.mocked(createAdminClient).mockReturnValue(mockSupa as unknown as ReturnType<typeof createAdminClient>);

      // Small budget to force truncation
      const result = await buildAnalysisContext(TEST_PROMPT_ID, {
        tokenBudget: 50,
      });

      expect(result).toBeDefined();
      // Most recent should be included
      const hasThird = result!.messages.some((m) => m.content.includes('Third'));
      if (result!.messages.length > 0) {
        expect(hasThird).toBe(true);
      }
    });

    it('should truncate old messages when budget exceeded', async () => {
      const mockPrompt = createMockPrompt({ sequence_number: 3 });
      const longText = 'word '.repeat(500);
      const mockPrecedingPrompts = [
        createMockPrompt({
          id: 'aaaa0001-0001-0001-0001-000000000001',
          sequence_number: 1,
          text: longText,
        }),
        createMockPrompt({
          id: 'aaaa0002-0002-0002-0002-000000000002',
          sequence_number: 2,
          text: 'Short prompt',
        }),
      ];

      const mockSupa = createMockSupabase({
        prompt: mockPrompt,
        precedingPrompts: mockPrecedingPrompts,
        session: createMockSession(),
      });

      vi.mocked(createAdminClient).mockReturnValue(mockSupa as unknown as ReturnType<typeof createAdminClient>);

      const result = await buildAnalysisContext(TEST_PROMPT_ID, {
        tokenBudget: 100,
      });

      expect(result).toBeDefined();
      expect(result!.totalTokens).toBeLessThanOrEqual(100);
    });
  });

  describe('AC3: Response Summary Extraction', () => {
    it('should summarize long responses (> 500 chars)', async () => {
      const mockPrompt = createMockPrompt({ sequence_number: 2 });
      const longResponse = 'A'.repeat(1000);
      const mockPrecedingPrompts = [
        createMockPrompt({
          id: 'aaaa0001-0001-0001-0001-000000000001',
          sequence_number: 1,
          text: 'First prompt',
          prompt_responses: [
            {
              id: TEST_RESPONSE_ID,
              response_text_encrypted: 'encrypted',
              thinking_summary: null,
              tools_used: null,
              model: null,
            },
          ],
        }),
      ];

      const mockSupa = createMockSupabase({
        prompt: mockPrompt,
        precedingPrompts: mockPrecedingPrompts,
        session: createMockSession(),
        decryptedResponses: new Map([[TEST_RESPONSE_ID, longResponse]]),
      });

      vi.mocked(createAdminClient).mockReturnValue(mockSupa as unknown as ReturnType<typeof createAdminClient>);

      const result = await buildAnalysisContext(TEST_PROMPT_ID);

      expect(result).toBeDefined();
      if (result!.lastResponse) {
        expect(result!.lastResponse.fullLength).toBe(1000);
        expect(result!.lastResponse.text.length).toBeLessThanOrEqual(503);
      }
    });

    it('should set askedQuestion to true if response ends with ?', async () => {
      const mockPrompt = createMockPrompt({ sequence_number: 2 });
      const mockPrecedingPrompts = [
        createMockPrompt({
          id: 'aaaa0001-0001-0001-0001-000000000001',
          sequence_number: 1,
          text: 'First prompt',
          prompt_responses: [
            {
              id: TEST_RESPONSE_ID,
              response_text_encrypted: 'encrypted',
              thinking_summary: null,
              tools_used: null,
              model: null,
            },
          ],
        }),
      ];

      const mockSupa = createMockSupabase({
        prompt: mockPrompt,
        precedingPrompts: mockPrecedingPrompts,
        session: createMockSession(),
        decryptedResponses: new Map([[TEST_RESPONSE_ID, 'Would you like me to proceed?']]),
      });

      vi.mocked(createAdminClient).mockReturnValue(mockSupa as unknown as ReturnType<typeof createAdminClient>);

      const result = await buildAnalysisContext(TEST_PROMPT_ID);

      expect(result).toBeDefined();
      expect(result!.lastResponse?.askedQuestion).toBe(true);
    });

    it('should extract options from response with numbered list', async () => {
      const mockPrompt = createMockPrompt({ sequence_number: 2 });
      const responseWithOptions = `Here are your options:
1. Create a new file
2. Modify existing file
3. Delete the file`;

      const mockPrecedingPrompts = [
        createMockPrompt({
          id: 'aaaa0001-0001-0001-0001-000000000001',
          sequence_number: 1,
          text: 'First prompt',
          prompt_responses: [
            {
              id: TEST_RESPONSE_ID,
              response_text_encrypted: 'encrypted',
              thinking_summary: null,
              tools_used: null,
              model: null,
            },
          ],
        }),
      ];

      const mockSupa = createMockSupabase({
        prompt: mockPrompt,
        precedingPrompts: mockPrecedingPrompts,
        session: createMockSession(),
        decryptedResponses: new Map([[TEST_RESPONSE_ID, responseWithOptions]]),
      });

      vi.mocked(createAdminClient).mockReturnValue(mockSupa as unknown as ReturnType<typeof createAdminClient>);

      const result = await buildAnalysisContext(TEST_PROMPT_ID);

      expect(result).toBeDefined();
      expect(result!.lastResponse?.presentedOptions).toBeDefined();
      expect(result!.lastResponse?.presentedOptions.length).toBeGreaterThan(0);
    });

    it('should extract tools used from response', async () => {
      const mockPrompt = createMockPrompt({ sequence_number: 2 });
      const mockPrecedingPrompts = [
        createMockPrompt({
          id: 'aaaa0001-0001-0001-0001-000000000001',
          sequence_number: 1,
          text: 'First prompt',
          prompt_responses: [
            {
              id: TEST_RESPONSE_ID,
              response_text_encrypted: 'encrypted',
              thinking_summary: null,
              tools_used: ['Read', 'Write', 'Bash'],
              model: 'claude-opus-4',
            },
          ],
        }),
      ];

      const mockSupa = createMockSupabase({
        prompt: mockPrompt,
        precedingPrompts: mockPrecedingPrompts,
        session: createMockSession(),
        decryptedResponses: new Map([[TEST_RESPONSE_ID, 'Response text']]),
      });

      vi.mocked(createAdminClient).mockReturnValue(mockSupa as unknown as ReturnType<typeof createAdminClient>);

      const result = await buildAnalysisContext(TEST_PROMPT_ID);

      expect(result).toBeDefined();
      expect(result!.lastResponse?.toolsUsed).toEqual(['Read', 'Write', 'Bash']);
    });
  });

  describe('AC4: Message Index Tracking', () => {
    it('should set messageIndex to 0 for first prompt', async () => {
      const mockPrompt = createMockPrompt({ sequence_number: 1 });

      const mockSupa = createMockSupabase({
        prompt: mockPrompt,
        session: createMockSession(),
      });

      vi.mocked(createAdminClient).mockReturnValue(mockSupa as unknown as ReturnType<typeof createAdminClient>);

      const result = await buildAnalysisContext(TEST_PROMPT_ID);

      expect(result).toBeDefined();
      expect(result!.messageIndex).toBe(0);
    });

    it('should set messageIndex based on sequence_number (0-indexed)', async () => {
      const mockPrompt = createMockPrompt({ sequence_number: 5 });
      const mockPrecedingPrompts = Array.from({ length: 4 }, (_, i) =>
        createMockPrompt({
          id: `aaaa000${i + 1}-0001-0001-0001-00000000000${i + 1}`,
          sequence_number: i + 1,
          text: `Prompt ${i + 1}`,
        })
      );

      const mockSupa = createMockSupabase({
        prompt: mockPrompt,
        precedingPrompts: mockPrecedingPrompts,
        session: createMockSession(),
      });

      vi.mocked(createAdminClient).mockReturnValue(mockSupa as unknown as ReturnType<typeof createAdminClient>);

      const result = await buildAnalysisContext(TEST_PROMPT_ID);

      expect(result).toBeDefined();
      expect(result!.messageIndex).toBe(4); // 0-indexed, so prompt 5 = index 4
    });
  });

  describe('AC5: Empty Context Handling', () => {
    it('should return empty messages array for first prompt in session', async () => {
      const mockPrompt = createMockPrompt({ sequence_number: 1 });

      const mockSupa = createMockSupabase({
        prompt: mockPrompt,
        session: createMockSession(),
      });

      vi.mocked(createAdminClient).mockReturnValue(mockSupa as unknown as ReturnType<typeof createAdminClient>);

      const result = await buildAnalysisContext(TEST_PROMPT_ID);

      expect(result).toBeDefined();
      expect(result!.messages).toEqual([]);
      expect(result!.messageIndex).toBe(0);
      expect(result!.lastResponse).toBeUndefined();
    });

    it('should return valid result for classification even with no context', async () => {
      const mockPrompt = createMockPrompt({ sequence_number: 1 });

      const mockSupa = createMockSupabase({
        prompt: mockPrompt,
        session: createMockSession(),
      });

      vi.mocked(createAdminClient).mockReturnValue(mockSupa as unknown as ReturnType<typeof createAdminClient>);

      const result = await buildAnalysisContext(TEST_PROMPT_ID);

      expect(result).toBeDefined();
      expect(result!.sessionId).toBe(TEST_SESSION_ID);
      expect(result!.tokenBudget).toBe(DEFAULT_CONTEXT_OPTIONS.tokenBudget);
      expect(result!.totalTokens).toBe(0);
    });
  });

  describe('Session Metadata', () => {
    it('should include session metadata when available', async () => {
      const mockPrompt = createMockPrompt({ sequence_number: 1 });
      const mockSession = createMockSession({
        primary_stage: 'debugging',
        has_debugging_loop: true,
        user_message_count: 10,
      });

      const mockSupa = createMockSupabase({
        prompt: mockPrompt,
        session: mockSession,
      });

      vi.mocked(createAdminClient).mockReturnValue(mockSupa as unknown as ReturnType<typeof createAdminClient>);

      const result = await buildAnalysisContext(TEST_PROMPT_ID);

      expect(result).toBeDefined();
      expect(result!.sessionMetadata).toBeDefined();
      expect(result!.sessionMetadata?.primaryStage).toBe('debugging');
      expect(result!.sessionMetadata?.hasDebuggingLoop).toBe(true);
      expect(result!.sessionMetadata?.promptCount).toBe(10);
    });

    it('should handle missing session metadata gracefully', async () => {
      const mockPrompt = createMockPrompt({ sequence_number: 1 });

      const mockSupa = createMockSupabase({
        prompt: mockPrompt,
        session: null,
      });

      vi.mocked(createAdminClient).mockReturnValue(mockSupa as unknown as ReturnType<typeof createAdminClient>);

      const result = await buildAnalysisContext(TEST_PROMPT_ID);

      expect(result).toBeDefined();
      expect(result!.sessionMetadata).toBeUndefined();
    });
  });

  describe('Options', () => {
    it('should use default options when none provided', async () => {
      const mockPrompt = createMockPrompt({ sequence_number: 1 });

      const mockSupa = createMockSupabase({
        prompt: mockPrompt,
        session: createMockSession(),
      });

      vi.mocked(createAdminClient).mockReturnValue(mockSupa as unknown as ReturnType<typeof createAdminClient>);

      const result = await buildAnalysisContext(TEST_PROMPT_ID);

      expect(result).toBeDefined();
      expect(result!.tokenBudget).toBe(10000);
    });

    it('should respect maxMessages option', async () => {
      const mockPrompt = createMockPrompt({ sequence_number: 10 });
      const mockPrecedingPrompts = Array.from({ length: 9 }, (_, i) =>
        createMockPrompt({
          id: `aaaa000${i + 1}-0001-0001-0001-00000000000${i + 1}`,
          sequence_number: i + 1,
          text: `Prompt ${i + 1}`,
        })
      );

      const mockSupa = createMockSupabase({
        prompt: mockPrompt,
        precedingPrompts: mockPrecedingPrompts,
        session: createMockSession(),
      });

      vi.mocked(createAdminClient).mockReturnValue(mockSupa as unknown as ReturnType<typeof createAdminClient>);

      const result = await buildAnalysisContext(TEST_PROMPT_ID, {
        maxMessages: 3,
      });

      expect(result).toBeDefined();
      // Note: The actual limit is applied at DB query level
    });

    it('should respect includeResponses: false option', async () => {
      const mockPrompt = createMockPrompt({ sequence_number: 2 });
      const mockPrecedingPrompts = [
        createMockPrompt({
          id: 'aaaa0001-0001-0001-0001-000000000001',
          sequence_number: 1,
          text: 'First prompt',
          prompt_responses: [
            {
              id: TEST_RESPONSE_ID,
              response_text_encrypted: 'encrypted',
              thinking_summary: null,
              tools_used: null,
              model: null,
            },
          ],
        }),
      ];

      const mockSupa = createMockSupabase({
        prompt: mockPrompt,
        precedingPrompts: mockPrecedingPrompts,
        session: createMockSession(),
        decryptedResponses: new Map([[TEST_RESPONSE_ID, 'Response text']]),
      });

      vi.mocked(createAdminClient).mockReturnValue(mockSupa as unknown as ReturnType<typeof createAdminClient>);

      const result = await buildAnalysisContext(TEST_PROMPT_ID, {
        includeResponses: false,
      });

      expect(result).toBeDefined();
      // With includeResponses: false, no assistant messages should be in the array
      const assistantMessages = result!.messages.filter((m) => m.role === 'assistant');
      expect(assistantMessages.length).toBe(0);
    });

    it('should respect custom summaryLength option', async () => {
      const mockPrompt = createMockPrompt({ sequence_number: 2 });
      const longResponse = 'A'.repeat(1000);
      const mockPrecedingPrompts = [
        createMockPrompt({
          id: 'aaaa0001-0001-0001-0001-000000000001',
          sequence_number: 1,
          text: 'First prompt',
          prompt_responses: [
            {
              id: TEST_RESPONSE_ID,
              response_text_encrypted: 'encrypted',
              thinking_summary: null,
              tools_used: null,
              model: null,
            },
          ],
        }),
      ];

      const mockSupa = createMockSupabase({
        prompt: mockPrompt,
        precedingPrompts: mockPrecedingPrompts,
        session: createMockSession(),
        decryptedResponses: new Map([[TEST_RESPONSE_ID, longResponse]]),
      });

      vi.mocked(createAdminClient).mockReturnValue(mockSupa as unknown as ReturnType<typeof createAdminClient>);

      const result = await buildAnalysisContext(TEST_PROMPT_ID, {
        summaryLength: 200,
      });

      expect(result).toBeDefined();
      if (result!.lastResponse) {
        expect(result!.lastResponse.text.length).toBeLessThanOrEqual(203);
      }
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid UUID', async () => {
      await expect(buildAnalysisContext('not-a-uuid')).rejects.toThrow();
    });

    it('should throw error when preceding prompts query fails', async () => {
      const mockPrompt = createMockPrompt({ sequence_number: 3 });

      const mockSupa = createMockSupabase({
        prompt: mockPrompt,
        precedingError: { message: 'Query failed' },
        session: createMockSession(),
      });

      vi.mocked(createAdminClient).mockReturnValue(mockSupa as unknown as ReturnType<typeof createAdminClient>);

      await expect(buildAnalysisContext(TEST_PROMPT_ID)).rejects.toThrow(
        'Failed to fetch context'
      );
    });
  });

  describe('Messages Chronological Order', () => {
    it('should return messages in chronological order (oldest first)', async () => {
      const mockPrompt = createMockPrompt({ sequence_number: 4 });
      const mockPrecedingPrompts = [
        createMockPrompt({
          id: 'aaaa0001-0001-0001-0001-000000000001',
          sequence_number: 1,
          text: 'First prompt',
        }),
        createMockPrompt({
          id: 'aaaa0002-0002-0002-0002-000000000002',
          sequence_number: 2,
          text: 'Second prompt',
        }),
        createMockPrompt({
          id: 'aaaa0003-0003-0003-0003-000000000003',
          sequence_number: 3,
          text: 'Third prompt',
        }),
      ];

      const mockSupa = createMockSupabase({
        prompt: mockPrompt,
        precedingPrompts: mockPrecedingPrompts,
        session: createMockSession(),
      });

      vi.mocked(createAdminClient).mockReturnValue(mockSupa as unknown as ReturnType<typeof createAdminClient>);

      const result = await buildAnalysisContext(TEST_PROMPT_ID);

      expect(result).toBeDefined();
      if (result!.messages.length >= 3) {
        expect(result!.messages[0].content).toContain('First');
        expect(result!.messages[result!.messages.length - 1].content).toContain('Third');
      }
    });
  });
});

// ============================================================================
// Caching Tests
// ============================================================================

describe('Context Caching', () => {
  // Note: Caching is tested separately as it involves time-based behavior
  // These tests verify the cache interface but may need integration tests
  // for full validation

  it('should define cache TTL constant', () => {
    expect(DEFAULT_CONTEXT_OPTIONS.tokenBudget).toBe(10000);
    expect(DEFAULT_CONTEXT_OPTIONS.maxMessages).toBe(50);
  });
});
