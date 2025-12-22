import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be 100 characters or less')
    .transform((val) => val.trim()),
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
    .transform((val) => val.trim()),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .nullable(),
  is_archived: z.boolean().optional(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
