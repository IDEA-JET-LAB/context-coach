'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { verifySuperAdmin } from '@/lib/services/admin-users';
import { revalidatePath } from 'next/cache';
import type {
  Experiment,
  ExperimentWithVariants,
  ExperimentWithDetails,
  CreateExperimentInput,
  UpdateExperimentInput,
  ExperimentConfigSnapshot,
} from '@/lib/types/experiments';

// ============================================
// TYPES
// ============================================

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

// ============================================
// AUDIT LOGGING
// ============================================

type ExperimentAuditAction =
  | 'experiment_created'
  | 'experiment_updated'
  | 'experiment_activated'
  | 'experiment_paused'
  | 'experiment_resumed'
  | 'experiment_stopped'
  | 'experiment_deleted';

async function logExperimentAction(
  adminId: string,
  action: ExperimentAuditAction,
  details?: Record<string, unknown>
): Promise<void> {
  const supabase = createAdminClient();
  try {
    await supabase.from('admin_audit_logs').insert({
      admin_id: adminId,
      action: action,
      details: details,
    });
  } catch (err) {
    console.error('[Experiments] Audit log error:', err);
  }
}

// ============================================
// READ OPERATIONS
// ============================================

/**
 * Get all experiments with their variants.
 * Requires super admin access.
 */
export async function getExperiments(): Promise<ActionResult<ExperimentWithVariants[]>> {
  try {
    const admin = await verifySuperAdmin();
    if (!admin) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } };
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('experiments')
      .select(`
        *,
        variants:experiment_variants(
          id,
          experiment_id,
          variant_name,
          config_id,
          config_snapshot,
          sample_count,
          mean_score,
          std_deviation,
          created_at
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Experiments] Failed to fetch experiments:', error);
      return { success: false, error: { code: 'FETCH_ERROR', message: error.message } };
    }

    return { success: true, data: data as ExperimentWithVariants[] };
  } catch (err) {
    console.error('[Experiments] Unexpected error:', err);
    return { success: false, error: { code: 'UNEXPECTED_ERROR', message: 'Failed to fetch experiments' } };
  }
}

/**
 * Get a single experiment with variants and config details.
 * Requires super admin access.
 */
export async function getExperiment(id: string): Promise<ActionResult<ExperimentWithDetails>> {
  try {
    const admin = await verifySuperAdmin();
    if (!admin) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } };
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('experiments')
      .select(`
        *,
        variants:experiment_variants(
          id,
          experiment_id,
          variant_name,
          config_id,
          config_snapshot,
          sample_count,
          mean_score,
          std_deviation,
          created_at
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, error: { code: 'NOT_FOUND', message: 'Experiment not found' } };
      }
      console.error('[Experiments] Failed to fetch experiment:', error);
      return { success: false, error: { code: 'FETCH_ERROR', message: error.message } };
    }

    // Get config details for each variant
    const experiment = data as ExperimentWithDetails;
    const controlVariant = experiment.variants.find(v => v.variant_name === 'control');
    const variantVariant = experiment.variants.find(v => v.variant_name === 'variant');

    if (controlVariant) {
      const { data: controlConfig } = await supabase
        .from('analysis_configs')
        .select('id, name, version')
        .eq('id', controlVariant.config_id)
        .single();
      experiment.control_config = controlConfig || undefined;
    }

    if (variantVariant) {
      const { data: variantConfig } = await supabase
        .from('analysis_configs')
        .select('id, name, version')
        .eq('id', variantVariant.config_id)
        .single();
      experiment.variant_config = variantConfig || undefined;
    }

    return { success: true, data: experiment };
  } catch (err) {
    console.error('[Experiments] Unexpected error:', err);
    return { success: false, error: { code: 'UNEXPECTED_ERROR', message: 'Failed to fetch experiment' } };
  }
}

// ============================================
// CREATE OPERATIONS
// ============================================

/**
 * Create a new experiment as draft.
 * Requires super admin access.
 */
