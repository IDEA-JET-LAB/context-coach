'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { verifySuperAdmin, SuperAdminError } from '@/lib/auth/admin';
import { revalidatePath } from 'next/cache';
import type {
  DimensionWeight,
  WeightConfiguration,
  WeightSaveRequest,
  WeightChange,
  WeightHistoryEntry,
} from '@/lib/types/scoring-weights';

// Error types
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

/**
 * Helper to handle SuperAdminError in action results
 */
function handleError(error: unknown): ActionResult<never> {
  if (error instanceof SuperAdminError) {
    return { success: false, error: { code: error.code, message: error.message } };
  }
  console.error('[ScoringWeights] Unexpected error:', error);
  return {
    success: false,
    error: { code: 'UNEXPECTED_ERROR', message: 'An unexpected error occurred' },
  };
}

/**
 * Get current weights from active config
 */
export async function getCurrentWeights(): Promise<ActionResult<WeightConfiguration>> {
  try {
    await verifySuperAdmin();

    const supabase = createAdminClient();

    const { data: activeConfig, error: configError } = await supabase
      .from('analysis_configs')
      .select('id, version, name, is_active')
      .eq('is_active', true)
      .single();

    if (configError || !activeConfig) {
      return {
        success: false,
        error: { code: 'NO_ACTIVE_CONFIG', message: 'No active analysis config found' },
      };
    }

    const { data: dimensions, error: dimsError } = await supabase
      .from('analysis_dimensions')
      .select('id, name, description, weight, enabled, prompt_template, scoring_criteria, sort_order')
      .eq('config_id', activeConfig.id)
      .order('sort_order', { ascending: true });

    if (dimsError) {
      return { success: false, error: { code: 'FETCH_ERROR', message: dimsError.message } };
    }

    const dimensionWeights: DimensionWeight[] = (dimensions || []).map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description || '',
      weight: d.weight,
      enabled: d.enabled,
      prompt_template: d.prompt_template,
      scoring_criteria: d.scoring_criteria,
      sort_order: d.sort_order,
    }));

    const total = dimensionWeights.reduce((sum, d) => sum + (d.enabled ? d.weight : 0), 0);

    return {
      success: true,
      data: {
        config_id: activeConfig.id,
        config_version: activeConfig.version,
        config_name: activeConfig.name,
        is_active: activeConfig.is_active,
        dimensions: dimensionWeights,
        total,
        is_valid: total === 100,
      },
    };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Save updated weights
 */
export async function saveWeights(request: WeightSaveRequest): Promise<ActionResult<{ success: boolean }>> {
  try {
    const adminId = await verifySuperAdmin();

    const supabase = createAdminClient();

    // Verify the config exists and is active
    const { data: config, error: configError } = await supabase
      .from('analysis_configs')
      .select('id, is_active')
      .eq('id', request.config_id)
      .single();

    if (configError || !config) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Configuration not found' },
      };
    }

    if (!config.is_active) {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cannot update weights for inactive config' },
      };
    }

    // Validate total equals 100 for enabled dimensions
    const enabledWeights = request.weights.filter((w) => w.enabled);
    const total = enabledWeights.reduce((sum, w) => sum + w.weight, 0);

    if (total !== 100) {
      return {
        success: false,
        error: {
          code: 'INVALID_TOTAL',
          message: `Weights must sum to 100% (currently ${total}%)`,
        },
      };
    }

    // Get current weights for audit trail
    const { data: currentDimensions } = await supabase
      .from('analysis_dimensions')
      .select('id, name, weight, enabled')
      .eq('config_id', request.config_id);

    const changes: WeightChange[] = [];
    const currentMap = new Map(currentDimensions?.map((d) => [d.id, d]) || []);

    // Update each dimension
    for (const weight of request.weights) {
      const current = currentMap.get(weight.dimension_id);
      if (current && (current.weight !== weight.weight || current.enabled !== weight.enabled)) {
        changes.push({
          dimension_id: weight.dimension_id,
          dimension_name: current.name,
          old_weight: current.weight,
          new_weight: weight.weight,
          old_enabled: current.enabled,
          new_enabled: weight.enabled,
        });
      }

      const { error } = await supabase
        .from('analysis_dimensions')
        .update({ weight: weight.weight, enabled: weight.enabled })
        .eq('id', weight.dimension_id);

      if (error) {
        return { success: false, error: { code: 'UPDATE_ERROR', message: error.message } };
      }
    }

    // Log to audit trail using config_audit_logs table
    if (changes.length > 0) {
      // Get admin email for audit log
      const { data: adminData } = await supabase
        .from('users')
        .select('email')
        .eq('id', adminId)
        .single();

      const changeSummary = changes
        .map((c) => `${c.dimension_name}: ${c.old_weight}% -> ${c.new_weight}%`)
        .join(', ');

      const { error: auditError } = await supabase.from('config_audit_logs').insert({
        action: 'weight_updated',
        entity_type: 'scoring_weight',
        entity_id: request.config_id,
        entity_name: 'Scoring Weights',
        before_state: Object.fromEntries(changes.map((c) => [c.dimension_name, { weight: c.old_weight, enabled: c.old_enabled }])),
        after_state: Object.fromEntries(changes.map((c) => [c.dimension_name, { weight: c.new_weight, enabled: c.new_enabled }])),
        change_summary: changeSummary,
        changed_by: adminId,
        changed_by_email: adminData?.email || null,
      });

      if (auditError) {
        console.error('[ScoringWeights] Failed to log audit:', auditError);
        // Don't fail the operation for audit log errors
      }
    }

    revalidatePath('/admin/analysis/weights');
    revalidatePath('/admin/config');
    return { success: true, data: { success: true } };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Get weight change history from audit trail
 */
