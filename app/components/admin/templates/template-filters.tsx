'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Search, MessageSquare, Tag, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PromptTemplateType, PromptTemplateStatus } from '@/lib/types/prompt-templates';
import { TEMPLATE_STATUS_CONFIG } from '@/lib/types/prompt-templates';

interface TemplateFiltersProps {
  currentType?: PromptTemplateType;
  currentStatus?: PromptTemplateStatus;
}

const typeOptions: { value: PromptTemplateType; label: string; icon: typeof Search }[] = [
  { value: 'analysis', label: 'Analysis', icon: Search },
  { value: 'feedback', label: 'Feedback', icon: MessageSquare },
  { value: 'classification', label: 'Classification', icon: Tag },
];

const statusOptions: PromptTemplateStatus[] = ['draft', 'active', 'archived'];

export function TemplateFilters({ currentType, currentStatus }: TemplateFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  };

  const clearFilters = () => {
    router.push('/admin/analysis/templates');
  };

  const hasFilters = currentType || currentStatus;

  return (
    <div
      className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-background p-4"
      data-testid="template-filters"
    >
      {/* Type Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Type:</span>
        <div className="flex gap-1">
          {typeOptions.map((option) => {
            const Icon = option.icon;
            const isActive = currentType === option.value;
            return (
              <Button
                key={option.value}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateFilter('type', isActive ? undefined : option.value)}
                className={cn(
                  'gap-1.5',
                  !isActive && 'text-muted-foreground'
                )}
                data-testid={`filter-type-${option.value}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {option.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Separator */}
      <div className="h-6 w-px bg-border" />

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Status:</span>
        <div className="flex gap-1">
          {statusOptions.map((status) => {
            const config = TEMPLATE_STATUS_CONFIG[status];
            const isActive = currentStatus === status;
            return (
              <Badge
                key={status}
                variant={isActive ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer transition-colors',
                  !isActive && 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => updateFilter('status', isActive ? undefined : status)}
                data-testid={`filter-status-${status}`}
              >
                {config.label}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Clear Filters */}
      {hasFilters && (
        <>
          <div className="h-6 w-px bg-border" />
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            data-testid="clear-filters"
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </Button>
        </>
      )}
    </div>
  );
}
