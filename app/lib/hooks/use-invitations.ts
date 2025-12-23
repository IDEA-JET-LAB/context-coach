'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { showToast } from '@/components/feedback';

export interface Invitation {
  id: string;
  email: string;
  status: 'pending' | 'accepted' | 'revoked';
  created_at: string;
  expires_at: string;
  invited_by: string | null;
}

export interface InvitationDetails {
  id: string;
  email: string;
  teamName: string;
  expiresAt: string;
}

interface ApiError {
  code: string;
  message: string;
}

// Fetch pending invitations for a team
async function fetchInvitations(teamId: string): Promise<Invitation[]> {
  const response = await fetch(`/api/teams/${teamId}/invitations`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to fetch invitations');
  }

  return data.data.invitations;
}

// Create a new invitation
async function createInvitation(
  teamId: string,
  email: string
): Promise<{ invitation: Invitation; emailSent: boolean }> {
  const response = await fetch(`/api/teams/${teamId}/invitations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error?.message || 'Failed to create invitation') as Error & {
      code?: string;
    };
    error.code = data.error?.code;
    throw error;
  }

  return data.data;
}

// Revoke an invitation
async function revokeInvitation(
  teamId: string,
  invitationId: string
): Promise<Invitation> {
  const response = await fetch(`/api/teams/${teamId}/invitations`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invitationId }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to revoke invitation');
  }

  return data.data.invitation;
}

// Validate invitation token
async function validateInvitation(token: string): Promise<InvitationDetails> {
  const response = await fetch(`/api/invitations/${token}`);
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error?.message || 'Invalid invitation') as Error & {
      code?: string;
    };
    error.code = data.error?.code;
    throw error;
  }

  return data.data.invitation;
}

// Accept invitation
async function acceptInvitation(token: string): Promise<{ team: { id: string; name: string } }> {
  const response = await fetch(`/api/invitations/${token}/accept`, {
    method: 'POST',
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error?.message || 'Failed to accept invitation') as Error & {
      code?: string;
    };
    error.code = data.error?.code;
    throw error;
  }

  return data.data;
}

// Hook to fetch invitations
export function useInvitations(teamId: string) {
  return useQuery({
    queryKey: ['invitations', teamId],
    queryFn: () => fetchInvitations(teamId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!teamId,
  });
}

// Hook to create invitation
export function useInviteMember(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (email: string) => createInvitation(teamId, email),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invitations', teamId] });

      if (data.emailSent) {
        showToast.success('Invitation sent successfully');
      } else {
        showToast.success('Invitation created (email delivery pending)');
      }
    },
    onError: (error: Error & { code?: string }) => {
      // Map error codes to user-friendly messages
      const messageMap: Record<string, string> = {
        EMAIL_ALREADY_INVITED: 'This email already has a pending invitation',
        EMAIL_ALREADY_MEMBER: 'This user is already a team member',
        FORBIDDEN: 'Only team admins can invite members',
      };

      showToast.error(messageMap[error.code || ''] || error.message);
    },
  });
}

// Hook to revoke invitation
export function useRevokeInvitation(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => revokeInvitation(teamId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', teamId] });
      showToast.success('Invitation revoked');
    },
    onError: (error: Error) => {
      showToast.error(error.message);
    },
  });
}

// Hook to validate invitation token
export function useValidateInvitation(token: string) {
  return useQuery({
    queryKey: ['invitation', token],
    queryFn: () => validateInvitation(token),
    retry: false,
    enabled: !!token,
  });
}

// Hook to accept invitation
export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acceptInvitation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['current-team'] });
      showToast.success(`Welcome to ${data.team.name}!`);
    },
    onError: (error: Error & { code?: string }) => {
      const messageMap: Record<string, string> = {
        INVALID_TOKEN: 'This invitation is no longer valid',
        EMAIL_MISMATCH: 'This invitation was sent to a different email address',
        ALREADY_MEMBER: 'You are already a member of this team',
      };

      showToast.error(messageMap[error.code || ''] || error.message);
    },
  });
}

// ============================================
// LINK INVITATIONS
// ============================================

export interface LinkInvitation {
  id: string;
  invite_token: string;
  url: string;
  status: 'pending' | 'revoked';
  created_at: string;
  expires_at: string;
  max_uses: number | null;
  current_uses: number;
}

// Fetch link invitations for a team
async function fetchLinkInvitations(teamId: string): Promise<LinkInvitation[]> {
  const response = await fetch(`/api/teams/${teamId}/invites/link`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to fetch link invitations');
  }

  return data.data.invitations;
}

// Create a new link invitation
async function createLinkInvitation(
  teamId: string,
  options?: { maxUses?: number; expiresDays?: number }
): Promise<{
  id: string;
  token: string;
  url: string;
  expires_at: string;
  max_uses: number;
}> {
  const response = await fetch(`/api/teams/${teamId}/invites/link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options || {}),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error?.message || 'Failed to create link invitation') as Error & {
      code?: string;
    };
    error.code = data.error?.code;
    throw error;
  }

  return data.data;
}

// Revoke a link invitation
async function revokeLinkInvitation(
  teamId: string,
  invitationId: string
): Promise<{ id: string; status: string }> {
  const response = await fetch(`/api/teams/${teamId}/invites/link`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invitationId }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to revoke link invitation');
  }

  return data.data;
}

// Hook to fetch link invitations
export function useLinkInvitations(teamId: string) {
  return useQuery({
    queryKey: ['link-invitations', teamId],
    queryFn: () => fetchLinkInvitations(teamId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!teamId,
  });
}

// Hook to create link invitation
export function useCreateLinkInvitation(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (options?: { maxUses?: number; expiresDays?: number }) =>
      createLinkInvitation(teamId, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['link-invitations', teamId] });
      showToast.success('Invite link created successfully');
    },
    onError: (error: Error & { code?: string }) => {
      const messageMap: Record<string, string> = {
        FORBIDDEN: 'Only team admins can create invite links',
        VALIDATION_ERROR: 'Invalid parameters',
      };

      showToast.error(messageMap[error.code || ''] || error.message);
    },
  });
}

// Hook to revoke link invitation
export function useRevokeLinkInvitation(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => revokeLinkInvitation(teamId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['link-invitations', teamId] });
      showToast.success('Invite link revoked');
    },
    onError: (error: Error) => {
      showToast.error(error.message);
    },
  });
}
