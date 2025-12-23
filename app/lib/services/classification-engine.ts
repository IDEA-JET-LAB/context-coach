/**
 * Classification Engine
 * Story 22-2: Classification Rule Editor
 *
 * Provides prompt classification using regex-based rules with priority ordering.
 * Results include both primary classification and all matching rules for debugging.
 *
 * Note: This file is NOT a server action module because it has non-async exports.
 * Use the individual exported functions directly from server-side code.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { ClassificationResult, ClassificationRule } from '@/lib/types/classification-rules';

// ============================================================================
// Pattern Cache
// ============================================================================

interface CachedRule {
  id: string;
  name: string;
  pattern: string;
  flags: string;
  priority: number;
  category_id: string;
  category_name: string;
  compiledRegex?: RegExp;
}

let cachedRules: CachedRule[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Compile a regex pattern with caching.
 */
function getCompiledPattern(rule: CachedRule): RegExp | null {
  if (rule.compiledRegex) {
    return rule.compiledRegex;
  }

  try {
    rule.compiledRegex = new RegExp(rule.pattern, rule.flags);
    return rule.compiledRegex;
  } catch (error) {
    console.error(`[ClassificationEngine] Invalid pattern in rule ${rule.id}:`, error);
    return null;
  }
}

/**
 * Load and cache enabled rules from database.
 */
async function loadRules(): Promise<CachedRule[]> {
  const now = Date.now();

  // Return cached rules if still valid
  if (cachedRules && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedRules;
  }

  const supabase = createAdminClient();

  const { data: rules, error } = await supabase
    .from('classification_rules')
    .select(`
      id,
      name,
      pattern,
      pattern_flags,
      priority,
      category_id,
      category:classification_categories(name)
    `)
    .eq('enabled', true)
    .order('priority', { ascending: false });

  if (error) {
    console.error('[ClassificationEngine] Failed to load rules:', error);
    return cachedRules || [];
  }

  cachedRules = rules.map((r) => ({
    id: r.id,
    name: r.name,
    pattern: r.pattern,
    flags: r.pattern_flags || 'i',
    priority: r.priority,
    category_id: r.category_id,
    category_name: (r.category as { name: string })?.name || 'unknown',
  }));
  cacheTimestamp = now;

  console.log(`[ClassificationEngine] Loaded ${cachedRules.length} classification rules`);
  return cachedRules;
}

/**
 * Invalidate the rules cache.
 * Call this after rule updates.
 */
export function invalidateRulesCache(): void {
  cachedRules = null;
  cacheTimestamp = 0;
  console.log('[ClassificationEngine] Rules cache invalidated');
}

// ============================================================================
// Classification Functions
// ============================================================================

/**
 * Classify a prompt using the configured rules.
 *
 * @param prompt - The prompt text to classify
 * @param timeout - Maximum time per pattern in milliseconds (default: 50ms)
 * @returns Classification result with primary category and all matches
 */
export async function classifyPrompt(
  prompt: string,
  timeout = 50
): Promise<ClassificationResult> {
  const rules = await loadRules();

  if (rules.length === 0) {
    return { primary: null, all_matches: [] };
  }

  const matches: ClassificationResult['all_matches'] = [];

  for (const rule of rules) {
    const regex = getCompiledPattern(rule);
    if (!regex) continue;

    try {
      // Execute with timeout protection
      const start = performance.now();
      const isMatch = regex.test(prompt);
      const elapsed = performance.now() - start;

      if (elapsed > timeout) {
        console.warn(
          `[ClassificationEngine] Pattern "${rule.name}" took ${elapsed.toFixed(1)}ms (limit: ${timeout}ms)`
        );
        continue; // Skip slow patterns
      }

      if (isMatch) {
        matches.push({
          category: rule.category_name,
          category_id: rule.category_id,
          rule_id: rule.id,
          rule_name: rule.name,
          priority: rule.priority,
        });
      }
    } catch (error) {
      console.error(`[ClassificationEngine] Error matching rule ${rule.id}:`, error);
    }
  }

  // Primary is highest priority match (already sorted by priority)
  const primary =
    matches.length > 0
      ? {
          category: matches[0].category,
          category_id: matches[0].category_id,
          rule_id: matches[0].rule_id,
          rule_name: matches[0].rule_name,
          confidence: calculateConfidence(matches),
        }
      : null;

  return { primary, all_matches: matches };
}

