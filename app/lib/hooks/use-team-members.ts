'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { showToast } from '@/components/feedback';

export interface TeamMember {
  id: string;
  user_id: string;
  role: 'member' | 'admin';
  joined_at: string;
  name: string | null;
  avatar_url: string | null;
}

export interface TeamMembersResponse {
  members: TeamMember[];
  currentUserRole: 'member' | 'admin';
  currentUserId: string;
}

async function fetchTeamMembers(teamId: string): Promise<TeamMembersResponse> {
  const response = await fetch(`/api/teams/${teamId}/members`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to fetch team members');
  }

  return data.data;
}

export function useTeamMembers(teamId: string) {
  return useQuery({
    queryKey: ['team-members', teamId],
    queryFn: () => fetchTeamMembers(teamId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!teamId,
  });
}

// Update member role mutation with optimistic updates
interface UpdateRoleParams {
  memberId: string;
  role: 'member' | 'admin';
}

interface ApiError extends Error {
  code?: string;
}

export function useUpdateMemberRole(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memberId, role }: UpdateRoleParams) => {
      const response = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.error?.message || 'Failed to update member role') as ApiError;
        error.code = data.error?.code;
        throw error;
      }

      return data.data;
    },
    onMutate: async ({ memberId, role }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['team-members', teamId] });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<TeamMembersResponse>(['team-members', teamId]);

      // Optimistically update
      queryClient.setQueryData<TeamMembersResponse>(['team-members', teamId], (old) => {
        if (!old) return old;
        return {
          ...old,
          members: old.members.map((member) =>
            member.id === memberId ? { ...member, role } : member
          ),
        };
      });

      return { previousData };
    },
    onError: (error: ApiError, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['team-members', teamId], context.previousData);
      }

      if (error.code === 'LAST_ADMIN') {
        showToast.error('You must assign another admin first');
      } else {
        showToast.error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      showToast.success('Role updated successfully');
    },
  });
}

// Remove member mutation
export function useRemoveMember(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string) => {
      const response = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.error?.message || 'Failed to remove member') as ApiError;
        error.code = data.error?.code;
        throw error;
      }

      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      showToast.success('Member removed from team');
    },
    onError: (error: ApiError) => {
      if (error.code === 'LAST_ADMIN') {
        showToast.error('Cannot remove the last admin');
      } else {
        showToast.error(error.message);
      }
    },
  });
}

// Leave team mutation
interface LeaveTeamResult {
  success: boolean;
  nextTeam: { id: string; name: string } | null;
}

export function useLeaveTeam(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<LeaveTeamResult> => {
      const response = await fetch(`/api/teams/${teamId}/leave`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.error?.message || 'Failed to leave team') as ApiError;
        error.code = data.error?.code;
        throw error;
      }

      return data.data;
    },
    onSuccess: () => {
      // Invalidate all team-related queries
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['current-team'] });
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      showToast.success('You have left the team');
    },
    onError: (error: ApiError) => {
      if (error.code === 'LAST_ADMIN') {
        showToast.error('You must assign another admin before leaving');
      } else {
        showToast.error(error.message);
      }
    },
  });
}
