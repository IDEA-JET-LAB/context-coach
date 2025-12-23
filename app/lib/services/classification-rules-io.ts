'use server';

/**
 * Classification Rules Import/Export Service
 * Story 22-2: Classification Rule Editor - Task 12
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { verifySuperAdmin, SuperAdminError } from '@/lib/auth/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { analyzePattern } from '@/lib/utils/redos-detector';
import {
  importSchemaValidator,
  type ClassificationRulesExport,
  type ImportResult,
  type ImportPreview,
} from '@/lib/types/classification-rules-io';

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

function handleError(error: unknown): ActionResult<never> {
  if (error instanceof SuperAdminError) {
    return { success: false, error: { code: error.code, message: error.message } };
  }
  console.error('[ClassificationRulesIO] Unexpected error:', error);
  return {
    success: false,
    error: { code: 'UNEXPECTED_ERROR', message: 'An unexpected error occurred' },
  };
}

/**
 * Export all classification rules and categories as JSON.
 */
export async function exportRules(): Promise<ActionResult<ClassificationRulesExport>> {
  try {
    await verifySuperAdmin();
    const supabase = createAdminClient();
    const userSupabase = await createClient();

    // Get current user email
    const { data: { user } } = await userSupabase.auth.getUser();

    // Fetch categories
    const { data: categories, error: catError } = await supabase
      .from('classification_categories')
      .select('name, description, color, sort_order')
      .eq('is_archived', false)
      .order('sort_order');

    if (catError) {
      return { success: false, error: { code: 'FETCH_ERROR', message: catError.message } };
    }

    // Fetch rules with category names
    const { data: rules, error: rulesError } = await supabase
      .from('classification_rules')
      .select(`
        name,
        pattern,
        pattern_flags,
        priority,
        description,
        enabled,
        category:classification_categories(name)
      `)
      .order('priority', { ascending: false });

    if (rulesError) {
      return { success: false, error: { code: 'FETCH_ERROR', message: rulesError.message } };
    }

    const exportData: ClassificationRulesExport = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      exportedBy: user?.email || 'unknown',
      categories: categories.map((c) => ({
        name: c.name,
        description: c.description,
        color: c.color,
        sort_order: c.sort_order,
      })),
      rules: rules.map((r) => ({
        name: r.name,
        category_name: (r.category as { name: string })?.name || 'unknown',
        pattern: r.pattern,
        pattern_flags: r.pattern_flags,
        priority: r.priority,
        description: r.description,
        enabled: r.enabled,
      })),
    };

    console.log(`[ClassificationRulesIO] Exported ${rules.length} rules`);
    return { success: true, data: exportData };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Preview what an import will do without applying changes.
 */
export async function previewImport(jsonContent: string): Promise<ActionResult<ImportPreview>> {
  try {
    await verifySuperAdmin();

    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonContent);
    } catch {
      return {
        success: false,
        error: { code: 'INVALID_JSON', message: 'Invalid JSON format' },
      };
    }

    // Validate schema
    const validated = importSchemaValidator.safeParse(parsed);
    if (!validated.success) {
      const errors = validated.error.issues.map(
        (i) => `${i.path.join('.')}: ${i.message}`
      );
      return {
        success: true,
        data: {
          valid: false,
          errors,
          categories: [],
          rules: [],
        },
      };
    }

    const importData = validated.data;
    const supabase = createAdminClient();

    // Check existing categories
    const { data: existingCategories } = await supabase
      .from('classification_categories')
      .select('name');

    const existingCatNames = new Set(existingCategories?.map((c) => c.name) || []);

    // Check existing rules
    const { data: existingRules } = await supabase
      .from('classification_rules')
      .select('name');

    const existingRuleNames = new Set(existingRules?.map((r) => r.name) || []);

    const preview: ImportPreview = {
      valid: true,
      errors: [],
      categories: importData.categories.map((cat) => ({
        name: cat.name,
        action: existingCatNames.has(cat.name) ? 'skip' : 'create',
      })),
      rules: [],
    };

    // Validate patterns and check conflicts
    for (const rule of importData.rules) {
      // Check if category will exist
      const categoryExists =
        existingCatNames.has(rule.category_name) ||
        importData.categories.some((c) => c.name === rule.category_name);

      if (!categoryExists) {
        preview.errors.push(`Rule "${rule.name}": category "${rule.category_name}" not found`);
        preview.rules.push({
          name: rule.name,
          categoryName: rule.category_name,
          action: 'skip',
        });
        continue;
      }

      // Validate regex
      try {
        new RegExp(rule.pattern);
      } catch {
        preview.errors.push(`Rule "${rule.name}": invalid regex pattern`);
        preview.rules.push({
          name: rule.name,
          categoryName: rule.category_name,
          action: 'skip',
        });
        continue;
      }

      // Check ReDoS risk
      const redosAnalysis = analyzePattern(rule.pattern);
      if (redosAnalysis.risk === 'dangerous') {
        preview.errors.push(`Rule "${rule.name}": ReDoS vulnerability detected`);
        preview.rules.push({
          name: rule.name,
          categoryName: rule.category_name,
          action: 'skip',
        });
        continue;
      }

      // Check if rule exists
      if (existingRuleNames.has(rule.name)) {
        preview.rules.push({
          name: rule.name,
          categoryName: rule.category_name,
          action: 'update',
          conflictsWith: rule.name,
        });
      } else {
        preview.rules.push({
          name: rule.name,
          categoryName: rule.category_name,
          action: 'create',
        });
      }
    }

    return { success: true, data: preview };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Import rules from JSON content.
 */
export async function importRules(
  jsonContent: string,
  options: { skipConflicting?: boolean; updateExisting?: boolean } = {}
): Promise<ActionResult<ImportResult>> {
  try {
    const userId = await verifySuperAdmin();

    // Parse and validate
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonContent);
    } catch {
      return {
        success: false,
        error: { code: 'INVALID_JSON', message: 'Invalid JSON format' },
      };
    }

    const validated = importSchemaValidator.safeParse(parsed);
    if (!validated.success) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validated.error.issues[0]?.message || 'Schema validation failed',
        },
      };
    }

    const importData = validated.data;
    const supabase = createAdminClient();

    const result: ImportResult = {
      success: true,
      summary: {
        categoriesCreated: 0,
        categoriesSkipped: 0,
        rulesCreated: 0,
        rulesUpdated: 0,
        rulesSkipped: 0,
        errors: 0,
      },
      details: [],
    };

    // Build category name -> id map
    const categoryIdMap = new Map<string, string>();

    // Get existing categories
    const { data: existingCategories } = await supabase
      .from('classification_categories')
      .select('id, name');

    existingCategories?.forEach((c) => categoryIdMap.set(c.name, c.id));

    // Create new categories
    for (const cat of importData.categories) {
      if (categoryIdMap.has(cat.name)) {
        result.summary.categoriesSkipped++;
        continue;
      }

      const { data: newCat, error: catError } = await supabase
        .from('classification_categories')
        .insert({
          name: cat.name,
          description: cat.description,
          color: cat.color,
          sort_order: cat.sort_order,
        })
        .select('id')
        .single();

      if (catError) {
        console.error('[ImportRules] Failed to create category:', catError);
        result.summary.errors++;
        continue;
      }

      categoryIdMap.set(cat.name, newCat.id);
      result.summary.categoriesCreated++;
    }

    // Get existing rules
    const { data: existingRules } = await supabase
      .from('classification_rules')
      .select('id, name');

    const existingRuleMap = new Map<string, string>();
    existingRules?.forEach((r) => existingRuleMap.set(r.name, r.id));

    // Import rules
    for (const rule of importData.rules) {
      const categoryId = categoryIdMap.get(rule.category_name);

      if (!categoryId) {
        result.details.push({
          ruleName: rule.name,
          status: 'skipped',
          reason: `Category "${rule.category_name}" not found`,
        });
        result.summary.rulesSkipped++;
        continue;
      }

      // Validate regex
      try {
        new RegExp(rule.pattern);
      } catch {
        result.details.push({
          ruleName: rule.name,
          status: 'error',
          reason: 'Invalid regex pattern',
        });
        result.summary.errors++;
        continue;
      }

      // Check ReDoS
      const redosAnalysis = analyzePattern(rule.pattern);
      if (redosAnalysis.risk === 'dangerous') {
        result.details.push({
          ruleName: rule.name,
          status: 'error',
          reason: 'ReDoS vulnerability detected',
        });
        result.summary.errors++;
        continue;
      }

      const existingRuleId = existingRuleMap.get(rule.name);

      if (existingRuleId) {
        if (options.skipConflicting) {
          result.details.push({
            ruleName: rule.name,
            status: 'skipped',
            reason: 'Rule already exists',
            conflictsWith: rule.name,
          });
          result.summary.rulesSkipped++;
          continue;
        }

        if (options.updateExisting) {
          const { error } = await supabase
            .from('classification_rules')
            .update({
              category_id: categoryId,
              pattern: rule.pattern,
              pattern_flags: rule.pattern_flags,
              priority: rule.priority,
              description: rule.description,
              enabled: rule.enabled,
              redos_risk: redosAnalysis.risk,
            })
            .eq('id', existingRuleId);

          if (error) {
            result.details.push({
              ruleName: rule.name,
              status: 'error',
              reason: error.message,
            });
            result.summary.errors++;
          } else {
            result.details.push({
              ruleName: rule.name,
              status: 'updated',
            });
            result.summary.rulesUpdated++;
          }
          continue;
        }

        // Default: skip
        result.details.push({
          ruleName: rule.name,
          status: 'skipped',
          reason: 'Rule already exists',
          conflictsWith: rule.name,
        });
        result.summary.rulesSkipped++;
        continue;
      }

      // Create new rule
      const { error } = await supabase.from('classification_rules').insert({
        name: rule.name,
        category_id: categoryId,
        pattern: rule.pattern,
        pattern_flags: rule.pattern_flags,
        priority: rule.priority,
        description: rule.description,
        enabled: rule.enabled,
        redos_risk: redosAnalysis.risk,
        created_by: userId,
      });

      if (error) {
        result.details.push({
          ruleName: rule.name,
          status: 'error',
          reason: error.message,
        });
        result.summary.errors++;
      } else {
        result.details.push({
          ruleName: rule.name,
          status: 'created',
        });
        result.summary.rulesCreated++;
      }
    }

    console.log(
      `[ClassificationRulesIO] Import complete: ${result.summary.rulesCreated} created, ${result.summary.rulesUpdated} updated, ${result.summary.rulesSkipped} skipped`
    );

    revalidatePath('/admin/analysis/rules');
    return { success: true, data: result };
  } catch (err) {
    return handleError(err);
  }
}
