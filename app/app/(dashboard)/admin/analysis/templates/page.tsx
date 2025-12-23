import { Metadata } from 'next';
import Link from 'next/link';
import { Plus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InlineAlert, EmptyState } from '@/components/feedback';
import { getPromptTemplates } from '@/lib/services/prompt-templates';
import { TemplateList } from '@/components/admin/templates/template-list';
import { TemplateFilters } from '@/components/admin/templates/template-filters';

export const metadata: Metadata = {
  title: 'Prompt Templates | Admin | Contextor',
  description: 'Manage LLM prompt templates for analysis, feedback, and classification',
};

interface PageProps {
  searchParams: Promise<{
    type?: string;
    status?: string;
  }>;
}

export default async function PromptTemplatesPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Validate filter parameters
  const typeFilter = ['analysis', 'feedback', 'classification'].includes(params.type || '')
    ? (params.type as 'analysis' | 'feedback' | 'classification')
    : undefined;

  const statusFilter = ['draft', 'active', 'archived'].includes(params.status || '')
    ? (params.status as 'draft' | 'active' | 'archived')
    : undefined;

  const result = await getPromptTemplates({
    type: typeFilter,
    status: statusFilter,
  });

  return (
    <div data-testid="templates-list-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Prompt Templates</h2>
          <p className="text-muted-foreground">
            Create and manage LLM prompt templates with variable substitution
          </p>
        </div>
        <Button asChild data-testid="create-template-button">
          <Link href="/admin/analysis/templates/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <TemplateFilters
        currentType={typeFilter}
        currentStatus={statusFilter}
      />

      {/* Content */}
      {result.success ? (
        result.data.length > 0 ? (
          <TemplateList templates={result.data} />
        ) : (
          <TemplatesEmptyState hasFilters={!!(typeFilter || statusFilter)} />
        )
      ) : (
        <InlineAlert
          variant="error"
          title="Failed to load templates"
          message={result.error.message}
        />
      )}
    </div>
  );
}

// Client component for empty state with navigation
function TemplatesEmptyState({ hasFilters }: { hasFilters: boolean }) {
  'use client';
  return (
    <EmptyState
      icon={FileText}
      title="No Templates Found"
      description={
        hasFilters
          ? 'No templates match your current filters. Try adjusting the filters or create a new template.'
          : 'Create your first prompt template to customize how the AI analyzes prompts.'
      }
    />
  );
}
