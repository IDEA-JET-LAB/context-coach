'use client';

import { NoTeamMembersEmptyState } from '@/components/feedback';

interface EmptyTeamProps {
  isAdmin: boolean;
  onInvite?: () => void;
}

export function EmptyTeam({ isAdmin, onInvite }: EmptyTeamProps) {
  if (!isAdmin) {
    return null;
  }

  return <NoTeamMembersEmptyState onInvite={onInvite} />;
}
