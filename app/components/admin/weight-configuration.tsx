'use client';

import { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { showToast } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  Scale,
  RefreshCw,
  Save,
  Eye,
  Info,
  Sparkles,
  Lock,
  Check,
  AlertTriangle,
  RotateCcw,
  Copy,
} from 'lucide-react';

/**
 * Weight Configuration Component
 *
 * Allows admins to configure scoring weights with:
 * - 5-dimension weight sliders
 * - Weight sum normalization indicator
 * - Weight preset templates
 * - Impact preview (how scores would change)
 */

// Default dimensions for the scoring system
const DEFAULT_DIMENSIONS = [
  {
    id: 'clarity',
    name: 'Clarity',
    description: 'How clear and unambiguous the prompt is',
    color: 'bg-blue-500',
    defaultWeight: 20,
  },
  {
    id: 'context',
    name: 'Context',
    description: 'How well the prompt provides relevant context',
    color: 'bg-purple-500',
    defaultWeight: 20,
  },
  {
    id: 'specificity',
    name: 'Specificity',
    description: 'How specific and detailed the requirements are',
    color: 'bg-green-500',
    defaultWeight: 25,
  },
  {
    id: 'goal',
    name: 'Goal Definition',
    description: 'How well the desired outcome is defined',
    color: 'bg-amber-500',
    defaultWeight: 20,
  },
  {
    id: 'constraints',
    name: 'Constraints',
    description: 'How well constraints and limitations are specified',
    color: 'bg-rose-500',
    defaultWeight: 15,
  },
] as const;

// Preset configurations
const WEIGHT_PRESETS = [
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Equal weight across all dimensions',
    weights: { clarity: 20, context: 20, specificity: 20, goal: 20, constraints: 20 },
  },
  {
    id: 'clarity-focused',
    name: 'Clarity Focused',
    description: 'Emphasizes clear communication',
    weights: { clarity: 35, context: 15, specificity: 20, goal: 20, constraints: 10 },
  },
  {
    id: 'technical',
    name: 'Technical',
    description: 'Best for code and technical prompts',
    weights: { clarity: 15, context: 25, specificity: 30, goal: 15, constraints: 15 },
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'Best for creative and open-ended prompts',
    weights: { clarity: 20, context: 15, specificity: 15, goal: 35, constraints: 15 },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Emphasizes context and constraints for business use',
    weights: { clarity: 20, context: 25, specificity: 20, goal: 15, constraints: 20 },
  },
] as const;

export interface DimensionWeight {
  id: string;
  name: string;
  weight: number;
  description?: string;
}

export interface WeightConfigurationProps {
  weights?: Record<string, number>;
  dimensions?: DimensionWeight[];
  onSave?: (weights: Record<string, number>) => Promise<{ success: boolean; error?: string }>;
  onPreview?: (weights: Record<string, number>) => Promise<{ success: boolean; preview?: ScorePreview }>;
  readOnly?: boolean;
  isLocked?: boolean;
  lockedReason?: string;
}

interface ScorePreview {
  samplePrompts: {
    text: string;
    originalScore: number;
    newScore: number;
    dimensionScores: Record<string, { original: number; new: number }>;
  }[];
  averageChange: number;
}

