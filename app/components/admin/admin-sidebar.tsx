'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Building2, Settings2, Activity, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const adminNavItems = [
  { icon: LayoutDashboard, label: 'Overview', href: '/admin' },
  { icon: Users, label: 'Users', href: '/admin/users' },
  { icon: Building2, label: 'Teams', href: '/admin/teams' },
  { icon: Settings2, label: 'Analysis Config', href: '/admin/config' },
  { icon: Activity, label: 'System Health', href: '/admin/system' },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex w-16 flex-col items-center border-r border-border bg-background py-4"
      data-testid="admin-sidebar"
    >
      {/* Back to dashboard link */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href="/prompts"
            aria-label="Back to Dashboard"
            data-testid="nav-back-dashboard"
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg transition-colors mb-4',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              'text-muted-foreground hover:bg-card hover:text-foreground'
            )}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          Back to Dashboard
        </TooltipContent>
      </Tooltip>

      {/* Divider */}
      <div className="w-8 border-t border-border mb-4" />

      {/* Admin navigation */}
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
                      : 'text-muted-foreground hover:bg-card hover:text-foreground'
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
    </aside>
  );
}
