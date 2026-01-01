import Link from 'next/link';
import { Plus, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClassificationRulesList } from '@/components/admin/classification-rules-list';
import { InlineAlert, EmptyState } from '@/components/feedback';
import { getRulesGroupedByCategory, getCategories } from '@/lib/services/classification-rules';

/**
 * Rules Subtab
 *
 * Classification rule management.
 */
export async function RulesSubtab() {
  const [rulesResult, categoriesResult] = await Promise.all([
    getRulesGroupedByCategory(),
    getCategories(),
  ]);

  // Handle errors
  if (!rulesResult.success) {
    return (
      <div data-testid="rules-subtab" className="space-y-4">
        <InlineAlert
          variant="error"
          title="Failed to load rules"
          message={rulesResult.error.message}
        />
      </div>
    );
  }

  if (!categoriesResult.success) {
    return (
      <div data-testid="rules-subtab" className="space-y-4">
        <InlineAlert
          variant="error"
          title="Failed to load categories"
          message={categoriesResult.error.message}
        />
      </div>
    );
  }

  const hasRules = rulesResult.data.some((group) => group.rules.length > 0);

  return (
    <div data-testid="rules-subtab" className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Define classification rules for prompt categorization.
        </p>
        <Button asChild size="sm">
          <Link href="/admin/analysis/rules/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Rule
          </Link>
        </Button>
      </div>

      {hasRules ? (
        <ClassificationRulesList
          rulesByCategory={rulesResult.data}
          categories={categoriesResult.data}
        />
      ) : (
        <EmptyState
          icon={List}
          title="No classification rules"
          description="Create your first classification rule to categorize prompts."
        />
      )}
    </div>
  );
}
