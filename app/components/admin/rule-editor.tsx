'use client';

import { useState, useCallback } from 'react';
import { useFieldArray, useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { showToast } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  GripVertical,
  Plus,
  Trash2,
  Play,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  Filter,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

/**
 * Classification Rule Editor
 *
 * Allows admins to create and manage classification rules with:
 * - Rule list with enable/disable toggles
 * - Rule builder (condition + action pattern)
 * - Condition types (regex, keyword, score threshold)
 * - Rule priority/ordering
 * - Rule test interface
 */

// Rule condition types
const CONDITION_TYPES = [
  { value: 'regex', label: 'Regex Pattern', description: 'Match using regular expression' },
  { value: 'keyword', label: 'Keyword Match', description: 'Match specific keywords' },
  { value: 'score_threshold', label: 'Score Threshold', description: 'Match based on score' },
  { value: 'length', label: 'Length Check', description: 'Match based on prompt length' },
  { value: 'contains_code', label: 'Contains Code', description: 'Detect code snippets' },
] as const;

const ACTION_TYPES = [
  { value: 'classify', label: 'Classify As', description: 'Assign a classification label' },
  { value: 'adjust_score', label: 'Adjust Score', description: 'Modify the score by amount' },
  { value: 'flag', label: 'Flag for Review', description: 'Mark for manual review' },
  { value: 'skip_dimension', label: 'Skip Dimension', description: 'Skip scoring for dimension' },
  { value: 'apply_template', label: 'Apply Template', description: 'Use specific template' },
] as const;

// Schema
const ruleConditionSchema = z.object({
  type: z.enum(['regex', 'keyword', 'score_threshold', 'length', 'contains_code']),
  value: z.string().min(1, 'Value is required'),
  operator: z.enum(['equals', 'contains', 'greater_than', 'less_than', 'matches']).optional(),
});

const ruleActionSchema = z.object({
  type: z.enum(['classify', 'adjust_score', 'flag', 'skip_dimension', 'apply_template']),
  value: z.string().min(1, 'Value is required'),
});

const classificationRuleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  enabled: z.boolean(),
  priority: z.number().min(0).max(1000),
  condition: ruleConditionSchema,
  action: ruleActionSchema,
});

const rulesFormSchema = z.object({
  rules: z.array(classificationRuleSchema),
});

type ClassificationRule = z.infer<typeof classificationRuleSchema>;
type RulesFormData = z.infer<typeof rulesFormSchema>;

export interface RuleEditorProps {
  rules?: ClassificationRule[];
  onSave?: (rules: ClassificationRule[]) => Promise<{ success: boolean; error?: string }>;
  onTest?: (rule: ClassificationRule, testInput: string) => Promise<{ success: boolean; matched: boolean; result?: string }>;
  readOnly?: boolean;
}

