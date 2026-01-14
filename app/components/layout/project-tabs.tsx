/**
 * ProjectTabs - Tab navigation for project-specific views
 *
 * Shows when a project is selected, providing navigation between:
 * - Conversations (filtered by project)
 * - Stages (stage analytics)
 * - Settings (project configuration)
 */

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useSelectedProject } from '@/lib/hooks/use-selected-project';
import { MessageSquare, BarChart3, Settings } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: (projectId: string) => string;
  isActive: (pathname: string, projectId: string) => boolean;
}

const TABS: Tab[] = [
  {
    id: 'conversations',
    label: 'Conversations',
    icon: MessageSquare,
    href: (projectId) => `/conversations?project=${projectId}`,
    // Active on conversations list or individual conversation pages
    isActive: (pathname) =>
      pathname === '/conversations' || pathname.startsWith('/conversations/'),
  },
  {
    id: 'stages',
    label: 'Stages',
    icon: BarChart3,
    href: (projectId) => `/projects/${projectId}/stages`,
    isActive: (pathname, projectId) => pathname === `/projects/${projectId}/stages`,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    href: (projectId) => `/projects/${projectId}/settings`,
    isActive: (pathname, projectId) =>
      pathname === `/projects/${projectId}/settings` ||
      pathname === `/projects/${projectId}`,
  },
];

export function ProjectTabs() {
  const pathname = usePathname();
  const { projectId, hasProject } = useSelectedProject();

  // Don't render if no project selected
  if (!hasProject || !projectId) {
    return null;
  }

  return (
    <div className="border-b border-border bg-background">
      <div className="px-6">
        <nav className="flex gap-1" aria-label="Project navigation">
          {TABS.map((tab) => {
            const isActive = tab.isActive(pathname, projectId);
            const Icon = tab.icon;

            return (
              <Link
                key={tab.id}
                href={tab.href(projectId)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative',
                  'hover:text-foreground',
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                )}
                aria-current={isActive ? 'page' : undefined}
                data-testid={`project-tab-${tab.id}`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {/* Active indicator */}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
