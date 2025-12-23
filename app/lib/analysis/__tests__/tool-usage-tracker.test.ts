/**
 * Tool Usage Tracker Tests
 * Story 21-6: Tool Usage Profiling
 *
 * Tests for tool usage extraction, profile classification, insights generation,
 * team comparison, mastery progression, and personalized feedback.
 */

import { describe, it, expect } from 'vitest';
import {
  TOOL_NAMES,
  ALL_TOOL_NAMES,
  TOOL_USER_PROFILES,
  extractToolUsage,
  calculateToolDistribution,
  classifyUserProfile,
  identifyTopTools,
  identifyUnderutilizedTools,
  generateToolInsights,
  compareToTeamAverages,
  calculateMasteryLevel,
  generateToolFeedback,
  type ToolName,
  type ToolUserProfile,
  type ToolUsageProfile,
  type TeamComparison,
  type MasteryLevel,
  type ToolMasteryProfile,
  type ToolFeedback,
} from '../tool-usage-tracker';

// ============================================================================
// Tests: Type and Structure
// ============================================================================

describe('ToolUsageTracker Types', () => {
  it('should export 11 Claude Code tool names', () => {
    expect(TOOL_NAMES).toHaveLength(11);
    expect(TOOL_NAMES).toContain('Bash');
    expect(TOOL_NAMES).toContain('Read');
    expect(TOOL_NAMES).toContain('Edit');
    expect(TOOL_NAMES).toContain('Write');
    expect(TOOL_NAMES).toContain('Glob');
    expect(TOOL_NAMES).toContain('Grep');
    expect(TOOL_NAMES).toContain('TodoWrite');
    expect(TOOL_NAMES).toContain('Task');
    expect(TOOL_NAMES).toContain('WebFetch');
    expect(TOOL_NAMES).toContain('WebSearch');
    expect(TOOL_NAMES).toContain('NotebookEdit');
  });

  it('should export 4 user profile types', () => {
    expect(TOOL_USER_PROFILES).toHaveLength(4);
    expect(TOOL_USER_PROFILES).toContain('terminal_power');
    expect(TOOL_USER_PROFILES).toContain('code_centric');
    expect(TOOL_USER_PROFILES).toContain('methodical');
    expect(TOOL_USER_PROFILES).toContain('balanced');
  });

  it('should include MCP tools in ALL_TOOL_NAMES', () => {
    // ALL_TOOL_NAMES includes core tools plus allows MCP prefixed tools
    expect(ALL_TOOL_NAMES.length).toBeGreaterThanOrEqual(11);
  });
});

// ============================================================================
// Tests: Tool Extraction (AC #1, #2)
// ============================================================================

describe('extractToolUsage', () => {
  it('should extract tool names from response data with tool_use content', () => {
    const responseData = {
      content: [
        { type: 'tool_use', name: 'Read' },
        { type: 'tool_use', name: 'Edit' },
        { type: 'tool_use', name: 'Bash' },
        { type: 'text', text: 'Some text' },
      ],
    };

    const result = extractToolUsage(responseData);

    expect(result).toEqual(['Read', 'Edit', 'Bash']);
  });

  it('should return empty array for response without tool_use', () => {
    const responseData = {
      content: [
        { type: 'text', text: 'Just text content' },
      ],
    };

    const result = extractToolUsage(responseData);

    expect(result).toEqual([]);
  });

  it('should return empty array for null/undefined response', () => {
    expect(extractToolUsage(null)).toEqual([]);
    expect(extractToolUsage(undefined)).toEqual([]);
    expect(extractToolUsage({})).toEqual([]);
  });

  it('should handle response with empty content array', () => {
    const responseData = { content: [] };
    const result = extractToolUsage(responseData);
    expect(result).toEqual([]);
  });

  it('should handle duplicate tool uses in same response', () => {
    const responseData = {
      content: [
        { type: 'tool_use', name: 'Read' },
        { type: 'tool_use', name: 'Read' },
        { type: 'tool_use', name: 'Read' },
      ],
    };

    const result = extractToolUsage(responseData);

    expect(result).toEqual(['Read', 'Read', 'Read']);
    expect(result).toHaveLength(3);
  });

  it('should handle MCP tool names with prefixes', () => {
    const responseData = {
      content: [
        { type: 'tool_use', name: 'mcp__github__create_issue' },
        { type: 'tool_use', name: 'mcp__slack__send_message' },
        { type: 'tool_use', name: 'Read' },
      ],
    };

    const result = extractToolUsage(responseData);

    expect(result).toContain('mcp__github__create_issue');
    expect(result).toContain('mcp__slack__send_message');
    expect(result).toContain('Read');
  });
});

