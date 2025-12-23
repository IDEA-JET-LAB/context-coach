'use client';

import { useFieldArray, UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { GripVertical, Trash2, Plus, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AnalysisConfigFormInput } from '@/lib/validations/analysis-config';

interface DimensionEditorProps {
  form: UseFormReturn<AnalysisConfigFormInput>;
  readOnly?: boolean;
}

export function DimensionEditor({ form, readOnly = false }: DimensionEditorProps) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'dimensions',
  });

  const watchedDimensions = form.watch('dimensions');
  const totalWeight = watchedDimensions?.reduce(
    (sum, dim) => sum + (dim?.weight ?? 0),
    0
  ) ?? 0;

  function addDimension() {
    append({
      name: '',
      description: '',
      weight: 0,
      prompt_template: '',
      scoring_criteria: '',
      sort_order: fields.length,
      enabled: true,
    });
  }

  function autoBalance() {
    const count = fields.length;
    if (count === 0) return;

    const baseWeight = Math.floor(100 / count);
    const remainder = 100 % count;

    fields.forEach((_, index) => {
      const weight = index < remainder ? baseWeight + 1 : baseWeight;
      form.setValue(`dimensions.${index}.weight`, weight);
    });
  }

  const weightWarning = watchedDimensions?.length > 0 && totalWeight !== 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Scoring Dimensions</h3>
          <p className="text-sm text-muted-foreground">
            Define how prompts will be evaluated
          </p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                data-testid="total-weight"
                className={cn(
                  'text-sm font-medium',
                  totalWeight === 100 ? 'text-green-500' : 'text-amber-500'
                )}
              >
                Total: {totalWeight}%
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={autoBalance}
              disabled={fields.length === 0}
            >
              <Scale className="mr-1 h-3.5 w-3.5" />
              Auto-balance
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={addDimension}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Dimension
            </Button>
          </div>
        )}
      </div>

      {weightWarning && (
        <div
          data-testid="weight-warning"
          className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-500"
        >
          Dimension weights must sum to 100% (currently {totalWeight}%)
        </div>
      )}

      {fields.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-background p-8 text-center">
          <p className="text-muted-foreground">
            No dimensions defined. {!readOnly && 'Click "Add Dimension" to get started.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {fields.map((field, index) => (
            <Card
              key={field.id}
              data-testid="dimension-card"
              className="border-border bg-background"
            >
              <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-3">
                {!readOnly && (
                  <div className="cursor-grab text-muted-foreground">
                    <GripVertical className="h-5 w-5" />
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label htmlFor={`dimension-${index}-name`} className="sr-only">
                        Dimension Name
                      </Label>
                      <Input
                        id={`dimension-${index}-name`}
                        data-testid={`dimension-${index}-name`}
                        placeholder="Dimension name (e.g., Clarity)"
                        {...form.register(`dimensions.${index}.name`)}
                        disabled={readOnly}
                        className="bg-card"
                      />
                      {form.formState.errors.dimensions?.[index]?.name && (
                        <p className="mt-1 text-xs text-destructive">
                          {form.formState.errors.dimensions[index]?.name?.message}
                        </p>
                      )}
                    </div>
                    <div className="flex w-48 items-center gap-3">
                      <Slider
                        value={[watchedDimensions?.[index]?.weight ?? 0]}
                        onValueChange={([value]) =>
                          form.setValue(`dimensions.${index}.weight`, value ?? 0)
                        }
                        max={100}
                        step={1}
                        disabled={readOnly}
                        className="flex-1"
                      />
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          data-testid={`dimension-${index}-weight-input`}
                          value={watchedDimensions?.[index]?.weight ?? 0}
                          onChange={(e) =>
                            form.setValue(
                              `dimensions.${index}.weight`,
                              Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                            )
                          }
                          disabled={readOnly}
                          className="w-16 bg-card text-center"
                          min={0}
                          max={100}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        data-testid={`remove-dimension-${index}`}
                        onClick={() => remove(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div>
                  <Label htmlFor={`dimension-${index}-description`}>Description</Label>
                  <Input
                    id={`dimension-${index}-description`}
                    data-testid={`dimension-${index}-description`}
                    placeholder="Brief description of what this dimension measures"
                    {...form.register(`dimensions.${index}.description`)}
                    disabled={readOnly}
                    className="mt-1.5 bg-card"
                  />
                </div>
                <div>
                  <Label htmlFor={`dimension-${index}-prompt-template`}>
                    Prompt Template
                  </Label>
                  <Textarea
                    id={`dimension-${index}-prompt-template`}
                    data-testid={`dimension-${index}-prompt-template`}
                    placeholder="Instructions for evaluating this dimension. Use {{prompt}} for the user's prompt."
                    {...form.register(`dimensions.${index}.prompt_template`)}
                    disabled={readOnly}
                    rows={3}
                    className="mt-1.5 bg-card"
                  />
                  {form.formState.errors.dimensions?.[index]?.prompt_template && (
                    <p className="mt-1 text-xs text-destructive">
                      {form.formState.errors.dimensions[index]?.prompt_template?.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor={`dimension-${index}-scoring-criteria`}>
                    Scoring Criteria
                  </Label>
                  <Textarea
                    id={`dimension-${index}-scoring-criteria`}
                    data-testid={`dimension-${index}-scoring-criteria`}
                    placeholder="Define the 1-10 scoring scale for this dimension"
                    {...form.register(`dimensions.${index}.scoring_criteria`)}
                    disabled={readOnly}
                    rows={3}
                    className="mt-1.5 bg-card"
                  />
                  {form.formState.errors.dimensions?.[index]?.scoring_criteria && (
                    <p className="mt-1 text-xs text-destructive">
                      {form.formState.errors.dimensions[index]?.scoring_criteria?.message}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
