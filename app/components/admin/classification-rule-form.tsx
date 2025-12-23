'use client';

/**
 * Classification Rule Form Component
 * Story 22-2: Classification Rule Editor - Task 4
 *
 * Form for creating and editing classification rules with
 * pattern testing and ReDoS validation.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { showToast } from '@/components/feedback';
import { Loader2, Save, ArrowLeft, Code, AlertTriangle } from 'lucide-react';
import { createRule, updateRule } from '@/lib/services/classification-rules';
import { analyzePattern } from '@/lib/utils/redos-detector';
import { RegexTester } from './regex-tester';
import { RedosWarning } from './redos-warning';
import { PatternConflictWarning } from './pattern-conflict-warning';
import type {
  ClassificationCategory,
  ClassificationRule,
  RedosAnalysis,
} from '@/lib/types/classification-rules';

// Form validation schema
const ruleFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  category_id: z.string().uuid('Please select a category'),
  pattern: z.string().min(1, 'Pattern is required'),
  pattern_flags: z.string().max(10).default('i'),
  priority: z.number().min(1).max(100).default(50),
  description: z.string().max(500).optional(),
  enabled: z.boolean().default(true),
});

type RuleFormData = z.infer<typeof ruleFormSchema>;

interface ClassificationRuleFormProps {
  categories: ClassificationCategory[];
  initialData?: ClassificationRule;
  mode: 'create' | 'edit';
}

export function ClassificationRuleForm({
  categories,
  initialData,
  mode,
}: ClassificationRuleFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [redosAnalysis, setRedosAnalysis] = useState<RedosAnalysis | null>(null);

  const form = useForm<RuleFormData>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      category_id: initialData?.category_id || '',
      pattern: initialData?.pattern || '',
      pattern_flags: initialData?.pattern_flags || 'i',
      priority: initialData?.priority || 50,
      description: initialData?.description || '',
      enabled: initialData?.enabled ?? true,
    },
  });

  const watchedPattern = form.watch('pattern');
  const watchedCategoryId = form.watch('category_id');
  const watchedPriority = form.watch('priority');

  // Analyze pattern when it changes
  useEffect(() => {
    if (!watchedPattern) {
      setRedosAnalysis(null);
      return;
    }

    // Debounce analysis
    const timer = setTimeout(() => {
      const analysis = analyzePattern(watchedPattern);
      setRedosAnalysis(analysis);
    }, 300);

    return () => clearTimeout(timer);
  }, [watchedPattern]);

  // Check if pattern is valid regex
  const isPatternValid = useCallback(() => {
    if (!watchedPattern) return true;
    try {
      new RegExp(watchedPattern);
      return true;
    } catch {
      return false;
    }
  }, [watchedPattern]);

  const handleSubmit = async (data: RuleFormData) => {
    // Block submission if pattern is dangerous
    if (redosAnalysis?.risk === 'dangerous') {
      showToast.error('Cannot save: pattern has ReDoS vulnerability');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'create') {
        const result = await createRule({
          name: data.name,
          category_id: data.category_id,
          pattern: data.pattern,
          pattern_flags: data.pattern_flags,
          priority: data.priority,
          description: data.description || null,
          enabled: data.enabled,
        });

        if (result.success) {
          showToast.success('Rule created successfully');
          router.push('/admin/analysis/rules');
        } else {
          showToast.error(result.error.message);
        }
      } else if (initialData) {
        const result = await updateRule(initialData.id, {
          name: data.name,
          category_id: data.category_id,
          pattern: data.pattern,
          pattern_flags: data.pattern_flags,
          priority: data.priority,
          description: data.description || null,
          enabled: data.enabled,
        });

        if (result.success) {
          showToast.success('Rule updated successfully');
          router.push('/admin/analysis/rules');
        } else {
          showToast.error(result.error.message);
        }
      }
    } catch {
      showToast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeCategories = categories.filter((c) => !c.is_archived);

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push('/admin/analysis/rules')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Form Fields */}
        <div className="space-y-6">
          <Card className="border-border bg-surface-secondary">
            <CardHeader>
              <CardTitle className="text-lg">Rule Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Rule Name *</Label>
                <Input
                  id="name"
                  {...form.register('name')}
                  placeholder="e.g., Bug Fix Keywords"
                  className="bg-surface-primary"
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-status-error">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={watchedCategoryId}
                  onValueChange={(value) => form.setValue('category_id', value)}
                >
                  <SelectTrigger className="bg-surface-primary">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.name.replace(/_/g, ' ')}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.category_id && (
                  <p className="text-xs text-status-error">
                    {form.formState.errors.category_id.message}
                  </p>
                )}
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="priority">Priority (1-100)</Label>
                  <span className="text-sm font-mono text-muted-foreground">
                    {watchedPriority}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[watchedPriority]}
                    onValueChange={([value]) => form.setValue('priority', value ?? 50)}
                    min={1}
                    max={100}
                    step={1}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={watchedPriority}
                    onChange={(e) =>
                      form.setValue(
                        'priority',
                        Math.min(100, Math.max(1, parseInt(e.target.value) || 50))
                      )
                    }
                    className="w-20 bg-surface-primary text-center"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Higher priority rules are matched first. Use 80-100 for important rules.
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...form.register('description')}
                  placeholder="Brief description of what this rule matches"
                  rows={3}
                  className="bg-surface-primary"
                />
              </div>

              {/* Enabled Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enabled">Enabled</Label>
                  <p className="text-xs text-muted-foreground">
                    Disabled rules won't match any prompts
                  </p>
                </div>
                <Switch
                  id="enabled"
                  checked={form.watch('enabled')}
                  onCheckedChange={(checked) => form.setValue('enabled', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Pattern Section */}
          <Card className="border-border bg-surface-secondary">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Code className="h-5 w-5" />
                Regex Pattern
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Pattern Input */}
              <div className="space-y-2">
                <Label htmlFor="pattern">Pattern *</Label>
                <Input
                  id="pattern"
                  {...form.register('pattern')}
                  placeholder="\b(fix|bug|error)\b"
                  className={cn(
                    'bg-surface-primary font-mono',
                    !isPatternValid() && 'border-status-error'
                  )}
                />
                {form.formState.errors.pattern && (
                  <p className="text-xs text-status-error">
                    {form.formState.errors.pattern.message}
                  </p>
                )}
                {!isPatternValid() && (
                  <p className="text-xs text-status-error">Invalid regex syntax</p>
                )}
              </div>

              {/* Pattern Flags */}
              <div className="space-y-2">
                <Label htmlFor="pattern_flags">Flags</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="pattern_flags"
                    {...form.register('pattern_flags')}
                    placeholder="i"
                    className="w-24 bg-surface-primary font-mono"
                  />
                  <span className="text-xs text-muted-foreground">
                    Common: i (case-insensitive), g (global), m (multiline)
                  </span>
                </div>
              </div>

              {/* ReDoS Warning */}
              {redosAnalysis && (
                <RedosWarning analysis={redosAnalysis} />
              )}

              {/* Pattern Conflict Detection */}
              {watchedPattern && watchedCategoryId && (
                <PatternConflictWarning
                  pattern={watchedPattern}
                  categoryId={watchedCategoryId}
                  excludeRuleId={initialData?.id}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Pattern Tester */}
        <div>
          <RegexTester
            pattern={watchedPattern}
            flags={form.watch('pattern_flags')}
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex items-center justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/analysis/rules')}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || redosAnalysis?.risk === 'dangerous' || !isPatternValid()}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {mode === 'create' ? 'Create Rule' : 'Save Changes'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