// ============================================================================
// Tests: Tool Distribution Calculation
// ============================================================================

describe('calculateToolDistribution', () => {
  it('should count occurrences of each tool', () => {
    const toolCalls = ['Read', 'Edit', 'Read', 'Bash', 'Read', 'Bash'];

    const result = calculateToolDistribution(toolCalls);

    expect(result['Read']).toBe(3);
    expect(result['Bash']).toBe(2);
    expect(result['Edit']).toBe(1);
  });

  it('should return empty object for empty array', () => {
    const result = calculateToolDistribution([]);
    expect(result).toEqual({});
  });

  it('should handle single tool call', () => {
    const result = calculateToolDistribution(['Grep']);
    expect(result).toEqual({ 'Grep': 1 });
  });
});

// ============================================================================
// Tests: User Profile Classification (AC #3, #4, #5, #6)
// ============================================================================

describe('classifyUserProfile', () => {
  it('should classify as balanced when distribution is empty', () => {
    const result = classifyUserProfile({});
    expect(result.profile).toBe('balanced');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  it('should classify as terminal_power when Bash > 30% (AC #4)', () => {
    const distribution = {
      'Bash': 40,
      'Read': 30,
      'Edit': 20,
      'Grep': 10,
    };

    const result = classifyUserProfile(distribution);

    expect(result.profile).toBe('terminal_power');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('should classify as code_centric when file ops > 50% (AC #5)', () => {
    const distribution = {
      'Read': 30,
      'Edit': 25,
      'Write': 15,
      'Bash': 20,
      'Grep': 10,
    };

    const result = classifyUserProfile(distribution);

    expect(result.profile).toBe('code_centric');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('should classify as methodical when TodoWrite > 10% (AC #6)', () => {
    // Distribution where file ops < 50% and Bash < 30% but TodoWrite > 10%
    const distribution = {
      'Read': 25,
      'Edit': 20,
      'TodoWrite': 15,
      'Bash': 25,
      'Grep': 15,
    };

    const result = classifyUserProfile(distribution);

    expect(result.profile).toBe('methodical');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('should classify as balanced when no category dominates', () => {
    const distribution = {
      'Bash': 20,
      'Read': 20,
      'Edit': 15,
      'Grep': 15,
      'Glob': 15,
      'WebSearch': 15,
    };

    const result = classifyUserProfile(distribution);

    expect(result.profile).toBe('balanced');
  });

  it('should prioritize terminal_power over other classifications', () => {
    // Both Bash > 30% AND file ops > 50%
    const distribution = {
      'Bash': 35,
      'Read': 25,
      'Edit': 25,
      'Write': 15,
    };

    const result = classifyUserProfile(distribution);

    // Bash > 30% should take priority
    expect(result.profile).toBe('terminal_power');
  });

  it('should return confidence based on how strongly category matches', () => {
    // Strong terminal_power match (Bash = 50%)
    const strongTerminal = { 'Bash': 50, 'Read': 50 };
    const strongResult = classifyUserProfile(strongTerminal);

    // Weak terminal_power match (Bash = 31%)
    const weakTerminal = { 'Bash': 31, 'Read': 69 };
    const weakResult = classifyUserProfile(weakTerminal);

    expect(strongResult.confidence).toBeGreaterThan(weakResult.confidence);
  });
});

// ============================================================================
// Tests: Top Tools Identification (AC #7)
// ============================================================================

describe('identifyTopTools', () => {
  it('should return top N tools by usage count', () => {
    const distribution = {
      'Read': 100,
      'Edit': 80,
      'Bash': 60,
      'Grep': 40,
      'Glob': 20,
    };

    const result = identifyTopTools(distribution, 3);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe('Read');
    expect(result[1]).toBe('Edit');
    expect(result[2]).toBe('Bash');
  });

  it('should return all tools if limit exceeds count', () => {
    const distribution = { 'Read': 10, 'Edit': 5 };

    const result = identifyTopTools(distribution, 10);

    expect(result).toHaveLength(2);
  });

  it('should return empty array for empty distribution', () => {
    const result = identifyTopTools({}, 3);
    expect(result).toEqual([]);
  });

  it('should default to top 5 tools', () => {
    const distribution = {
      'Read': 100,
      'Edit': 90,
      'Bash': 80,
      'Grep': 70,
      'Glob': 60,
      'Write': 50,
      'TodoWrite': 40,
    };

    const result = identifyTopTools(distribution);

    expect(result).toHaveLength(5);
  });
});

// ============================================================================
// Tests: Underutilized Tools Identification (AC #7)
// ============================================================================

describe('identifyUnderutilizedTools', () => {
  it('should identify tools not used at all', () => {
    const distribution = {
      'Read': 50,
      'Edit': 30,
      'Bash': 20,
    };

    const result = identifyUnderutilizedTools(distribution);

    expect(result).toContain('Grep');
    expect(result).toContain('Glob');
    expect(result).toContain('TodoWrite');
    expect(result).toContain('WebSearch');
    expect(result).not.toContain('Read');
    expect(result).not.toContain('Edit');
  });

  it('should identify tools with < 5% usage as underutilized', () => {
    const distribution = {
      'Read': 50,
      'Edit': 45,
      'Bash': 3,  // < 5%
      'Grep': 2,  // < 5%
    };

    const result = identifyUnderutilizedTools(distribution);

    expect(result).toContain('Bash');
    expect(result).toContain('Grep');
    expect(result).not.toContain('Read');
    expect(result).not.toContain('Edit');
  });

  it('should return all core tools when distribution is empty', () => {
    const result = identifyUnderutilizedTools({});

    expect(result).toHaveLength(11); // All 11 core tools
  });
});

// ============================================================================
// Tests: Tool Insights Generation (AC #7)
// ============================================================================

describe('generateToolInsights', () => {
  it('should return profile with distribution, top tools, and underutilized tools', () => {
    const distribution = {
      'Bash': 50,
      'Read': 30,
      'Edit': 20,
    };

    const result = generateToolInsights(distribution);

    expect(result).toHaveProperty('toolDistribution');
    expect(result).toHaveProperty('totalToolCalls');
    expect(result).toHaveProperty('topTools');
    expect(result).toHaveProperty('underutilizedTools');
    expect(result).toHaveProperty('userProfile');

    expect(result.totalToolCalls).toBe(100);
    expect(result.topTools).toContain('Bash');
    expect(result.userProfile).toBe('terminal_power');
  });
});

// ============================================================================
// Tests: Team Comparison (AC #8)
// ============================================================================

describe('compareToTeamAverages', () => {
  it('should calculate percentage differences from team averages', () => {
    const userDistribution = {
      'Bash': 40,
      'Read': 30,
      'Edit': 30,
    };

    const teamAverages = {
      'Bash': { total_count: 200, avg_per_user: 20, percentage: 20 },
      'Read': { total_count: 400, avg_per_user: 40, percentage: 40 },
      'Edit': { total_count: 400, avg_per_user: 40, percentage: 40 },
    };

    const result = compareToTeamAverages(userDistribution, teamAverages);

    // User has 40% Bash vs team's 20% => +20 percentage points difference
    const bashComparison = result.find(c => c.toolName === 'Bash');
    expect(bashComparison).toBeDefined();
    expect(bashComparison!.userPercentage).toBe(40);
    expect(bashComparison!.teamAveragePercentage).toBe(20);
    expect(bashComparison!.differencePercent).toBe(20);
    expect(bashComparison!.insight).toContain('more');
  });

  it('should indicate when user is below team average', () => {
    // User has Read: 20% of their total vs team's 40%
    const userDistribution = { 'Read': 20, 'Bash': 80 };
    const teamAverages = {
      'Read': { total_count: 400, avg_per_user: 40, percentage: 40 },
      'Bash': { total_count: 400, avg_per_user: 40, percentage: 40 },
    };

    const result = compareToTeamAverages(userDistribution, teamAverages);
    const readComparison = result.find(c => c.toolName === 'Read');

    expect(readComparison!.differencePercent).toBe(-20);
    expect(readComparison!.insight).toContain('less');
  });

  it('should handle empty user distribution', () => {
    const result = compareToTeamAverages({}, {});
    expect(result).toEqual([]);
  });
});

// ============================================================================
// Tests: Mastery Level Calculation (AC #9)
// ============================================================================

describe('calculateMasteryLevel', () => {
  it('should return beginner for 0-49 total uses', () => {
    expect(calculateMasteryLevel(0)).toBe('beginner');
    expect(calculateMasteryLevel(25)).toBe('beginner');
    expect(calculateMasteryLevel(49)).toBe('beginner');
  });

  it('should return intermediate for 50-199 total uses', () => {
    expect(calculateMasteryLevel(50)).toBe('intermediate');
    expect(calculateMasteryLevel(100)).toBe('intermediate');
    expect(calculateMasteryLevel(199)).toBe('intermediate');
  });

  it('should return advanced for 200-499 total uses', () => {
    expect(calculateMasteryLevel(200)).toBe('advanced');
    expect(calculateMasteryLevel(350)).toBe('advanced');
    expect(calculateMasteryLevel(499)).toBe('advanced');
  });

  it('should return power_user for 500+ total uses', () => {
    expect(calculateMasteryLevel(500)).toBe('power_user');
    expect(calculateMasteryLevel(1000)).toBe('power_user');
    expect(calculateMasteryLevel(10000)).toBe('power_user');
  });
});

// ============================================================================
// Tests: Personalized Feedback Messages (AC #10)
// ============================================================================

describe('generateToolFeedback', () => {
  it('should generate profile-based message for terminal_power', () => {
    const profile: ToolUsageProfile = {
      toolDistribution: { 'Bash': 50, 'Read': 50 },
      totalToolCalls: 100,
      topTools: ['Bash', 'Read'],
      underutilizedTools: ['Grep', 'Glob'],
      userProfile: 'terminal_power',
    };

    const result = generateToolFeedback(profile);

    expect(result.profileMessage).toContain('terminal');
    expect(result.profileMessage.toLowerCase()).toContain('power');
  });

  it('should generate profile-based message for code_centric', () => {
    const profile: ToolUsageProfile = {
      toolDistribution: { 'Read': 40, 'Edit': 35, 'Write': 25 },
      totalToolCalls: 100,
      topTools: ['Read', 'Edit', 'Write'],
      underutilizedTools: ['Bash', 'Grep'],
      userProfile: 'code_centric',
    };

    const result = generateToolFeedback(profile);

    expect(result.profileMessage.toLowerCase()).toContain('code');
  });

  it('should generate profile-based message for methodical', () => {
    const profile: ToolUsageProfile = {
      toolDistribution: { 'TodoWrite': 20, 'Read': 40, 'Edit': 40 },
      totalToolCalls: 100,
      topTools: ['Read', 'Edit', 'TodoWrite'],
      underutilizedTools: ['Bash'],
      userProfile: 'methodical',
    };

    const result = generateToolFeedback(profile);

    // The methodical message mentions organized approach and TodoWrite
    expect(result.profileMessage.toLowerCase()).toContain('organized');
    expect(result.profileMessage.toLowerCase()).toContain('todowrite');
  });

  it('should generate profile-based message for balanced', () => {
    const profile: ToolUsageProfile = {
      toolDistribution: { 'Bash': 25, 'Read': 25, 'Edit': 25, 'Grep': 25 },
      totalToolCalls: 100,
      topTools: ['Bash', 'Read', 'Edit', 'Grep'],
      underutilizedTools: [],
      userProfile: 'balanced',
    };

    const result = generateToolFeedback(profile);

    // The balanced message mentions "well-rounded"
    expect(result.profileMessage.toLowerCase()).toContain('well-rounded');
  });

  it('should include suggestions for underutilized tools', () => {
    const profile: ToolUsageProfile = {
      toolDistribution: { 'Read': 100 },
      totalToolCalls: 100,
      topTools: ['Read'],
      underutilizedTools: ['Grep', 'Glob', 'WebSearch'],
      userProfile: 'balanced',
    };

    const result = generateToolFeedback(profile);

    expect(result.suggestions.length).toBeGreaterThan(0);
    // Should suggest at least one of the underutilized tools
    const suggestionText = result.suggestions.join(' ').toLowerCase();
    expect(
      suggestionText.includes('grep') ||
      suggestionText.includes('glob') ||
      suggestionText.includes('websearch') ||
      suggestionText.includes('search')
    ).toBe(true);
  });

  it('should include comparison-based insight when comparison provided', () => {
    const profile: ToolUsageProfile = {
      toolDistribution: { 'Bash': 50, 'Read': 50 },
      totalToolCalls: 100,
      topTools: ['Bash', 'Read'],
      underutilizedTools: [],
      userProfile: 'terminal_power',
    };

    const comparison: TeamComparison[] = [
      {
        toolName: 'Bash',
        userPercentage: 50,
        teamAveragePercentage: 20,
        differencePercent: 30,
        insight: 'You use Bash 30% more than your team average',
      },
    ];

    const result = generateToolFeedback(profile, comparison);

    expect(result.comparisonInsights).toBeDefined();
    expect(result.comparisonInsights!.length).toBeGreaterThan(0);
  });

  it('should include mastery progression messages when mastery provided', () => {
    const profile: ToolUsageProfile = {
      toolDistribution: { 'Bash': 100 },
      totalToolCalls: 100,
      topTools: ['Bash'],
      underutilizedTools: [],
      userProfile: 'terminal_power',
    };

    const mastery: ToolMasteryProfile[] = [
      {
        tool: 'Bash',
        currentLevel: 'power_user',
        usageCount: 500,
        firstUsed: new Date('2024-01-01'),
        progressionHistory: [
          { date: new Date('2024-01-01'), level: 'beginner' },
          { date: new Date('2024-06-01'), level: 'power_user' },
        ],
      },
    ];

    const result = generateToolFeedback(profile, undefined, mastery);

    expect(result.masteryMessages).toBeDefined();
    expect(result.masteryMessages!.length).toBeGreaterThan(0);
    expect(result.masteryMessages![0].toLowerCase()).toContain('power');
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle very large tool counts', () => {
    const distribution = { 'Bash': 1000000 };
    const result = classifyUserProfile(distribution);
    expect(result.profile).toBe('terminal_power');
  });

  it('should handle fractional percentages in team comparison', () => {
    // User has Bash = 100% (only tool), team has Bash = 100%
    const userDistribution = { 'Bash': 100 };
    const teamAverages = {
      'Bash': { total_count: 333, avg_per_user: 33.3, percentage: 100 },
    };

    const result = compareToTeamAverages(userDistribution, teamAverages);
    // Both are 100%, so difference should be close to 0
    expect(result[0]!.differencePercent).toBeCloseTo(0, 1);
  });

  it('should handle tools with zero usage in distribution', () => {
    const distribution = { 'Read': 50, 'Bash': 0, 'Edit': 50 };
    const result = classifyUserProfile(distribution);

    expect(result.profile).toBe('code_centric');
  });
});

// ============================================================================
// Tests: Performance
// ============================================================================

describe('Performance', () => {
  it('should classify profiles in under 5ms', () => {
    const distribution = {
      'Bash': 100,
      'Read': 200,
      'Edit': 150,
      'Write': 50,
      'Grep': 80,
      'Glob': 60,
      'TodoWrite': 30,
      'Task': 20,
      'WebFetch': 10,
      'WebSearch': 15,
      'NotebookEdit': 5,
    };

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      classifyUserProfile(distribution);
    }
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100); // 100 classifications in under 100ms
  });

  it('should extract tools from response in under 5ms', () => {
    const responseData = {
      content: Array(50).fill({ type: 'tool_use', name: 'Read' }),
    };

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      extractToolUsage(responseData);
    }
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
  });
});