export async function createExperiment(
  input: CreateExperimentInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const admin = await verifySuperAdmin();
    if (!admin) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } };
    }

    // Validate configs are different
    if (input.control_config_id === input.variant_config_id) {
      return {
        success: false,
        error: { code: 'SAME_CONFIG', message: 'Control and variant must be different configurations' },
      };
    }

    const supabase = createAdminClient();

    // Validate both configs exist
    const { data: configs } = await supabase
      .from('analysis_configs')
      .select('id, name')
      .in('id', [input.control_config_id, input.variant_config_id]);

    if (!configs || configs.length !== 2) {
      return {
        success: false,
        error: { code: 'CONFIG_NOT_FOUND', message: 'One or both configurations not found' },
      };
    }

    // Create experiment
    const { data: experiment, error: expError } = await supabase
      .from('experiments')
      .insert({
        name: input.name,
        hypothesis: input.hypothesis,
        traffic_percentage: input.traffic_percentage ?? 50,
        min_sample_size: input.min_sample_size ?? 100,
        min_duration_hours: input.min_duration_hours ?? 24,
        significance_threshold: input.significance_threshold ?? 0.05,
        success_metric: input.success_metric ?? 'overall_score',
        auto_promote_winner: input.auto_promote_winner ?? false,
        status: 'draft',
        created_by: admin.adminId,
      })
      .select()
      .single();

    if (expError) {
      console.error('[Experiments] Failed to create experiment:', expError);
      return { success: false, error: { code: 'CREATE_ERROR', message: expError.message } };
    }

    // Create variants
    const variants = [
      { experiment_id: experiment.id, variant_name: 'control', config_id: input.control_config_id },
      { experiment_id: experiment.id, variant_name: 'variant', config_id: input.variant_config_id },
    ];

    const { error: varError } = await supabase
      .from('experiment_variants')
      .insert(variants);

    if (varError) {
      // Rollback experiment creation
      await supabase.from('experiments').delete().eq('id', experiment.id);
      console.error('[Experiments] Failed to create variants:', varError);
      return { success: false, error: { code: 'CREATE_ERROR', message: varError.message } };
    }

    await logExperimentAction(admin.adminId, 'experiment_created', {
      experiment_id: experiment.id,
      control_config_id: input.control_config_id,
      variant_config_id: input.variant_config_id,
    });

    revalidatePath('/admin/experiments');
    return { success: true, data: { id: experiment.id } };
  } catch (err) {
    console.error('[Experiments] Create error:', err);
    return { success: false, error: { code: 'UNEXPECTED_ERROR', message: 'Failed to create experiment' } };
  }
}

// ============================================
// UPDATE OPERATIONS
// ============================================

/**
 * Update a draft experiment.
 * Requires super admin access. Only draft experiments can be updated.
 */
export async function updateExperiment(
  id: string,
  input: UpdateExperimentInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const admin = await verifySuperAdmin();
    if (!admin) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } };
    }

    const supabase = createAdminClient();

    // Check if experiment is in draft status
    const { data: existing } = await supabase
      .from('experiments')
      .select('status')
      .eq('id', id)
      .single();

    if (!existing) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Experiment not found' } };
    }

    if (existing.status !== 'draft') {
      return { success: false, error: { code: 'FORBIDDEN', message: 'Only draft experiments can be edited' } };
    }

    // Validate configs are different if both provided
    if (input.control_config_id && input.variant_config_id) {
      if (input.control_config_id === input.variant_config_id) {
        return {
          success: false,
          error: { code: 'SAME_CONFIG', message: 'Control and variant must be different configurations' },
        };
      }
    }

    // Update experiment
    const { error: updateError } = await supabase
      .from('experiments')
      .update({
        name: input.name,
        hypothesis: input.hypothesis,
        traffic_percentage: input.traffic_percentage,
        min_sample_size: input.min_sample_size,
        min_duration_hours: input.min_duration_hours,
        significance_threshold: input.significance_threshold,
        success_metric: input.success_metric,
        auto_promote_winner: input.auto_promote_winner,
      })
      .eq('id', id);

    if (updateError) {
      console.error('[Experiments] Failed to update experiment:', updateError);
      return { success: false, error: { code: 'UPDATE_ERROR', message: updateError.message } };
    }

    // Update variant configs if provided
    if (input.control_config_id) {
      await supabase
        .from('experiment_variants')
        .update({ config_id: input.control_config_id })
        .eq('experiment_id', id)
        .eq('variant_name', 'control');
    }

    if (input.variant_config_id) {
      await supabase
        .from('experiment_variants')
        .update({ config_id: input.variant_config_id })
        .eq('experiment_id', id)
        .eq('variant_name', 'variant');
    }

    await logExperimentAction(admin.adminId, 'experiment_updated', {
      experiment_id: id,
      changes: input,
    });

    revalidatePath('/admin/experiments');
    revalidatePath(`/admin/experiments/${id}`);
    return { success: true, data: { id } };
  } catch (err) {
    console.error('[Experiments] Update error:', err);
    return { success: false, error: { code: 'UNEXPECTED_ERROR', message: 'Failed to update experiment' } };
  }
}

