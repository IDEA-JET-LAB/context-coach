'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Search,
  MessageSquare,
  Tag,
  Copy,
  MoreHorizontal,
  Trash2,
  Archive,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { showToast } from '@/components/feedback';
import {
  duplicatePromptTemplate,
  archivePromptTemplate,
  deletePromptTemplate,
} from '@/lib/services/prompt-templates';
import type {
  PromptTemplateListItem,
  PromptTemplateType,
  PromptTemplateStatus,
} from '@/lib/types/prompt-templates';
import { TEMPLATE_STATUS_CONFIG } from '@/lib/types/prompt-templates';

interface TemplateListProps {
  templates: PromptTemplateListItem[];
}

const typeIcons: Record<PromptTemplateType, typeof Search> = {
  analysis: Search,
  feedback: MessageSquare,
  classification: Tag,
};

const typeLabels: Record<PromptTemplateType, string> = {
  analysis: 'Analysis',
  feedback: 'Feedback',
  classification: 'Classification',
};

export function TemplateList({ templates }: TemplateListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const result = await duplicatePromptTemplate(id);
      if (result.success) {
        showToast.success('Template duplicated successfully');
        router.push(`/admin/analysis/templates/${result.data.id}`);
      } else {
        showToast.error(result.error.message);
      }
    });
  };

  const handleArchive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const result = await archivePromptTemplate(id);
      if (result.success) {
        showToast.success('Template archived');
        router.refresh();
      } else {
        showToast.error(result.error.message);
      }
    });
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const result = await deletePromptTemplate(id);
      if (result.success) {
        showToast.success('Template deleted');
        router.refresh();
      } else {
        showToast.error(result.error.message);
      }
    });
  };

  // Group templates by status (active first, then draft, then archived)
  const sortedTemplates = [...templates].sort((a, b) => {
    const statusOrder: Record<PromptTemplateStatus, number> = {
      active: 0,
      draft: 1,
      archived: 2,
    };
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return (
    <div className="space-y-4" data-testid="template-list">
      {sortedTemplates.map((template) => {
        const Icon = typeIcons[template.type];
        const statusConfig = TEMPLATE_STATUS_CONFIG[template.status];

        return (
          <Card
            key={template.id}
            className={cn(
              'cursor-pointer border-border bg-background transition-colors hover:bg-muted/30',
              template.status === 'active' && 'border-l-4 border-l-primary',
              isPending && 'opacity-50 pointer-events-none'
            )}
            onClick={() => router.push(`/admin/analysis/templates/${template.id}`)}
            data-testid={`template-card-${template.id}`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg',
                      template.status === 'active'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-base font-medium text-foreground">
                      {template.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-normal">
                        {typeLabels[template.type]}
                      </Badge>
                      <Badge
                        variant={statusConfig.variant}
                        className={cn(
                          'text-xs',
                          template.status === 'active' &&
                            'bg-primary/10 text-primary hover:bg-primary/20'
                        )}
                      >
                        {statusConfig.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        v{template.version}
                      </span>
                    </div>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`template-actions-${template.id}`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => handleDuplicate(template.id, e as unknown as React.MouseEvent)}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Duplicate
                    </DropdownMenuItem>
                    {template.status !== 'archived' && (
                      <DropdownMenuItem
                        onClick={(e) => handleArchive(template.id, e as unknown as React.MouseEvent)}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        Archive
                      </DropdownMenuItem>
                    )}
                    {template.status !== 'active' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => handleDelete(template.id, e as unknown as React.MouseEvent)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {template.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {template.description}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Updated{' '}
                {formatDistanceToNow(new Date(template.updated_at), { addSuffix: true })}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
