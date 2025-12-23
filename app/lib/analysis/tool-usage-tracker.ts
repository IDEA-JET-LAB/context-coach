/**
 * Tool Usage Tracker for Contextor
 * Story 21-6: Tool Usage Profiling
 *
 * Tracks and analyzes Claude Code tool usage per session to help developers
 * understand their tool usage patterns and identify opportunities for improvement.
 *
 * Performance Requirements:
 * - Average execution: <3ms per operation
 * - No external dependencies or API calls
 */

// ============================================================================
// Types and Constants
// ============================================================================

/**
 * Core Claude Code tool names.
 */
export const TOOL_NAMES = [
  'Bash',
  'Read',
  'Edit',
  'Write',
  'Glob',
  'Grep',
  'TodoWrite',
  'Task',
  'WebFetch',
  'WebSearch',
  'NotebookEdit',
] as const;

/**
 * Type for valid Claude Code tool names.
 */
export type ToolName = (typeof TOOL_NAMES)[number];

/**
 * Extended tool names including MCP tools.
 * MCP tools are prefixed with 'mcp__'.
 */
export const ALL_TOOL_NAMES = [...TOOL_NAMES] as string[];

/**
 * User profile types based on tool usage patterns.
 */
export const TOOL_USER_PROFILES = [
  'terminal_power',
  'code_centric',
  'methodical',
  'balanced',
] as const;

/**
 * Type for user profile classification.
 */
export type ToolUserProfile = (typeof TOOL_USER_PROFILES)[number];

/**
 * Mastery levels for tool proficiency.
 */
export type MasteryLevel = 'beginner' | 'intermediate' | 'advanced' | 'power_user';

/**
 * Tool usage distribution - maps tool name to usage count.
 */
export type ToolDistribution = Record<string, number>;

/**
 * Result of classifying a user's tool usage profile.
 */
export interface ProfileClassificationResult {
  /** The classified profile type */
  profile: ToolUserProfile;
  /** Confidence score from 0.0 to 1.0 */
  confidence: number;
}

/**
 * Complete tool usage profile for a user.
 */
export interface ToolUsageProfile {
  /** Distribution of tool usage counts */
  toolDistribution: ToolDistribution;
  /** Total number of tool calls */
  totalToolCalls: number;
  /** Top tools by usage */
  topTools: string[];
  /** Tools that are underutilized */
  underutilizedTools: string[];
  /** User's tool usage profile type */
  userProfile: ToolUserProfile;
}

/**
 * Team average data for a tool.
 */
export interface TeamToolAverage {
  total_count: number;
  avg_per_user: number;
  percentage: number;
}

/**
 * Team averages for all tools.
 */
export type TeamAverages = Record<string, TeamToolAverage>;

/**
 * Comparison of user's tool usage to team averages.
 */
export interface TeamComparison {
  toolName: string;
  userPercentage: number;
  teamAveragePercentage: number;
  differencePercent: number; // positive = above average
  insight: string;
}

/**
 * Tool mastery profile with progression history.
 */
export interface ToolMasteryProfile {
  tool: string;
  currentLevel: MasteryLevel;
  usageCount: number;
  firstUsed: Date;
  progressionHistory: { date: Date; level: MasteryLevel }[];
}

/**
 * Generated feedback for a user based on their tool usage.
 */
export interface ToolFeedback {
  /** Main profile-based message */
  profileMessage: string;
  /** Actionable suggestions for improvement */
  suggestions: string[];
  /** Comparison insights (if team data available) */
  comparisonInsights?: string[];
  /** Mastery progression messages (if mastery data available) */
  masteryMessages?: string[];
}

// ============================================================================
// Tool Usage Extraction
// ============================================================================

/**
 * Response data structure from Claude API.
 */
