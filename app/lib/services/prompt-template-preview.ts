'use server';

/**
 * Prompt Template Preview Service
 *
 * Server-side operations for previewing and testing LLM prompt templates.
 */

import { verifySuperAdmin, SuperAdminError } from '@/lib/auth/admin';
import type {
  PromptTemplateType,
  TemplatePreviewResult,
  TemplateSampleData,
} from '@/lib/types/prompt-templates';
import {
  renderTemplate,
  generateSampleData,
  VARIABLES_BY_TYPE,
} from '@/lib/utils/template-engine';

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
  console.error('[TemplatePreview] Unexpected error:', error);
  return {
    success: false,
    error: { code: 'UNEXPECTED_ERROR', message: 'An unexpected error occurred' },
  };
}

/**
 * Preview a template with sample data
 */
export async function previewTemplate(
  templateBody: string,
  templateType: PromptTemplateType,
  customData?: TemplateSampleData
): Promise<ActionResult<TemplatePreviewResult>> {
  try {
    await verifySuperAdmin();

    // Get valid variables for this type
    const validVariables = VARIABLES_BY_TYPE[templateType];

    // Use custom data or generate sample data
    const sampleData = customData || generateSampleData(templateType);

    // Render the template
    const result = renderTemplate(templateBody, sampleData, validVariables);

    return { success: true, data: result };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Get sample data for a template type
 */
export async function getSampleData(
  templateType: PromptTemplateType
): Promise<ActionResult<TemplateSampleData>> {
  try {
    await verifySuperAdmin();

    const sampleData = generateSampleData(templateType);

    return { success: true, data: sampleData };
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Test a template with custom input (rate limited)
 *
 * Note: This would integrate with the actual LLM for testing.
 * For now, it just renders the template with the provided data.
 */
export async function testTemplateWithLLM(
  templateBody: string,
  templateType: PromptTemplateType,
  testInput: TemplateSampleData
): Promise<ActionResult<{ rendered: string; testResult: string }>> {
  try {
    await verifySuperAdmin();

    // TODO: Add rate limiting (5/minute per admin) via Upstash

    // Get valid variables for this type
    const validVariables = VARIABLES_BY_TYPE[templateType];

    // Render the template
    const result = renderTemplate(templateBody, testInput, validVariables);

    if (!result.is_valid) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Template validation failed: missing ${result.missing_required.join(', ')}`,
        },
      };
    }

    // TODO: In a full implementation, this would call the LLM
    // For now, return a mock response
    const mockLLMResponse = `[LLM Test Response]

This is a simulated LLM response for testing purposes.

The template was rendered successfully with ${result.variables_used.length} variables.

Rendered output preview (first 500 chars):
${result.rendered.substring(0, 500)}${result.rendered.length > 500 ? '...' : ''}

In production, this would be replaced with an actual LLM call.`;

    return {
      success: true,
      data: {
        rendered: result.rendered,
        testResult: mockLLMResponse,
      },
    };
  } catch (err) {
    return handleError(err);
  }
}