// ============================================
// LIFECYCLE OPERATIONS
// ============================================

/**
 * Create a snapshot of a config for experiment.
 */
async function createConfigSnapshot(configId: string): Promise<ExperimentConfigSnapshot | null> {
  const supabase = createAdminClient();

  const { data: config, error } = await supabase
    .from('analysis_configs')
    .select(`
      id,
      name,
      version,
      model,
      system_prompt,
      analysis_dimensions(
        name,
        weight,
        enabled,
        description,
        prompt_template,
        scoring_criteria
      )
    `)
    .eq('id', configId)
    .single();

  if (error || !config) {
    console.error('[Experiments] Failed to create config snapshot:', error);
    return null;
  }

  return {
    id: config.id,
    name: config.name,
    version: config.version,
    model: config.model,
    system_prompt: config.system_prompt,
    dimensions: config.analysis_dimensions,
  };
}

/**
 * Activate a draft experiment.
 * Creates config snapshots and starts the experiment.
 */
export async function activateExperiment(experimentId: string): Promise<ActionResult<{ success: boolean }>> {
  try {
    const admin = await verifySuperAdmin();
    if (!admin) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } };
    }

    const supabase = createAdminClient();

    // Get experiment with variants
    const { data: experiment } = await supabase
      .from('experiments')
      .select(`
        id, status,
        experiment_variants(id, variant_name, config_id)
      `)
      .eq('id', experimentId)
      .single();

    if (!experiment) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Experiment not found' } };
    }

    if (experiment.status !== 'draft') {
      return { success: false, error: { code: 'INVALID_STATUS', message: 'Only draft experiments can be activated' } };
    }

    // Check no other running experiment with same configs
    const configIds = experiment.experiment_variants.map((v: { config_id: string }) => v.config_id);
    const { data: conflicting } = await supabase
      .from('experiments')
      .select(`
        id,
        experiment_variants!inner(config_id)
      `)
      .eq('status', 'running')
      .in('experiment_variants.config_id', configIds);

    if (conflicting && conflicting.length > 0) {
      return {
        success: false,
        error: { code: 'CONFLICT', message: 'Another experiment is already running with one of these configurations' },
      };
    }

    // Create snapshots for both configs
    for (const variant of experiment.experiment_variants) {
      const snapshot = await createConfigSnapshot(variant.config_id);
      if (!snapshot) {
        return {
          success: false,
          error: { code: 'SNAPSHOT_ERROR', message: 'Failed to create config snapshot' },
        };
      }

      await supabase
        .from('experiment_variants')
        .update({ config_snapshot: snapshot })
        .eq('id', variant.id);
    }

    // Activate experiment
    const { error } = await supabase
      .from('experiments')
      .update({
        status: 'running',
        activated_at: new Date().toISOString(),
      })
      .eq('id', experimentId);

    if (error) {
      console.error('[Experiments] Failed to activate:', error);
      return { success: false, error: { code: 'ACTIVATION_ERROR', message: error.message } };
    }

    await logExperimentAction(admin.adminId, 'experiment_activated', {
      experiment_id: experimentId,
    });

    revalidatePath('/admin/experiments');
    revalidatePath(`/admin/experiments/${experimentId}`);
    return { success: true, data: { success: true } };
  } catch (err) {
    console.error('[Experiments] Activation error:', err);
    return { success: false, error: { code: 'UNEXPECTED_ERROR', message: 'Failed to activate experiment' } };
  }
}

/**
 * Pause a running experiment.
 */
export async function pauseExperiment(experimentId: string): Promise<ActionResult<{ success: boolean }>> {
  try {
    const admin = await verifySuperAdmin();
    if (!admin) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } };
    }

    const supabase = createAdminClient();

    const { data: experiment } = await supabase
      .from('experiments')
      .select('status')
      .eq('id', experimentId)
      .single();

    if (!experiment) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Experiment not found' } };
    }

    if (experiment.status !== 'running') {
      return { success: false, error: { code: 'INVALID_STATUS', message: 'Only running experiments can be paused' } };
    }

    const { error } = await supabase
      .from('experiments')
      .update({ status: 'paused' })
      .eq('id', experimentId);

    if (error) {
      console.error('[Experiments] Failed to pause:', error);
      return { success: false, error: { code: 'PAUSE_ERROR', message: error.message } };
    }

    await logExperimentAction(admin.adminId, 'experiment_paused', { experiment_id: experimentId });
    revalidatePath('/admin/experiments');
    revalidatePath(`/admin/experiments/${experimentId}`);
    return { success: true, data: { success: true } };
  } catch (err) {
    console.error('[Experiments] Pause error:', err);
    return { success: false, error: { code: 'UNEXPECTED_ERROR', message: 'Failed to pause experiment' } };
  }
}

