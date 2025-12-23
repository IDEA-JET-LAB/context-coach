'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MessageSquare,
  BarChart2,
  Users,
  FolderOpen,
  Settings,
  LayoutDashboard,
  Building2,
  Settings2,
  Activity,
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
  { icon: BarChart2, label: 'Analytics', href: '/analytics' },
  { icon: Users, label: 'Team', href: '/team' },
  { icon: FolderOpen, label: 'Projects', href: '/projects' },
  { icon: BookOpen, label: 'Docs', href: '/docs' },
  { icon: Settings, label: 'Settings', href: '/settings' },
];

const adminNavItems = [
  { icon: LayoutDashboard, label: 'Admin Overview', href: '/admin' },
  { icon: Users, label: 'Users', href: '/admin/users' },
  { icon: Building2, label: 'Teams', href: '/admin/teams' },
  { icon: Settings2, label: 'Analysis Config', href: '/admin/config' },
  { icon: Activity, label: 'System Health', href: '/admin/system' },
];

interface SidebarProps {
  isAdmin?: boolean;
}

export function Sidebar({ isAdmin = false }: SidebarProps) {
  const pathname = usePathname();
  const { data: currentTeam } = useCurrentTeam();

  // Check if we're on team settings page
  const isTeamSettingsActive = pathname.includes('/teams/') && pathname.includes('/settings');

  return (
    <aside
      className="flex w-16 flex-col items-center border-r border-border bg-background py-4"
      data-testid="dashboard-sidebar"
    >
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

      {/* Admin navigation - only shown for super admins */}
      {isAdmin && (
        <>
          <div className="my-4 w-8 border-t border-border" />
          <nav role="navigation" aria-label="Admin navigation" className="flex flex-col gap-2">
            {adminNavItems.map((item) => {
              const isActive =
                item.href === '/admin'
                  ? pathname === '/admin'
                  : pathname.startsWith(item.href);

              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      aria-label={item.label}
                      aria-current={isActive ? 'page' : undefined}
                      data-testid={`admin-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        isActive
                          ? 'bg-amber-500/20 text-amber-500'
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
          </nav>
        </>
      )}
    </aside>
  );
}
