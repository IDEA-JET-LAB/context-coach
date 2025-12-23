'use server';

/**
 * Classification Rules Service
 * Story 22-2: Classification Rule Editor
 *
 * Server actions for managing classification rules and categories.
 * All actions require super admin access.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { verifySuperAdmin, SuperAdminError } from '@/lib/auth/admin';
import { revalidatePath } from 'next/cache';
import { analyzePattern } from '@/lib/utils/redos-detector';
import {
  createCategorySchema,
  updateCategorySchema,
  createRuleSchema,
  updateRuleSchema,
  bulkUpdateRulesSchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
  type CreateRuleInput,
  type UpdateRuleInput,
  type BulkUpdateRulesInput,
} from '@/lib/validations/classification-rules';
import type {
  ClassificationCategory,
  ClassificationRule,
  RulesByCategory,
} from '@/lib/types/classification-rules';

// ============================================================================
// Error Types
// ============================================================================

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

function handleError(error: unknown): ActionResult<never> {
  if (error instanceof SuperAdminError) {
    return { success: false, error: { code: error.code, message: error.message } };
  }
  console.error('[ClassificationRules] Unexpected error:', error);
  return {
    success: false,
    error: { code: 'UNEXPECTED_ERROR', message: 'An unexpected error occurred' },
  };
}

// ============================================================================
// Category Actions
// ============================================================================

/**
 * Get all classification categories with rule counts.
 */
export async function getCategories(): Promise<
  ActionResult<(ClassificationCategory & { rule_count: number })[]>
