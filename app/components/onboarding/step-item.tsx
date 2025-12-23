'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface StepItemProps {
  icon: LucideIcon;
  label: string;
  completed: boolean;
  href?: string;
  onClick?: () => void;
}

export function StepItem({ icon: Icon, label, completed, href, onClick }: StepItemProps) {
  const content = (
    <div
      className={cn(
        'flex items-center gap-3 p-2 rounded-md transition-all duration-300',
        completed
          ? 'text-muted-foreground'
          : 'text-foreground hover:bg-muted cursor-pointer'
      )}
      role="listitem"
      aria-label={`${label} - ${completed ? 'completed' : 'pending'}`}
    >
      <div
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-full transition-all duration-300',
          completed ? 'bg-teal-500' : 'border border-muted'
        )}
      >
        {completed ? (
          <Check className="h-4 w-4 text-white" aria-hidden="true" />
        ) : (
          <Icon className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <span className={cn('text-sm', completed && 'line-through')}>{label}</span>
    </div>
  );

  if (completed) {
    return content;
  }

  if (href) {
    return (
      <Link href={href} tabIndex={0}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left"
        tabIndex={0}
      >
        {content}
      </button>
    );
  }

  return content;
}
