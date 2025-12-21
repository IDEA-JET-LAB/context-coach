/**
 * Generate the full invitation URL from a token
 */
export function generateInviteUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3050';
  return `${baseUrl}/invite/${token}`;
}

/**
 * Parse error code from Supabase function error message
 */
export function parseInvitationError(errorMessage: string): {
  code: string;
  message: string;
} {
  // Expected format: "CODE: Human readable message"
  const match = errorMessage.match(/^([A-Z_]+):\s*(.+)$/);

  if (match && match[1] && match[2]) {
    return {
      code: match[1],
      message: match[2],
    };
  }

  // Map known error codes to user-friendly messages
  const errorMap: Record<string, string> = {
    EMAIL_ALREADY_INVITED: 'This email has a pending invitation',
    EMAIL_ALREADY_MEMBER: 'This user is already a team member',
    FORBIDDEN: 'Only team admins can invite members',
    INVALID_TOKEN: 'Invalid or expired invitation',
    EMAIL_MISMATCH: 'Invitation email does not match your account',
    ALREADY_MEMBER: 'You are already a member of this team',
    INVALID_INVITATION: 'Invitation not found',
  };

  for (const [code, message] of Object.entries(errorMap)) {
    if (errorMessage.includes(code)) {
      return { code, message };
    }
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: errorMessage || 'An unexpected error occurred',
  };
}