interface ResponseData {
  content?: Array<{
    type: string;
    name?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

/**
 * Extracts tool names from a Claude response.
 *
 * @param responseData - The response data containing tool_use content blocks
 * @returns Array of tool names used in the response
 *
 * @example
 * ```ts
 * const tools = extractToolUsage({
 *   content: [
 *     { type: 'tool_use', name: 'Read' },
 *     { type: 'tool_use', name: 'Edit' },
 *   ]
 * });
 * // => ['Read', 'Edit']
 * ```
 */
export function extractToolUsage(responseData: ResponseData | null | undefined): string[] {
  if (!responseData || !responseData.content || !Array.isArray(responseData.content)) {
    return [];
  }

  const tools: string[] = [];

  for (const block of responseData.content) {
    if (block.type === 'tool_use' && typeof block.name === 'string') {
      tools.push(block.name);
    }
  }

  return tools;
}

/**
 * Calculates tool distribution from an array of tool calls.
 *
 * @param toolCalls - Array of tool names from responses
 * @returns Record mapping tool names to their usage counts
 *
 * @example
 * ```ts
 * calculateToolDistribution(['Read', 'Edit', 'Read', 'Bash'])
 * // => { Read: 2, Edit: 1, Bash: 1 }
 * ```
 */
export function calculateToolDistribution(toolCalls: string[]): ToolDistribution {
  const distribution: ToolDistribution = {};

  for (const tool of toolCalls) {
    distribution[tool] = (distribution[tool] || 0) + 1;
  }

  return distribution;
}

// ============================================================================
// Profile Classification
// ============================================================================

/**
 * Classification thresholds for user profiles.
 */
const PROFILE_THRESHOLDS = {
  terminalPower: 0.30,   // Bash > 30%
  codeCentric: 0.50,     // Read+Edit+Write > 50%
  methodical: 0.10,      // TodoWrite > 10%
};

/**
 * Classifies a user's tool usage profile based on their distribution.
 *
 * Priority order:
 * 1. terminal_power (Bash > 30%)
 * 2. code_centric (Read+Edit+Write > 50%)
 * 3. methodical (TodoWrite > 10%)
 * 4. balanced (default)
 *
 * @param distribution - Tool usage distribution
 * @returns Classification result with profile and confidence
 *
 * @example
 * ```ts
 * classifyUserProfile({ Bash: 50, Read: 50 })
 * // => { profile: 'terminal_power', confidence: 0.85 }
 * ```
 */
export function classifyUserProfile(distribution: ToolDistribution): ProfileClassificationResult {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);

  if (total === 0) {
    return { profile: 'balanced', confidence: 0.5 };
  }

  // Calculate ratios
  const bashRatio = (distribution['Bash'] || 0) / total;
  const fileOpsRatio = (
    (distribution['Read'] || 0) +
    (distribution['Edit'] || 0) +
    (distribution['Write'] || 0)
  ) / total;
  const todoRatio = (distribution['TodoWrite'] || 0) / total;

  // Check terminal_power first (highest priority)
  if (bashRatio > PROFILE_THRESHOLDS.terminalPower) {
    // Confidence increases with how much Bash exceeds threshold
    const excess = bashRatio - PROFILE_THRESHOLDS.terminalPower;
    const confidence = Math.min(0.7 + (excess * 2), 1.0);
    return { profile: 'terminal_power', confidence };
  }

  // Check code_centric
  if (fileOpsRatio > PROFILE_THRESHOLDS.codeCentric) {
    const excess = fileOpsRatio - PROFILE_THRESHOLDS.codeCentric;
    const confidence = Math.min(0.7 + (excess * 2), 1.0);
    return { profile: 'code_centric', confidence };
  }

  // Check methodical
  if (todoRatio > PROFILE_THRESHOLDS.methodical) {
    const excess = todoRatio - PROFILE_THRESHOLDS.methodical;
    const confidence = Math.min(0.7 + (excess * 3), 1.0);
    return { profile: 'methodical', confidence };
  }

  // Default to balanced
  return { profile: 'balanced', confidence: 0.6 };
}

// ============================================================================
// Tool Insights
// ============================================================================

/**
 * Identifies top tools by usage count.
 *
 * @param distribution - Tool usage distribution
 * @param limit - Maximum number of tools to return (default: 5)
 * @returns Array of tool names sorted by usage (highest first)
 */
export function identifyTopTools(distribution: ToolDistribution, limit: number = 5): string[] {
  const entries = Object.entries(distribution);

  if (entries.length === 0) {
    return [];
  }

  return entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tool]) => tool);
}

/**
 * Identifies underutilized tools (not used or < 5% usage).
 *
 * @param distribution - Tool usage distribution
 * @returns Array of underutilized tool names
 */
export function identifyUnderutilizedTools(distribution: ToolDistribution): string[] {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);

  if (total === 0) {
    // All core tools are underutilized if no usage
    return [...TOOL_NAMES];
  }

  const underutilized: string[] = [];

  // Check all core tools for underutilization
  for (const tool of TOOL_NAMES) {
    const count = distribution[tool] || 0;
    const percentage = (count / total) * 100;

    if (percentage < 5) {
      underutilized.push(tool);
    }
  }

  return underutilized;
}

/**
 * Generates complete tool usage insights for a user.
 *
 * @param distribution - Tool usage distribution
 * @returns Complete tool usage profile with insights
 */
export function generateToolInsights(distribution: ToolDistribution): ToolUsageProfile {
  const totalToolCalls = Object.values(distribution).reduce((a, b) => a + b, 0);
  const topTools = identifyTopTools(distribution);
  const underutilizedTools = identifyUnderutilizedTools(distribution);
  const { profile } = classifyUserProfile(distribution);

  return {
    toolDistribution: distribution,
    totalToolCalls,
    topTools,
    underutilizedTools,
    userProfile: profile,
  };
}

// ============================================================================
// Team Comparison
// ============================================================================

/**
 * Compares user's tool usage to team averages.
 *
 * @param userDistribution - User's tool usage distribution
 * @param teamAverages - Team's average tool usage
 * @returns Array of comparisons for each tool
 */
