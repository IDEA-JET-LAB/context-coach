/**
 * Pattern Conflict Detector
 * Story 22-2: Classification Rule Editor - Task 13
 *
 * Detects overlapping regex patterns within the same category.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { PatternConflict } from '@/lib/types/classification-rules';

// Word lists for generating sample inputs
const WORD_LISTS = {
  actions: ['fix', 'add', 'create', 'update', 'remove', 'delete', 'implement', 'build', 'refactor', 'debug'],
  objects: ['bug', 'feature', 'test', 'error', 'code', 'function', 'component', 'module', 'api', 'database'],
  modifiers: ['new', 'old', 'broken', 'slow', 'fast', 'urgent', 'important', 'minor', 'major', 'critical'],
};

/**
 * Generate sample strings that might match regex patterns.
 */
function generateSampleInputs(count: number): string[] {
  const samples: string[] = [];
  const templates = [
    (a: string, o: string, m: string) => `${a} the ${o}`,
    (a: string, o: string, m: string) => `Please ${a} this ${m} ${o}`,
    (a: string, o: string, m: string) => `Can you ${a} a ${m} ${o}?`,
    (a: string, o: string, m: string) => `I need to ${a} ${o}`,
    (a: string, o: string, m: string) => `${m} ${o} needs ${a}`,
    (a: string, o: string, m: string) => `Help me ${a} the ${o} please`,
    (a: string, o: string, m: string) => `${a} ${o}`,
    (a: string, o: string, m: string) => `${o} ${a}`,
  ];

  // Generate combinations
  for (const action of WORD_LISTS.actions) {
    for (const obj of WORD_LISTS.objects) {
      for (const mod of WORD_LISTS.modifiers) {
        for (const template of templates) {
          if (samples.length >= count) break;
          samples.push(template(action, obj, mod));
        }
        if (samples.length >= count) break;
      }
      if (samples.length >= count) break;
    }
    if (samples.length >= count) break;
  }

  return samples.slice(0, count);
}

/**
 * Generate strings that specifically match a pattern.
 */
function generateMatchingSamples(pattern: string, count: number): string[] {
  const samples: string[] = [];
  const allSamples = generateSampleInputs(500);

  try {
    const regex = new RegExp(pattern, 'i');

    for (const sample of allSamples) {
      if (regex.test(sample) && samples.length < count) {
        samples.push(sample);
      }
    }
  } catch {
    // Invalid pattern, return empty
  }

  return samples;
}

/**
 * Determine the overlap type between two patterns.
 */
function classifyOverlap(
  newPattern: string,
  existingPattern: string,
  samples: string[]
): 'subset' | 'superset' | 'partial' {
  try {
    const newRegex = new RegExp(newPattern, 'i');
    const existingRegex = new RegExp(existingPattern, 'i');

    let newOnlyCount = 0;
    let existingOnlyCount = 0;
    let bothCount = 0;

    for (const sample of samples) {
      const matchesNew = newRegex.test(sample);
      const matchesExisting = existingRegex.test(sample);

      if (matchesNew && matchesExisting) {
        bothCount++;
      } else if (matchesNew) {
        newOnlyCount++;
      } else if (matchesExisting) {
        existingOnlyCount++;
      }
    }

    // If new matches subset of existing
    if (newOnlyCount === 0 && existingOnlyCount > 0) {
      return 'subset';
    }

    // If new matches superset of existing
    if (existingOnlyCount === 0 && newOnlyCount > 0) {
      return 'superset';
    }

    return 'partial';
  } catch {
    return 'partial';
  }
}

const SEVERITY_ORDER: Record<'info' | 'warning' | 'error', number> = {
  info: 0,
  warning: 1,
  error: 2,
};

/**
 * Detect overlapping patterns within the same category.
 *
 * @param newPattern - The new pattern to check
 * @param categoryId - The category to check within
 * @param excludeRuleId - Rule ID to exclude (when editing existing rule)
 * @returns Array of conflicts sorted by severity
 */
export async function detectPatternConflicts(
  newPattern: string,
  categoryId: string,
  excludeRuleId?: string
): Promise<PatternConflict[]> {
  const conflicts: PatternConflict[] = [];

  // Validate the new pattern first
  try {
    new RegExp(newPattern);
  } catch {
    return []; // Invalid pattern, no conflicts to check
  }

  // Generate samples that match the new pattern
  const samples = generateMatchingSamples(newPattern, 20);
  if (samples.length === 0) {
    return []; // Can't generate matches, skip conflict detection
  }

  // Fetch existing rules in same category
  const supabase = createAdminClient();
  let query = supabase
    .from('classification_rules')
    .select('id, name, pattern, pattern_flags')
    .eq('category_id', categoryId)
    .eq('enabled', true);

  if (excludeRuleId) {
    query = query.neq('id', excludeRuleId);
  }

  const { data: existingRules, error } = await query;

  if (error || !existingRules) {
    console.error('[PatternConflict] Failed to fetch rules:', error);
    return [];
  }

  // Check each existing rule for overlap
  for (const rule of existingRules) {
    try {
      const existingRegex = new RegExp(rule.pattern, rule.pattern_flags || 'i');

      // Find samples that match both patterns
      const matchingBoth = samples.filter((s) => {
        try {
          return existingRegex.test(s);
        } catch {
          return false;
        }
      });

      if (matchingBoth.length > 0) {
        const overlapType = classifyOverlap(newPattern, rule.pattern, generateSampleInputs(100));

        conflicts.push({
          ruleId: rule.id,
          ruleName: rule.name,
          pattern: rule.pattern,
          overlapType,
          sampleMatches: matchingBoth.slice(0, 3),
          severity:
            overlapType === 'subset'
              ? 'info'
              : overlapType === 'superset'
              ? 'warning'
              : 'error',
        });
      }
    } catch {
      // Skip invalid patterns
    }
  }

  // Sort by severity
  return conflicts.sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);
}

/**
 * Quick check for potential conflicts (without database query).
 * Useful for client-side preview.
 */
export function quickConflictCheck(newPattern: string, existingPatterns: string[]): boolean {
  try {
    const newRegex = new RegExp(newPattern, 'i');
    const samples = generateSampleInputs(50);

    for (const existingPattern of existingPatterns) {
      try {
        const existingRegex = new RegExp(existingPattern, 'i');

        for (const sample of samples) {
          if (newRegex.test(sample) && existingRegex.test(sample)) {
            return true; // Potential conflict found
          }
        }
      } catch {
        // Skip invalid patterns
      }
    }

    return false;
  } catch {
    return false;
  }
}