export function WeightConfiguration({
  weights: initialWeights,
  dimensions: customDimensions,
  onSave,
  onPreview,
  readOnly = false,
  isLocked = false,
  lockedReason,
}: WeightConfigurationProps) {
  // Use custom dimensions or defaults
  const dimensions = useMemo(
    () =>
      customDimensions?.map((d) => ({
        ...d,
        color: DEFAULT_DIMENSIONS.find((dd) => dd.id === d.id)?.color || 'bg-primary',
        defaultWeight: DEFAULT_DIMENSIONS.find((dd) => dd.id === d.id)?.defaultWeight || 20,
      })) ||
      DEFAULT_DIMENSIONS.map((d) => ({
        id: d.id,
        name: d.name,
        weight: initialWeights?.[d.id] ?? d.defaultWeight,
        description: d.description,
        color: d.color,
        defaultWeight: d.defaultWeight,
      })),
    [customDimensions, initialWeights]
  );

  // Initialize weights from props or defaults
  const [weights, setWeights] = useState<Record<string, number>>(() => {
    if (initialWeights) return { ...initialWeights };
    const defaultWeights: Record<string, number> = {};
    DEFAULT_DIMENSIONS.forEach((d) => {
      defaultWeights[d.id] = d.defaultWeight;
    });
    return defaultWeights;
  });

  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<ScorePreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Calculate total weight
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  const isNormalized = totalWeight === 100;

  // Handle weight change for a dimension
  const handleWeightChange = useCallback(
    (dimensionId: string, newWeight: number) => {
      setWeights((prev) => ({
        ...prev,
        [dimensionId]: newWeight,
      }));
      setSelectedPreset(null);
      setHasChanges(true);
    },
    []
  );

  // Apply a preset
  const applyPreset = useCallback((preset: typeof WEIGHT_PRESETS[number]) => {
    setWeights({ ...preset.weights });
    setSelectedPreset(preset.id);
    setHasChanges(true);
    showToast.success(`Applied "${preset.name}" preset`);
  }, []);

  // Auto-balance weights to 100%
  const autoBalance = useCallback(() => {
    const dimensionCount = Object.keys(weights).length;
    if (dimensionCount === 0) return;

    const baseWeight = Math.floor(100 / dimensionCount);
    const remainder = 100 % dimensionCount;

    const balanced: Record<string, number> = {};
    Object.keys(weights).forEach((key, index) => {
      balanced[key] = index < remainder ? baseWeight + 1 : baseWeight;
    });

    setWeights(balanced);
    setSelectedPreset(null);
    setHasChanges(true);
    showToast.success('Weights balanced to 100%');
  }, [weights]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    const defaultWeights: Record<string, number> = {};
    DEFAULT_DIMENSIONS.forEach((d) => {
      defaultWeights[d.id] = d.defaultWeight;
    });
    setWeights(defaultWeights);
    setSelectedPreset(null);
    setHasChanges(true);
    setShowResetDialog(false);
    showToast.success('Reset to default weights');
  }, []);

  // Generate preview
  const generatePreview = useCallback(async () => {
    if (!onPreview) {
      // Mock preview data
      setPreviewData({
        samplePrompts: [
          {
            text: 'Help me write a function that sorts an array...',
            originalScore: 7.2,
            newScore: 7.5,
            dimensionScores: {
              clarity: { original: 8, new: 8 },
              context: { original: 6, new: 7 },
              specificity: { original: 7, new: 8 },
              goal: { original: 8, new: 7 },
              constraints: { original: 5, new: 5 },
            },
          },
          {
            text: 'Create a dashboard for analytics...',
            originalScore: 6.5,
            newScore: 6.8,
            dimensionScores: {
              clarity: { original: 7, new: 7 },
              context: { original: 5, new: 6 },
              specificity: { original: 6, new: 7 },
              goal: { original: 7, new: 7 },
              constraints: { original: 4, new: 4 },
            },
          },
        ],
        averageChange: 0.3,
      });
      setShowPreview(true);
      return;
    }

    setIsLoadingPreview(true);
    const result = await onPreview(weights);
    setIsLoadingPreview(false);

    if (result.success && result.preview) {
      setPreviewData(result.preview);
      setShowPreview(true);
    } else {
      showToast.error('Failed to generate preview');
    }
  }, [weights, onPreview]);

  // Save weights
  const handleSave = useCallback(async () => {
    if (!isNormalized) {
      showToast.error('Weights must sum to 100% before saving');
      return;
    }

    if (onSave) {
      const result = await onSave(weights);
      if (result.success) {
        showToast.success('Weights saved successfully');
        setHasChanges(false);
      } else {
        showToast.error(result.error || 'Failed to save weights');
      }
    }
  }, [weights, isNormalized, onSave]);

  const isDisabled = readOnly || isLocked;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Scoring Weights
              {isLocked && (
                <Tooltip>
                  <TooltipTrigger>
                    <Lock className="h-4 w-4 text-amber-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{lockedReason || 'Configuration is locked'}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </h3>
            <p className="text-sm text-muted-foreground">
              Configure how each dimension contributes to the overall score
            </p>
          </div>

          {!isDisabled && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={generatePreview}
                disabled={isLoadingPreview}
              >
                <Eye className="mr-2 h-4 w-4" />
                Preview Impact
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={autoBalance}
                disabled={!hasChanges && isNormalized}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Auto-balance
              </Button>
              <Button
                onClick={handleSave}
                disabled={!hasChanges || !isNormalized}
              >
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
            </div>
          )}
        </div>

        {/* Locked Warning */}
        {isLocked && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
            <div className="flex items-center gap-2 text-amber-500">
              <Lock className="h-4 w-4" />
              <span className="text-sm font-medium">
                {lockedReason || 'This configuration is locked and cannot be modified'}
              </span>
            </div>
          </div>
        )}

        {/* Total Weight Indicator */}
        <Card className="border-border bg-background">
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Total Weight</span>
              <span
                className={cn(
                  'text-sm font-bold',
                  isNormalized ? 'text-green-500' : 'text-amber-500'
                )}
              >
                {totalWeight}%
              </span>
            </div>
            <Progress
              value={Math.min(totalWeight, 100)}
              className={cn(
                'h-2',
                isNormalized ? '[&>div]:bg-green-500' : '[&>div]:bg-amber-500'
              )}
            />
            {!isNormalized && (
              <div className="flex items-center gap-2 mt-2 text-sm text-amber-500">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  Weights must sum to 100% (currently {totalWeight > 100 ? 'over' : 'under'} by{' '}
                  {Math.abs(100 - totalWeight)}%)
                </span>
              </div>
            )}
            {isNormalized && (
              <div className="flex items-center gap-2 mt-2 text-sm text-green-500">
                <Check className="h-4 w-4" />
                <span>Weights are properly balanced</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Presets */}
        <Card className="border-border bg-background">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Preset Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
              {WEIGHT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => !isDisabled && applyPreset(preset)}
                  disabled={isDisabled}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-all',
                    selectedPreset === preset.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:bg-muted/50',
                    isDisabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-foreground">
                      {preset.name}
                    </span>
                    {selectedPreset === preset.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {preset.description}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Dimension Weights */}
        <Card className="border-border bg-background">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Dimension Weights</CardTitle>
              {!isDisabled && hasChanges && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowResetDialog(true)}
                >
                  <RotateCcw className="mr-2 h-3.5 w-3.5" />
                  Reset
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {dimensions.map((dimension) => {
              const weight = weights[dimension.id] ?? 0;
              const defaultDim = DEFAULT_DIMENSIONS.find((d) => d.id === dimension.id);

              return (
                <div key={dimension.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'h-3 w-3 rounded-full',
                          defaultDim?.color || 'bg-primary'
                        )}
                      />
                      <Label className="font-medium">{dimension.name}</Label>
                      {dimension.description && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">{dimension.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={weight}
                        onChange={(e) =>
                          handleWeightChange(
                            dimension.id,
                            Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                          )
                        }
                        disabled={isDisabled}
                        className="w-16 text-center bg-card"
                        min={0}
                        max={100}
                      />
                      <span className="text-sm text-muted-foreground w-4">%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <Slider
                      value={[weight]}
                      onValueChange={([value]) => handleWeightChange(dimension.id, value ?? 0)}
                      max={100}
                      step={1}
                      disabled={isDisabled}
                      className="flex-1"
                    />
                  </div>

                  {/* Visual weight bar */}
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-all duration-300',
                        defaultDim?.color || 'bg-primary'
                      )}
                      style={{ width: `${weight}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Preview Panel */}
        {showPreview && previewData && (
          <Card className="border-border bg-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Score Impact Preview
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border p-4 bg-card">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Average Score Change</span>
                  <Badge
                    className={cn(
                      previewData.averageChange > 0
                        ? 'bg-green-500/20 text-green-500'
                        : previewData.averageChange < 0
                        ? 'bg-red-500/20 text-red-500'
                        : 'bg-muted'
                    )}
                  >
                    {previewData.averageChange > 0 ? '+' : ''}
                    {previewData.averageChange.toFixed(2)}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm">Sample Prompts</Label>
                {previewData.samplePrompts.map((sample, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-border p-4 bg-card space-y-3"
                  >
                    <p className="text-sm text-foreground line-clamp-2">
                      "{sample.text}"
                    </p>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Original:</span>
                        <Badge variant="secondary">{sample.originalScore.toFixed(1)}</Badge>
                      </div>
                      <span className="text-muted-foreground">→</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">New:</span>
                        <Badge
                          className={cn(
                            sample.newScore > sample.originalScore
                              ? 'bg-green-500/20 text-green-500'
                              : sample.newScore < sample.originalScore
                              ? 'bg-red-500/20 text-red-500'
                              : 'bg-muted'
                          )}
                        >
                          {sample.newScore.toFixed(1)}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground ml-auto">
                        ({sample.newScore > sample.originalScore ? '+' : ''}
                        {(sample.newScore - sample.originalScore).toFixed(1)})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reset Confirmation Dialog */}
        <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Weights</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to reset all weights to their default values? This will
                discard any unsaved changes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={resetToDefaults}>
                Reset to Defaults
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}

/**
 * WeightConfigurationCompact - A compact version for inline display
 */
export function WeightConfigurationCompact({
  weights,
  onEdit,
}: {
  weights: Record<string, number>;
  onEdit?: () => void;
}) {
  return (
    <div className="space-y-2">
      {DEFAULT_DIMENSIONS.map((dim) => {
        const weight = weights[dim.id] ?? dim.defaultWeight;
        return (
          <div key={dim.id} className="flex items-center gap-2">
            <div className={cn('h-2 w-2 rounded-full', dim.color)} />
            <span className="text-xs text-muted-foreground flex-1">{dim.name}</span>
            <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full', dim.color)}
                style={{ width: `${weight}%` }}
              />
            </div>
            <span className="text-xs text-foreground w-8 text-right">{weight}%</span>
          </div>
        );
      })}
      {onEdit && (
        <Button variant="ghost" size="sm" onClick={onEdit} className="w-full mt-2">
          Edit Weights
        </Button>
      )}
    </div>
  );
}

/**
 * WeightConfigurationSkeleton - Loading skeleton
 */
export function WeightConfigurationSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-32 bg-muted rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 bg-muted rounded animate-pulse" />
          <div className="h-9 w-24 bg-muted rounded animate-pulse" />
        </div>
      </div>

      <Card className="border-border bg-background">
        <CardContent className="py-4">
          <div className="h-2 w-full bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>

      <Card className="border-border bg-background">
        <CardContent className="py-6 space-y-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <div className="h-5 w-24 bg-muted rounded animate-pulse" />
                <div className="h-5 w-12 bg-muted rounded animate-pulse" />
              </div>
              <div className="h-2 w-full bg-muted rounded animate-pulse" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
