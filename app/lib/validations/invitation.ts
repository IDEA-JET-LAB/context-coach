import { z } from 'zod';

export const inviteEmailSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .max(255, 'Email must be 255 characters or less')
    .transform((val) => val.toLowerCase().trim()),
});

export type InviteEmailInput = z.infer<typeof inviteEmailSchema>;

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
