'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { showToast } from '@/components/feedback';
import { cn } from '@/lib/utils';
import { ExperimentConfigComparison } from './experiment-config-comparison';
import { createExperiment, updateExperiment } from '@/lib/services/experiments';
import { SUCCESS_METRICS, DURATION_OPTIONS } from '@/lib/types/experiments';
import type { AnalysisConfig } from '@/lib/validations/analysis-config';
import type { ExperimentWithDetails, CreateExperimentInput, UpdateExperimentInput } from '@/lib/types/experiments';
import {
  Loader2,
  Beaker,
  Settings2,
  Target,
  SplitSquareVertical,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';

// Form validation schema
const experimentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  hypothesis: z.string().min(10, 'Hypothesis must be at least 10 characters').max(1000),
  control_config_id: z.string().uuid('Select a control configuration'),
  variant_config_id: z.string().uuid('Select a variant configuration'),
  traffic_percentage: z.number().min(10).max(90),
  min_sample_size: z.number().min(50).max(10000),
  min_duration_hours: z.number().min(1).max(720),
  significance_threshold: z.number().min(0.001).max(0.1),
  success_metric: z.string(),
  auto_promote_winner: z.boolean(),
}).refine(data => data.control_config_id !== data.variant_config_id, {
  message: 'Control and variant must be different configurations',
  path: ['variant_config_id'],
});

type ExperimentFormData = z.infer<typeof experimentSchema>;

interface ExperimentFormProps {
  configs: AnalysisConfig[];
  experiment?: ExperimentWithDetails;
  mode: 'create' | 'edit';
}