export function compareToTeamAverages(
  userDistribution: ToolDistribution,
  teamAverages: TeamAverages
): TeamComparison[] {
  const userTotal = Object.values(userDistribution).reduce((a, b) => a + b, 0);

  if (userTotal === 0) {
    return [];
  }

  const comparisons: TeamComparison[] = [];

  // Compare each tool in user's distribution
  for (const [toolName, count] of Object.entries(userDistribution)) {
    const userPercentage = (count / userTotal) * 100;
    const teamData = teamAverages[toolName];
    const teamAveragePercentage = teamData?.percentage || 0;
    const differencePercent = userPercentage - teamAveragePercentage;

    let insight: string;
    if (Math.abs(differencePercent) < 5) {
      insight = `Your ${toolName} usage is about average for your team`;
    } else if (differencePercent > 0) {
      insight = `You use ${toolName} ${Math.round(differencePercent)}% more than your team average`;
    } else {
      insight = `You use ${toolName} ${Math.round(Math.abs(differencePercent))}% less than your team average`;
    }

    comparisons.push({
      toolName,
      userPercentage: Math.round(userPercentage * 10) / 10,
      teamAveragePercentage: Math.round(teamAveragePercentage * 10) / 10,
      differencePercent: Math.round(differencePercent * 10) / 10,
      insight,
    });
  }

  // Sort by absolute difference (most notable first)
  comparisons.sort((a, b) => Math.abs(b.differencePercent) - Math.abs(a.differencePercent));

  return comparisons;
}

// ============================================================================
// Mastery Calculation
// ============================================================================

/**
 * Mastery thresholds based on total tool usage count.
 */
const MASTERY_THRESHOLDS = {
  intermediate: 50,
  advanced: 200,
  powerUser: 500,
};

/**
 * Calculates mastery level based on total usage count.
 *
 * @param usageCount - Total number of times the tool has been used
 * @returns Mastery level
 */
export function calculateMasteryLevel(usageCount: number): MasteryLevel {
  if (usageCount >= MASTERY_THRESHOLDS.powerUser) {
    return 'power_user';
  }
  if (usageCount >= MASTERY_THRESHOLDS.advanced) {
    return 'advanced';
  }
  if (usageCount >= MASTERY_THRESHOLDS.intermediate) {
    return 'intermediate';
  }
  return 'beginner';
}

// ============================================================================
// Feedback Generation
// ============================================================================

/**
 * Profile-based feedback messages.
 */
const PROFILE_MESSAGES: Record<ToolUserProfile, string> = {
  terminal_power: "You're a power terminal user! Your command-line skills are impressive.",
  code_centric: "You're deeply focused on code - great attention to file operations!",
  methodical: "Your organized approach with TodoWrite shows strong planning skills.",
  balanced: "You have a well-rounded tool usage pattern across all categories.",
};

/**
 * Tool-specific suggestions for underutilized tools.
 */
const TOOL_SUGGESTIONS: Record<string, string> = {
  Bash: "Try using Bash more for quick system commands and automation.",
  Read: "Use Read to explore unfamiliar codebases more efficiently.",
  Edit: "Edit is great for precise code modifications - give it a try!",
  Write: "Write can help you create new files quickly.",
  Glob: "Glob is perfect for finding files by pattern - very useful for large projects.",
  Grep: "Grep is underutilized - it's great for finding patterns across your codebase.",
  TodoWrite: "Consider using TodoWrite to organize complex multi-step tasks.",
  Task: "Task helps delegate work to specialized agents - try it for complex tasks.",
  WebFetch: "WebFetch can retrieve documentation and web content for you.",
  WebSearch: "WebSearch could help you find solutions faster - give it a try!",
  NotebookEdit: "NotebookEdit is great for data analysis workflows in Jupyter.",
};

/**
 * Generates personalized feedback based on tool usage profile.
 *
 * @param profile - User's tool usage profile
 * @param comparison - Optional team comparison data
 * @param mastery - Optional mastery progression data
 * @returns Personalized feedback with messages and suggestions
 */
export function generateToolFeedback(
  profile: ToolUsageProfile,
  comparison?: TeamComparison[],
  mastery?: ToolMasteryProfile[]
): ToolFeedback {
  const feedback: ToolFeedback = {
    profileMessage: PROFILE_MESSAGES[profile.userProfile],
    suggestions: [],
  };

  // Add suggestions for top underutilized tools (max 3)
  for (const tool of profile.underutilizedTools.slice(0, 3)) {
    const suggestion = TOOL_SUGGESTIONS[tool];
    if (suggestion) {
      feedback.suggestions.push(suggestion);
    }
  }

  // Add comparison insights if available
  if (comparison && comparison.length > 0) {
    feedback.comparisonInsights = comparison
      .filter(c => Math.abs(c.differencePercent) >= 10)
      .slice(0, 3)
      .map(c => c.insight);
  }

  // Add mastery progression messages if available
  if (mastery && mastery.length > 0) {
    feedback.masteryMessages = mastery
      .filter(m => m.currentLevel === 'power_user' || m.currentLevel === 'advanced')
      .map(m => {
        if (m.currentLevel === 'power_user') {
          return `Congratulations! You've reached power_user level with ${m.tool}!`;
        }
        return `You're at advanced level with ${m.tool} - keep going to reach power_user!`;
      });
  }

  return feedback;
}
