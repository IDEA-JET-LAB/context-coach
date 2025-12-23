/**
 * Work Style Classifier for Contextor
 * Story 21-2: Work Style Categorization
 *
 * Automatically classifies prompts into one of 10 work style categories
 * to help developers understand their prompting patterns.
 *
 * Performance Requirements:
 * - Average execution: <3ms per prompt
 * - Worst case (all patterns checked): <5ms
 * - No external dependencies or API calls
 */

/**
 * The 10 work style categories for prompt classification.
 */
export const WORK_STYLE_CATEGORIES = [
  'architecture_questions',
  'file_operations',
  'debugging',
  'agent_delegation',
  'testing',
  'deployment',
  'design_iteration',
  'context_recovery',
  'quick_commands',
  'business_discussion',
] as const;

/**
 * Type for valid work style categories.
 */
export type WorkStyleCategory = (typeof WORK_STYLE_CATEGORIES)[number];

/**
 * Result of classifying a prompt's work style.
 */
export interface WorkStyleResult {
  /** The classified category */
  category: WorkStyleCategory;
  /** Confidence score from 0.0 to 1.0 */
  confidence: number;
}

/**
 * Rule configuration for a category.
 */
interface CategoryRule {
  /** Regex patterns to match (any match triggers) */
  patterns: RegExp[];
  /** Priority for matching (higher = checked first) */
  priority: number;
  /** Minimum confidence score when matched */
  minConfidence: number;
}

/**
 * Category rules sorted by priority (descending).
 * Higher priority categories are checked first for early exit.
 *
 * Priority levels:
 * - 100: quick_commands (most specific, single word/phrase)
 * - 90: context_recovery (specific phrases about resuming)
 * - 80: debugging (error-related keywords)
 * - 70: testing, deployment (domain-specific)
 * - 60: agent_delegation (role-setting phrases)
 * - 50: architecture_questions (design discussions)
 * - 40: file_operations, design_iteration (general operations)
 * - 30: business_discussion (business terms)
 */
