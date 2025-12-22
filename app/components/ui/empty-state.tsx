'use client';

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  children?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 text-center px-4',
        className
      )}
      role="status"
      aria-label={title}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1a1a1a]">
        <Icon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-lg font-medium text-[#fafafa]">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {action && (
        <Button
          className="mt-6"
          onClick={action.onClick}
          asChild={!!action.href}
        >
          {action.href ? (
            <Link href={action.href}>{action.label}</Link>
          ) : (
            action.label
          )}
        </Button>
      )}
      {children && <div className="mt-6 w-full max-w-md">{children}</div>}
    </div>
  );
}
