/**
 * Quick Analysis Definitions - Story 30-8
 *
 * Pre-configured analysis presets for common conversation analysis tasks.
 * Each quick analysis defines:
 * - A prompt template
 * - Content selection settings
 * - Recommended model tier
 */

import {
  FileText,
  AlertTriangle,
  Lightbulb,
  Microscope,
  type LucideIcon,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

/**
 * Content settings for a quick analysis.
 */
export interface QuickAnalysisContentSettings {
  includePrompts: boolean;
  includeResponses: boolean;
  includeThinking: boolean;
  includeTools: boolean;
}

/**
 * Type of question being asked in the analysis.
 */
export type QuestionType = "summarize" | "find_issues" | "suggestions" | "deep_dive";

/**
 * Model tier recommendation.
 */
export type RecommendedModel = "haiku" | "sonnet" | "opus";

/**
 * Definition of a quick analysis preset.
 */
export interface QuickAnalysis {
  /** Unique identifier */
  id: string;
  /** Display label for the button */
  label: string;
  /** Icon component to display */
  icon: LucideIcon;
  /** The prompt to send to the AI */
  prompt: string;
  /** Category of the question */
  questionType: QuestionType;
  /** Which content types to include */
  contentSettings: QuickAnalysisContentSettings;
  /** Recommended model for this analysis type */
  recommendedModel: RecommendedModel;
  /** Optional warning message (e.g., for high token usage) */
  warning?: string;
}

// ============================================================================
// Quick Analysis Definitions
// ============================================================================

/**
 * Pre-configured quick analysis presets.
 */
export const QUICK_ANALYSES: QuickAnalysis[] = [
  {
    id: "summarize",
    label: "Summarize",
    icon: FileText,
    prompt: `Summarize this conversation in 2-3 sentences: 1. What was the user trying to accomplish? 2. What was the outcome? 3. How many turns did it take? Be concise and factual.`,
    questionType: "summarize",
    contentSettings: {
      includePrompts: true,
      includeResponses: true,
      includeThinking: false,
      includeTools: false,
    },
    recommendedModel: "haiku",
  },
  {
    id: "find_issues",
    label: "Find Issues",
    icon: AlertTriangle,
    prompt: `Analyze this conversation and identify 3-5 context-engineering issues. For each: 1) What went wrong 2) Why it matters 3) What they could do differently. Be specific with examples.`,
    questionType: "find_issues",
    contentSettings: {
      includePrompts: true,
      includeResponses: true,
      includeThinking: false,
      includeTools: true,
    },
    recommendedModel: "sonnet",
  },
  {
    id: "suggestions",
    label: "Suggestions",
    icon: Lightbulb,
    prompt: `Provide 3-5 actionable suggestions for improving prompting skills. Format: **Suggestion:** [summary] **Why:** [explanation] **Example:** [application]`,
    questionType: "suggestions",
    contentSettings: {
      includePrompts: true,
      includeResponses: true,
      includeThinking: false,
      includeTools: false,
    },
    recommendedModel: "sonnet",
  },
  {
    id: "deep_dive",
    label: "Deep Dive",
    icon: Microscope,
    prompt: `Deep analysis including AI reasoning. Analyze: 1) Goal Clarity 2) Context Quality 3) AI Reasoning 4) Collaboration Efficiency 5) Outcome Assessment. Provide specific examples.`,
    questionType: "deep_dive",
    contentSettings: {
      includePrompts: true,
      includeResponses: true,
      includeThinking: true,
      includeTools: true,
    },
    recommendedModel: "opus",
    warning: "Includes thinking blocks - higher token usage",
  },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Gets a human-readable description for a quick analysis type.
 *
 * @param id - The quick analysis ID
 * @returns Description string
 */
export function getAnalysisDescription(id: string): string {
  const descriptions: Record<string, string> = {
    summarize: "Get a quick 2-3 sentence summary of what happened.",
    find_issues: "Identify context-engineering mistakes and areas for improvement.",
    suggestions: "Get actionable tips for improving your prompting skills.",
    deep_dive: "Full analysis including AI reasoning - best for complex conversations.",
  };
  return descriptions[id] || "";
}

/**
 * Gets a quick analysis by its ID.
 *
 * @param id - The quick analysis ID
 * @returns QuickAnalysis or undefined if not found
 */
export function getQuickAnalysisById(id: string): QuickAnalysis | undefined {
  return QUICK_ANALYSES.find((qa) => qa.id === id);
}
