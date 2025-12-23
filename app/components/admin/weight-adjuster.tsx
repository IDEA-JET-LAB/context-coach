'use client';

import { useState, useEffect, useCallback, useRef, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { showToast } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
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
  Info,
  Check,
  AlertTriangle,
  RotateCcw,
  Keyboard,
} from 'lucide-react';
import type { DimensionWeight } from '@/lib/types/scoring-weights';
import { autoBalanceWeights } from '@/lib/config/default-weights';

export interface WeightAdjusterProps {
  dimensions: DimensionWeight[];
  onSave: (
    weights: Array<{ dimension_id: string; weight: number; enabled: boolean }>
  ) => Promise<{ success: boolean; error?: string }>;
  defaultWeights?: DimensionWeight[];
  isSaving?: boolean;
}

export function WeightAdjuster({
  dimensions: initialDimensions,
  onSave,
  defaultWeights,
  isSaving = false,
}: WeightAdjusterProps) {
  const [dimensions, setDimensions] = useState<DimensionWeight[]>(initialDimensions);
  const [originalDimensions] = useState<DimensionWeight[]>(initialDimensions);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Calculate totals
  const enabledTotal = dimensions.reduce((sum, d) => sum + (d.enabled ? d.weight : 0), 0);
  const isValid = enabledTotal === 100;
  const hasChanges =
    JSON.stringify(dimensions.map((d) => ({ id: d.id, weight: d.weight, enabled: d.enabled }))) !==
    JSON.stringify(originalDimensions.map((d) => ({ id: d.id, weight: d.weight, enabled: d.enabled })));

  // Handle weight change for a dimension
  const handleWeightChange = useCallback((dimensionId: string, newWeight: number) => {
    const clampedWeight = Math.min(100, Math.max(0, newWeight));
    setDimensions((prev) =>
      prev.map((d) => (d.id === dimensionId ? { ...d, weight: clampedWeight } : d))
    );
  }, []);

  // Handle enabled toggle
  const handleEnabledChange = useCallback((dimensionId: string, enabled: boolean) => {
    setDimensions((prev) =>
      prev.map((d) => (d.id === dimensionId ? { ...d, enabled, weight: enabled ? d.weight : 0 } : d))
    );
  }, []);

  // Auto-balance weights
  const handleAutoBalance = useCallback(() => {
    const balanced = autoBalanceWeights(dimensions);
    setDimensions((prev) =>
      prev.map((d) => {
        const balancedWeight = balanced.find((b) => b.id === d.id);
        return balancedWeight ? { ...d, weight: balancedWeight.weight } : d;
      })
    );
    showToast.success('Weights balanced to 100%');
  }, [dimensions]);

  // Reset to defaults
  const handleReset = useCallback(() => {
    if (defaultWeights) {
      setDimensions(defaultWeights);
    } else {
      setDimensions(originalDimensions);
    }
    setShowResetDialog(false);
    showToast.success('Weights reset to defaults');
  }, [defaultWeights, originalDimensions]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!isValid) {
      showToast.error('Weights must sum to 100% before saving');
      return;
    }

    const weights = dimensions.map((d) => ({
      dimension_id: d.id,
      weight: d.weight,
      enabled: d.enabled,
    }));

    const result = await onSave(weights);
    if (result.success) {
      showToast.success('Weights saved successfully');
    } else {
      showToast.error(result.error || 'Failed to save weights');
    }
  }, [dimensions, isValid, onSave]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const enabledDimensions = dimensions.filter((d) => d.enabled);
      const enabledIds = enabledDimensions.map((d) => d.id);

      // Find current focused dimension
      let currentDimensionIndex = focusedIndex;
      if (currentDimensionIndex === null) {
        currentDimensionIndex = 0;
      }

      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          if (currentDimensionIndex !== null) {
            const increment = event.shiftKey ? 5 : 1;
            const dim = dimensions[currentDimensionIndex];
            if (dim && dim.enabled) {
              handleWeightChange(dim.id, dim.weight + increment);
            }
          }
          break;
        case 'ArrowDown':
          event.preventDefault();
          if (currentDimensionIndex !== null) {
            const decrement = event.shiftKey ? 5 : 1;
            const dim = dimensions[currentDimensionIndex];
            if (dim && dim.enabled) {
              handleWeightChange(dim.id, dim.weight - decrement);
            }
          }
          break;
        case 'Tab':
          // Let default Tab behavior work for navigation
          break;
        case 'Enter':
          event.preventDefault();
          if (isValid && hasChanges && !isSaving) {
            handleSave();
          }
          break;
        case 'Escape':
          event.preventDefault();
          if (hasChanges) {
            setDimensions(originalDimensions);
            showToast.info('Changes discarded');
          }
          break;
      }
    },
    [dimensions, focusedIndex, handleWeightChange, isValid, hasChanges, isSaving, handleSave, originalDimensions]
  );

  // Focus handling for inputs
  const handleInputFocus = useCallback((index: number) => {
    setFocusedIndex(index);
  }, []);

  return (
    <TooltipProvider>
      <div
        ref={containerRef}
        className="space-y-6"
        onKeyDown={handleKeyDown}
        data-testid="weight-adjuster"
      >
        {/* Header with actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Scoring Weights
            </h3>
            <p className="text-sm text-muted-foreground">
              Adjust how each dimension contributes to the overall score
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowKeyboardHelp(true)}
                  data-testid="keyboard-help-button"
                >
                  <Keyboard className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Keyboard shortcuts</TooltipContent>
            </Tooltip>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoBalance}
              disabled={isSaving}
              data-testid="auto-balance-button"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Auto-Balance
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResetDialog(true)}
              disabled={!hasChanges || isSaving}
              data-testid="reset-button"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || !isValid || isSaving}
              data-testid="save-weights-button"
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Weights'}
            </Button>
          </div>
        </div>

        {/* Total Weight Indicator */}
        <Card className="border-border bg-background" data-testid="total-weight-card">
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Total Weight</span>
              <span
                data-testid="total-weight-value"
                className={cn('text-2xl font-bold', isValid ? 'text-score-high' : 'text-score-growth')}
              >
                {enabledTotal}%
              </span>
            </div>
            <Progress
              value={Math.min(enabledTotal, 100)}
              className={cn('h-2', isValid ? '[&>div]:bg-score-high' : '[&>div]:bg-score-growth')}
              data-testid="total-weight-progress"
            />
            {!isValid && (
              <div
                className="flex items-center gap-2 mt-2 text-sm text-score-growth"
                data-testid="weight-error"
              >
                <AlertTriangle className="h-4 w-4" />
                <span>
                  Total must equal 100% (currently {enabledTotal > 100 ? 'over' : 'under'} by{' '}
                  {Math.abs(100 - enabledTotal)}%)
                </span>
              </div>
            )}
            {isValid && (
              <div className="flex items-center gap-2 mt-2 text-sm text-score-high" data-testid="weight-valid">
                <Check className="h-4 w-4" />
                <span>Weights are properly balanced</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dimension Weights */}
        <Card className="border-border bg-background">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dimension Weights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {dimensions.map((dimension, index) => (
              <div
                key={dimension.id}
                data-testid={`dimension-weight-${index}`}
                className={cn('space-y-3 p-4 rounded-lg border transition-colors', {
                  'border-border': dimension.enabled,
                  'border-border/50 opacity-60': !dimension.enabled,
                  'ring-2 ring-primary/50': focusedIndex === index,
                })}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={dimension.enabled}
                      onCheckedChange={(checked) => handleEnabledChange(dimension.id, checked)}
                      disabled={isSaving}
                      data-testid={`dimension-toggle-${index}`}
                    />
                    <div className="flex items-center gap-2">
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
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      type="number"
                      min={0}
                      max={100}
                      value={dimension.weight}
                      onChange={(e) => handleWeightChange(dimension.id, parseInt(e.target.value) || 0)}
                      onFocus={() => handleInputFocus(index)}
                      disabled={!dimension.enabled || isSaving}
                      className="w-20 text-center bg-card"
                      data-testid={`dimension-weight-input-${index}`}
                    />
                    <span className="text-sm text-muted-foreground w-4">%</span>
                  </div>
                </div>

                <Slider
                  value={[dimension.weight]}
                  onValueChange={([value]) => handleWeightChange(dimension.id, value ?? 0)}
                  max={100}
                  step={1}
                  disabled={!dimension.enabled || isSaving}
                  className="flex-1"
                  data-testid={`dimension-slider-${index}`}
                />

                {/* Visual weight bar */}
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full transition-all duration-300', {
                      'bg-primary': dimension.enabled,
                      'bg-muted-foreground/30': !dimension.enabled,
                    })}
                    style={{ width: `${dimension.weight}%` }}
                    data-testid={`dimension-bar-${index}`}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Reset Confirmation Dialog */}
        <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Weights</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to reset all weights to their default values? This will discard
                any unsaved changes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="reset-cancel">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset} data-testid="reset-confirm">
                Reset to Defaults
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Keyboard Shortcuts Dialog */}
        <AlertDialog open={showKeyboardHelp} onOpenChange={setShowKeyboardHelp}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Keyboard Shortcuts</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <kbd className="px-2 py-1 rounded bg-muted text-xs">Tab</kbd>
                      <span>Move to next dimension</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <kbd className="px-2 py-1 rounded bg-muted text-xs">Shift+Tab</kbd>
                      <span>Move to previous</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <kbd className="px-2 py-1 rounded bg-muted text-xs">Up</kbd>
                      <span>Increase by 1</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <kbd className="px-2 py-1 rounded bg-muted text-xs">Down</kbd>
                      <span>Decrease by 1</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <kbd className="px-2 py-1 rounded bg-muted text-xs">Shift+Up</kbd>
                      <span>Increase by 5</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <kbd className="px-2 py-1 rounded bg-muted text-xs">Shift+Down</kbd>
                      <span>Decrease by 5</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <kbd className="px-2 py-1 rounded bg-muted text-xs">Enter</kbd>
                      <span>Save (if valid)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <kbd className="px-2 py-1 rounded bg-muted text-xs">Escape</kbd>
                      <span>Discard changes</span>
                    </div>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction>Got it</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