export function RuleEditor({ rules = [], onSave, onTest, readOnly = false }: RuleEditorProps) {
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [testInput, setTestInput] = useState('');
  const [testResults, setTestResults] = useState<Record<string, { matched: boolean; result?: string }>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);

  const form = useForm<RulesFormData>({
    resolver: zodResolver(rulesFormSchema),
    defaultValues: {
      rules: rules.map((rule, index) => ({
        ...rule,
        id: rule.id || `rule-${index}`,
        enabled: rule.enabled ?? true,
        priority: rule.priority ?? 100,
      })),
    },
  });

  const { fields, append, remove, move, update } = useFieldArray({
    control: form.control,
    name: 'rules',
  });

  const watchedRules = form.watch('rules');

  const handleAddRule = useCallback(() => {
    const newRule: ClassificationRule = {
      id: `rule-${Date.now()}`,
      name: `Rule ${fields.length + 1}`,
      description: '',
      enabled: true,
      priority: 100,
      condition: {
        type: 'keyword',
        value: '',
      },
      action: {
        type: 'classify',
        value: '',
      },
    };
    append(newRule);
    setExpandedRuleId(newRule.id!);
  }, [append, fields.length]);

  const handleDuplicateRule = useCallback(
    (index: number) => {
      const ruleToDuplicate = watchedRules[index];
      if (!ruleToDuplicate) return;
      const newRule: ClassificationRule = {
        id: `rule-${Date.now()}`,
        name: `${ruleToDuplicate.name} (copy)`,
        description: ruleToDuplicate.description,
        enabled: ruleToDuplicate.enabled ?? true,
        priority: ruleToDuplicate.priority ?? 100,
        condition: ruleToDuplicate.condition ?? { type: 'keyword', value: '' },
        action: ruleToDuplicate.action ?? { type: 'classify', value: '' },
      };
      append(newRule);
      showToast.success('Rule duplicated');
    },
    [append, watchedRules]
  );

  const handleDeleteRule = useCallback(
    (index: number) => {
      remove(index);
      setDeleteRuleId(null);
      showToast.success('Rule deleted');
    },
    [remove]
  );

  const handleMoveRule = useCallback(
    (index: number, direction: 'up' | 'down') => {
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex >= 0 && newIndex < fields.length) {
        move(index, newIndex);
      }
    },
    [move, fields.length]
  );

  const handleToggleRule = useCallback(
    (index: number) => {
      const currentValue = watchedRules[index]?.enabled ?? true;
      form.setValue(`rules.${index}.enabled`, !currentValue);
    },
    [form, watchedRules]
  );

  const handleTestRule = async (index: number) => {
    if (!testInput.trim()) {
      showToast.error('Please enter test input');
      return;
    }

    const rule = watchedRules[index];
    if (!rule) return;

    setIsTesting(true);

    if (onTest) {
      const result = await onTest(rule, testInput);
      setTestResults((prev) => ({
        ...prev,
        [rule.id!]: { matched: result.matched, result: result.result },
      }));
    } else {
      // Mock test for demo
      let matched = false;
      if (rule.condition.type === 'keyword') {
        matched = testInput.toLowerCase().includes(rule.condition.value.toLowerCase());
      } else if (rule.condition.type === 'regex') {
        try {
          const regex = new RegExp(rule.condition.value, 'i');
          matched = regex.test(testInput);
        } catch {
          showToast.error('Invalid regex pattern');
        }
      } else if (rule.condition.type === 'length') {
        const length = parseInt(rule.condition.value);
        matched = testInput.length >= length;
      }

      setTestResults((prev) => ({
        ...prev,
        [rule.id!]: { matched, result: matched ? `Matched: ${rule.action.type} = ${rule.action.value}` : 'No match' },
      }));
    }

    setIsTesting(false);
  };

  const handleTestAllRules = async () => {
    if (!testInput.trim()) {
      showToast.error('Please enter test input');
      return;
    }

    setIsTesting(true);
    const results: Record<string, { matched: boolean; result?: string }> = {};

    for (const rule of watchedRules) {
      if (!rule.enabled) continue;

      if (onTest) {
        const result = await onTest(rule, testInput);
        results[rule.id!] = { matched: result.matched, result: result.result };
      } else {
        // Mock test
        let matched = false;
        if (rule.condition.type === 'keyword') {
          matched = testInput.toLowerCase().includes(rule.condition.value.toLowerCase());
        }
        results[rule.id!] = { matched };
      }
    }

    setTestResults(results);
    setIsTesting(false);

    const matchCount = Object.values(results).filter((r) => r.matched).length;
    showToast.success(`${matchCount} rule(s) matched`);
  };

  const handleSave = async () => {
    const data = form.getValues();
    if (onSave) {
      const result = await onSave(data.rules);
      if (result.success) {
        showToast.success('Rules saved successfully');
      } else {
        showToast.error(result.error || 'Failed to save rules');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Classification Rules</h3>
          <p className="text-sm text-muted-foreground">
            Define rules for automatic prompt classification and scoring adjustments
          </p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSave}>
              Save Rules
            </Button>
            <Button onClick={handleAddRule}>
              <Plus className="mr-2 h-4 w-4" />
              Add Rule
            </Button>
          </div>
        )}
      </div>

      {/* Test Panel */}
      <Card className="border-border bg-background">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Test Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Test Input</Label>
            <Textarea
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="Enter a sample prompt to test against all rules..."
              rows={3}
              className="bg-card"
            />
          </div>
          <Button
            onClick={handleTestAllRules}
            disabled={isTesting || !testInput.trim()}
            className="w-full"
          >
            {isTesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Test All Rules
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Rules List */}
      {fields.length === 0 ? (
        <Card className="border-dashed border-border bg-background">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Filter className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center">
              No classification rules defined.
              <br />
              {!readOnly && 'Click "Add Rule" to create your first rule.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => {
            const rule = watchedRules[index];
            const isExpanded = expandedRuleId === field.id;
            const testResult = testResults[field.id];

            return (
              <Card
                key={field.id}
                className={cn(
                  'border-border bg-background transition-all',
                  !rule?.enabled && 'opacity-60',
                  testResult?.matched && 'border-green-500/50 bg-green-500/5'
                )}
              >
                <CardHeader className="pb-0">
                  <div className="flex items-center gap-3">
                    {/* Drag Handle */}
                    {!readOnly && (
                      <div className="cursor-grab text-muted-foreground">
                        <GripVertical className="h-5 w-5" />
                      </div>
                    )}

                    {/* Priority Badge */}
                    <Badge variant="outline" className="text-xs">
                      #{index + 1}
                    </Badge>

                    {/* Enable/Disable Toggle */}
                    <Switch
                      checked={rule?.enabled ?? true}
                      onCheckedChange={() => handleToggleRule(index)}
                      disabled={readOnly}
                    />

                    {/* Rule Name */}
                    <div className="flex-1">
                      <button
                        type="button"
                        onClick={() => setExpandedRuleId(isExpanded ? null : field.id)}
                        className="flex items-center gap-2 text-left"
                      >
                        <span className="font-medium text-foreground">
                          {rule?.name || 'Unnamed Rule'}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                      {rule?.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {rule.description}
                        </p>
                      )}
                    </div>

                    {/* Condition/Action Summary */}
                    {!isExpanded && (
                      <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="secondary" className="text-xs">
                          {CONDITION_TYPES.find((c) => c.value === rule?.condition?.type)?.label || 'Unknown'}
                        </Badge>
                        <span className="text-muted-foreground/50">then</span>
                        <Badge variant="secondary" className="text-xs">
                          {ACTION_TYPES.find((a) => a.value === rule?.action?.type)?.label || 'Unknown'}
                        </Badge>
                      </div>
                    )}

                    {/* Test Result Indicator */}
                    {testResult && (
                      <div className="flex items-center gap-1">
                        {testResult.matched ? (
                          <Badge className="bg-green-500/20 text-green-500">
                            <Check className="h-3 w-3 mr-1" />
                            Match
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <X className="h-3 w-3 mr-1" />
                            No Match
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    {!readOnly && (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMoveRule(index, 'up')}
                          disabled={index === 0}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMoveRule(index, 'down')}
                          disabled={index === fields.length - 1}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDuplicateRule(index)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteRuleId(field.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>

                {/* Expanded Content */}
                {isExpanded && (
                  <CardContent className="pt-4 space-y-6">
                    {/* Basic Info */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Rule Name</Label>
                        <Input
                          {...form.register(`rules.${index}.name`)}
                          placeholder="e.g., Flag Long Prompts"
                          disabled={readOnly}
                          className="bg-card"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Priority (0-1000)</Label>
                        <div className="flex items-center gap-3">
                          <Slider
                            value={[rule?.priority ?? 100]}
                            onValueChange={([value]) =>
                              form.setValue(`rules.${index}.priority`, value ?? 100)
                            }
                            max={1000}
                            step={10}
                            disabled={readOnly}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            value={rule?.priority ?? 100}
                            onChange={(e) =>
                              form.setValue(
                                `rules.${index}.priority`,
                                Math.min(1000, Math.max(0, parseInt(e.target.value) || 0))
                              )
                            }
                            disabled={readOnly}
                            className="w-20 bg-card text-center"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Description (optional)</Label>
                      <Input
                        {...form.register(`rules.${index}.description`)}
                        placeholder="Brief description of what this rule does"
                        disabled={readOnly}
                        className="bg-card"
                      />
                    </div>

                    {/* Condition */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-sm font-medium text-muted-foreground">IF</span>
                        <div className="h-px flex-1 bg-border" />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Condition Type</Label>
                          <Select
                            value={rule?.condition?.type}
                            onValueChange={(value) =>
                              form.setValue(
                                `rules.${index}.condition.type`,
                                value as ClassificationRule['condition']['type']
                              )
                            }
                            disabled={readOnly}
                          >
                            <SelectTrigger className="bg-card">
                              <SelectValue placeholder="Select condition type" />
                            </SelectTrigger>
                            <SelectContent>
                              {CONDITION_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  <div className="flex flex-col">
                                    <span>{type.label}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {type.description}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>
                            {rule?.condition?.type === 'regex'
                              ? 'Pattern'
                              : rule?.condition?.type === 'keyword'
                              ? 'Keywords (comma-separated)'
                              : rule?.condition?.type === 'score_threshold'
                              ? 'Threshold Value'
                              : rule?.condition?.type === 'length'
                              ? 'Minimum Length'
                              : 'Value'}
                          </Label>
                          <Input
                            {...form.register(`rules.${index}.condition.value`)}
                            placeholder={
                              rule?.condition?.type === 'regex'
                                ? 'e.g., ^(help|how to).*'
                                : rule?.condition?.type === 'keyword'
                                ? 'e.g., urgent, asap, immediately'
                                : rule?.condition?.type === 'score_threshold'
                                ? 'e.g., 5'
                                : rule?.condition?.type === 'length'
                                ? 'e.g., 500'
                                : 'Enter value'
                            }
                            disabled={readOnly}
                            className="bg-card"
                          />
                          {rule?.condition?.type === 'regex' && (
                            <p className="text-xs text-muted-foreground">
                              Use JavaScript regex syntax. Example: /pattern/flags
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-sm font-medium text-muted-foreground">THEN</span>
                        <div className="h-px flex-1 bg-border" />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Action Type</Label>
                          <Select
                            value={rule?.action?.type}
                            onValueChange={(value) =>
                              form.setValue(
                                `rules.${index}.action.type`,
                                value as ClassificationRule['action']['type']
                              )
                            }
                            disabled={readOnly}
                          >
                            <SelectTrigger className="bg-card">
                              <SelectValue placeholder="Select action type" />
                            </SelectTrigger>
                            <SelectContent>
                              {ACTION_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  <div className="flex flex-col">
                                    <span>{type.label}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {type.description}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>
                            {rule?.action?.type === 'classify'
                              ? 'Classification Label'
                              : rule?.action?.type === 'adjust_score'
                              ? 'Score Adjustment (+/-)'
                              : rule?.action?.type === 'flag'
                              ? 'Flag Reason'
                              : rule?.action?.type === 'skip_dimension'
                              ? 'Dimension to Skip'
                              : rule?.action?.type === 'apply_template'
                              ? 'Template ID'
                              : 'Value'}
                          </Label>
                          <Input
                            {...form.register(`rules.${index}.action.value`)}
                            placeholder={
                              rule?.action?.type === 'classify'
                                ? 'e.g., urgent, bug-report, feature-request'
                                : rule?.action?.type === 'adjust_score'
                                ? 'e.g., -2 or +1'
                                : rule?.action?.type === 'flag'
                                ? 'e.g., Needs human review'
                                : 'Enter value'
                            }
                            disabled={readOnly}
                            className="bg-card"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Test Single Rule */}
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestRule(index)}
                        disabled={!testInput.trim() || isTesting}
                      >
                        <Play className="mr-2 h-3.5 w-3.5" />
                        Test This Rule
                      </Button>
                      {testResult && (
                        <span className="text-sm text-muted-foreground">
                          {testResult.result}
                        </span>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteRuleId !== null}
        onOpenChange={(open) => !open && setDeleteRuleId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this rule? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const index = fields.findIndex((f) => f.id === deleteRuleId);
                if (index !== -1) {
                  handleDeleteRule(index);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * RuleEditorSkeleton - Loading skeleton
 */
export function RuleEditorSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-24 bg-muted rounded animate-pulse" />
          <div className="h-10 w-28 bg-muted rounded animate-pulse" />
        </div>
      </div>

      <Card className="border-border bg-background">
        <CardContent className="py-6">
          <div className="h-24 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>

      {[1, 2, 3].map((i) => (
        <Card key={i} className="border-border bg-background">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 bg-muted rounded animate-pulse" />
              <div className="h-6 w-16 bg-muted rounded animate-pulse" />
              <div className="h-5 w-9 bg-muted rounded-full animate-pulse" />
              <div className="h-5 w-32 bg-muted rounded animate-pulse" />
              <div className="flex-1" />
              <div className="h-6 w-20 bg-muted rounded animate-pulse" />
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
