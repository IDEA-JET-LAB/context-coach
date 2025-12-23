/**
 * Classification Rules Validation Schemas
 * Story 22-2: Classification Rule Editor
 */

import { z } from 'zod';

/**
 * Validates a regex pattern is syntactically correct
 */
const regexPatternValidator = z.string().min(1, 'Pattern is required').refine(
  (pattern) => {
    try {
      new RegExp(pattern);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Invalid regex pattern syntax' }
);

/**
 * Hex color validation
 */
const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format (e.g., #FF5733)');

/**
 * Schema for creating a classification category
 */
export const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Category name is required')
    .max(50, 'Category name cannot exceed 50 characters')
    .regex(
      /^[a-z][a-z0-9_]*$/,
      'Category name must be lowercase with underscores (e.g., bug_fix)'
    ),
  description: z.string().max(500, 'Description cannot exceed 500 characters').nullable().optional(),
  color: hexColorSchema.optional().default('#6366f1'),
  sort_order: z.number().int().min(0).optional().default(0),
});

/**
 * Schema for updating a classification category
 */
export const updateCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Category name is required')
    .max(50)
    .regex(/^[a-z][a-z0-9_]*$/)
    .optional(),
  description: z.string().max(500).nullable().optional(),
  color: hexColorSchema.optional(),
  sort_order: z.number().int().min(0).optional(),
  is_archived: z.boolean().optional(),
});

/**
 * ReDoS risk level enum
 */
export const redosRiskSchema = z.enum(['safe', 'warning', 'dangerous']);

/**
 * Schema for creating a classification rule
 */
export const createRuleSchema = z.object({
  name: z
    .string()
    .min(1, 'Rule name is required')
    .max(100, 'Rule name cannot exceed 100 characters'),
  category_id: z.string().uuid('Invalid category ID'),
  pattern: regexPatternValidator,
  pattern_flags: z
    .string()
    .max(10, 'Pattern flags cannot exceed 10 characters')
    .regex(/^[gimsuy]*$/, 'Invalid regex flags (valid: g, i, m, s, u, y)')
    .optional()
    .default('i'),
  priority: z
    .number()
    .int()
    .min(1, 'Priority must be at least 1')
    .max(100, 'Priority cannot exceed 100')
    .optional()
    .default(50),
  description: z.string().max(500, 'Description cannot exceed 500 characters').nullable().optional(),
  enabled: z.boolean().optional().default(true),
});

/**
 * Schema for updating a classification rule
 */
export const updateRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category_id: z.string().uuid().optional(),
  pattern: regexPatternValidator.optional(),
  pattern_flags: z
    .string()
    .max(10)
    .regex(/^[gimsuy]*$/)
    .optional(),
  priority: z.number().int().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  enabled: z.boolean().optional(),
  redos_risk: redosRiskSchema.optional(),
});

/**
 * Schema for bulk operations
 */
export const bulkUpdateRulesSchema = z.object({
  rule_ids: z.array(z.string().uuid()).min(1, 'At least one rule is required'),
  updates: z.object({
    enabled: z.boolean().optional(),
    category_id: z.string().uuid().optional(),
  }).refine(
    (data) => data.enabled !== undefined || data.category_id !== undefined,
    { message: 'At least one update field is required' }
  ),
});

// Type exports
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;
export type BulkUpdateRulesInput = z.infer<typeof bulkUpdateRulesSchema>;
export type RedosRisk = z.infer<typeof redosRiskSchema>;
