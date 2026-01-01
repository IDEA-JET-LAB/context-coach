'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MessageSquare,
  MessagesSquare,
  BarChart2,
  Users,
  FolderOpen,
  Settings,
  Settings2,
  UserCog,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCurrentTeam } from '@/lib/hooks/use-current-team';

const navItems = [
  { icon: MessageSquare, label: 'Feed', href: '/prompts' },
  { icon: MessagesSquare, label: 'Conversations', href: '/conversations' },
  { icon: BarChart2, label: 'Analytics', href: '/analytics' },
  { icon: Users, label: 'Team', href: '/team' },
  { icon: FolderOpen, label: 'Projects', href: '/projects' },
  { icon: BookOpen, label: 'Docs', href: '/docs' },
  { icon: Settings, label: 'Settings', href: '/settings' },
];

interface SidebarProps {
  isAdmin?: boolean;
}

export function Sidebar({ isAdmin = false }: SidebarProps) {
  const pathname = usePathname();
  const { data: currentTeam } = useCurrentTeam();

  // Check if we're on team settings page
  const isTeamSettingsActive = pathname.includes('/teams/') && pathname.includes('/settings');

  // Check if we're on admin settings page
  const isAdminSettingsActive = pathname.startsWith('/admin/settings') || pathname === '/admin';

  return (
    <aside
      className="flex h-full w-16 flex-col items-center border-r border-border bg-background py-4"
      data-testid="dashboard-sidebar"
    >
      {/* Main navigation */}
      <nav role="navigation" aria-label="Main navigation" className="flex flex-col gap-2">
        {navItems.map((item) => {
          // For root path '/', only match exactly; for other paths, also match subpaths
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    isActive
                      ? 'bg-surface text-primary'
                      : 'text-muted-foreground hover:bg-surface hover:text-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}

        {/* Team Settings - only show if user has a current team */}
        {currentTeam && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/teams/${currentTeam.id}/settings`}
                aria-label="Team Settings"
                aria-current={isTeamSettingsActive ? 'page' : undefined}
                data-testid="nav-team-settings"
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isTeamSettingsActive
                    ? 'bg-surface text-primary'
                    : 'text-muted-foreground hover:bg-surface hover:text-foreground'
                )}
              >
                <UserCog className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Team Settings
            </TooltipContent>
          </Tooltip>
        )}
      </nav>

      {/* Spacer to push admin settings to bottom */}
      <div className="flex-1" />

      {/* Admin Settings - single icon at bottom, only for super admins */}
      {isAdmin && (
        <nav role="navigation" aria-label="Admin navigation" className="mt-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/admin/settings"
                aria-label="Admin Settings"
                aria-current={isAdminSettingsActive ? 'page' : undefined}
                data-testid="nav-admin-settings"
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
                  isAdminSettingsActive
                    ? 'bg-amber-500/20 text-amber-500'
                    : 'text-amber-500/70 hover:bg-amber-500/10 hover:text-amber-500'
                )}
              >
                <Settings2 className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Admin Settings
            </TooltipContent>
          </Tooltip>
        </nav>
      )}
    </aside>
  );
}
