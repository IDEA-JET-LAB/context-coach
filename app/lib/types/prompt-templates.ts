/**
 * Prompt Templates Types
 *
 * Types for the prompt template management system (Story 22-1)
 */

/**
 * Template type determines what variables are available
 */
export type PromptTemplateType = 'analysis' | 'feedback' | 'classification';

/**
 * Template status controls editability and usage
 */
export type PromptTemplateStatus = 'draft' | 'active' | 'archived';

/**
 * Prompt template record from database
 */
export interface PromptTemplate {
  id: string;
  name: string;
  description: string | null;
  type: PromptTemplateType;
  body: string;
  status: PromptTemplateStatus;
  version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

/**
 * Variable definition for template types
 */
export interface PromptTemplateVariable {
  id: string;
  name: string;
  type: PromptTemplateType;
  description: string;
  example_value: string | null;
  required: boolean;
  created_at: string;
}

/**
 * Input for creating a new template
 */
export interface CreatePromptTemplateInput {
  name: string;
  description?: string;
  type: PromptTemplateType;
  body: string;
}

/**
 * Input for updating an existing template
 */
export interface UpdatePromptTemplateInput {
  name?: string;
  description?: string;
  body?: string;
}

/**
 * Result of template preview/render
 */
export interface TemplatePreviewResult {
  rendered: string;
  variables_used: string[];
  missing_required: string[];
  unknown_variables: string[];
  is_valid: boolean;
}

/**
 * Sample data for template preview
 */
export interface TemplateSampleData {
  [key: string]: string;
}

/**
 * Template list item (for list view)
 */
export interface PromptTemplateListItem {
  id: string;
  name: string;
  description: string | null;
  type: PromptTemplateType;
  status: PromptTemplateStatus;
  version: number;
  updated_at: string;
  variable_count: number;
}

/**
 * Template type configuration
 */
export interface TemplateTypeConfig {
  value: PromptTemplateType;
  label: string;
  description: string;
  icon: string;
}

/**
 * Available template types with metadata
 */
export const TEMPLATE_TYPES: TemplateTypeConfig[] = [
  {
    value: 'analysis',
    label: 'Analysis',
    description: 'Templates for analyzing prompt quality and dimensions',
    icon: 'Search',
  },
  {
    value: 'feedback',
    label: 'Feedback',
    description: 'Templates for generating user feedback and suggestions',
    icon: 'MessageSquare',
  },
  {
    value: 'classification',
    label: 'Classification',
    description: 'Templates for categorizing prompts by intent',
    icon: 'Tag',
  },
];

/**
 * Template status badges
 */
export const TEMPLATE_STATUS_CONFIG: Record<
  PromptTemplateStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  draft: { label: 'Draft', variant: 'secondary' },
  active: { label: 'Active', variant: 'default' },
  archived: { label: 'Archived', variant: 'outline' },
};
