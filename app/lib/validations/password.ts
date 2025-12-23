import { z } from "zod";

/**
 * Password requirements:
 * - Minimum 12 characters
 * - At least one lowercase letter
 * - At least one uppercase letter
 * - At least one number
 */
export const PASSWORD_REQUIREMENTS = {
  minLength: 12,
  requireLowercase: true,
  requireUppercase: true,
  requireNumber: true,
} as const;

/**
 * Individual password validation rules with their error messages.
 */
export const PASSWORD_RULES = [
  {
    key: "minLength" as const,
    test: (password: string) => password.length >= PASSWORD_REQUIREMENTS.minLength,
    message: `At least ${PASSWORD_REQUIREMENTS.minLength} characters`,
  },
  {
    key: "lowercase" as const,
    test: (password: string) => /[a-z]/.test(password),
    message: "One lowercase letter",
  },
  {
    key: "uppercase" as const,
    test: (password: string) => /[A-Z]/.test(password),
    message: "One uppercase letter",
  },
  {
    key: "number" as const,
    test: (password: string) => /[0-9]/.test(password),
    message: "One number",
  },
] as const;

export type PasswordRuleKey = typeof PASSWORD_RULES[number]["key"];

/**
 * Result of password validation check.
 */
export interface PasswordValidationResult {
  isValid: boolean;
  checks: Record<PasswordRuleKey, boolean>;
  /** Number of passed checks out of total */
  passedCount: number;
  totalCount: number;
}

/**
 * Validates a password against all requirements and returns detailed results.
 * Used for real-time password strength indicator.
 */
export function validatePassword(password: string): PasswordValidationResult {
  const checks = {} as Record<PasswordRuleKey, boolean>;
  let passedCount = 0;

  for (const rule of PASSWORD_RULES) {
    const passed = rule.test(password);
    checks[rule.key] = passed;
    if (passed) passedCount++;
  }

  return {
    isValid: passedCount === PASSWORD_RULES.length,
    checks,
    passedCount,
    totalCount: PASSWORD_RULES.length,
  };
}

/**
 * Base password Zod schema with all requirements.
 */
export const passwordSchema = z
  .string()
  .min(
    PASSWORD_REQUIREMENTS.minLength,
    `Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`
  )
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

/**
 * Password with confirmation schema.
 */
export const passwordWithConfirmSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type PasswordWithConfirm = z.infer<typeof passwordWithConfirmSchema>;

/**
 * Password change schema for authenticated users.
 * Includes current password verification.
 */
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmNewPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

/**
 * Set password schema for OAuth-only users (no current password required).
 */
export const setPasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmNewPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
