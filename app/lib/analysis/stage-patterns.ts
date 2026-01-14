/**
 * Stage Detection Patterns - Story 31-1
 *
 * Defines regex patterns and configurations for detecting project stages
 * from prompt text. Used by the stage detector to classify prompts.
 */

import type { ProjectStage } from '@/lib/types/conversations';

/**
 * Configuration for a stage's detection patterns.
 */
export interface StagePatternConfig {
  /** Regex patterns that signal this stage */
  patterns: RegExp[];
  /** Priority for pattern matching (higher = checked first) */
  priority: number;
  /** Minimum confidence when any pattern matches */
  minConfidence: number;
  /** Human-readable description of this stage */
  description: string;
}

/**
 * Slash commands that map to specific stages.
 */
export const SLASH_COMMAND_STAGE_MAP: Record<string, ProjectStage> = {
  '/commit': 'development',
  '/test': 'testing',
  '/deploy': 'deployment',
  '/review': 'review',
  '/plan': 'planning',
  '/build': 'development',
  '/fix': 'debugging',
  '/refactor': 'refactoring',
  '/docs': 'documentation',
  '/debug': 'debugging',
  '/spec': 'specification',
  '/architect': 'architecture',
};

/**
 * Patterns that indicate a confirmation/continuation (not a stage transition).
 * These prompts should inherit the previous stage.
 */
export const CONFIRMATION_PATTERNS: RegExp[] = [
  /^(yes|yeah|yep|yup|ok|okay|sure|go\s+ahead|do\s+it|proceed|continue|sounds\s+good|perfect|great|thanks|thank\s+you|good|nice|cool|awesome|lgtm)\.?$/i,
  /^(y|n|[0-9]+)$/i, // Single letter/number responses
  /^\d+$/, // Just a number (selection)
  /^(option\s+)?\d+$/i, // "option 1" or just "1"
];

/**
 * Stage detection patterns organized by stage type.
 * Higher priority stages are checked first.
 */
