'use server';

/**
 * Prompt Templates Server Actions
 *
 * Server-side operations for managing LLM prompt templates.
 * All operations require super admin access via verifySuperAdmin().
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { verifySuperAdmin, SuperAdminError } from '@/lib/auth/admin';
import { revalidatePath } from 'next/cache';
import type {
  PromptTemplate,
  PromptTemplateVariable,
  PromptTemplateType,
  PromptTemplateStatus,
  CreatePromptTemplateInput,
  UpdatePromptTemplateInput,
  PromptTemplateListItem,
} from '@/lib/types/prompt-templates';
import { validateTemplate } from '@/lib/utils/template-engine';

// Action result types
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
  console.error('[PromptTemplates] Unexpected error:', error);
  return {
    success: false,
    error: { code: 'UNEXPECTED_ERROR', message: 'An unexpected error occurred' },
  };
}

/**
 * Get all prompt templates with optional filtering
 */
export async function getPromptTemplates(options?: {
  type?: PromptTemplateType;
  status?: PromptTemplateStatus;
}): Promise<ActionResult<PromptTemplateListItem[]>> {
  try {
    await verifySuperAdmin();

    const supabase = createAdminClient();

    let query = supabase
      .from('prompt_templates')
      .select('id, name, description, type, status, version, updated_at')
      .order('updated_at', { ascending: false });

    if (options?.type) {
      query = query.eq('type', options.type);
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[PromptTemplates] Failed to fetch templates:', error);
      return { success: false, error: { code: 'FETCH_ERROR', message: error.message } };
    }

    // Add variable count (could be optimized with a view or computed column)
    const templates: PromptTemplateListItem[] = (data || []).map((t) => ({
      ...t,
      variable_count: 0, // Will be computed client-side from body if needed
    }));

    return { success: true, data: templates };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Get a single prompt template by ID
 */
export async function getPromptTemplate(
  id: string
): Promise<ActionResult<PromptTemplate>> {
  try {
    await verifySuperAdmin();

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } };
      }
      console.error('[PromptTemplates] Failed to fetch template:', error);
      return { success: false, error: { code: 'FETCH_ERROR', message: error.message } };
    }

    return { success: true, data: data as PromptTemplate };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Get variable definitions for a template type
 */
export async function getTemplateVariables(
  type: PromptTemplateType
): Promise<ActionResult<PromptTemplateVariable[]>> {
  try {
    await verifySuperAdmin();

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('prompt_template_variables')
      .select('*')
      .eq('type', type)
      .order('required', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      console.error('[PromptTemplates] Failed to fetch variables:', error);
      return { success: false, error: { code: 'FETCH_ERROR', message: error.message } };
    }

    return { success: true, data: (data || []) as PromptTemplateVariable[] };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Create a new prompt template (always starts as draft)
 */
export async function createPromptTemplate(
  input: CreatePromptTemplateInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await verifySuperAdmin();

    // Validate template body
    const validation = validateTemplate(input.body, input.type);
    if (!validation.isValid) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: validation.errors.join('; ') },
      };
    }

    // Validate name
    if (!input.name || input.name.trim().length < 1) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Template name is required' },
      };
    }

    if (input.name.length > 100) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Template name must be 100 characters or less' },
      };
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('prompt_templates')
      .insert({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        type: input.type,
        body: input.body,
        status: 'draft',
        version: 1,
        created_by: userId,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[PromptTemplates] Failed to create template:', error);

      // Check for duplicate name error
      if (error.code === '23505') {
        return {
          success: false,
          error: {
            code: 'DUPLICATE_ERROR',
            message: 'A template with this name already exists for this type',
          },
        };
      }

      return { success: false, error: { code: 'CREATE_ERROR', message: error.message } };
    }

    console.log(`[PromptTemplates] Template ${data.id} created by ${userId}`);
    revalidatePath('/admin/analysis/templates');

    return { success: true, data: { id: data.id } };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Update an existing prompt template (only drafts can be edited)
 */
export async function updatePromptTemplate(
  id: string,
  input: UpdatePromptTemplateInput
): Promise<ActionResult<{ id: string }>> {
  try {
    await verifySuperAdmin();

    const supabase = createAdminClient();

    // Check current status
    const { data: existing } = await supabase
      .from('prompt_templates')
      .select('status, type')
      .eq('id', id)
      .single();

    if (!existing) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } };
    }

    if (existing.status !== 'draft') {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only draft templates can be edited' },
      };
    }

    // Validate body if provided
    if (input.body) {
      const validation = validateTemplate(input.body, existing.type);
      if (!validation.isValid) {
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: validation.errors.join('; ') },
        };
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.description !== undefined)
      updateData.description = input.description?.trim() || null;
    if (input.body !== undefined) updateData.body = input.body;

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: { code: 'VALIDATION_ERROR', message: 'No changes provided' } };
    }

    const { error } = await supabase
      .from('prompt_templates')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('[PromptTemplates] Failed to update template:', error);
      return { success: false, error: { code: 'UPDATE_ERROR', message: error.message } };
    }

    console.log(`[PromptTemplates] Template ${id} updated`);
    revalidatePath('/admin/analysis/templates');
    revalidatePath(`/admin/analysis/templates/${id}`);

    return { success: true, data: { id } };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Publish a draft template (changes status to active)
 */
