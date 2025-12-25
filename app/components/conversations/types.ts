/**
 * Phase 3: Conversation Intelligence Types
 * Shared type definitions for conversation components
 */

export type ProjectStage =
  | "architecture"
  | "specification"
  | "development"
  | "debugging"
  | "enhancement"
  | "planning"
  | "implementation"
  | "testing"
  | "documentation"
  | "review"
  | "refactoring"
  | "exploration"
  | "unknown";

export type PromptType =
  | "initiating"
  | "continuation"
  | "selection"
  | "correction"
  | "confirmation"
  | "clarification";

export interface ConversationSummary {
  id: string;
  sessionId: string;
  slug: string;
  projectId: string | null;
  projectName: string | null;
  userId: string;
  userName?: string;
  startedAt: string;
  endedAt: string | null;
  userMessageCount: number;
  totalMessages: number;
  primaryStage: ProjectStage | null;
  hasDebuggingLoop: boolean;
  conversationScore: number | null;
  gitBranch: string | null;
  cwd: string | null;
  claudeCodeVersion: string | null;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sequenceNumber: number;
  promptType?: PromptType;
  score?: number;
  detectedStage?: ProjectStage;
  isInDebuggingLoop?: boolean;
  parentPromptId?: string;
  messageUuid?: string;
  metadata?: MessageMetadata;
  response?: ResponseData;
  analysis?: PromptAnalysis;
}

export interface MessageMetadata {
  gitBranch?: string;
  cwd?: string;
  claudeCodeVersion?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface ResponseData {
  id: string;
  responseText?: string;
  thinkingSummary?: string;
  thinkingWordCount?: number;
  toolCount: number;
  toolsUsed: string[];
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  stopReason?: string;
}

export interface ToolExecution {
  id: string;
  toolName: string;
  toolId?: string;
  inputSummary: string;
  outputSummary?: string;
  success?: boolean;
  executionOrder: number;
}

export interface PromptAnalysis {
  overallScore: number;
  dimensions: {
    clarity: number;
    context: number;
    specificity: number;
    actionability: number;
    efficiency: number;
  };
  feedback?: string;
}

export interface ProjectMapping {
  id: string;
  teamId: string;
  projectId: string | null;
  projectName?: string;
  claudeProjectPath: string;
  normalizedPath: string;
  matchConfidence: number | null;
  matchMethod: "exact_path" | "suffix_match" | "name_similarity" | "user_selected" | null;
  userConfirmed: boolean;
}

export interface StageBreakdown {
  architecture: number;
  specification: number;
  development: number;
  debugging: number;
  enhancement: number;
  planning: number;
  implementation: number;
  testing: number;
  documentation: number;
  review: number;
  refactoring: number;
  exploration: number;
  unknown: number;
}

// Stage configuration
export const STAGE_CONFIG: Record<
  ProjectStage,
  { label: string; color: string; bgColor: string }
> = {
  architecture: {
    label: "Architecture",
    color: "text-info",
    bgColor: "bg-info/20",
  },
  specification: {
    label: "Specification",
    color: "text-secondary",
    bgColor: "bg-secondary/20",
  },
  development: {
    label: "Development",
    color: "text-score-high",
    bgColor: "bg-score-high/20",
  },
  debugging: {
    label: "Debugging",
    color: "text-score-medium",
    bgColor: "bg-score-medium/20",
  },
  enhancement: {
    label: "Enhancement",
    color: "text-primary",
    bgColor: "bg-primary/20",
  },
  planning: {
    label: "Planning",
    color: "text-info",
    bgColor: "bg-info/20",
  },
  implementation: {
    label: "Implementation",
    color: "text-score-high",
    bgColor: "bg-score-high/20",
  },
  testing: {
    label: "Testing",
    color: "text-secondary",
    bgColor: "bg-secondary/20",
  },
  documentation: {
    label: "Documentation",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
  },
  review: {
    label: "Review",
    color: "text-primary",
    bgColor: "bg-primary/20",
  },
  refactoring: {
    label: "Refactoring",
    color: "text-score-medium",
    bgColor: "bg-score-medium/20",
  },
  exploration: {
    label: "Exploration",
    color: "text-info",
    bgColor: "bg-info/20",
  },
  unknown: {
    label: "Unknown",
    color: "text-muted-foreground",
    bgColor: "bg-muted/30",
  },
};

// Prompt type configuration
export const PROMPT_TYPE_CONFIG: Record<
  PromptType,
  { label: string; color: string; bgColor: string; scoringWeight: number }
> = {
  initiating: {
    label: "Initiating",
    color: "text-primary",
    bgColor: "bg-primary/20",
    scoringWeight: 1.0,
  },
  continuation: {
    label: "Continuation",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    scoringWeight: 0.7,
  },
  selection: {
    label: "Selection",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    scoringWeight: 0,
  },
  correction: {
    label: "Correction",
    color: "text-score-medium",
    bgColor: "bg-score-medium/20",
    scoringWeight: 0.8,
  },
  confirmation: {
    label: "Confirmation",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    scoringWeight: 0,
  },
  clarification: {
    label: "Clarification",
    color: "text-info",
    bgColor: "bg-info/20",
    scoringWeight: 0.6,
  },
};

// Helper to format duration
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// Helper to format relative time
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}
