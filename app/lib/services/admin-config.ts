'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { verifySuperAdmin, SuperAdminError } from '@/lib/auth/admin';
import { revalidatePath } from 'next/cache';
import {
  analysisConfigSchema,
  type AnalysisConfigInput,
  type AnalysisConfig,
  type AnalysisConfigWithDimensions,
  type AnalysisDimension,
} from '@/lib/validations/analysis-config';
import { logConfigChange } from '@/lib/services/audit-log';

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
  console.error('[Admin] Unexpected error:', error);
  return { success: false, error: { code: 'UNEXPECTED_ERROR', message: 'An unexpected error occurred' } };
}

/**
 * Get all analysis configs with dimension counts.
 * Requires super admin access.
 */
export async function getAnalysisConfigs(): Promise<ActionResult<(AnalysisConfig & { dimension_count: number })[]>> {
  try {
    // Verify super admin access before any operations
    await verifySuperAdmin();

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('analysis_configs')
      .select(`
        id,
        version,
        name,
        system_prompt,
        model,
        is_active,
        created_by,
        created_at,
        analysis_dimensions(id)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Admin] Failed to fetch configs:', error);
      return { success: false, error: { code: 'FETCH_ERROR', message: error.message } };
    }

    const configs = data?.map((config) => ({
      id: config.id,
      version: config.version,
      name: config.name,
      system_prompt: config.system_prompt,
      model: config.model,
      is_active: config.is_active,
      created_by: config.created_by,
      created_at: config.created_at,
      dimension_count: config.analysis_dimensions?.length ?? 0,
    })) ?? [];

    return { success: true, data: configs };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Get a single analysis config with all dimensions.
 * Requires super admin access.
 */
export async function getAnalysisConfig(id: string): Promise<ActionResult<AnalysisConfigWithDimensions>> {
  try {
    // Verify super admin access before any operations
    await verifySuperAdmin();

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('analysis_configs')
      .select(`
        id,
        version,
        name,
        system_prompt,
        model,
        is_active,
        created_by,
        created_at,
        analysis_dimensions(
          id,
          config_id,
          name,
          description,
          weight,
          prompt_template,
          scoring_criteria,
          enabled,
          sort_order
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, error: { code: 'NOT_FOUND', message: 'Config not found' } };
      }
      console.error('[Admin] Failed to fetch config:', error);
      return { success: false, error: { code: 'FETCH_ERROR', message: error.message } };
    }

    // Sort dimensions by sort_order
    const configWithSortedDimensions = {
      ...data,
      analysis_dimensions: (data.analysis_dimensions as AnalysisDimension[]).sort((a, b) => a.sort_order - b.sort_order),
    };

    return { success: true, data: configWithSortedDimensions };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Create a new analysis config with dimensions.
 * Requires super admin access.
 */
export async function createAnalysisConfig(input: AnalysisConfigInput): Promise<ActionResult<{ id: string }>> {
  try {
    // Verify super admin access before any operations
    await verifySuperAdmin();

    // Validate input
    const validated = analysisConfigSchema.safeParse(input);
    if (!validated.success) {
      const firstError = validated.error.issues[0]?.message ?? 'Validation failed';
      return { success: false, error: { code: 'VALIDATION_ERROR', message: firstError } };
    }

    const supabase = createAdminClient();

    // Get next version number
    const { data: maxVersion } = await supabase
      .from('analysis_configs')
      .select('version')
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const nextVersion = (maxVersion?.version ?? 0) + 1;

    // Create config
    const { data: config, error: configError } = await supabase
      .from('analysis_configs')
      .insert({
        version: nextVersion,
        name: validated.data.name,
        system_prompt: validated.data.system_prompt,
        model: validated.data.model,
        is_active: false,
      })
      .select()
      .single();

    if (configError) {
      console.error('[Admin] Failed to create config:', configError);
      return { success: false, error: { code: 'CREATE_ERROR', message: configError.message } };
    }

    // Create dimensions
    const dimensions = validated.data.dimensions.map((dim, index) => ({
      config_id: config.id,
      name: dim.name,
      description: dim.description || '',
      weight: dim.weight,
      prompt_template: dim.prompt_template,
      scoring_criteria: dim.scoring_criteria,
      enabled: dim.enabled ?? true,
      sort_order: index,
    }));

    const { error: dimsError } = await supabase
      .from('analysis_dimensions')
      .insert(dimensions);

    if (dimsError) {
      console.error('[Admin] Failed to create dimensions:', dimsError);
      // Rollback config creation
      await supabase.from('analysis_configs').delete().eq('id', config.id);
      return { success: false, error: { code: 'CREATE_ERROR', message: dimsError.message } };
    }

    console.log(`[Admin] Analysis config ${config.id} created with ${dimensions.length} dimensions`);

    // Log audit entry (non-blocking)
    logConfigChange({
      action: 'config_created',
      entity_type: 'analysis_config',
      entity_id: config.id,
      entity_name: config.name,
      after_state: {
        name: config.name,
        version: config.version,
        model: config.model,
        system_prompt: validated.data.system_prompt,
        dimensions: validated.data.dimensions.map((d) => d.name),
      },
    }).catch(console.error);

    revalidatePath('/admin/config');
    return { success: true, data: { id: config.id } };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Update an existing analysis config (only if inactive).
 * Requires super admin access.
 */
export async function updateAnalysisConfig(
  id: string,
  input: Partial<AnalysisConfigInput>
): Promise<ActionResult<{ id: string }>> {
  try {
    // Verify super admin access before any operations
    await verifySuperAdmin();

    const supabase = createAdminClient();

    // Get existing config for audit (before state)
    const { data: existingConfig } = await supabase
      .from('analysis_configs')
      .select('*, analysis_dimensions(*)')
      .eq('id', id)
      .single();

    if (!existingConfig) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Config not found' } };
    }

    if (existingConfig.is_active) {
      return { success: false, error: { code: 'FORBIDDEN', message: 'Cannot edit active config' } };
    }

    // Capture before state for audit
    const beforeState = {
      name: existingConfig.name,
      model: existingConfig.model,
      system_prompt: existingConfig.system_prompt,
      dimensions: existingConfig.analysis_dimensions?.map((d: AnalysisDimension) => d.name) || [],
    };

    // Update config
    const { error: configError } = await supabase
      .from('analysis_configs')
      .update({
        name: input.name,
        system_prompt: input.system_prompt,
        model: input.model,
      })
      .eq('id', id);

    if (configError) {
      console.error('[Admin] Failed to update config:', configError);
      return { success: false, error: { code: 'UPDATE_ERROR', message: configError.message } };
    }

    // If dimensions are provided, replace them
    if (input.dimensions) {
      // Delete existing dimensions
      await supabase.from('analysis_dimensions').delete().eq('config_id', id);

      // Insert new dimensions
      const dimensions = input.dimensions.map((dim, index) => ({
        config_id: id,
        name: dim.name,
        description: dim.description || '',
        weight: dim.weight,
        prompt_template: dim.prompt_template,
        scoring_criteria: dim.scoring_criteria,
        enabled: dim.enabled ?? true,
        sort_order: index,
      }));

      const { error: dimsError } = await supabase
        .from('analysis_dimensions')
        .insert(dimensions);

      if (dimsError) {
        console.error('[Admin] Failed to update dimensions:', dimsError);
        return { success: false, error: { code: 'UPDATE_ERROR', message: dimsError.message } };
      }
    }

    console.log(`[Admin] Analysis config ${id} updated`);

    // Log audit entry (non-blocking)
    logConfigChange({
      action: 'config_updated',
      entity_type: 'analysis_config',
      entity_id: id,
      entity_name: input.name || existingConfig.name,
      before_state: beforeState,
      after_state: {
        name: input.name || existingConfig.name,
        model: input.model || existingConfig.model,
        system_prompt: input.system_prompt || existingConfig.system_prompt,
        dimensions: input.dimensions?.map((d) => d.name) || beforeState.dimensions,
      },
    }).catch(console.error);

    revalidatePath('/admin/config');
    revalidatePath(`/admin/config/${id}`);
    return { success: true, data: { id } };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Activate an analysis config (deactivates the current active one).
 * Requires super admin access.
 */
export async function activateConfig(configId: string): Promise<ActionResult<{ success: boolean }>> {
  try {
    // Verify super admin access before any operations
    await verifySuperAdmin();

    const supabase = createAdminClient();

    // Check if config exists and has valid weights
    const { data: config } = await supabase
      .from('analysis_configs')
      .select(`
        id,
        name,
        is_active,
        analysis_dimensions(weight)
      `)
      .eq('id', configId)
      .single();

    if (!config) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Config not found' } };
    }

    if (config.is_active) {
      return { success: false, error: { code: 'ALREADY_ACTIVE', message: 'Config is already active' } };
    }

    // Verify weights sum to 100
    const totalWeight = (config.analysis_dimensions as { weight: number }[]).reduce(
      (sum, dim) => sum + dim.weight,
      0
    );

    if (totalWeight !== 100) {
      return { success: false, error: { code: 'VALIDATION_ERROR', message: 'Dimension weights must sum to 100' } };
    }

    // Deactivate all configs first
    const { error: deactivateError } = await supabase
      .from('analysis_configs')
      .update({ is_active: false })
      .eq('is_active', true);

    if (deactivateError) {
      console.error('[Admin] Failed to deactivate configs:', deactivateError);
      return { success: false, error: { code: 'ACTIVATION_ERROR', message: deactivateError.message } };
    }

    // Activate selected config
    const { error: activateError } = await supabase
      .from('analysis_configs')
      .update({ is_active: true })
      .eq('id', configId);

    if (activateError) {
      console.error('[Admin] Failed to activate config:', activateError);
      return { success: false, error: { code: 'ACTIVATION_ERROR', message: activateError.message } };
    }

    console.log(`[Admin] Analysis config ${configId} activated`);

    // Log audit entry (non-blocking)
    logConfigChange({
      action: 'config_activated',
      entity_type: 'analysis_config',
      entity_id: configId,
      entity_name: config.name,
      before_state: { is_active: false },
      after_state: { is_active: true },
    }).catch(console.error);

    revalidatePath('/admin/config');
    revalidatePath(`/admin/config/${configId}`);
    return { success: true, data: { success: true } };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Duplicate an analysis config.
 * Requires super admin access.
 */
export async function duplicateConfig(configId: string): Promise<ActionResult<{ id: string }>> {
  try {
    // Verify super admin access before any operations
    // Note: getAnalysisConfig also verifies, but we verify first for consistency
    await verifySuperAdmin();

    // Get existing config with dimensions (this also verifies admin)
    const result = await getAnalysisConfig(configId);
    if (!result.success) {
      return result;
    }

    const original = result.data;

    // Create new config input
    const newConfigInput: AnalysisConfigInput = {
      name: `Copy of ${original.name}`,
      system_prompt: original.system_prompt,
      model: original.model as AnalysisConfigInput['model'],
      dimensions: original.analysis_dimensions.map((dim) => ({
        name: dim.name,
        description: dim.description,
        weight: dim.weight,
        prompt_template: dim.prompt_template,
        scoring_criteria: dim.scoring_criteria,
        sort_order: dim.sort_order,
        enabled: dim.enabled,
      })),
    };

    // Create the duplicate
    const createResult = await createAnalysisConfig(newConfigInput);
    if (!createResult.success) {
      return createResult;
    }

    console.log(`[Admin] Analysis config ${configId} duplicated to ${createResult.data.id}`);

    // Log audit entry for duplication (non-blocking)
    // Note: createAnalysisConfig already logs the creation
    logConfigChange({
      action: 'config_duplicated',
      entity_type: 'analysis_config',
      entity_id: createResult.data.id,
      entity_name: `Copy of ${original.name}`,
      after_state: {
        original_id: configId,
        original_name: original.name,
      },
    }).catch(console.error);

    return createResult;
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Delete an analysis config (only if inactive).
 * Requires super admin access.
 */
export async function deleteConfig(configId: string): Promise<ActionResult<{ success: boolean }>> {
  try {
    // Verify super admin access before any operations
    await verifySuperAdmin();

    const supabase = createAdminClient();

    // Get config for audit before deleting
    const { data: config } = await supabase
      .from('analysis_configs')
      .select('name, is_active, model, system_prompt')
      .eq('id', configId)
      .single();

    if (!config) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Config not found' } };
    }

    if (config.is_active) {
      return { success: false, error: { code: 'FORBIDDEN', message: 'Cannot delete active config' } };
    }

    // Delete config (dimensions will be deleted by cascade)
    const { error } = await supabase
      .from('analysis_configs')
      .delete()
      .eq('id', configId);

    if (error) {
      console.error('[Admin] Failed to delete config:', error);
      return { success: false, error: { code: 'DELETE_ERROR', message: error.message } };
    }

    console.log(`[Admin] Analysis config ${configId} deleted`);

    // Log audit entry (non-blocking)
    logConfigChange({
      action: 'config_deleted',
      entity_type: 'analysis_config',
      entity_id: configId,
      entity_name: config.name,
      before_state: {
        name: config.name,
        model: config.model,
        system_prompt: config.system_prompt,
      },
    }).catch(console.error);

    revalidatePath('/admin/config');
    return { success: true, data: { success: true } };
  } catch (err) {
    return handleError(err);
  }
}
