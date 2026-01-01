import Link from 'next/link';
import { Plus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TemplateList } from '@/components/admin/templates/template-list';
import { InlineAlert, EmptyState } from '@/components/feedback';
import { getPromptTemplates } from '@/lib/services/prompt-templates';

/**
 * Templates Subtab
 *
 * Analysis prompt template management.
 */
export async function TemplatesSubtab() {
  const result = await getPromptTemplates();

  return (
    <div data-testid="templates-subtab" className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Create and manage LLM prompt templates with variable substitution.
        </p>
        <Button asChild size="sm">
          <Link href="/admin/analysis/templates/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Link>
        </Button>
      </div>

      {result.success ? (
        result.data.length > 0 ? (
          <TemplateList templates={result.data} />
        ) : (
          <EmptyState
            icon={FileText}
            title="No templates found"
            description="Create your first prompt template to get started."
          />
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