export function ExperimentForm({ configs, experiment, mode }: ExperimentFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get default values based on mode
  const getDefaultValues = (): Partial<ExperimentFormData> => {
    if (mode === 'edit' && experiment) {
      const controlVariant = experiment.variants.find(v => v.variant_name === 'control');
      const variantVariant = experiment.variants.find(v => v.variant_name === 'variant');
      return {
        name: experiment.name,
        hypothesis: experiment.hypothesis,
        control_config_id: controlVariant?.config_id ?? '',
        variant_config_id: variantVariant?.config_id ?? '',
        traffic_percentage: experiment.traffic_percentage,
        min_sample_size: experiment.min_sample_size,
        min_duration_hours: experiment.min_duration_hours,
        significance_threshold: experiment.significance_threshold,
        success_metric: experiment.success_metric,
        auto_promote_winner: experiment.auto_promote_winner,
      };
    }

    // Default values for new experiment
    // Default control to active config if available
    const activeConfig = configs.find(c => c.is_active);
    return {
      name: '',
      hypothesis: '',
      control_config_id: activeConfig?.id ?? '',
      variant_config_id: '',
      traffic_percentage: 50,
      min_sample_size: 100,
      min_duration_hours: 24,
      significance_threshold: 0.05,
      success_metric: 'overall_score',
      auto_promote_winner: false,
    };
  };

  const form = useForm<ExperimentFormData>({
    resolver: zodResolver(experimentSchema),
    defaultValues: getDefaultValues(),
  });

  const watchedControlId = form.watch('control_config_id');
  const watchedVariantId = form.watch('variant_config_id');
  const watchedTrafficPercentage = form.watch('traffic_percentage');
  const watchedMinSampleSize = form.watch('min_sample_size');
  const watchedMinDuration = form.watch('min_duration_hours');
  const watchedSignificance = form.watch('significance_threshold');

  const controlConfig = configs.find(c => c.id === watchedControlId);
  const variantConfig = configs.find(c => c.id === watchedVariantId);

  const handleSubmit = async (data: ExperimentFormData) => {
    setIsSubmitting(true);

    try {
      if (mode === 'create') {
        const input: CreateExperimentInput = {
          name: data.name,
          hypothesis: data.hypothesis,
          control_config_id: data.control_config_id,
          variant_config_id: data.variant_config_id,
          traffic_percentage: data.traffic_percentage,
          min_sample_size: data.min_sample_size,
          min_duration_hours: data.min_duration_hours,
          significance_threshold: data.significance_threshold,
          success_metric: data.success_metric,
          auto_promote_winner: data.auto_promote_winner,
        };

        const result = await createExperiment(input);
        if (result.success) {
          showToast.success('Experiment created successfully');
          router.push(`/admin/experiments/${result.data.id}`);
        } else {
          showToast.error(result.error.message);
        }
      } else if (experiment) {
        const input: UpdateExperimentInput = {
          name: data.name,
          hypothesis: data.hypothesis,
          control_config_id: data.control_config_id,
          variant_config_id: data.variant_config_id,
          traffic_percentage: data.traffic_percentage,
          min_sample_size: data.min_sample_size,
          min_duration_hours: data.min_duration_hours,
          significance_threshold: data.significance_threshold,
          success_metric: data.success_metric,
          auto_promote_winner: data.auto_promote_winner,
        };

        const result = await updateExperiment(experiment.id, input);
        if (result.success) {
          showToast.success('Experiment updated successfully');
          router.refresh();
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

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      {/* Basic Info */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Beaker className="h-5 w-5" />
            Experiment Details
          </CardTitle>
          <CardDescription>
            Define your experiment name and hypothesis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Experiment Name</Label>
            <Input
              id="name"
              placeholder="e.g., Q4 Scoring Optimization Test"
              {...form.register('name')}
              className="bg-background"
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="hypothesis">
              Hypothesis
              <span className="text-muted-foreground text-xs ml-2">
                What do you expect to happen?
              </span>
            </Label>
            <Textarea
              id="hypothesis"
              placeholder="e.g., Increasing the weight of specificity will improve average prompt scores by 5% because it encourages more detailed prompts..."
              rows={3}
              {...form.register('hypothesis')}
              className="bg-background"
            />
            {form.formState.errors.hypothesis && (
              <p className="text-xs text-destructive">
                {form.formState.errors.hypothesis.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configuration Selection */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configuration Selection
          </CardTitle>
          <CardDescription>
            Select the control and variant configurations to test
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Control Configuration</Label>
              <Select
                value={watchedControlId}
                onValueChange={(v) => form.setValue('control_config_id', v)}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select control config" />
                </SelectTrigger>
                <SelectContent>
                  {configs.map((config) => (
                    <SelectItem key={config.id} value={config.id}>
                      <div className="flex items-center gap-2">
                        <span>{config.name}</span>
                        <span className="text-xs text-muted-foreground">v{config.version}</span>
                        {config.is_active && (
                          <span className="text-xs bg-green-500/20 text-green-500 px-1.5 py-0.5 rounded">
                            Active
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.control_config_id && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.control_config_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Variant Configuration</Label>
              <Select
                value={watchedVariantId}
                onValueChange={(v) => form.setValue('variant_config_id', v)}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select variant config" />
                </SelectTrigger>
                <SelectContent>
                  {configs.map((config) => (
                    <SelectItem
                      key={config.id}
                      value={config.id}
                      disabled={config.id === watchedControlId}
                    >
                      <div className="flex items-center gap-2">
                        <span>{config.name}</span>
                        <span className="text-xs text-muted-foreground">v{config.version}</span>
                        {config.is_active && (
                          <span className="text-xs bg-green-500/20 text-green-500 px-1.5 py-0.5 rounded">
                            Active
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.variant_config_id && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.variant_config_id.message}
                </p>
              )}
            </div>
          </div>

          {/* Config Comparison */}
          {controlConfig && variantConfig && (
            <ExperimentConfigComparison
              controlConfig={controlConfig}
              variantConfig={variantConfig}
            />
          )}
        </CardContent>
      </Card>

      {/* Traffic Split */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SplitSquareVertical className="h-5 w-5" />
            Traffic Split
          </CardTitle>
          <CardDescription>
            Configure how traffic is divided between control and variant
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Traffic Allocation</Label>
              <span className="text-sm font-medium">
                {100 - watchedTrafficPercentage}% / {watchedTrafficPercentage}%
              </span>
            </div>
            <Slider
              value={[watchedTrafficPercentage]}
              onValueChange={([v]) => form.setValue('traffic_percentage', v ?? 50)}
              min={10}
              max={90}
              step={5}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Control ({100 - watchedTrafficPercentage}%)</span>
              <span>Variant ({watchedTrafficPercentage}%)</span>
            </div>
          </div>

          {/* Traffic visualization */}
          <div className="h-4 rounded-full overflow-hidden flex bg-muted">
            <div
              className="bg-blue-500 transition-all"
              style={{ width: `${100 - watchedTrafficPercentage}%` }}
            />
            <div
              className="bg-green-500 transition-all"
              style={{ width: `${watchedTrafficPercentage}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Experiment Parameters */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Experiment Parameters
          </CardTitle>
          <CardDescription>
            Set success criteria and statistical parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Success Metric</Label>
              <Select
                value={form.watch('success_metric')}
                onValueChange={(v) => form.setValue('success_metric', v)}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select metric" />
                </SelectTrigger>
                <SelectContent>
                  {SUCCESS_METRICS.map((metric) => (
                    <SelectItem key={metric.value} value={metric.value}>
                      <div className="flex flex-col">
                        <span>{metric.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {metric.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Minimum Duration</Label>
              <Select
                value={String(watchedMinDuration)}
                onValueChange={(v) => form.setValue('min_duration_hours', parseInt(v))}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Minimum Sample Size (per variant)</Label>
              <span className="text-sm font-medium">{watchedMinSampleSize}</span>
            </div>
            <Slider
              value={[watchedMinSampleSize]}
              onValueChange={([v]) => form.setValue('min_sample_size', v ?? 100)}
              min={50}
              max={5000}
              step={50}
            />
            <p className="text-xs text-muted-foreground">
              Minimum number of samples per variant before declaring results
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Significance Threshold (p-value)</Label>
              <span className="text-sm font-medium">{watchedSignificance}</span>
            </div>
            <Slider
              value={[watchedSignificance * 100]}
              onValueChange={([v]) => form.setValue('significance_threshold', (v ?? 5) / 100)}
              min={1}
              max={10}
              step={0.5}
            />
            <p className="text-xs text-muted-foreground">
              Lower values require more statistical confidence
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <div>
              <Label className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Auto-promote Winner
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Automatically activate the winning configuration when experiment completes
              </p>
            </div>
            <Switch
              checked={form.watch('auto_promote_winner')}
              onCheckedChange={(v) => form.setValue('auto_promote_winner', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Estimated Duration */}
      <div className="rounded-lg border border-info/50 bg-info/10 p-4">
        <div className="flex items-start gap-2">
          <Info className="h-5 w-5 text-info mt-0.5" />
          <div>
            <p className="font-medium text-info flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Estimated Minimum Duration
            </p>
            <p className="text-sm text-info/80 mt-1">
              Based on your parameters ({watchedMinSampleSize * 2} total samples, {watchedMinDuration} hour minimum),
              this experiment will run for at least{' '}
              <strong>
                {watchedMinDuration < 24
                  ? `${watchedMinDuration} hours`
                  : `${Math.ceil(watchedMinDuration / 24)} days`}
              </strong>
              .
            </p>
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {mode === 'create' ? 'Creating...' : 'Saving...'}
            </>
          ) : (
            <>
              {mode === 'create' ? 'Create Experiment' : 'Save Changes'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
