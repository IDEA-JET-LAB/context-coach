'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Search,
  Users,
  Inbox,
  FolderOpen,
  BarChart3,
  Zap,
  LucideIcon,
} from 'lucide-react';

export type EmptyStateVariant = 'default' | 'search' | 'team' | 'inbox' | 'folder' | 'analytics' | 'prompts';

export interface EmptyStateProps {
  /** Variant determines default icon and styling */
  variant?: EmptyStateVariant;
  /** Custom icon */
  icon?: LucideIcon;
  /** Title text */
  title: string;
  /** Description text */
  description: string;
  /** Primary action */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Secondary action */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class names */
  className?: string;
}

const variantIcons: Record<EmptyStateVariant, LucideIcon> = {
  default: Inbox,
  search: Search,
  team: Users,
  inbox: Inbox,
  folder: FolderOpen,
  analytics: BarChart3,
  prompts: FileText,
};

const sizeConfig = {
  sm: {
    iconContainer: 'h-12 w-12',
    icon: 'h-6 w-6',
    title: 'text-base',
    description: 'text-sm',
    spacing: 'space-y-3',
  },
  md: {
    iconContainer: 'h-16 w-16',
    icon: 'h-8 w-8',
    title: 'text-lg',
    description: 'text-sm',
    spacing: 'space-y-4',
  },
  lg: {
    iconContainer: 'h-20 w-20',
    icon: 'h-10 w-10',
    title: 'text-xl',
    description: 'text-base',
    spacing: 'space-y-5',
  },
};

export function EmptyState({
  variant = 'default',
  icon,
  title,
  description,
  action,
  secondaryAction,
  size = 'md',
  className,
}: EmptyStateProps) {
  const Icon = icon || variantIcons[variant];
  const config = sizeConfig[size];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-12 px-4',
        config.spacing,
        className
      )}
      data-testid="empty-state"
      data-variant={variant}
    >
      <div
        className={cn(
          'rounded-full bg-muted flex items-center justify-center',
          config.iconContainer
        )}
      >
        <Icon className={cn('text-muted-foreground', config.icon)} />
      </div>
      <div className="space-y-2">
        <h3 className={cn('font-semibold text-foreground', config.title)}>
          {title}
        </h3>
        <p className={cn('text-muted-foreground max-w-md', config.description)}>
          {description}
        </p>
      </div>
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 mt-2">
          {action && (
            <Button onClick={action.onClick} size={size === 'sm' ? 'sm' : 'default'}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="outline"
              onClick={secondaryAction.onClick}
              size={size === 'sm' ? 'sm' : 'default'}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Pre-configured empty states for common use cases
export function NoPromptsEmptyState({
  onAction,
  className,
}: {
  onAction?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      variant="prompts"
      icon={Zap}
      title="No prompts yet"
      description="Start using Claude Code with the Contextor CLI installed to begin tracking your prompts and improving your skills."
      action={onAction ? { label: 'Install CLI', onClick: onAction } : undefined}
      className={className}
    />
  );
}

export function NoSearchResultsEmptyState({
  searchTerm,
  onClear,
  className,
}: {
  searchTerm: string;
  onClear: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      variant="search"
      title="No results found"
      description={`No results match "${searchTerm}". Try adjusting your search or filters.`}
      action={{ label: 'Clear search', onClick: onClear }}
      size="sm"
      className={className}
    />
  );
}

export function NoTeamMembersEmptyState({
  onInvite,
  className,
}: {
  onInvite?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      variant="team"
      title="No team members"
      description="Invite colleagues to your team to collaborate and track prompts together."
      action={onInvite ? { label: 'Invite members', onClick: onInvite } : undefined}
      className={className}
    />
  );
}

export function NoAnalyticsDataEmptyState({ className }: { className?: string }) {
  return (
    <EmptyState
      variant="analytics"
      title="Not enough data"
      description="Analytics will appear once you have submitted and analyzed more prompts."
      size="sm"
      className={className}
    />
  );
}
