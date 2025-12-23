'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { showToast } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DimensionEditor } from './dimension-editor';
import {
  analysisConfigSchema,
  AI_MODEL_OPTIONS,
  type AnalysisConfigFormInput,
  type AnalysisConfigInput,
  type AnalysisConfigWithDimensions,
} from '@/lib/validations/analysis-config';
import {
  createAnalysisConfig,
  updateAnalysisConfig,
} from '@/lib/services/admin-config';
import { Save, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface AnalysisConfigFormProps {
  config?: AnalysisConfigWithDimensions;
  mode: 'create' | 'edit';
}

export function AnalysisConfigForm({ config, mode }: AnalysisConfigFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AnalysisConfigFormInput>({
    resolver: zodResolver(analysisConfigSchema),
    defaultValues: config
      ? {
          name: config.name,
          system_prompt: config.system_prompt,
          model: config.model as AnalysisConfigFormInput['model'],
          dimensions: config.analysis_dimensions.map((dim) => ({
            id: dim.id,
            name: dim.name,
            description: dim.description || '',
            weight: dim.weight,
            prompt_template: dim.prompt_template,
            scoring_criteria: dim.scoring_criteria,
            sort_order: dim.sort_order,
            enabled: dim.enabled,
          })),
        }
      : {
          name: '',
          system_prompt: '',
          model: 'gpt-4o-mini',
          dimensions: [],
        },
  });

  const onSubmit = (data: AnalysisConfigFormInput) => {
    setError(null);
    startTransition(async () => {
      try {
        // Parse through schema to apply defaults
        const parsedData = analysisConfigSchema.parse(data);
        if (mode === 'create') {
          const result = await createAnalysisConfig(parsedData);
          if (result.success) {
            showToast.success('Configuration created successfully');
            router.push(`/admin/config/${result.data.id}`);
          } else {
            setError(result.error.message);
            showToast.error(result.error.message);
          }
        } else if (config) {
          const result = await updateAnalysisConfig(config.id, parsedData);
          if (result.success) {
            showToast.success('Configuration updated successfully');
            router.push(`/admin/config/${config.id}`);
            router.refresh();
          } else {
            setError(result.error.message);
            showToast.error(result.error.message);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred';
        setError(message);
        showToast.error(message);
      }
    });
  };

  return (
    <form
      data-testid="new-config-form"
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-8"
    >
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-border bg-background p-6 space-y-6">
        <h3 className="text-lg font-semibold text-foreground">Basic Information</h3>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Version Name</Label>
            <Input
              id="name"
              placeholder="e.g., Scoring v2.0"
              {...form.register('name')}
              className="bg-card"
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">AI Model</Label>
            <Select
              value={form.watch('model')}
              onValueChange={(value) =>
                form.setValue('model', value as AnalysisConfigFormInput['model'])
              }
            >
              <SelectTrigger id="model" data-testid="model-select-trigger" className="bg-card">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {AI_MODEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className="flex items-center gap-2">
                      {option.label}
                      <span className="text-xs text-muted-foreground">
                        ({option.provider})
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.model && (
              <p className="text-xs text-destructive">
                {form.formState.errors.model.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="system_prompt">System Prompt</Label>
          <Textarea
            id="system_prompt"
            placeholder="Instructions for the AI on how to analyze prompts..."
            {...form.register('system_prompt')}
            rows={6}
            className="bg-card"
          />
          {form.formState.errors.system_prompt && (
            <p className="text-xs text-destructive">
              {form.formState.errors.system_prompt.message}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background p-6">
        <DimensionEditor form={form} />
        {form.formState.errors.dimensions?.root && (
          <p className="mt-2 text-sm text-destructive">
            {form.formState.errors.dimensions.root.message}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" asChild>
          <Link href="/admin/config">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Configs
          </Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          <Save className="mr-2 h-4 w-4" />
          {isPending ? 'Saving...' : mode === 'create' ? 'Save Config' : 'Update Config'}
        </Button>
      </div>
    </form>
  );
}
