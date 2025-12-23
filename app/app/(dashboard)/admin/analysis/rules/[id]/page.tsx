import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { InlineAlert } from '@/components/feedback';
import { getRule, getCategories } from '@/lib/services/classification-rules';
import { getRecentMatchesForRule } from '@/lib/services/classification-engine';
import { ClassificationRuleForm } from '@/components/admin/classification-rule-form';
import { RuleMatchHistory } from '@/components/admin/rule-match-history';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getRule(id);

  if (!result.success) {
    return {
      title: 'Rule Not Found | Admin | Contextor',
    };
  }

  return {
    title: `${result.data.name} | Classification Rules | Admin | Contextor`,
    description: result.data.description || `Edit classification rule: ${result.data.name}`,
  };
}

export default async function ClassificationRuleDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [ruleResult, categoriesResult, matchesResult] = await Promise.all([
    getRule(id),
    getCategories(),
    getRecentMatchesForRule(id, 10),
  ]);

  if (!ruleResult.success && ruleResult.error.code === 'NOT_FOUND') {
    notFound();
  }

  if (!ruleResult.success) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-foreground">Edit Classification Rule</h2>
        <InlineAlert
          variant="error"
          title="Failed to load rule"
          message={ruleResult.error.message}
        />
      </div>
    );
  }

  if (!categoriesResult.success) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-foreground">Edit Classification Rule</h2>
        <InlineAlert
          variant="error"
          title="Failed to load categories"
          message={categoriesResult.error.message}
        />
      </div>
    );
  }

  const rule = ruleResult.data;
  const activeCategories = categoriesResult.data.filter((c) => !c.is_archived);

  return (
    <div data-testid="rule-detail-page" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Edit Classification Rule</h2>
        <p className="text-muted-foreground">
          Modify the pattern and settings for "{rule.name}"
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <ClassificationRuleForm
          categories={activeCategories}
          initialData={rule}
          mode="edit"
        />

        {/* Match History Sidebar */}
        <div className="xl:order-last">
          <RuleMatchHistory
            matches={matchesResult.success ? matchesResult.data || [] : []}
            matchCount={rule.match_count}
            lastMatchedAt={rule.last_matched_at}
          />
        </div>
      </div>
    </div>
  );
}
