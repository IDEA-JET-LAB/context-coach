import { Metadata } from 'next';
import { InlineAlert } from '@/components/feedback';
import { getCategories } from '@/lib/services/classification-rules';
import { ClassificationRuleForm } from '@/components/admin/classification-rule-form';

export const metadata: Metadata = {
  title: 'Create Rule | Classification Rules | Admin | Contextor',
  description: 'Create a new classification rule',
};

export default async function NewClassificationRulePage() {
  const result = await getCategories();

  if (!result.success) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-foreground">Create Classification Rule</h2>
        <InlineAlert
          variant="error"
          title="Failed to load categories"
          message={result.error.message}
        />
      </div>
    );
  }

  const activeCategories = result.data.filter((c) => !c.is_archived);

  return (
    <div data-testid="new-rule-page" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Create Classification Rule</h2>
        <p className="text-muted-foreground">
          Define a regex pattern to automatically categorize prompts
        </p>
      </div>

      <ClassificationRuleForm categories={activeCategories} mode="create" />
    </div>
  );
}
