'use client';

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { showToast } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
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
import {
  Beaker,
  Target,
  Calendar,
  Users,
  Split,
  Play,
  Pause,
  Check,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
  Info,
  Sparkles,
} from 'lucide-react';

/**
 * A/B Experiment Creator
 *
 * A wizard-style component for creating A/B experiments with:
 * - Experiment creation wizard
 * - Variant definition UI
 * - Control vs treatment setup
 * - Hypothesis/goal input
 * - Traffic allocation controls
 * - Scheduling (start/end dates)
 */

// Schema
const experimentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  hypothesis: z.string().min(10, 'Hypothesis must be at least 10 characters').max(500),
  primaryMetric: z.enum(['overall_score', 'dimension_score', 'user_satisfaction', 'engagement']),
  targetDimension: z.string().optional(),
  variants: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1, 'Variant name is required'),
      description: z.string().optional(),
      configId: z.string().min(1, 'Configuration is required'),
      trafficPercentage: z.number().min(1).max(100),
      isControl: z.boolean(),
    })
  ).min(2, 'At least 2 variants required'),
  scheduling: z.object({
    startDate: z.string(),
    endDate: z.string().optional(),
    autoEnd: z.boolean(),
    minimumSamples: z.number().min(100),
    confidenceThreshold: z.number().min(80).max(99),
  }),
  targeting: z.object({
    allUsers: z.boolean(),
    teamIds: z.array(z.string()).optional(),
    userPercentage: z.number().min(1).max(100),
  }),
});

type ExperimentFormData = z.infer<typeof experimentSchema>;

// Available configurations for variants
export interface ConfigOption {
  id: string;
  name: string;
  version: number;
  description?: string;
}

// Available teams for targeting
export interface TeamOption {
  id: string;
  name: string;
  memberCount: number;
}

const METRIC_OPTIONS = [
  { value: 'overall_score', label: 'Overall Score', description: 'Average prompt score across all dimensions' },
  { value: 'dimension_score', label: 'Dimension Score', description: 'Score for a specific dimension' },
  { value: 'user_satisfaction', label: 'User Satisfaction', description: 'User feedback and ratings' },
  { value: 'engagement', label: 'Engagement', description: 'User activity and prompt frequency' },
] as const;

const WIZARD_STEPS = [
  { id: 'basics', title: 'Basics', description: 'Name and hypothesis' },
  { id: 'variants', title: 'Variants', description: 'Define control & treatment' },
  { id: 'traffic', title: 'Traffic', description: 'Allocate traffic' },
  { id: 'scheduling', title: 'Scheduling', description: 'Timeline and targets' },
  { id: 'review', title: 'Review', description: 'Confirm and launch' },
] as const;

export interface ExperimentCreatorProps {
  configs: ConfigOption[];
  teams: TeamOption[];
  onSave?: (data: ExperimentFormData) => Promise<{ success: boolean; error?: string }>;
  onCancel?: () => void;
}

