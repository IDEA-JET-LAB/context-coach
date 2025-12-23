/**
 * Classification Rules Types
 * Story 22-2: Classification Rule Editor
 *
 * Types for regex-based prompt classification rules and categories.
 */

/**
 * ReDoS vulnerability risk levels
 */
export type RedosRisk = 'safe' | 'warning' | 'dangerous';

/**
 * Classification category definition
 */
export interface ClassificationCategory {
  id: string;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  /** Computed from join */
  rule_count?: number;
}

/**
 * Classification rule definition
 */
export interface ClassificationRule {
  id: string;
  name: string;
  category_id: string;
  category?: ClassificationCategory;
  pattern: string;
  pattern_flags: string;
  priority: number;
  description: string | null;
  enabled: boolean;
  match_count: number;
  last_matched_at: string | null;
  redos_risk: RedosRisk;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Result from testing a regex pattern against sample input
 */
export interface RegexTestResult {
  /** Array of all matches found */
  matches: Array<{
    /** The matched text */
    text: string;
    /** Starting position in the input */
    index: number;
    /** Length of the match */
    length: number;
    /** Named capture groups if any */
    groups: Record<string, string>;
  }>;
  /** Total number of matches */
  matchCount: number;
  /** Time taken to execute the regex (ms) */
  executionTime: number;
}

/**
 * ReDoS vulnerability analysis result
 */
export interface RedosAnalysis {
  /** Overall risk level */
  risk: RedosRisk;
  /** List of detected issues */
  issues: string[];
  /** Suggestions to fix issues */
  suggestions: string[];
}

/**
 * Input for creating a new classification category
 */
export interface CreateCategoryInput {
  name: string;
  description?: string | null;
  color?: string;
  sort_order?: number;
}

/**
 * Input for updating a classification category
 */
export interface UpdateCategoryInput {
  name?: string;
  description?: string | null;
  color?: string;
  sort_order?: number;
  is_archived?: boolean;
}

/**
 * Input for creating a new classification rule
 */
export interface CreateRuleInput {
  name: string;
  category_id: string;
  pattern: string;
  pattern_flags?: string;
  priority?: number;
  description?: string | null;
  enabled?: boolean;
}

/**
 * Input for updating a classification rule
 */
export interface UpdateRuleInput {
  name?: string;
  category_id?: string;
  pattern?: string;
  pattern_flags?: string;
  priority?: number;
  description?: string | null;
  enabled?: boolean;
  redos_risk?: RedosRisk;
}

/**
 * Classification result for a prompt
 */
export interface ClassificationResult {
  /** The primary (highest priority) match */
  primary: {
    category: string;
    category_id: string;
    rule_id: string;
    rule_name: string;
    confidence: number;
  } | null;
  /** All matching rules ordered by priority */
  all_matches: Array<{
    category: string;
    category_id: string;
    rule_id: string;
    rule_name: string;
    priority: number;
  }>;
}

/**
 * Pattern conflict detection result
 */
export interface PatternConflict {
  /** ID of the conflicting rule */
  ruleId: string;
  /** Name of the conflicting rule */
  ruleName: string;
  /** Pattern of the conflicting rule */
  pattern: string;
  /** Type of overlap detected */
  overlapType: 'subset' | 'superset' | 'partial';
  /** Sample inputs that match both patterns */
  sampleMatches: string[];
  /** Severity of the conflict */
  severity: 'info' | 'warning' | 'error';
}

/**
 * Rules grouped by category for display
 */
export interface RulesByCategory {
  category: ClassificationCategory;
  rules: ClassificationRule[];
}
