/**
 * Classification Rules Import/Export Types
 * Story 22-2: Classification Rule Editor - Task 12
 */

import { z } from 'zod';

/**
 * JSON schema for classification rules import/export.
 * Version 1.0 - Initial schema
 */
export interface ClassificationRulesExport {
  version: '1.0';
  exportedAt: string; // ISO timestamp
  exportedBy: string; // User email
  categories: ExportedCategory[];
  rules: ExportedRule[];
}

export interface ExportedCategory {
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
}

export interface ExportedRule {
  name: string;
  category_name: string; // References category by name
  pattern: string;
  pattern_flags: string;
  priority: number;
  description: string | null;
  enabled: boolean;
}

/**
 * Import result with detailed status for each rule
 */
export interface ImportResult {
  success: boolean;
  summary: {
    categoriesCreated: number;
    categoriesSkipped: number;
    rulesCreated: number;
    rulesUpdated: number;
    rulesSkipped: number;
    errors: number;
  };
  details: ImportRuleResult[];
}

export interface ImportRuleResult {
  ruleName: string;
  status: 'created' | 'updated' | 'skipped' | 'error';
  reason?: string; // Why skipped or error message
  conflictsWith?: string; // Existing rule name if conflict
}

/**
 * Import preview before applying
 */
export interface ImportPreview {
  valid: boolean;
  errors: string[];
  categories: {
    name: string;
    action: 'create' | 'skip' | 'update';
  }[];
  rules: {
    name: string;
    categoryName: string;
    action: 'create' | 'update' | 'skip';
    conflictsWith?: string;
  }[];
}

// Zod schema for validation
export const exportedCategorySchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  sort_order: z.number().int().min(0),
});

export const exportedRuleSchema = z.object({
  name: z.string().min(1).max(100),
  category_name: z.string().min(1),
  pattern: z.string().min(1),
  pattern_flags: z.string().max(10),
  priority: z.number().int().min(1).max(100),
  description: z.string().nullable(),
  enabled: z.boolean(),
});

export const importSchemaValidator = z.object({
  version: z.literal('1.0'),
  exportedAt: z.string().datetime(),
  exportedBy: z.string().email(),
  categories: z.array(exportedCategorySchema),
  rules: z.array(exportedRuleSchema),
});

export type ImportSchema = z.infer<typeof importSchemaValidator>;
