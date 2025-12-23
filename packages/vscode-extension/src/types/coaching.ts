/**
 * Coaching Types for VS Code Extension
 * Story 19-5: Quick Coaching Tips
 *
 * Types for coaching tips, weak dimension detection, and improvement suggestions.
 */

/**
 * The 5 prompt quality dimensions
 */
export type DimensionName =
  | "clarity"
  | "context"
  | "specificity"
  | "actionability"
  | "efficiency";

/**
 * Priority level for coaching tips
 */
export type TipPriority = "high" | "medium" | "low";

/**
 * Source of the coaching tip
 * - pattern: Derived from user's prompt patterns over time
 * - recent: Based on a recent prompt's analysis
 * - general: General best practice tips
 */
export type TipSource = "pattern" | "recent" | "general";

/**
 * A single coaching tip with actionable advice
 */
export interface CoachingTip {
  /** Unique identifier for the tip */
  id: string;
  /** Which dimension this tip addresses */
  dimension: DimensionName;
  /** Short, descriptive title */
  title: string;
  /** Detailed explanation of the improvement */
  description: string;
  /** Optional before/after example */
  example?: {
    before: string;
    after: string;
  };
  /** Priority level for display ordering */
  priority: TipPriority;
  /** How this tip was generated */
  source: TipSource;
  /** When this tip was created */
  createdAt: string;
}

/**
 * A dimension that the user consistently scores low on
 */
export interface WeakDimension {
  /** The dimension name */
  dimension: DimensionName;
  /** Average score for this dimension (0-100) */
  averageScore: number;
  /** Number of prompts analyzed */
  promptCount: number;
  /** Trend compared to previous period */
  trend: "improving" | "declining" | "stable";
  /** Specific improvement strategies */
  strategies: string[];
}

/**
 * Response from the coaching API
 */
export interface CoachingResponse {
  /** Personalized coaching tips */
  tips: CoachingTip[];
  /** Dimensions with consistently low scores */
  weakDimensions: WeakDimension[];
  /** When the coaching data was last updated */
  lastUpdated: string;
}

/**
 * Coaching suggestion for a specific prompt improvement
 * (Named CoachingPromptSuggestion to avoid conflict with analytics PromptSuggestion)
 */
export interface CoachingPromptSuggestion {
  /** Which dimension this suggestion targets */
  dimension: DimensionName;
  /** The identified issue */
  issue: string;
  /** How to improve */
  improvement: string;
  /** Example of the improved prompt */
  improvedExample?: string;
}

/**
 * Request to dismiss a coaching tip
 */
export interface DismissTipRequest {
  /** The tip ID to dismiss */
  tipId: string;
  /** Reason for dismissal (optional) */
  reason?: "applied" | "not_relevant" | "already_know";
}

/**
 * Storage keys for coaching persistence
 */
export const COACHING_STORAGE_KEYS = {
  DISMISSED_TIPS: "contextor.dismissedTips",
  COACHING_CACHE: "contextor.coachingCache",
  LAST_COACHING_FETCH: "contextor.lastCoachingFetch",
} as const;

/**
 * Cached coaching data for offline mode
 */
export interface CachedCoaching {
  /** The coaching response data */
  data: CoachingResponse;
  /** When the cache was created */
  cachedAt: string;
}

/**
 * Dimension display configuration
 */
export const DIMENSION_CONFIG: Record<
  DimensionName,
  { label: string; color: string; description: string }
> = {
  clarity: {
    label: "Clarity",
    color: "#3b82f6",
    description: "How clearly your intent is expressed",
  },
  context: {
    label: "Context",
    color: "#8b5cf6",
    description: "Background information provided",
  },
  specificity: {
    label: "Specificity",
    color: "#10b981",
    description: "Level of detail in requirements",
  },
  actionability: {
    label: "Actionability",
    color: "#f59e0b",
    description: "How actionable the request is",
  },
  efficiency: {
    label: "Efficiency",
    color: "#ef4444",
    description: "Conciseness and focus of the prompt",
  },
};

/**
 * Default coaching tips for new users with no prompt history
 */
export const DEFAULT_GETTING_STARTED_TIPS: Omit<CoachingTip, "id" | "createdAt">[] = [
  {
    dimension: "clarity",
    title: "Be specific about what you want",
    description:
      "Clearly state your goal at the beginning of the prompt. Avoid ambiguous phrases like 'help me with' without specifying what kind of help.",
    example: {
      before: "Help me with this code",
      after: "Fix the null pointer exception in the getUserById function",
    },
    priority: "high",
    source: "general",
  },
  {
    dimension: "context",
    title: "Provide relevant background",
    description:
      "Include relevant context like the programming language, framework, or constraints. This helps get more accurate responses.",
    example: {
      before: "Write a test for this function",
      after:
        "Write a Jest unit test for this TypeScript function that handles async API calls",
    },
    priority: "high",
    source: "general",
  },
  {
    dimension: "specificity",
    title: "Define expected output format",
    description:
      "Specify what format you want the response in - code only, explanation, step-by-step, etc.",
    example: {
      before: "How do I handle errors?",
      after:
        "Show me a try-catch pattern for handling network errors in this fetch call, with TypeScript types",
    },
    priority: "medium",
    source: "general",
  },
  {
    dimension: "actionability",
    title: "Break complex tasks into steps",
    description:
      "For complex requests, break them into smaller, sequential tasks rather than asking for everything at once.",
    priority: "medium",
    source: "general",
  },
];
