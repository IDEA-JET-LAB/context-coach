'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TeamSwitcher } from '@/components/layout/team-switcher';
import { ProjectSwitcher } from '@/components/layout/project-switcher';
import { useUser } from '@/lib/hooks/use-user';
import { Skeleton } from '@/components/ui/skeleton';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

function getInitials(name: string | null, email: string): string {
  if (name && name.length > 0) {
    const parts = name.split(' ').filter((p) => p.length > 0);
    const first = parts[0];
    const second = parts[1];
    if (parts.length >= 2 && first && second && first.length > 0 && second.length > 0) {
      return (first.charAt(0) + second.charAt(0)).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
}

export function Header() {
  const { data: user, isPending } = useUser();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <header
      className="flex h-16 items-center justify-between border-b border-border bg-background px-6"
      data-testid="dashboard-header"
    >
      <div className="flex items-center gap-4">
        <TeamSwitcher />
        <div className="h-6 w-px bg-border" aria-hidden="true" />
        <ProjectSwitcher />
      </div>

      <div className="flex items-center gap-4">
        {isPending ? (
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : user ? (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8" data-testid="user-avatar">
              <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name ?? user.email} />
              <AvatarFallback className="bg-card text-xs">
                {getInitials(user.name, user.email)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-foreground" data-testid="user-name">
              {user.name ?? user.email}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              aria-label="Sign out"
              data-testid="logout-button"
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