export async function publishPromptTemplate(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await verifySuperAdmin();

    const supabase = createAdminClient();

    // Get current template
    const { data: existing } = await supabase
      .from('prompt_templates')
      .select('status, type, name, body')
      .eq('id', id)
      .single();

    if (!existing) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } };
    }

    if (existing.status !== 'draft') {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only draft templates can be published' },
      };
    }

    // Validate template before publishing
    const validation = validateTemplate(existing.body, existing.type);
    if (!validation.isValid) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Cannot publish: ${validation.errors.join('; ')}`,
        },
      };
    }

    // Archive any existing active template with same name and type
    await supabase
      .from('prompt_templates')
      .update({ status: 'archived' })
      .eq('name', existing.name)
      .eq('type', existing.type)
      .eq('status', 'active');

    // Publish the template
    const { error } = await supabase
      .from('prompt_templates')
      .update({
        status: 'active',
        published_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('[PromptTemplates] Failed to publish template:', error);
      return { success: false, error: { code: 'PUBLISH_ERROR', message: error.message } };
    }

    console.log(`[PromptTemplates] Template ${id} published by ${userId}`);
    revalidatePath('/admin/analysis/templates');
    revalidatePath(`/admin/analysis/templates/${id}`);

    return { success: true, data: { id } };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Archive a template
 */
export async function archivePromptTemplate(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    await verifySuperAdmin();

    const supabase = createAdminClient();

    // Check current status
    const { data: existing } = await supabase
      .from('prompt_templates')
      .select('status')
      .eq('id', id)
      .single();

    if (!existing) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } };
    }

    if (existing.status === 'archived') {
      return {
        success: false,
        error: { code: 'ALREADY_ARCHIVED', message: 'Template is already archived' },
      };
    }

    const { error } = await supabase
      .from('prompt_templates')
      .update({ status: 'archived' })
      .eq('id', id);

    if (error) {
      console.error('[PromptTemplates] Failed to archive template:', error);
      return { success: false, error: { code: 'ARCHIVE_ERROR', message: error.message } };
    }

    console.log(`[PromptTemplates] Template ${id} archived`);
    revalidatePath('/admin/analysis/templates');
    revalidatePath(`/admin/analysis/templates/${id}`);

    return { success: true, data: { id } };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Duplicate a template (creates a new draft copy)
 */
export async function duplicatePromptTemplate(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await verifySuperAdmin();

    const supabase = createAdminClient();

    // Get original template
    const { data: original } = await supabase
      .from('prompt_templates')
      .select('name, description, type, body')
      .eq('id', id)
      .single();

    if (!original) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } };
    }

    // Create copy with new name
    const { data, error } = await supabase
      .from('prompt_templates')
      .insert({
        name: `Copy of ${original.name}`.substring(0, 100),
        description: original.description,
        type: original.type,
        body: original.body,
        status: 'draft',
        version: 1,
        created_by: userId,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[PromptTemplates] Failed to duplicate template:', error);
      return { success: false, error: { code: 'DUPLICATE_ERROR', message: error.message } };
    }

    console.log(`[PromptTemplates] Template ${id} duplicated to ${data.id} by ${userId}`);
    revalidatePath('/admin/analysis/templates');

    return { success: true, data: { id: data.id } };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Delete a template (only drafts can be deleted)
 */
export async function deletePromptTemplate(
  id: string
): Promise<ActionResult<{ success: boolean }>> {
  try {
    await verifySuperAdmin();

    const supabase = createAdminClient();

    // Check current status
    const { data: existing } = await supabase
      .from('prompt_templates')
      .select('status')
      .eq('id', id)
      .single();

    if (!existing) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } };
    }

    if (existing.status === 'active') {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cannot delete active templates. Archive first.' },
      };
    }

    const { error } = await supabase.from('prompt_templates').delete().eq('id', id);

    if (error) {
      console.error('[PromptTemplates] Failed to delete template:', error);
      return { success: false, error: { code: 'DELETE_ERROR', message: error.message } };
    }

    console.log(`[PromptTemplates] Template ${id} deleted`);
    revalidatePath('/admin/analysis/templates');

    return { success: true, data: { success: true } };
  } catch (err) {
    return handleError(err);
  }
}