export async function getWeightHistory(
  limit: number = 10
): Promise<ActionResult<WeightHistoryEntry[]>> {
  try {
    await verifySuperAdmin();

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('config_audit_logs')
      .select(`
        id,
        created_at,
        changed_by,
        changed_by_email,
        before_state,
        after_state,
        change_summary,
        entity_id
      `)
      .eq('action', 'weight_updated')
      .eq('entity_type', 'scoring_weight')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      // If table doesn't exist yet, return empty array
      if (error.code === '42P01') {
        return { success: true, data: [] };
      }
      return { success: false, error: { code: 'FETCH_ERROR', message: error.message } };
    }

    // Convert audit log format to weight history format
    const history: WeightHistoryEntry[] = (data || []).map((entry) => {
      const beforeState = entry.before_state as Record<string, { weight: number; enabled?: boolean }> | null;
      const afterState = entry.after_state as Record<string, { weight: number; enabled?: boolean }> | null;

      // Reconstruct changes from before/after state
      const changes: WeightChange[] = [];
      if (beforeState && afterState) {
        for (const [dimName, before] of Object.entries(beforeState)) {
          const after = afterState[dimName];
          if (after) {
            changes.push({
              dimension_id: '', // Not stored in this format
              dimension_name: dimName,
              old_weight: before.weight,
              new_weight: after.weight,
              old_enabled: before.enabled,
              new_enabled: after.enabled,
            });
          }
        }
      }

      return {
        id: entry.id,
        created_at: entry.created_at,
        admin_id: entry.changed_by || '',
        admin_email: entry.changed_by_email || undefined,
        action: 'weight_update' as const,
        changes,
        total_weight: 100, // Calculate from after_state if needed
      };
    });

    return { success: true, data: history };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Revert to a previous weight configuration from history
 */
export async function revertToHistoricalWeights(
  historyEntryId: string
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const adminId = await verifySuperAdmin();

    const supabase = createAdminClient();

    // Get the historical entry from config_audit_logs
    const { data: historyEntry, error: historyError } = await supabase
      .from('config_audit_logs')
      .select('before_state, entity_id')
      .eq('id', historyEntryId)
      .eq('action', 'weight_updated')
      .single();

    if (historyError || !historyEntry) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'History entry not found' },
      };
    }

    const beforeState = historyEntry.before_state as Record<string, { weight: number; enabled?: boolean }> | null;
    if (!beforeState || Object.keys(beforeState).length === 0) {
      return {
        success: false,
        error: { code: 'NO_CHANGES', message: 'No weight changes found in history entry' },
      };
    }

    // Get current dimension IDs by name
    const { data: dimensions } = await supabase
      .from('analysis_dimensions')
      .select('id, name')
      .eq('config_id', historyEntry.entity_id);

    const dimNameToId = new Map(dimensions?.map((d) => [d.name, d.id]) || []);

    // Revert each dimension to its previous state
    for (const [dimName, state] of Object.entries(beforeState)) {
      const dimId = dimNameToId.get(dimName);
      if (!dimId) continue;

      const { error } = await supabase
        .from('analysis_dimensions')
        .update({
          weight: state.weight,
          enabled: state.enabled ?? true,
        })
        .eq('id', dimId);

      if (error) {
        return { success: false, error: { code: 'UPDATE_ERROR', message: error.message } };
      }
    }

    // Get admin email for audit log
    const { data: adminData } = await supabase
      .from('users')
      .select('email')
      .eq('id', adminId)
      .single();

    // Log the revert action
    await supabase.from('config_audit_logs').insert({
      action: 'weight_updated',
      entity_type: 'scoring_weight',
      entity_id: historyEntry.entity_id,
      entity_name: 'Scoring Weights (Reverted)',
      before_state: null, // Could capture current state here
      after_state: beforeState,
      change_summary: `Reverted to previous configuration from ${historyEntryId}`,
      changed_by: adminId,
      changed_by_email: adminData?.email || null,
    });

    revalidatePath('/admin/analysis/weights');
    return { success: true, data: { success: true } };
  } catch (err) {
    return handleError(err);
  }
}