const CATEGORY_RULES: Record<WorkStyleCategory, CategoryRule> = {
  quick_commands: {
    patterns: [
      // Exact match patterns for short affirmations
      /^(yes|no|ok|okay|y|n|continue|proceed|done|next)$/i,
      /^[1-9]$/,  // Single digit selections
      /^(go ahead|looks good|lgtm|perfect|great)$/i,
    ],
    priority: 100,
    minConfidence: 0.95,
  },

  context_recovery: {
    patterns: [
      /continu(ed?|ing)?\s+(from|where)/i,
      /pick(ing)?\s+up\s+(from|where)/i,
      /context\s+limit/i,
      /resum(e|ing)\s+(our\s+)?conversation/i,
      /where\s+were\s+we/i,
      /what\s+was\s+I\s+working/i,
      /refresh\s+my\s+memory/i,
      /lets?\s+continue/i,
      /back\s+to\s+what\s+we/i,
    ],
    priority: 90,
    minConfidence: 0.85,
  },

  debugging: {
    patterns: [
      /not\s+working/i,
      // Only match "bug" or "broken" - not "error" (too common in other contexts)
      /\b(bug|broken)\b/i,
      // Match error only when it's the focus (not "error handling")
      /\berror\b(?!\s+handling)/i,
      // Match fix only when followed by bug/issue/problem/error (not "fix the alignment")
      /\bfix\s+(this|the|a|an)?\s*(bug|issue|problem|error)\b/i,
      /\b(debug|troubleshoot)\b/i,
      /why\s+(is|does|doesn'?t|isn'?t)/i,
      /still\s+(wrong|broken|failing)/i,
      /\bexception\b/i,
      /\b(TypeError|ReferenceError|SyntaxError)\b/i,
      /failing\s+(on|at)/i,
      /throw(ing|s)?\s+(an?\s+)?error/i,
    ],
    priority: 80,
    minConfidence: 0.80,
  },

  testing: {
    patterns: [
      /\b(test|tests|testing)\b/i,
      /\bspec(s)?\b/i,
      /\be2e\b/i,
      /\bplaywright\b/i,
      /\bjest\b/i,
      /\bvitest\b/i,
      /unit\s+test/i,
      /test\s+(suite|coverage|case)/i,
      /integration\s+test/i,
      /\bmock(ing|s)?\b/i,
      // Match "failing" only in test context (spec, test)
      /failing\s+(spec|test)/i,
    ],
    priority: 75,  // Slightly higher than deployment to catch test-specific keywords
    minConfidence: 0.75,
  },

  deployment: {
    patterns: [
      /\bdeploy(ment|ing|ed)?\b/i,
      /\bdocker\b/i,
      /\bproduction\b/i,
      /\bci\/?cd\b/i,
      /\bstaging\b/i,
      /\bkubernetes\b/i,
      /\bk8s\b/i,
      /\bnginx\b/i,
      /\baws\b/i,
      /\bgithub\s+actions\b/i,
      /\brelease\b/i,
      /\bbuild\s+(the\s+)?container\b/i,
    ],
    priority: 70,
    minConfidence: 0.85,
  },

  agent_delegation: {
    patterns: [
      /you\s+are\s+a\b/i,
      /act\s+as\s+a?\b/i,
      /your\s+role\s+is/i,
      /pretend\s+you\s+are/i,
      /be\s+a\s+(helpful\s+)?assistant/i,
      /assume\s+the\s+role/i,
    ],
    priority: 60,
    minConfidence: 0.75,
  },

  architecture_questions: {
    patterns: [
      /how\s+should\s+I\s+(structure|design|organize)/i,
      /\b(best\s+practice|best\s+way)\b/i,
      /\bdesign\s+(a|the|pattern)/i,
      /should\s+I\s+use\s+\w+\s+or\s+\w+/i,
      /\barchitecture\s+(pattern|style)/i,
      /\brecommend\s+(a\s+)?(folder|project)\s+structure/i,
      /\borganize\s+the\s+codebase/i,
      /\bstate\s+management\b/i,
      /\bscalable\b/i,
    ],
    priority: 50,
    minConfidence: 0.70,
  },

  file_operations: {
    patterns: [
      // File operation verbs followed by file/component keywords
      /\b(create|read|modify|delete|rename|move|update)\s+(a\s+)?(new\s+)?(file|component)/i,
      // File operation verbs followed by "the" + file indicator
      /\b(delete|rename|move|update)\s+the\s+(\w+\s+)?(file|config|old)/i,
      // Move to specific paths
      /\bmove\s+(the\s+)?\w+\s+to\s+\//i,
      // File extensions indicate file operations
      /\.(ts|tsx|js|jsx|py|go|rs|java|json|yaml|yml|md|txt|sql|css|scss|html)\b/i,
      // Path patterns
      /\/(src|lib|components|pages|app|utils|hooks)\//i,
      /\bpackage\.json\b/i,
      /\bREADME\b/i,
      /\bcomponent\s+in\s+\//i,
      /\badd\s+(a\s+)?new\s+component/i,
    ],
    priority: 40,
    minConfidence: 0.65,
  },

  design_iteration: {
    patterns: [
      /\bmake\s+it\s+(larger|smaller|bigger|wider|taller)/i,
      /\bchange\s+(the\s+)?colou?r/i,
      /\b(ui|layout)\b/i,
      /\b(spacing|padding|margin)\b/i,
      /\bmake\s+the\s+button/i,
      /\bcenter\s+(the\s+)?text/i,
      // Design-specific "fix" patterns (before general debugging)
      /\bfix\s+the\s+(alignment|spacing|layout|styling|padding|margin)/i,
      /\bresponsive\b/i,
      /\bvisual\s+design/i,
      /\bstyling\b/i,
    ],
    priority: 45,  // Slightly higher than file_operations to catch design-specific keywords
    minConfidence: 0.65,
  },

  business_discussion: {
    patterns: [
      /\bpricing\s+(model|strategy)/i,
      /\bhow\s+many\s+users\b/i,
      /\bstrategy\s+for/i,
      /\broadmap\b/i,
      /\brevenue\b/i,
      /\bmarket\s+analysis/i,
      /\bcompetitive\s+(landscape|analysis)/i,
      /\buser\s+feedback\b/i,
      /\bcustomer\s+acquisition/i,
    ],
    priority: 30,
    minConfidence: 0.60,
  },
};

/**
 * Pre-sorted category entries by priority (descending) for fast lookup.
 * Computed once at module load time for performance.
 */
const SORTED_CATEGORIES = (
  Object.entries(CATEGORY_RULES) as [WorkStyleCategory, CategoryRule][]
).sort((a, b) => b[1].priority - a[1].priority);

/**
 * Default classification when no patterns match.
 */
const DEFAULT_RESULT: WorkStyleResult = {
  category: 'file_operations',
  confidence: 0.30,
};

/**
 * Classifies a prompt into one of 10 work style categories.
 *
 * Uses pattern-based classification with priority ordering.
 * Early exits on first match for optimal performance.
 *
 * @param promptText - The prompt text to classify
 * @returns Classification result with category and confidence
 *
 * @example
 * ```ts
 * classifyWorkStyle('yes')
 * // => { category: 'quick_commands', confidence: 0.95 }
 *
 * classifyWorkStyle('fix this bug')
 * // => { category: 'debugging', confidence: 0.80 }
 *
 * classifyWorkStyle('random text')
 * // => { category: 'file_operations', confidence: 0.30 }
 * ```
 */
export function classifyWorkStyle(promptText: string): WorkStyleResult {
  const trimmed = promptText.trim();

  // Empty or whitespace-only prompts get default classification
  if (!trimmed) {
    return DEFAULT_RESULT;
  }

  // Check categories in priority order (early exit on first match)
  for (const [category, rule] of SORTED_CATEGORIES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(trimmed)) {
        return {
          category,
          confidence: rule.minConfidence,
        };
      }
    }
  }

  // No patterns matched - return default
  return DEFAULT_RESULT;
}
