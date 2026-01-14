import { z } from "zod";

/**
 * Feedback categories matching database enum
 */
export const FEEDBACK_CATEGORIES = [
  "suggestion",
  "question",
  "bug",
  "feature-request",
  "other",
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

/**
 * Feedback status values matching database enum
 */
export const FEEDBACK_STATUSES = [
  "new",
  "reviewed",
  "in-progress",
  "resolved",
  "archived",
] as const;

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

/**
 * Category display labels
 */
export const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  suggestion: "Suggestion",
  question: "Question",
  bug: "Bug Report",
  "feature-request": "Feature Request",
  other: "Other",
};

/**
 * Validation constants
 */
export const FEEDBACK_MESSAGE_MIN_LENGTH = 10;
export const FEEDBACK_MESSAGE_MAX_LENGTH = 2000;

/**
 * Schema for submitting feedback
 */
export const submitFeedbackSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES, {
    message: "Invalid feedback category",
  }),
  message: z
    .string()
    .min(FEEDBACK_MESSAGE_MIN_LENGTH, {
      message: `Message must be at least ${FEEDBACK_MESSAGE_MIN_LENGTH} characters`,
    })
    .max(FEEDBACK_MESSAGE_MAX_LENGTH, {
      message: `Message must be at most ${FEEDBACK_MESSAGE_MAX_LENGTH} characters`,
    }),
  extensionVersion: z.string().optional(),
});

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;

/**
 * Schema for admin feedback list query parameters
 */
export const feedbackListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.enum(FEEDBACK_CATEGORIES).optional(),
  status: z.enum(FEEDBACK_STATUSES).optional(),
  sortBy: z.enum(["created_at", "status", "category"]).default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type FeedbackListQuery = z.infer<typeof feedbackListQuerySchema>;

/**
 * Schema for updating feedback status (admin)
 */
export const updateFeedbackStatusSchema = z.object({
  status: z.enum(FEEDBACK_STATUSES),
  adminNotes: z.string().max(1000).optional(),
});

export type UpdateFeedbackStatusInput = z.infer<typeof updateFeedbackStatusSchema>;