export const STAGE_PATTERNS: Record<ProjectStage, StagePatternConfig> = {
  // Planning - High priority, clear signals
  planning: {
    patterns: [
      /\b(let'?s?\s+plan|how\s+should\s+we|what'?s?\s+the\s+approach)\b/i,
      /\b(before\s+we\s+start|first\s+let'?s?\s+think|let'?s?\s+think\s+about)\b/i,
      /\b(plan\s+(for|out|this)|planning\s+phase)\b/i,
      /\b(strategy|roadmap|milestone|timeline)\b/i,
      /\b(what\s+do\s+you\s+think|how\s+would\s+you|what\s+would\s+be\s+the\s+best)\b/i,
    ],
    priority: 90,
    minConfidence: 0.85,
    description: 'Planning and strategy discussion',
  },

  // Architecture - High priority for design discussions
  architecture: {
    patterns: [
      /\b(architect(ure)?|system\s+design|high[\s-]level\s+design)\b/i,
      /\b(design\s+pattern|component\s+diagram|data\s+model)\b/i,
      /\b(database\s+schema|api\s+design|service\s+architecture)\b/i,
      /\b(microservice|monolith|scalability|infrastructure)\b/i,
      /\b(tech\s+stack|technology\s+choice|framework\s+selection)\b/i,
    ],
    priority: 88,
    minConfidence: 0.85,
    description: 'Architecture and system design',
  },

  // Specification - Writing requirements
  specification: {
    patterns: [
      /\b(spec(ification)?|requirements?|user\s+stor(y|ies))\b/i,
      /\b(acceptance\s+criteria|definition\s+of\s+done)\b/i,
      /\b(prd|product\s+(requirements?|brief)|functional\s+requirements?)\b/i,
      /\b(use\s+case|scenario|epic)\b/i,
    ],
    priority: 85,
    minConfidence: 0.80,
    description: 'Writing specifications and requirements',
  },

  // Debugging - High priority due to urgency
  debugging: {
    patterns: [
      /\b(fix(ing)?|debug(ging)?|broken|not\s+working|bug)\b/i,
      /\b(error|exception|crash|fail(ing|ed|s)?)\b/i,
      /\bwhy\s+(is|does|isn'?t|doesn'?t|won'?t|can'?t)\b/i,
      /\b(investigate|figure\s+out|what'?s?\s+wrong)\b/i,
      /\b(issue|problem|trouble|stuck)\b/i,
      /\b(doesn'?t\s+work|won'?t\s+work|isn'?t\s+working)\b/i,
      /\b(help\s+me\s+fix|can\s+you\s+fix)\b/i,
      /\bstill\s+(broken|failing|not\s+working)\b/i,
    ],
    priority: 80,
    minConfidence: 0.80,
    description: 'Debugging and fixing issues',
  },

  // Deployment - High priority for release activities
  deployment: {
    patterns: [
      /\b(deploy(ing|ment)?|release|publish|ship)\b/i,
      /\b(production|staging|ci\/?cd|pipeline)\b/i,
      /\b(docker|kubernetes|k8s|cloud\s*run|aws|gcp|azure)\b/i,
      /\b(build\s+and\s+push|push\s+to|go\s+live)\b/i,
      /\b(environment|env\s+var|secret|config)\b/i,
    ],
    priority: 75,
    minConfidence: 0.85,
    description: 'Deployment and release activities',
  },

  // Testing - Clear signals
  // NOTE: Patterns must be specific to avoid matching common English words
  // like "should" and "expect" which appear in regular conversation
  testing: {
    patterns: [
      /\b(add|write|create|run)\s+.*?tests?\b/i,
      /\b(unit|e2e|integration|end[\s-]to[\s-]end)\s+tests?\b/i,
      /\b(playwright|jest|vitest|mocha|cypress)\b/i,
      /\btest\s+(coverage|suite|file|case|scenario)\b/i,
      /\b(spec\.ts|\.test\.ts|\.spec\.js|\.test\.js)\b/i,
      // Only match assertion methods in code context (with parentheses or dots)
      /\b(assert|expect|should)\s*\(/i, // assert(, expect(, should(
      /\.(toBe|toEqual|toMatch|toContain|toHaveLength)\s*\(/i, // Jest matchers
      /\.(should|expect)\s*\./i, // Chai style: .should.equal, .expect.
      /\b(mock|stub|spy|fixture)\b/i,
      /\bnpm\s+(test|run\s+test)\b/i,
      /\brun\s+.*?tests?\b/i,
    ],
    priority: 70,
    minConfidence: 0.85,
    description: 'Writing and running tests',
  },

  // Review - Code review activities
  review: {
    patterns: [
      /\b(code\s+review|review\s+(this|the|my)|peer\s+review)\b/i,
      /\b(lgtm|looks\s+good|approved|ship\s+it)\b/i,
      /\b(pr|pull\s+request|merge\s+request)\b/i,
      /\b(check\s+(this|my)|verify|validate)\b/i,
      /\b(feedback|suggestion|comment\s+on)\b/i,
    ],
    priority: 65,
    minConfidence: 0.75,
    description: 'Code review and validation',
  },

  // Refactoring - Code improvement
  // NOTE: "improve" alone is too broad - must be in code context
  refactoring: {
    patterns: [
      /\brefactor(ing)?\b/i,
      /\b(clean\s+up|cleanup|optimize|simplify)\s+(the\s+)?(code|function|class|component|module)?\b/i,
      /\bimprove\s+(the\s+)?(code|readability|performance|structure)\b/i, // Code-specific improvement
      /\b(rename|extract|move|reorganize|restructure)\b/i,
      /\b(reduce\s+duplication|dry|don'?t\s+repeat)\b/i,
      /\b(better\s+way|cleaner|more\s+elegant)\b/i,
    ],
    priority: 60,
    minConfidence: 0.80,
    description: 'Code refactoring and improvement',
  },

  // Documentation - Writing docs
  // NOTE: Patterns must be specific to avoid matching "read this document" or "document.getElementById"
  documentation: {
    patterns: [
      // Only match "documentation" (not "document" alone) or explicit doc file references
      /\b(documentation|readme(\.md)?)\b/i,
      /\b(add|write|create|update)\s+(docs?|documentation|comments?|jsdoc|tsdoc)\b/i,
      /\bexplain\s+(this|the|how|what)\b/i,
      /\b(api\s+docs?|swagger|openapi)\b/i,
      /\b(changelog|release\s+notes)\b/i,
      /\bdocument\s+(the|this|how|what|our)\b/i, // "document this", "document how", etc.
    ],
    priority: 55,
    minConfidence: 0.80,
    description: 'Writing documentation',
  },

  // Development/Implementation - Core coding
  development: {
    patterns: [
      /\b(implement|create|add|build|write)\s+.*?(feature|function|component|service|module|class)\b/i,
      /\b(let'?s?\s+build|start\s+coding|implement\s+this)\b/i,
      /\bcreate\s+(a\s+)?new\s+(file|component|function|class|module)\b/i,
      /\b(add|implement)\s+.*?(endpoint|route|api|method)\b/i,
      /\b(code|coding|programming|developing)\b/i,
      /\bimplement\s+(the|a|this)\b/i,
    ],
    priority: 50,
    minConfidence: 0.75,
    description: 'Feature development and coding',
  },

  // Implementation - Same as development but explicit (lower priority)
  implementation: {
    patterns: [
      /\bimplement(ation|ing)\b/i,
      /\b(build|construct|make)\s+(the|this|a)\b/i,
      /\b(start|begin)\s+(implement|build|creat)\b/i,
    ],
    priority: 45,
    minConfidence: 0.70,
    description: 'Implementation work',
  },

  // Enhancement - Adding to existing features
  // NOTE: Patterns must be specific to avoid matching "build on our own" (greenfield)
  enhancement: {
    patterns: [
      /\b(enhance(ment)?|upgrade)\b/i,
      /\bimprove\s+(the|this|existing|current)\b/i, // "improve the feature", not just "improve"
      /\bextend\s+(the|this|existing|current)\b/i, // "extend the API", not just "extend"
      /\badd\s+to\s+(the|this|existing|current)\b/i, // "add to the feature"
      /\bbuild\s+on\s+(the|this|existing|current|what)\b/i, // "build on existing", not "build on our own"
      /\bexpand\s+(the|this|existing|current)\b/i,
      /\b(feature\s+request|new\s+capability)\b/i,
      /\b(make\s+it\s+better|polish)\b/i,
    ],
    priority: 45,
    minConfidence: 0.70,
    description: 'Feature enhancement',
  },

  // Exploration - Learning and discovery
  exploration: {
    patterns: [
      /\b(explore|discover|investigate|research)\b/i,
      /\b(how\s+does|what\s+is|where\s+is|find\s+out)\b/i,
      /\b(understand|learn|figure\s+out)\b/i,
      /\b(look\s+at|examine|analyze)\b/i,
      /\b(codebase|project\s+structure)\b/i,
    ],
    priority: 40,
    minConfidence: 0.70,
    description: 'Exploring and learning',
  },

  // Unknown - Fallback
  unknown: {
    patterns: [],
    priority: 0,
    minConfidence: 0.5,
    description: 'Unknown or unclassified',
  },
};

/**
 * Get sorted stages by priority (highest first).
 */
export function getStagesByPriority(): [ProjectStage, StagePatternConfig][] {
  return (Object.entries(STAGE_PATTERNS) as [ProjectStage, StagePatternConfig][])
    .filter(([_, config]) => config.patterns.length > 0)
    .sort((a, b) => b[1].priority - a[1].priority);
}

/**
 * Check if a prompt is a confirmation/continuation.
 */
export function isConfirmationPrompt(text: string): boolean {
  const trimmed = text.trim();
  return CONFIRMATION_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Extract slash command from prompt if present.
 */
export function extractSlashCommand(text: string): string | null {
  const match = text.trim().match(/^(\/[a-z]+)/i);
  return match && match[1] ? match[1].toLowerCase() : null;
}

/**
 * Check if prompt is too short to reliably classify.
 */
export function isTooShortToClassify(text: string, minLength = 10): boolean {
  return text.trim().length < minLength;
}