/**
 * Calculate classification confidence based on matching rules.
 *
 * - Single match: 95% confidence
 * - Multiple matches same category: 90% confidence
 * - Multiple matches different categories: 70% confidence
 */
function calculateConfidence(matches: ClassificationResult['all_matches']): number {
  if (matches.length === 0) return 0;
  if (matches.length === 1) return 0.95;

  // Check if all matches are same category
  const uniqueCategories = new Set(matches.map((m) => m.category_id));
  if (uniqueCategories.size === 1) return 0.9;

  // Multiple categories = ambiguous
  return 0.7;
}

/**
 * Test a prompt against a specific pattern.
 * Useful for rule testing UI.
 *
 * @param prompt - The prompt text to test
 * @param pattern - The regex pattern
 * @param flags - Regex flags (default: 'i')
 * @returns Match result with details
 */
export async function testPattern(
  prompt: string,
  pattern: string,
  flags = 'i'
): Promise<{
  matched: boolean;
  matches: Array<{
    text: string;
    index: number;
    length: number;
    groups: Record<string, string>;
  }>;
  executionTime: number;
  error?: string;
}> {
  const start = performance.now();

  try {
    const regex = new RegExp(pattern, flags.includes('g') ? flags : `${flags}g`);
    const matches: Array<{
      text: string;
      index: number;
      length: number;
      groups: Record<string, string>;
    }> = [];

    let match: RegExpExecArray | null;
    while ((match = regex.exec(prompt)) !== null) {
      matches.push({
        text: match[0],
        index: match.index,
        length: match[0].length,
        groups: match.groups || {},
      });

      // Safety limit
      if (matches.length >= 100) break;

      // Prevent infinite loops on zero-length matches
      if (match[0].length === 0) {
        regex.lastIndex++;
      }
    }

    return {
      matched: matches.length > 0,
      matches,
      executionTime: performance.now() - start,
    };
  } catch (error) {
    return {
      matched: false,
      matches: [],
      executionTime: performance.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get recent prompts matched by a specific rule.
 * Useful for rule detail page.
 *
 * @param ruleId - The rule ID
 * @param limit - Maximum number of prompts to return (default: 10)
 * @returns Recent matched prompts
 */
export async function getRecentMatchesForRule(
  ruleId: string,
  limit = 10
): Promise<{
  success: boolean;
  data?: Array<{ id: string; text: string; created_at: string }>;
  error?: string;
}> {
  try {
    const supabase = createAdminClient();

    // Get the rule pattern
    const { data: rule, error: ruleError } = await supabase
      .from('classification_rules')
      .select('pattern, pattern_flags')
      .eq('id', ruleId)
      .single();

    if (ruleError) {
      return { success: false, error: 'Rule not found' };
    }

    // Fetch recent prompts (we'll filter in code)
    const { data: prompts, error: promptsError } = await supabase
      .from('prompts')
      .select('id, raw_text, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (promptsError) {
      return { success: false, error: promptsError.message };
    }

    // Filter prompts that match the pattern
    const regex = new RegExp(rule.pattern, rule.pattern_flags || 'i');
    const matchingPrompts = prompts
      .filter((p) => {
        try {
          return regex.test(p.raw_text);
        } catch {
          return false;
        }
      })
      .slice(0, limit)
      .map((p) => ({
        id: p.id,
        text: p.raw_text.substring(0, 200) + (p.raw_text.length > 200 ? '...' : ''),
        created_at: p.created_at,
      }));

    return { success: true, data: matchingPrompts };
  } catch (error) {
    console.error('[ClassificationEngine] Error getting matches:', error);
    return { success: false, error: 'Failed to fetch matches' };
  }
}

/**
 * Update match count for a rule.
 * Called by analytics pipeline.
 */
export async function incrementMatchCount(ruleId: string): Promise<void> {
  const supabase = createAdminClient();

  await supabase.rpc('increment_rule_match_count', { rule_id: ruleId }).catch((error) => {
    console.error(`[ClassificationEngine] Failed to increment match count for ${ruleId}:`, error);
  });
}
