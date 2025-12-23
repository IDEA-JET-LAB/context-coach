import { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InlineAlert } from '@/components/feedback';
import { getRulesGroupedByCategory, getCategories } from '@/lib/services/classification-rules';
import { ClassificationRulesList } from '@/components/admin/classification-rules-list';
import { RulesImportExport } from '@/components/admin/rules-import-export';

export const metadata: Metadata = {
  title: 'Classification Rules | Admin | Contextor',
  description: 'Manage regex-based classification patterns for prompt categorization',
};

export default async function ClassificationRulesPage() {
  const [rulesResult, categoriesResult] = await Promise.all([
    getRulesGroupedByCategory(),
    getCategories(),
  ]);

  const hasError = !rulesResult.success || !categoriesResult.success;
  const errorMessage = !rulesResult.success
    ? rulesResult.error.message
    : !categoriesResult.success
    ? categoriesResult.error.message
    : '';

  return (
    <div data-testid="classification-rules-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Classification Rules</h2>
          <p className="text-muted-foreground">
            Manage regex-based patterns for automatic prompt categorization
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RulesImportExport />
          <Button asChild>
            <Link href="/admin/analysis/rules/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Rule
            </Link>
          </Button>
        </div>
      </div>

      {/* Content */}
      {hasError ? (
        <InlineAlert
          variant="error"
          title="Failed to load classification rules"
          message={errorMessage}
        />
      ) : (
        <ClassificationRulesList
          rulesByCategory={rulesResult.data}
          categories={categoriesResult.data}
        />
      )}
    </div>
  );
}
