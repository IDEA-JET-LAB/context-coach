/**
 * Auth Message Whitelisting
 *
 * Security: URL parameters (error, message) should never be displayed directly
 * to users as this enables phishing attacks via crafted URLs. Instead, we use
 * a whitelist of known codes mapped to safe, user-friendly messages.
 *
 * Unknown codes show a generic message to prevent abuse while maintaining UX.
 */

/**
 * Error codes and their user-friendly messages
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Auth errors
  "access-denied": "Access denied. You don't have permission to view this page.",
  "access_denied": "Sign-in was cancelled.",
  "authentication-failed": "Authentication failed. Please try again.",
  "invalid-credentials": "Invalid email or password.",
  "email-not-confirmed": "Please verify your email before logging in.",
  "session-expired": "Your session has expired. Please log in again.",
  "expired": "This link has expired. Please request a new one.",

  // OAuth errors
  "oauth-cancelled": "Sign-in was cancelled.",
  "oauth-failed": "Sign-in failed. Please try again.",

  // OTP/Magic link errors
  "otp-expired": "This link has expired. Please request a new one.",
  "otp-invalid": "This link is invalid. Please request a new one.",

  // Rate limiting
  "rate-limited": "Too many attempts. Please wait and try again.",

  // Generic
  "unknown": "An error occurred. Please try again.",
  "invalid-request": "Invalid request. Please try again.",
};

/**
 * Info/success message codes and their user-friendly messages
 */
const INFO_MESSAGES: Record<string, string> = {
  // Session messages
  "session-expired": "Your session has expired. Please log in again.",

  // Access messages
  "no-access": "You do not have access to this area.",

  // Email verification
  "email-verified": "Your email has been verified. You can now log in.",
  "check-email": "Please check your email for a verification link.",

  // Password
  "password-updated": "Your password has been updated successfully.",
  "password-reset-sent": "If an account exists, a password reset link has been sent.",
};

/**
 * Default message for unknown error codes
 */
const DEFAULT_ERROR = "An error occurred. Please try again.";

/**
 * Get a safe, user-friendly error message from an error code or raw message.
 * Returns a generic message for unknown/unwhitelisted codes.
 */
export function getErrorMessage(errorParam: string | null | undefined): string | null {
  if (!errorParam) return null;

  // Normalize: lowercase and trim
  const normalized = errorParam.toLowerCase().trim();

  // Check exact match first
  if (ERROR_MESSAGES[normalized]) {
    return ERROR_MESSAGES[normalized];
  }

  // Check if the raw message matches any known friendly message
  // (for backwards compatibility with existing redirects that use full messages)
  const knownMessages = Object.values(ERROR_MESSAGES);
  if (knownMessages.some(msg => msg.toLowerCase() === normalized)) {
    return errorParam; // Return as-is if it's a known safe message
  }

  // Return default for unknown codes
  return DEFAULT_ERROR;
}

/**
 * Get a safe, user-friendly info message from a message code or raw message.
 * Returns null for unknown/unwhitelisted codes (no message shown).
 */
export function getInfoMessage(messageParam: string | null | undefined): string | null {
  if (!messageParam) return null;

  // Normalize: lowercase and trim
  const normalized = messageParam.toLowerCase().trim();

  // Check exact match first
  if (INFO_MESSAGES[normalized]) {
    return INFO_MESSAGES[normalized];
  }

  // Check if the raw message matches any known friendly message
  // (for backwards compatibility with existing redirects that use full messages)
  const knownMessages = Object.values(INFO_MESSAGES);
  if (knownMessages.some(msg => msg.toLowerCase() === normalized)) {
    return messageParam; // Return as-is if it's a known safe message
  }

  // For info messages, we don't show unknown messages (could be phishing)
  // Return null to suppress display
  return null;
}

/**
 * Get a safe reset password error message.
 * Special handling for the reset password flow.
 */
export function getResetPasswordError(errorParam: string | null | undefined): string | null {
  if (!errorParam) return null;

  const normalized = errorParam.toLowerCase().trim();

  // Known reset password error codes
  if (normalized === "expired") {
    return "This reset link has expired. Please request a new one.";
  }

  if (normalized === "invalid") {
    return "This reset link is invalid. Please request a new one.";
  }

  // Return generic for unknown
  return "Unable to reset password. Please request a new link.";
}