/**
 * Resume a paused experiment.
 */
export async function resumeExperiment(experimentId: string): Promise<ActionResult<{ success: boolean }>> {
  try {
    const admin = await verifySuperAdmin();
    if (!admin) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } };
    }

    const supabase = createAdminClient();

    const { data: experiment } = await supabase
      .from('experiments')
      .select('status')
      .eq('id', experimentId)
      .single();

    if (!experiment) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Experiment not found' } };
    }

    if (experiment.status !== 'paused') {
      return { success: false, error: { code: 'INVALID_STATUS', message: 'Only paused experiments can be resumed' } };
    }

    const { error } = await supabase
      .from('experiments')
      .update({ status: 'running' })
      .eq('id', experimentId);

    if (error) {
      console.error('[Experiments] Failed to resume:', error);
      return { success: false, error: { code: 'RESUME_ERROR', message: error.message } };
    }

    await logExperimentAction(admin.adminId, 'experiment_resumed', { experiment_id: experimentId });
    revalidatePath('/admin/experiments');
    revalidatePath(`/admin/experiments/${experimentId}`);
    return { success: true, data: { success: true } };
  } catch (err) {
    console.error('[Experiments] Resume error:', err);
    return { success: false, error: { code: 'UNEXPECTED_ERROR', message: 'Failed to resume experiment' } };
  }
}

/**
 * Stop an experiment early and move to analyzing status.
 */
export async function stopExperimentEarly(experimentId: string): Promise<ActionResult<{ success: boolean }>> {
  try {
    const admin = await verifySuperAdmin();
    if (!admin) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } };
    }

    const supabase = createAdminClient();

    const { data: experiment } = await supabase
      .from('experiments')
      .select('status')
      .eq('id', experimentId)
      .single();

    if (!experiment) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Experiment not found' } };
    }

    if (!['running', 'paused'].includes(experiment.status)) {
      return { success: false, error: { code: 'INVALID_STATUS', message: 'Only running or paused experiments can be stopped' } };
    }

    const { error } = await supabase
      .from('experiments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        winner_variant: 'inconclusive',
      })
      .eq('id', experimentId);

    if (error) {
      console.error('[Experiments] Failed to stop:', error);
      return { success: false, error: { code: 'STOP_ERROR', message: error.message } };
    }

    await logExperimentAction(admin.adminId, 'experiment_stopped', { experiment_id: experimentId });
    revalidatePath('/admin/experiments');
    revalidatePath(`/admin/experiments/${experimentId}`);
    return { success: true, data: { success: true } };
  } catch (err) {
    console.error('[Experiments] Stop error:', err);
    return { success: false, error: { code: 'UNEXPECTED_ERROR', message: 'Failed to stop experiment' } };
  }
}

/**
 * Delete a draft experiment.
 */
export async function deleteExperiment(experimentId: string): Promise<ActionResult<{ success: boolean }>> {
  try {
    const admin = await verifySuperAdmin();
    if (!admin) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } };
    }

    const supabase = createAdminClient();

    const { data: experiment } = await supabase
      .from('experiments')
      .select('status')
      .eq('id', experimentId)
      .single();

    if (!experiment) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Experiment not found' } };
    }

    if (experiment.status !== 'draft') {
      return { success: false, error: { code: 'FORBIDDEN', message: 'Only draft experiments can be deleted' } };
    }

    const { error } = await supabase
      .from('experiments')
      .delete()
      .eq('id', experimentId);

    if (error) {
      console.error('[Experiments] Failed to delete:', error);
      return { success: false, error: { code: 'DELETE_ERROR', message: error.message } };
    }

    await logExperimentAction(admin.adminId, 'experiment_deleted', { experiment_id: experimentId });
    revalidatePath('/admin/experiments');
    return { success: true, data: { success: true } };
  } catch (err) {
    console.error('[Experiments] Delete error:', err);
    return { success: false, error: { code: 'UNEXPECTED_ERROR', message: 'Failed to delete experiment' } };
  }
}
