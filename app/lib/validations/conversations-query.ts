/**
 * Conversations Query Validation - Story 25-2: Conversations List Endpoint
 *
 * Zod schema for validating query parameters on GET /api/conversations.
 */

import { z } from 'zod';

/**
 * Valid project stage values for filtering.
 * Combined Phase 2 and Phase 3 stage values.
 */
const projectStages = [
  // Phase 3 story values
  'architecture',
  'specification',
  'development',
  'debugging',
  'enhancement',
  // Phase 2 values
  'planning',
  'implementation',
  'refactoring',
  'testing',
  'documentation',
  'review',
  'exploration',
  'unknown',
] as const;

/**
 * Valid sort options for conversation list.
 */
const sortOptions = ['date', 'messages', 'score'] as const;

/**
 * UUID regex pattern for validation.
 */
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parsed and validated query parameters after schema parsing.
 */
export interface ConversationsQuery {
  project_id?: string;
  stage?: typeof projectStages[number];
  has_loop?: boolean;
  date_from?: string;
  date_to?: string;
  limit: number;
  offset: number;
  sort_by: typeof sortOptions[number];
}

/**
 * Schema for validating GET /api/conversations query parameters.
 *
 * Validates:
 * - project_id: UUID or "unlinked" for sessions without a project
 * - stage: One of the valid project stages
 * - has_loop: Boolean (true/false as string)
 * - date_from: ISO 8601 datetime string
 * - date_to: ISO 8601 datetime string
 * - limit: Number 1-100 (default 50)
 * - offset: Number >= 0 (default 0)
 * - sort_by: One of 'date', 'messages', 'score' (default 'date')
 */
export const conversationsQuerySchema = z
  .object({
    project_id: z
      .string()
      .refine(
        (val) => val === 'unlinked' || uuidPattern.test(val),
        { message: 'project_id must be a valid UUID or "unlinked"' }
      )
      .optional(),

    stage: z.enum(projectStages, {
      message: `stage must be one of: ${projectStages.join(', ')}`,
    }).optional(),

    has_loop: z
      .enum(['true', 'false'], {
        message: 'has_loop must be "true" or "false"',
      })
      .transform((val) => val === 'true')
      .optional(),

    date_from: z
      .string()
      .refine(
        (val) => !isNaN(Date.parse(val)),
        { message: 'date_from must be a valid ISO 8601 date' }
      )
      .optional(),

    date_to: z
      .string()
      .refine(
        (val) => !isNaN(Date.parse(val)),
        { message: 'date_to must be a valid ISO 8601 date' }
      )
      .optional(),

    limit: z
      .string()
      .optional()
      .transform((val) => {
        const parsed = parseInt(val ?? '50', 10);
        return isNaN(parsed) ? 50 : Math.min(Math.max(1, parsed), 100);
      }),

    offset: z
      .string()
      .optional()
      .transform((val) => {
        const parsed = parseInt(val ?? '0', 10);
        return isNaN(parsed) ? 0 : Math.max(0, parsed);
      }),

    sort_by: z.enum(sortOptions, {
      message: `sort_by must be one of: ${sortOptions.join(', ')}`,
    }).optional().default('date'),
  });

/**
 * Maps Zod validation error to API error response format.
 *
 * @param zodError - The Zod validation error
 * @returns Error object with code and message
 */
export function mapConversationsQueryError(zodError: z.ZodError): {
  code: string;
  message: string;
} {
  const issue = zodError.issues[0];
  return {
    code: 'VALIDATION_ERROR',
    message: issue?.message || 'Invalid query parameters',
  };
}
