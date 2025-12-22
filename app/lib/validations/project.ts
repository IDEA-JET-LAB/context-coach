import { z } from 'zod';

/**
 * Sanitizes project names by removing potentially problematic characters
 * while preserving normal punctuation and international characters.
 */
const sanitizeName = (val: string): string => {
  return val
    .trim()
    // Remove control characters and zero-width characters
    .replace(/[\x00-\x1F\x7F-\x9F\u200B-\u200D\uFEFF]/g, '')
    // Normalize multiple spaces to single space
    .replace(/\s+/g, ' ');
};

export const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be 100 characters or less')
    .transform(sanitizeName),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .nullish()
    .transform((val) => (val ? val.trim() : null)),
});

export type CreateProjectInput = z.input<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be 100 characters or less')
    .transform(sanitizeName),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .nullish()
    .transform((val) => (val ? val.trim() : null)),
});

export type UpdateProjectInput = z.input<typeof updateProjectSchema>;
