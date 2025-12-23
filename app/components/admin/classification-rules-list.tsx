'use client';

/**
 * Classification Rules List Component
 * Story 22-2: Classification Rule Editor
 *
 * Displays classification rules grouped by category with filtering
 * and bulk selection capabilities.
 */

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { showToast } from '@/components/feedback';
import {
  ChevronDown,
  ChevronRight,
  Filter,
  Edit,
  AlertTriangle,
  Loader2,
  Settings,
} from 'lucide-react';
import { toggleRuleEnabled, bulkUpdateRules } from '@/lib/services/classification-rules';
import { BulkActionsBar } from './bulk-actions-bar';
import { CategoryManager } from './category-manager';
import type {
  ClassificationCategory,
  ClassificationRule,
  RulesByCategory,
} from '@/lib/types/classification-rules';

interface ClassificationRulesListProps {
  rulesByCategory: RulesByCategory[];
  categories: (ClassificationCategory & { rule_count: number })[];
}

export function ClassificationRulesList({
  rulesByCategory,
  categories,
}: ClassificationRulesListProps) {
  const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(rulesByCategory.map((g) => g.category.id))
  );
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [togglingRules, setTogglingRules] = useState<Set<string>>(new Set());
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  // Filter rules by category
  const filteredGroups =
    filterCategory === 'all'
      ? rulesByCategory
      : rulesByCategory.filter((g) => g.category.id === filterCategory);

  // Get all visible rule IDs
  const allVisibleRuleIds = filteredGroups.flatMap((g) => g.rules.map((r) => r.id));

  // Toggle category expansion
  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  // Toggle rule selection
  const toggleRuleSelection = useCallback((ruleId: string) => {
    setSelectedRules((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  }, []);

  // Select all visible rules
  const selectAllRules = useCallback(() => {
    setSelectedRules(new Set(allVisibleRuleIds));
  }, [allVisibleRuleIds]);

  // Deselect all rules
  const deselectAllRules = useCallback(() => {
    setSelectedRules(new Set());
  }, []);

  // Toggle rule enabled status
  const handleToggleEnabled = async (ruleId: string) => {
    setTogglingRules((prev) => new Set(prev).add(ruleId));

    try {
      const result = await toggleRuleEnabled(ruleId);
      if (result.success) {
        showToast.success(`Rule ${result.data.enabled ? 'enabled' : 'disabled'}`);
      } else {
        showToast.error(result.error.message);
      }
    } catch {
      showToast.error('Failed to toggle rule');
    } finally {
      setTogglingRules((prev) => {
        const next = new Set(prev);
        next.delete(ruleId);
        return next;
      });
    }
  };

  // Bulk enable
  const handleBulkEnable = async () => {
    const result = await bulkUpdateRules({
      rule_ids: Array.from(selectedRules),
      updates: { enabled: true },
    });

    if (result.success) {
      showToast.success(`${result.data.updated} rules enabled`);
      setSelectedRules(new Set());
    } else {
      showToast.error(result.error.message);
    }
  };

  // Bulk disable
  const handleBulkDisable = async () => {
    const result = await bulkUpdateRules({
      rule_ids: Array.from(selectedRules),
      updates: { enabled: false },
    });

    if (result.success) {
      showToast.success(`${result.data.updated} rules disabled`);
      setSelectedRules(new Set());
    } else {
      showToast.error(result.error.message);
    }
  };

  // Bulk change category
  const handleBulkChangeCategory = async (categoryId: string) => {
    const result = await bulkUpdateRules({
      rule_ids: Array.from(selectedRules),
      updates: { category_id: categoryId },
    });

    if (result.success) {
      showToast.success(`${result.data.updated} rules moved to new category`);
      setSelectedRules(new Set());
    } else {
      showToast.error(result.error.message);
    }
  };

  const totalRules = rulesByCategory.reduce((sum, g) => sum + g.rules.length, 0);

  return (
    <div className="space-y-6">
      {/* Filters and Category Management */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[200px] bg-surface-secondary">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories ({totalRules})</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    {cat.name} ({cat.rule_count})
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCategoryManager(true)}
        >
          <Settings className="mr-2 h-4 w-4" />
          Manage Categories
        </Button>
      </div>

      {/* Empty State */}
      {totalRules === 0 && (
        <Card className="border-dashed border-border bg-surface-secondary">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Filter className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center">
              No classification rules defined.
              <br />
              Click "Create Rule" to add your first rule.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Rules grouped by category */}
      {filteredGroups.map(({ category, rules }) => (
        <Card key={category.id} className="border-border bg-surface-secondary">
          <Collapsible
            open={expandedCategories.has(category.id)}
            onOpenChange={() => toggleCategory(category.id)}
          >
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-surface-tertiary/50 transition-colors">
                <div className="flex items-center gap-3">
                  {expandedCategories.has(category.id) ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}

                  <div
                    className="h-4 w-4 rounded-full shrink-0"
                    style={{ backgroundColor: category.color }}
                  />

                  <CardTitle className="text-base flex-1">
                    {category.name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </CardTitle>

                  <Badge variant="secondary" className="text-xs">
                    {rules.length} {rules.length === 1 ? 'rule' : 'rules'}
                  </Badge>

                  {rules.some((r) => r.redos_risk === 'warning') && (
                    <Badge variant="outline" className="text-amber-500 border-amber-500/50">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Warnings
                    </Badge>
                  )}
                </div>
                {category.description && (
                  <p className="text-sm text-muted-foreground ml-12">
                    {category.description}
                  </p>
                )}
              </CardHeader>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <CardContent className="pt-0">
                {rules.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No rules in this category
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {rules.map((rule) => (
                      <RuleRow
                        key={rule.id}
                        rule={rule}
                        isSelected={selectedRules.has(rule.id)}
                        isToggling={togglingRules.has(rule.id)}
                        onSelect={() => toggleRuleSelection(rule.id)}
                        onToggleEnabled={() => handleToggleEnabled(rule.id)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedRules.size}
        totalCount={allVisibleRuleIds.length}
        onSelectAll={selectAllRules}
        onDeselectAll={deselectAllRules}
        onBulkEnable={handleBulkEnable}
        onBulkDisable={handleBulkDisable}
        onBulkChangeCategory={handleBulkChangeCategory}
        categories={categories}
      />

      {/* Category Manager Dialog */}
      {showCategoryManager && (
        <CategoryManager
          categories={categories}
          open={showCategoryManager}
          onClose={() => setShowCategoryManager(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Rule Row Component
// ============================================================================

interface RuleRowProps {
  rule: ClassificationRule;
  isSelected: boolean;
  isToggling: boolean;
  onSelect: () => void;
  onToggleEnabled: () => void;
}

function RuleRow({ rule, isSelected, isToggling, onSelect, onToggleEnabled }: RuleRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 py-3 px-2 -mx-2 rounded transition-colors',
        isSelected && 'bg-surface-accent/50',
        !rule.enabled && 'opacity-60'
      )}
    >
      {/* Checkbox */}
      <Checkbox
        checked={isSelected}
        onCheckedChange={onSelect}
        aria-label={`Select rule ${rule.name}`}
      />

      {/* Enable Toggle */}
      <div className="shrink-0">
        {isToggling ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Switch
            checked={rule.enabled}
            onCheckedChange={onToggleEnabled}
            aria-label={`Toggle rule ${rule.name}`}
          />
        )}
      </div>

      {/* Priority Badge */}
      <Badge variant="outline" className="shrink-0 text-xs font-mono">
        P{rule.priority}
      </Badge>

      {/* Rule Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/analysis/rules/${rule.id}`}
            className="font-medium text-foreground hover:text-content-accent truncate"
          >
            {rule.name}
          </Link>
          {rule.redos_risk === 'warning' && (
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground font-mono truncate">
          {rule.pattern}
        </p>
      </div>

      {/* Match Count */}
      <div className="hidden sm:block shrink-0 text-right">
        <p className="text-sm font-medium text-foreground">
          {rule.match_count.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">matches</p>
      </div>

      {/* Edit Link */}
      <Button variant="ghost" size="sm" asChild className="shrink-0">
        <Link href={`/admin/analysis/rules/${rule.id}`}>
          <Edit className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