> {
  try {
    await verifySuperAdmin();
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('classification_categories')
      .select(`
        id,
        name,
        description,
        color,
        sort_order,
        is_archived,
        created_at,
        updated_at,
        classification_rules(id)
      `)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[ClassificationRules] Failed to fetch categories:', error);
      return { success: false, error: { code: 'FETCH_ERROR', message: error.message } };
    }

    const categories = data?.map((cat) => ({
      ...cat,
      rule_count: cat.classification_rules?.length ?? 0,
      classification_rules: undefined,
    })) as (ClassificationCategory & { rule_count: number })[];

    return { success: true, data: categories };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Get a single category by ID.
 */
export async function getCategory(id: string): Promise<ActionResult<ClassificationCategory>> {
  try {
    await verifySuperAdmin();
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('classification_categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } };
      }
      return { success: false, error: { code: 'FETCH_ERROR', message: error.message } };
    }

    return { success: true, data };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Create a new classification category.
 */
export async function createCategory(
  input: CreateCategoryInput
): Promise<ActionResult<{ id: string }>> {
  try {
    await verifySuperAdmin();

    const validated = createCategorySchema.safeParse(input);
    if (!validated.success) {
      const firstError = validated.error.issues[0]?.message ?? 'Validation failed';
      return { success: false, error: { code: 'VALIDATION_ERROR', message: firstError } };
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('classification_categories')
      .insert({
        name: validated.data.name,
        description: validated.data.description ?? null,
        color: validated.data.color,
        sort_order: validated.data.sort_order,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        return {
          success: false,
          error: { code: 'DUPLICATE', message: 'A category with this name already exists' },
        };
      }
      return { success: false, error: { code: 'CREATE_ERROR', message: error.message } };
    }

    console.log(`[ClassificationRules] Category ${data.id} created`);
    revalidatePath('/admin/analysis/rules');
    return { success: true, data: { id: data.id } };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Update a classification category.
 */
export async function updateCategory(
  id: string,
  input: UpdateCategoryInput
): Promise<ActionResult<{ id: string }>> {
  try {
    await verifySuperAdmin();

    const validated = updateCategorySchema.safeParse(input);
    if (!validated.success) {
      const firstError = validated.error.issues[0]?.message ?? 'Validation failed';
      return { success: false, error: { code: 'VALIDATION_ERROR', message: firstError } };
    }

    const supabase = createAdminClient();

    const { error } = await supabase
      .from('classification_categories')
      .update(validated.data)
      .eq('id', id);

    if (error) {
      if (error.code === '23505') {
        return {
          success: false,
          error: { code: 'DUPLICATE', message: 'A category with this name already exists' },
        };
      }
      return { success: false, error: { code: 'UPDATE_ERROR', message: error.message } };
    }

    console.log(`[ClassificationRules] Category ${id} updated`);
    revalidatePath('/admin/analysis/rules');
    return { success: true, data: { id } };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Archive a category (cannot delete if rules exist).
 */
export async function archiveCategory(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    await verifySuperAdmin();
    const supabase = createAdminClient();

    // Check for existing rules
    const { count } = await supabase
      .from('classification_rules')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id);

    if (count && count > 0) {
      return {
        success: false,
        error: {
          code: 'HAS_RULES',
          message: `Cannot archive category with ${count} active rules. Move or delete rules first.`,
        },
      };
    }

    const { error } = await supabase
      .from('classification_categories')
      .update({ is_archived: true })
      .eq('id', id);

    if (error) {
      return { success: false, error: { code: 'ARCHIVE_ERROR', message: error.message } };
    }

    console.log(`[ClassificationRules] Category ${id} archived`);
    revalidatePath('/admin/analysis/rules');
    return { success: true, data: { id } };
  } catch (err) {
    return handleError(err);
  }
}

// ============================================================================
// Rule Actions
// ============================================================================

/**
 * Get all rules grouped by category.
 */
export async function getRulesGroupedByCategory(): Promise<ActionResult<RulesByCategory[]>> {
  try {
    await verifySuperAdmin();
    const supabase = createAdminClient();

    // Fetch categories first
    const { data: categories, error: catError } = await supabase
      .from('classification_categories')
      .select('*')
      .eq('is_archived', false)
      .order('sort_order', { ascending: true });

    if (catError) {
      return { success: false, error: { code: 'FETCH_ERROR', message: catError.message } };
    }

    // Fetch all rules
    const { data: rules, error: rulesError } = await supabase
      .from('classification_rules')
      .select('*')
      .order('priority', { ascending: false });

    if (rulesError) {
      return { success: false, error: { code: 'FETCH_ERROR', message: rulesError.message } };
    }

    // Group rules by category
    const grouped: RulesByCategory[] = categories.map((cat) => ({
      category: cat,
      rules: rules.filter((r) => r.category_id === cat.id),
    }));

    return { success: true, data: grouped };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Get all rules with optional filters.
 */
export async function getRules(options?: {
  category_id?: string;
  enabled?: boolean;
}): Promise<ActionResult<ClassificationRule[]>> {
  try {
    await verifySuperAdmin();
    const supabase = createAdminClient();

    let query = supabase
      .from('classification_rules')
      .select(`
        *,
        category:classification_categories(id, name, color)
      `)
      .order('priority', { ascending: false });

    if (options?.category_id) {
      query = query.eq('category_id', options.category_id);
    }

    if (options?.enabled !== undefined) {
      query = query.eq('enabled', options.enabled);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: { code: 'FETCH_ERROR', message: error.message } };
    }

    return { success: true, data: data as ClassificationRule[] };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Get a single rule by ID.
 */
export async function getRule(id: string): Promise<ActionResult<ClassificationRule>> {
  try {
    await verifySuperAdmin();
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('classification_rules')
      .select(`
        *,
        category:classification_categories(id, name, description, color)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } };
      }
      return { success: false, error: { code: 'FETCH_ERROR', message: error.message } };
    }

    return { success: true, data: data as ClassificationRule };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Create a new classification rule.
 */
export async function createRule(
  input: CreateRuleInput
): Promise<ActionResult<{ id: string; redos_risk: string }>> {
  try {
    const userId = await verifySuperAdmin();

    const validated = createRuleSchema.safeParse(input);
    if (!validated.success) {
      const firstError = validated.error.issues[0]?.message ?? 'Validation failed';
      return { success: false, error: { code: 'VALIDATION_ERROR', message: firstError } };
    }

    // Analyze pattern for ReDoS vulnerabilities
    const redosAnalysis = analyzePattern(validated.data.pattern);

    // Block dangerous patterns
    if (redosAnalysis.risk === 'dangerous') {
      return {
        success: false,
        error: {
          code: 'DANGEROUS_PATTERN',
          message: `Pattern rejected: ${redosAnalysis.issues[0] || 'Potential ReDoS vulnerability detected'}`,
        },
      };
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('classification_rules')
      .insert({
        name: validated.data.name,
        category_id: validated.data.category_id,
        pattern: validated.data.pattern,
        pattern_flags: validated.data.pattern_flags,
        priority: validated.data.priority,
        description: validated.data.description ?? null,
        enabled: validated.data.enabled,
        redos_risk: redosAnalysis.risk,
        created_by: userId,
      })
      .select('id, redos_risk')
      .single();

    if (error) {
      return { success: false, error: { code: 'CREATE_ERROR', message: error.message } };
    }

    console.log(`[ClassificationRules] Rule ${data.id} created with risk level: ${data.redos_risk}`);
    revalidatePath('/admin/analysis/rules');
    return { success: true, data };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Update a classification rule.
 */
export async function updateRule(
  id: string,
  input: UpdateRuleInput
): Promise<ActionResult<{ id: string; redos_risk: string }>> {
  try {
    await verifySuperAdmin();

    const validated = updateRuleSchema.safeParse(input);
    if (!validated.success) {
      const firstError = validated.error.issues[0]?.message ?? 'Validation failed';
      return { success: false, error: { code: 'VALIDATION_ERROR', message: firstError } };
    }

    // If pattern is being updated, analyze for ReDoS
    let redosRisk = validated.data.redos_risk;
    if (validated.data.pattern) {
      const redosAnalysis = analyzePattern(validated.data.pattern);

      if (redosAnalysis.risk === 'dangerous') {
        return {
          success: false,
          error: {
            code: 'DANGEROUS_PATTERN',
            message: `Pattern rejected: ${redosAnalysis.issues[0] || 'Potential ReDoS vulnerability detected'}`,
          },
        };
      }

      redosRisk = redosAnalysis.risk;
    }

    const supabase = createAdminClient();

    const updateData = {
      ...validated.data,
      ...(redosRisk && { redos_risk: redosRisk }),
    };

    const { error } = await supabase
      .from('classification_rules')
      .update(updateData)
      .eq('id', id);

    if (error) {
      return { success: false, error: { code: 'UPDATE_ERROR', message: error.message } };
    }

    console.log(`[ClassificationRules] Rule ${id} updated`);
    revalidatePath('/admin/analysis/rules');
    revalidatePath(`/admin/analysis/rules/${id}`);
    return { success: true, data: { id, redos_risk: redosRisk || 'safe' } };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Toggle rule enabled status.
 */
export async function toggleRuleEnabled(
  id: string
): Promise<ActionResult<{ id: string; enabled: boolean }>> {
  try {
    await verifySuperAdmin();
    const supabase = createAdminClient();

    // Get current state
    const { data: current, error: fetchError } = await supabase
      .from('classification_rules')
      .select('enabled')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } };
      }
      return { success: false, error: { code: 'FETCH_ERROR', message: fetchError.message } };
    }

    // Toggle
    const newEnabled = !current.enabled;
    const { error: updateError } = await supabase
      .from('classification_rules')
      .update({ enabled: newEnabled })
      .eq('id', id);

    if (updateError) {
      return { success: false, error: { code: 'UPDATE_ERROR', message: updateError.message } };
    }

    console.log(`[ClassificationRules] Rule ${id} ${newEnabled ? 'enabled' : 'disabled'}`);
    revalidatePath('/admin/analysis/rules');
    return { success: true, data: { id, enabled: newEnabled } };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Delete a classification rule.
 */
export async function deleteRule(id: string): Promise<ActionResult<{ success: boolean }>> {
  try {
    await verifySuperAdmin();
    const supabase = createAdminClient();

    const { error } = await supabase.from('classification_rules').delete().eq('id', id);

    if (error) {
      return { success: false, error: { code: 'DELETE_ERROR', message: error.message } };
    }

    console.log(`[ClassificationRules] Rule ${id} deleted`);
    revalidatePath('/admin/analysis/rules');
    return { success: true, data: { success: true } };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Bulk update multiple rules at once.
 */
export async function bulkUpdateRules(
  input: BulkUpdateRulesInput
): Promise<ActionResult<{ updated: number }>> {
  try {
    await verifySuperAdmin();

    const validated = bulkUpdateRulesSchema.safeParse(input);
    if (!validated.success) {
      const firstError = validated.error.issues[0]?.message ?? 'Validation failed';
      return { success: false, error: { code: 'VALIDATION_ERROR', message: firstError } };
    }

    const supabase = createAdminClient();

    const { error, count } = await supabase
      .from('classification_rules')
      .update(validated.data.updates)
      .in('id', validated.data.rule_ids);

    if (error) {
      return { success: false, error: { code: 'UPDATE_ERROR', message: error.message } };
    }

    console.log(`[ClassificationRules] Bulk updated ${count} rules`);
    revalidatePath('/admin/analysis/rules');
    return { success: true, data: { updated: count ?? 0 } };
  } catch (err) {
    return handleError(err);
  }
}
