/**
 * Template Engine for Prompt Templates
 *
 * Provides variable extraction, validation, and rendering for LLM prompt templates.
 * Uses {{variable}} syntax for variable placeholders.
 */

import type {
  PromptTemplateType,
  TemplatePreviewResult,
  TemplateSampleData,
} from '@/lib/types/prompt-templates';

/**
 * Regex pattern for matching template variables
 * Matches: {{variable_name}}
 * Captures: variable_name (alphanumeric + underscore, must start with letter/underscore)
 */
export const VARIABLE_REGEX = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

/**
 * Variable definitions by template type
 */
export const VARIABLES_BY_TYPE: Record<PromptTemplateType, string[]> = {
  analysis: ['prompt', 'prompt_length', 'word_count', 'context'],
  feedback: ['score', 'dimension_scores', 'suggestions', 'strengths'],
  classification: ['prompt', 'patterns', 'categories'],
};

/**
 * Extract all variable names from a template string
 *
 * @param template - The template string to parse
 * @returns Array of unique variable names found
 */
export function extractVariables(template: string): string[] {
  const regex = new RegExp(VARIABLE_REGEX.source, 'g');
  const matches = template.matchAll(regex);
  const variables = new Set<string>();

  for (const match of matches) {
    if (match[1]) {
      variables.add(match[1]);
    }
  }

  return Array.from(variables);
}

/**
 * Check if a variable is valid for a given template type
 *
 * @param variableName - The variable name to check
 * @param templateType - The template type
 * @returns true if the variable is valid for the type
 */
export function isValidVariable(
  variableName: string,
  templateType: PromptTemplateType
): boolean {
  return VARIABLES_BY_TYPE[templateType].includes(variableName);
}

/**
 * Validate all variables in a template
 *
 * @param template - The template string
 * @param templateType - The template type
 * @returns Object with valid and invalid variables
 */
export function validateVariables(
  template: string,
  templateType: PromptTemplateType
): { valid: string[]; invalid: string[] } {
  const usedVariables = extractVariables(template);
  const validVariables = VARIABLES_BY_TYPE[templateType];

  const valid: string[] = [];
  const invalid: string[] = [];

  for (const variable of usedVariables) {
    if (validVariables.includes(variable)) {
      valid.push(variable);
    } else {
      invalid.push(variable);
    }
  }

  return { valid, invalid };
}

/**
 * Check if template has balanced braces
 *
 * @param template - The template string to check
 * @returns true if braces are balanced
 */
export function hasBalancedBraces(template: string): boolean {
  const openBraces = (template.match(/\{\{/g) || []).length;
  const closeBraces = (template.match(/\}\}/g) || []).length;
  return openBraces === closeBraces;
}

/**
 * Get missing required variables for a template type
 *
 * @param template - The template string
 * @param templateType - The template type
 * @param requiredVariables - List of variables required for this type (from DB)
 * @returns Array of missing required variable names
 */
export function getMissingRequiredVariables(
  template: string,
  requiredVariables: string[]
): string[] {
  const usedVariables = extractVariables(template);
  return requiredVariables.filter((v) => !usedVariables.includes(v));
}

/**
 * Render a template with provided variables
 *
 * @param template - The template string
 * @param variables - Object of variable name -> value mappings
 * @param validVariables - List of valid variables for validation
 * @returns Rendered template with substituted values and validation info
 */
export function renderTemplate(
  template: string,
  variables: TemplateSampleData,
  validVariables: string[] = []
): TemplatePreviewResult {
  const usedVariables: string[] = [];
  const missingRequired: string[] = [];
  const unknownVariables: string[] = [];

  const rendered = template.replace(VARIABLE_REGEX, (match, varName: string) => {
    usedVariables.push(varName);

    // Check if variable is known
    if (validVariables.length > 0 && !validVariables.includes(varName)) {
      unknownVariables.push(varName);
    }

    // Check if value is provided
    if (varName in variables) {
      return variables[varName] ?? match;
    }

    missingRequired.push(varName);
    return match; // Keep original placeholder if no value
  });

  return {
    rendered,
    variables_used: [...new Set(usedVariables)],
    missing_required: [...new Set(missingRequired)],
    unknown_variables: [...new Set(unknownVariables)],
    is_valid: missingRequired.length === 0 && unknownVariables.length === 0,
  };
}

/**
 * Generate sample data for a template type
 *
 * @param templateType - The type of template
 * @returns Sample data object for preview
 */
export function generateSampleData(
  templateType: PromptTemplateType
): TemplateSampleData {
  switch (templateType) {
    case 'analysis':
      return {
        prompt: 'Explain how React hooks work and when to use useState vs useEffect',
        prompt_length: '72',
        word_count: '12',
        context: 'The user is building a React application and needs help with state management.',
      };
    case 'feedback':
      return {
        score: '7.5',
        dimension_scores: JSON.stringify(
          {
            clarity: 8,
            specificity: 6,
            context: 7,
            structure: 8,
          },
          null,
          2
        ),
        suggestions: JSON.stringify(
          [
            'Be more specific about the desired output format',
            'Add context about your current implementation',
          ],
          null,
          2
        ),
        strengths: JSON.stringify(
          ['Clear goal stated', 'Good use of technical terminology'],
          null,
          2
        ),
      };
    case 'classification':
      return {
        prompt: 'Fix the authentication bug where users cannot log in with OAuth',
        patterns: JSON.stringify(
          {
            bug_fix: 'fix|bug|error|issue',
            feature: 'add|create|implement|build',
            refactor: 'refactor|clean|improve|optimize',
          },
          null,
          2
        ),
        categories: JSON.stringify(
          ['feature', 'bug_fix', 'refactor', 'documentation', 'question'],
          null,
          2
        ),
      };
    default:
      return {};
  }
}

/**
 * Validate a complete template
 *
 * @param template - The template string
 * @param templateType - The template type
 * @returns Validation result with errors
 */
export function validateTemplate(
  template: string,
  templateType: PromptTemplateType
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check minimum length
  if (template.length < 10) {
    errors.push('Template must be at least 10 characters long');
  }

  // Check balanced braces
  if (!hasBalancedBraces(template)) {
    errors.push('Template has unbalanced {{ and }} brackets');
  }

  // Check for invalid variables
  const { invalid } = validateVariables(template, templateType);
  for (const varName of invalid) {
    errors.push(`Unknown variable: {{${varName}}} (not valid for ${templateType} templates)`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Escape special characters in template for safe display
 *
 * @param template - The template string
 * @returns Escaped template string safe for HTML display
 */
export function escapeForDisplay(template: string): string {
  return template
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