export function ExperimentCreator({
  configs,
  teams,
  onSave,
  onCancel,
}: ExperimentCreatorProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showLaunchDialog, setShowLaunchDialog] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  const form = useForm<ExperimentFormData>({
    resolver: zodResolver(experimentSchema),
    defaultValues: {
      name: '',
      description: '',
      hypothesis: '',
      primaryMetric: 'overall_score',
      variants: [
        {
          id: 'control',
          name: 'Control',
          description: 'Current production configuration',
          configId: '',
          trafficPercentage: 50,
          isControl: true,
        },
        {
          id: 'treatment',
          name: 'Treatment',
          description: 'New configuration to test',
          configId: '',
          trafficPercentage: 50,
          isControl: false,
        },
      ],
      scheduling: {
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
        autoEnd: true,
        minimumSamples: 1000,
        confidenceThreshold: 95,
      },
      targeting: {
        allUsers: true,
        teamIds: [],
        userPercentage: 100,
      },
    },
  });

  const watchedVariants = form.watch('variants');
  const watchedMetric = form.watch('primaryMetric');
  const watchedTargeting = form.watch('targeting');
  const watchedScheduling = form.watch('scheduling');

  // Calculate total traffic allocation
  const totalTraffic = watchedVariants.reduce((sum, v) => sum + (v.trafficPercentage || 0), 0);

  // Add variant
  const addVariant = useCallback(() => {
    const currentVariants = form.getValues('variants');
    const newVariant = {
      id: `variant-${Date.now()}`,
      name: `Variant ${currentVariants.length}`,
      description: '',
      configId: '',
      trafficPercentage: 0,
      isControl: false,
    };
    form.setValue('variants', [...currentVariants, newVariant]);
  }, [form]);

  // Remove variant
  const removeVariant = useCallback(
    (index: number) => {
      const currentVariants = form.getValues('variants');
      if (currentVariants.length <= 2) {
        showToast.error('At least 2 variants are required');
        return;
      }
      if (currentVariants[index]?.isControl) {
        showToast.error('Cannot remove control variant');
        return;
      }
      form.setValue(
        'variants',
        currentVariants.filter((_, i) => i !== index)
      );
    },
    [form]
  );

  // Auto-balance traffic
  const autoBalanceTraffic = useCallback(() => {
    const currentVariants = form.getValues('variants');
    const count = currentVariants.length;
    const basePercentage = Math.floor(100 / count);
    const remainder = 100 % count;

    const balanced = currentVariants.map((v, i) => ({
      ...v,
      trafficPercentage: i < remainder ? basePercentage + 1 : basePercentage,
    }));

    form.setValue('variants', balanced);
    showToast.success('Traffic balanced evenly');
  }, [form]);

  // Navigate steps
  const nextStep = useCallback(() => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  // Validate current step
  const validateStep = useCallback(async (): Promise<boolean> => {
    const currentWizardStep = WIZARD_STEPS[currentStep];
    if (!currentWizardStep) return false;
    const step = currentWizardStep.id;

    switch (step) {
      case 'basics':
        return await form.trigger(['name', 'hypothesis', 'primaryMetric']);
      case 'variants':
        return await form.trigger('variants');
      case 'traffic':
        if (totalTraffic !== 100) {
          showToast.error('Traffic allocation must sum to 100%');
          return false;
        }
        return true;
      case 'scheduling':
        return await form.trigger('scheduling');
      default:
        return true;
    }
  }, [currentStep, form, totalTraffic]);

  // Handle next with validation
  const handleNext = useCallback(async () => {
    const isValid = await validateStep();
    if (isValid) {
      nextStep();
    }
  }, [validateStep, nextStep]);

  // Launch experiment
  const handleLaunch = useCallback(async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      showToast.error('Please fix validation errors');
      return;
    }

    if (totalTraffic !== 100) {
      showToast.error('Traffic allocation must sum to 100%');
      return;
    }

    setIsLaunching(true);
    const data = form.getValues();

    if (onSave) {
      const result = await onSave(data);
      if (result.success) {
        showToast.success('Experiment launched successfully');
        setShowLaunchDialog(false);
      } else {
        showToast.error(result.error || 'Failed to launch experiment');
      }
    }

    setIsLaunching(false);
  }, [form, totalTraffic, onSave]);

  // Render step content
  const renderStepContent = () => {
    const currentWizardStep = WIZARD_STEPS[currentStep];
    if (!currentWizardStep) return null;
    const step = currentWizardStep.id;

    switch (step) {
      case 'basics':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Experiment Name</Label>
              <Input
                id="name"
                placeholder="e.g., New Specificity Scoring Test"
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
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Brief description of what this experiment tests..."
                {...form.register('description')}
                rows={2}
                className="bg-card"
              />
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
                placeholder="e.g., We believe that the new specificity scoring criteria will improve average prompt scores by 5% because it provides clearer feedback to users."
                {...form.register('hypothesis')}
                rows={3}
                className="bg-card"
              />
              {form.formState.errors.hypothesis && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.hypothesis.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Primary Metric</Label>
              <Select
                value={watchedMetric}
                onValueChange={(value) =>
                  form.setValue('primaryMetric', value as ExperimentFormData['primaryMetric'])
                }
              >
                <SelectTrigger className="bg-card">
                  <SelectValue placeholder="Select metric to optimize" />
                </SelectTrigger>
                <SelectContent>
                  {METRIC_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {watchedMetric === 'dimension_score' && (
              <div className="space-y-2">
                <Label>Target Dimension</Label>
                <Select
                  value={form.watch('targetDimension')}
                  onValueChange={(value) => form.setValue('targetDimension', value)}
                >
                  <SelectTrigger className="bg-card">
                    <SelectValue placeholder="Select dimension" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clarity">Clarity</SelectItem>
                    <SelectItem value="context">Context</SelectItem>
                    <SelectItem value="specificity">Specificity</SelectItem>
                    <SelectItem value="goal">Goal Definition</SelectItem>
                    <SelectItem value="constraints">Constraints</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        );

      case 'variants':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-foreground">Variants</h4>
                <p className="text-sm text-muted-foreground">
                  Define the configurations to test
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={addVariant}>
                <Plus className="mr-2 h-4 w-4" />
                Add Variant
              </Button>
            </div>

            <div className="space-y-4">
              {watchedVariants.map((variant, index) => (
                <Card
                  key={variant.id}
                  className={cn(
                    'border-border bg-background',
                    variant.isControl && 'border-blue-500/50'
                  )}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Input
                          value={variant.name}
                          onChange={(e) =>
                            form.setValue(`variants.${index}.name`, e.target.value)
                          }
                          className="w-40 bg-card font-medium"
                          placeholder="Variant name"
                        />
                        {variant.isControl && (
                          <Badge className="bg-blue-500/20 text-blue-500">
                            Control
                          </Badge>
                        )}
                      </div>
                      {!variant.isControl && watchedVariants.length > 2 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeVariant(index)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input
                        value={variant.description || ''}
                        onChange={(e) =>
                          form.setValue(`variants.${index}.description`, e.target.value)
                        }
                        placeholder="Brief description of this variant"
                        className="bg-card"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Configuration</Label>
                      <Select
                        value={variant.configId}
                        onValueChange={(value) =>
                          form.setValue(`variants.${index}.configId`, value)
                        }
                      >
                        <SelectTrigger className="bg-card">
                          <SelectValue placeholder="Select configuration" />
                        </SelectTrigger>
                        <SelectContent>
                          {configs.map((config) => (
                            <SelectItem key={config.id} value={config.id}>
                              <div className="flex flex-col">
                                <span>{config.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  v{config.version}
                                  {config.description && ` - ${config.description}`}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.formState.errors.variants?.[index]?.configId && (
                        <p className="text-xs text-destructive">
                          Configuration is required
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {form.formState.errors.variants?.root && (
              <p className="text-sm text-destructive">
                {form.formState.errors.variants.root.message}
              </p>
            )}
          </div>
        );

      case 'traffic':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-foreground">Traffic Allocation</h4>
                <p className="text-sm text-muted-foreground">
                  Distribute traffic between variants
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={autoBalanceTraffic}>
                <Split className="mr-2 h-4 w-4" />
                Auto-balance
              </Button>
            </div>

            {/* Total indicator */}
            <Card className="border-border bg-background">
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Total Allocation</span>
                  <Badge
                    className={cn(
                      totalTraffic === 100
                        ? 'bg-green-500/20 text-green-500'
                        : 'bg-amber-500/20 text-amber-500'
                    )}
                  >
                    {totalTraffic}%
                  </Badge>
                </div>
                <Progress
                  value={Math.min(totalTraffic, 100)}
                  className={cn(
                    'h-2',
                    totalTraffic === 100 ? '[&>div]:bg-green-500' : '[&>div]:bg-amber-500'
                  )}
                />
                {totalTraffic !== 100 && (
                  <p className="text-xs text-amber-500 mt-2 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Must sum to 100%
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Traffic split visualization */}
            <div className="h-8 rounded-lg overflow-hidden flex">
              {watchedVariants.map((variant, index) => {
                const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500'];
                return (
                  <div
                    key={variant.id}
                    className={cn(
                      colors[index % colors.length],
                      'transition-all duration-300 flex items-center justify-center text-xs font-medium text-white'
                    )}
                    style={{ width: `${variant.trafficPercentage}%` }}
                  >
                    {variant.trafficPercentage > 10 && `${variant.trafficPercentage}%`}
                  </div>
                );
              })}
            </div>

            {/* Variant sliders */}
            <div className="space-y-4">
              {watchedVariants.map((variant, index) => (
                <div key={variant.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{variant.name}</span>
                      {variant.isControl && (
                        <Badge variant="secondary" className="text-xs">
                          Control
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={variant.trafficPercentage}
                        onChange={(e) =>
                          form.setValue(
                            `variants.${index}.trafficPercentage`,
                            Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                          )
                        }
                        className="w-16 text-center bg-card"
                        min={0}
                        max={100}
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                  <Slider
                    value={[variant.trafficPercentage]}
                    onValueChange={([value]) =>
                      form.setValue(`variants.${index}.trafficPercentage`, value ?? 0)
                    }
                    max={100}
                    step={1}
                  />
                </div>
              ))}
            </div>

            {/* Targeting */}
            <Card className="border-border bg-background">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Targeting
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Include All Users</Label>
                    <p className="text-xs text-muted-foreground">
                      Run experiment across all teams
                    </p>
                  </div>
                  <Switch
                    checked={watchedTargeting.allUsers}
                    onCheckedChange={(checked) =>
                      form.setValue('targeting.allUsers', checked)
                    }
                  />
                </div>

                {!watchedTargeting.allUsers && (
                  <div className="space-y-2">
                    <Label>Select Teams</Label>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {teams.map((team) => (
                        <label
                          key={team.id}
                          className={cn(
                            'flex items-center gap-2 rounded-lg border p-2 cursor-pointer transition-colors',
                            watchedTargeting.teamIds?.includes(team.id)
                              ? 'border-primary bg-primary/5'
                              : 'border-border bg-card hover:bg-muted/50'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={watchedTargeting.teamIds?.includes(team.id)}
                            onChange={(e) => {
                              const current = watchedTargeting.teamIds || [];
                              if (e.target.checked) {
                                form.setValue('targeting.teamIds', [...current, team.id]);
                              } else {
                                form.setValue(
                                  'targeting.teamIds',
                                  current.filter((id) => id !== team.id)
                                );
                              }
                            }}
                            className="sr-only"
                          />
                          <span className="text-sm">{team.name}</span>
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {team.memberCount}
                          </Badge>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>User Percentage</Label>
                    <span className="text-sm font-medium">{watchedTargeting.userPercentage}%</span>
                  </div>
                  <Slider
                    value={[watchedTargeting.userPercentage]}
                    onValueChange={([value]) =>
                      form.setValue('targeting.userPercentage', value ?? 100)
                    }
                    max={100}
                    step={5}
                  />
                  <p className="text-xs text-muted-foreground">
                    Percentage of eligible users to include in the experiment
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'scheduling':
        return (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={watchedScheduling.startDate}
                  onChange={(e) => form.setValue('scheduling.startDate', e.target.value)}
                  className="bg-card"
                />
              </div>

              <div className="space-y-2">
                <Label>End Date (optional)</Label>
                <Input
                  type="date"
                  value={watchedScheduling.endDate || ''}
                  onChange={(e) => form.setValue('scheduling.endDate', e.target.value)}
                  disabled={watchedScheduling.autoEnd}
                  className="bg-card"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-end when significant</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically end experiment when statistical significance is reached
                </p>
              </div>
              <Switch
                checked={watchedScheduling.autoEnd}
                onCheckedChange={(checked) =>
                  form.setValue('scheduling.autoEnd', checked)
                }
              />
            </div>

            <Card className="border-border bg-background">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Statistical Targets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Minimum Samples</Label>
                    <span className="text-sm font-medium">
                      {watchedScheduling.minimumSamples.toLocaleString()}
                    </span>
                  </div>
                  <Slider
                    value={[watchedScheduling.minimumSamples]}
                    onValueChange={([value]) =>
                      form.setValue('scheduling.minimumSamples', value ?? 1000)
                    }
                    min={100}
                    max={10000}
                    step={100}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum number of samples before declaring results
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Confidence Threshold</Label>
                    <span className="text-sm font-medium">
                      {watchedScheduling.confidenceThreshold}%
                    </span>
                  </div>
                  <Slider
                    value={[watchedScheduling.confidenceThreshold]}
                    onValueChange={([value]) =>
                      form.setValue('scheduling.confidenceThreshold', value ?? 95)
                    }
                    min={80}
                    max={99}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">
                    Required statistical confidence to declare a winner
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="rounded-lg border border-info/50 bg-info/10 p-4">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-info mt-0.5" />
                <div>
                  <p className="font-medium text-info">Estimated Duration</p>
                  <p className="text-sm text-info/80 mt-1">
                    Based on your traffic allocation and minimum samples, this experiment
                    will likely need <strong>7-14 days</strong> to reach statistical
                    significance.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'review':
        return (
          <div className="space-y-6">
            <Card className="border-border bg-background">
              <CardHeader>
                <CardTitle className="text-base">Experiment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-muted-foreground text-xs">Name</Label>
                    <p className="font-medium">{form.watch('name') || 'Untitled'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Primary Metric</Label>
                    <p className="font-medium">
                      {METRIC_OPTIONS.find((m) => m.value === watchedMetric)?.label}
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground text-xs">Hypothesis</Label>
                  <p className="text-sm">{form.watch('hypothesis')}</p>
                </div>

                <div>
                  <Label className="text-muted-foreground text-xs">Variants</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {watchedVariants.map((v) => (
                      <Badge key={v.id} variant="secondary">
                        {v.name}: {v.trafficPercentage}%
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-muted-foreground text-xs">Start Date</Label>
                    <p className="font-medium">
                      {format(new Date(watchedScheduling.startDate), 'PPP')}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Target Samples</Label>
                    <p className="font-medium">
                      {watchedScheduling.minimumSamples.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground text-xs">Targeting</Label>
                  <p className="font-medium">
                    {watchedTargeting.allUsers
                      ? 'All users'
                      : `${watchedTargeting.teamIds?.length || 0} selected teams`}
                    {' at '}
                    {watchedTargeting.userPercentage}% traffic
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-500">Before You Launch</p>
                  <ul className="text-sm text-amber-500/80 mt-1 space-y-1">
                    <li>Ensure configurations are tested and working</li>
                    <li>Verify traffic allocation is correct</li>
                    <li>Confirm targeting includes appropriate users</li>
                    <li>Review your hypothesis carefully</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Beaker className="h-5 w-5" />
            Create A/B Experiment
          </h3>
          <p className="text-sm text-muted-foreground">
            Test configuration changes with controlled experiments
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-between">
        {WIZARD_STEPS.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              'flex items-center',
              index < WIZARD_STEPS.length - 1 && 'flex-1'
            )}
          >
            <button
              type="button"
              onClick={() => index < currentStep && setCurrentStep(index)}
              disabled={index > currentStep}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 transition-colors',
                index === currentStep
                  ? 'bg-primary text-primary-foreground'
                  : index < currentStep
                  ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium">
                {index < currentStep ? (
                  <Check className="h-3 w-3" />
                ) : (
                  index + 1
                )}
              </span>
              <span className="hidden md:block text-sm font-medium">
                {step.title}
              </span>
            </button>
            {index < WIZARD_STEPS.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-px mx-2',
                  index < currentStep ? 'bg-green-500' : 'bg-border'
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card className="border-border bg-background">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {WIZARD_STEPS[currentStep]?.title}
            <span className="text-sm font-normal text-muted-foreground">
              - {WIZARD_STEPS[currentStep]?.description}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>{renderStepContent()}</CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={currentStep === 0 ? onCancel : prevStep}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          {currentStep === 0 ? 'Cancel' : 'Back'}
        </Button>

        {currentStep < WIZARD_STEPS.length - 1 ? (
          <Button onClick={handleNext}>
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={() => setShowLaunchDialog(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Launch Experiment
          </Button>
        )}
      </div>

      {/* Launch Confirmation */}
      <AlertDialog open={showLaunchDialog} onOpenChange={setShowLaunchDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Beaker className="h-5 w-5 text-primary" />
              Launch Experiment
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to launch "{form.watch('name')}"?
              <br />
              <br />
              The experiment will start on{' '}
              <strong>
                {format(new Date(watchedScheduling.startDate), 'PPP')}
              </strong>{' '}
              and will affect{' '}
              <strong>
                {watchedTargeting.allUsers
                  ? 'all users'
                  : `${watchedTargeting.teamIds?.length || 0} teams`}
              </strong>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLaunch}
              disabled={isLaunching}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLaunching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Launching...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Launch
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * ExperimentCreatorSkeleton - Loading skeleton
 */
export function ExperimentCreatorSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse" />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className="h-10 w-24 bg-muted rounded-lg animate-pulse" />
            {i < 5 && <div className="flex-1 h-px bg-muted" />}
          </div>
        ))}
      </div>

      <Card className="border-border bg-background">
        <CardContent className="py-8">
          <div className="space-y-4">
            <div className="h-10 w-full bg-muted rounded animate-pulse" />
            <div className="h-24 w-full bg-muted rounded animate-pulse" />
            <div className="h-10 w-1/2 bg-muted rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
