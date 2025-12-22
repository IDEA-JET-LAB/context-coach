'use client';

import { Users } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

interface EmptyTeamProps {
  isAdmin: boolean;
  onInvite?: () => void;
}

export function EmptyTeam({ isAdmin, onInvite }: EmptyTeamProps) {
  if (!isAdmin) {
    return null;
  }

  return (
    <EmptyState
      icon={Users}
      title="No team members yet"
      description="Invite team members to collaborate on prompts, share insights, and learn from each other's prompting strategies."
      action={{
        label: 'Invite Members',
        onClick: onInvite,
      }}
    />
  );
}
