'use client';

import { useState, useCallback, useMemo } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { showToast } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Beaker,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Users,
  Calendar,
  Clock,
  AlertTriangle,
  Check,
  X,
  ArrowRight,
  Info,
  Loader2,
  BarChart3,
  LineChart,
  Download,
  Share2,
} from 'lucide-react';

/**
 * Experiment Results Dashboard
 *
 * Displays A/B test results with:
 * - Results summary cards per variant
 * - Statistical significance indicator
 * - Metric comparison charts
 * - Confidence interval visualization
 * - "Declare winner" action
 * - Experiment conclusion workflow
 */

export interface VariantResult {
  id: string;
  name: string;
  isControl: boolean;
  sampleSize: number;
  metrics: {
    name: string;
    value: number;
    changeFromControl?: number;
    confidenceInterval: [number, number];
  }[];
  primaryMetric: {
    name: string;
    value: number;
    changeFromControl?: number;
    standardError: number;
  };
}

export interface ExperimentResult {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'stopped';
  startDate: string;
  endDate?: string;
  hypothesis: string;
  primaryMetricName: string;
  statisticalSignificance: number;
  confidenceThreshold: number;
  minimumSampleSize: number;
  currentSampleSize: number;
  winner?: string;
  variants: VariantResult[];
  dailyMetrics?: {
    date: string;
    variants: {
      id: string;
      value: number;
    }[];
  }[];
}

export interface ExperimentResultsProps {
  experiment: ExperimentResult;
  onDeclareWinner?: (variantId: string) => Promise<{ success: boolean; error?: string }>;
  onStopExperiment?: () => Promise<{ success: boolean; error?: string }>;
  onExportResults?: () => Promise<{ success: boolean; data?: string; error?: string }>;
  readOnly?: boolean;
}

// Statistical significance levels
const SIGNIFICANCE_LEVELS = {
  high: { threshold: 95, label: 'Significant', color: 'text-green-500' },
  trending: { threshold: 80, label: 'Trending', color: 'text-amber-500' },
  low: { threshold: 0, label: 'Not Significant', color: 'text-muted-foreground' },
} as const;

// Color palette for variants
const VARIANT_COLORS = [
  { bg: 'bg-blue-500', text: 'text-blue-500', fill: 'fill-blue-500', light: 'bg-blue-500/20' },
  { bg: 'bg-green-500', text: 'text-green-500', fill: 'fill-green-500', light: 'bg-green-500/20' },
  { bg: 'bg-purple-500', text: 'text-purple-500', fill: 'fill-purple-500', light: 'bg-purple-500/20' },
  { bg: 'bg-amber-500', text: 'text-amber-500', fill: 'fill-amber-500', light: 'bg-amber-500/20' },
] as const;

const DEFAULT_COLOR = VARIANT_COLORS[0];

function getVariantColor(index: number) {
  return VARIANT_COLORS[index % VARIANT_COLORS.length] ?? DEFAULT_COLOR;
}

export function ExperimentResults({
  experiment,
  onDeclareWinner,
  onStopExperiment,
  onExportResults,
  readOnly = false,
}: ExperimentResultsProps) {
  const [showDeclareWinnerDialog, setShowDeclareWinnerDialog] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [showStopDialog, setShowStopDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get significance level
  const significanceLevel = useMemo(() => {
    if (experiment.statisticalSignificance >= SIGNIFICANCE_LEVELS.high.threshold) {
      return SIGNIFICANCE_LEVELS.high;
    }
    if (experiment.statisticalSignificance >= SIGNIFICANCE_LEVELS.trending.threshold) {
      return SIGNIFICANCE_LEVELS.trending;
    }
    return SIGNIFICANCE_LEVELS.low;
  }, [experiment.statisticalSignificance]);

  // Get best performing variant (non-control with highest primary metric)
  const bestVariant = useMemo(() => {
    const nonControlVariants = experiment.variants.filter((v) => !v.isControl);
    if (nonControlVariants.length === 0) return null;

    return nonControlVariants.reduce((best, current) =>
      current.primaryMetric.value > best.primaryMetric.value ? current : best
    );
  }, [experiment.variants]);

  // Calculate progress toward significance
  const significanceProgress = useMemo(() => {
    return Math.min(
      (experiment.statisticalSignificance / experiment.confidenceThreshold) * 100,
      100
    );
  }, [experiment.statisticalSignificance, experiment.confidenceThreshold]);

  // Calculate sample progress
  const sampleProgress = useMemo(() => {
    return Math.min(
      (experiment.currentSampleSize / experiment.minimumSampleSize) * 100,
      100
    );
  }, [experiment.currentSampleSize, experiment.minimumSampleSize]);

  // Handle declare winner
  const handleDeclareWinner = useCallback(async () => {
    if (!selectedWinner || !onDeclareWinner) return;

    setIsSubmitting(true);
    const result = await onDeclareWinner(selectedWinner);
    setIsSubmitting(false);

    if (result.success) {
      showToast.success('Winner declared successfully');
      setShowDeclareWinnerDialog(false);
    } else {
      showToast.error(result.error || 'Failed to declare winner');
    }
  }, [selectedWinner, onDeclareWinner]);

  // Handle stop experiment
  const handleStopExperiment = useCallback(async () => {
    if (!onStopExperiment) return;

    setIsSubmitting(true);
    const result = await onStopExperiment();
    setIsSubmitting(false);

    if (result.success) {
      showToast.success('Experiment stopped');
      setShowStopDialog(false);
    } else {
      showToast.error(result.error || 'Failed to stop experiment');
    }
  }, [onStopExperiment]);

  // Handle export
  const handleExport = useCallback(async () => {
    if (!onExportResults) return;

    const result = await onExportResults();
    if (result.success && result.data) {
      // Create download
      const blob = new Blob([result.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `experiment-${experiment.id}-results.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      showToast.success('Results exported');
    } else {
      showToast.error(result.error || 'Failed to export results');
    }
  }, [experiment.id, onExportResults]);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Beaker className="h-5 w-5" />
                {experiment.name}
              </h3>
              <Badge
                className={cn(
                  experiment.status === 'running'
                    ? 'bg-green-500/20 text-green-500'
                    : experiment.status === 'completed'
                    ? 'bg-blue-500/20 text-blue-500'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {experiment.status === 'running'
                  ? 'Running'
                  : experiment.status === 'completed'
                  ? 'Completed'
                  : 'Stopped'}
              </Badge>
              {experiment.winner && (
                <Badge className="bg-amber-500/20 text-amber-500 gap-1">
                  <Trophy className="h-3 w-3" />
                  Winner: {experiment.variants.find((v) => v.id === experiment.winner)?.name}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              {experiment.hypothesis}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onExportResults && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            )}
            {!readOnly && experiment.status === 'running' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowStopDialog(true)}
                >
                  <X className="mr-2 h-4 w-4" />
                  Stop
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedWinner(bestVariant?.id || null);
                    setShowDeclareWinnerDialog(true);
                  }}
                  disabled={experiment.statisticalSignificance < experiment.confidenceThreshold}
                >
                  <Trophy className="mr-2 h-4 w-4" />
                  Declare Winner
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          {/* Statistical Significance */}
          <Card className="border-border bg-background">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4" />
                Statistical Significance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <span className={cn('text-2xl font-bold', significanceLevel.color)}>
                  {experiment.statisticalSignificance.toFixed(1)}%
                </span>
                <Badge
                  className={cn(
                    significanceLevel.color === 'text-green-500'
                      ? 'bg-green-500/20 text-green-500'
                      : significanceLevel.color === 'text-amber-500'
                      ? 'bg-amber-500/20 text-amber-500'
                      : 'bg-muted'
                  )}
                >
                  {significanceLevel.label}
                </Badge>
              </div>
              <Progress value={significanceProgress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                Target: {experiment.confidenceThreshold}%
              </p>
            </CardContent>
          </Card>

          {/* Sample Size */}
          <Card className="border-border bg-background">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Sample Size
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground mb-2">
                {experiment.currentSampleSize.toLocaleString()}
              </div>
              <Progress value={sampleProgress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                Target: {experiment.minimumSampleSize.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          {/* Duration */}
          <Card className="border-border bg-background">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Duration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {formatDistanceToNow(new Date(experiment.startDate))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Started {format(new Date(experiment.startDate), 'PPP')}
              </p>
            </CardContent>
          </Card>

          {/* Primary Metric */}
          <Card className="border-border bg-background">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                {experiment.primaryMetricName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bestVariant && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-foreground">
                      {bestVariant.primaryMetric.value.toFixed(2)}
                    </span>
                    {bestVariant.primaryMetric.changeFromControl !== undefined && (
                      <Badge
                        className={cn(
                          bestVariant.primaryMetric.changeFromControl > 0
                            ? 'bg-green-500/20 text-green-500'
                            : bestVariant.primaryMetric.changeFromControl < 0
                            ? 'bg-red-500/20 text-red-500'
                            : 'bg-muted'
                        )}
                      >
                        {bestVariant.primaryMetric.changeFromControl > 0 ? '+' : ''}
                        {bestVariant.primaryMetric.changeFromControl.toFixed(1)}%
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Best: {bestVariant.name}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Variant Results */}
        <Card className="border-border bg-background">
          <CardHeader>
            <CardTitle className="text-base">Variant Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {experiment.variants.map((variant, index) => {
                const colors = getVariantColor(index);
                const isWinner = experiment.winner === variant.id;
                const isBest = bestVariant?.id === variant.id && !variant.isControl;

                return (
                  <Card
                    key={variant.id}
                    className={cn(
                      'border-border bg-card',
                      isWinner && 'border-amber-500 bg-amber-500/5',
                      isBest && !isWinner && experiment.status === 'running' && 'border-green-500/50'
                    )}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn('h-3 w-3 rounded-full', colors.bg)} />
                          <CardTitle className="text-base">{variant.name}</CardTitle>
                          {variant.isControl && (
                            <Badge variant="secondary" className="text-xs">
                              Control
                            </Badge>
                          )}
                          {isWinner && (
                            <Badge className="bg-amber-500/20 text-amber-500 gap-1">
                              <Trophy className="h-3 w-3" />
                              Winner
                            </Badge>
                          )}
                          {isBest && !isWinner && experiment.status === 'running' && (
                            <Badge className="bg-green-500/20 text-green-500 gap-1">
                              <TrendingUp className="h-3 w-3" />
                              Leading
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          n = {variant.sampleSize.toLocaleString()}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Primary Metric */}
                      <div className="rounded-lg bg-muted/30 p-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-muted-foreground">
                            {experiment.primaryMetricName}
                          </span>
                          {variant.primaryMetric.changeFromControl !== undefined && (
                            <span
                              className={cn(
                                'text-sm font-medium',
                                variant.primaryMetric.changeFromControl > 0
                                  ? 'text-green-500'
                                  : variant.primaryMetric.changeFromControl < 0
                                  ? 'text-red-500'
                                  : 'text-muted-foreground'
                              )}
                            >
                              {variant.primaryMetric.changeFromControl > 0 ? (
                                <TrendingUp className="inline h-4 w-4 mr-1" />
                              ) : variant.primaryMetric.changeFromControl < 0 ? (
                                <TrendingDown className="inline h-4 w-4 mr-1" />
                              ) : (
                                <Minus className="inline h-4 w-4 mr-1" />
                              )}
                              {variant.primaryMetric.changeFromControl > 0 ? '+' : ''}
                              {variant.primaryMetric.changeFromControl.toFixed(2)}%
                            </span>
                          )}
                        </div>
                        <div className="text-3xl font-bold text-foreground">
                          {variant.primaryMetric.value.toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          SE: {variant.primaryMetric.standardError.toFixed(3)}
                        </div>
                      </div>

                      {/* Other Metrics */}
                      {variant.metrics.length > 0 && (
                        <div className="space-y-2">
                          {variant.metrics.map((metric) => (
                            <div
                              key={metric.name}
                              className="flex items-center justify-between py-1"
                            >
                              <span className="text-sm text-muted-foreground">
                                {metric.name}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {metric.value.toFixed(2)}
                                </span>
                                {metric.changeFromControl !== undefined && (
                                  <span
                                    className={cn(
                                      'text-xs',
                                      metric.changeFromControl > 0
                                        ? 'text-green-500'
                                        : metric.changeFromControl < 0
                                        ? 'text-red-500'
                                        : 'text-muted-foreground'
                                    )}
                                  >
                                    ({metric.changeFromControl > 0 ? '+' : ''}
                                    {metric.changeFromControl.toFixed(1)}%)
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Confidence Interval */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>95% Confidence Interval</span>
                          <span>
                            [{variant.metrics[0]?.confidenceInterval[0].toFixed(2)},{' '}
                            {variant.metrics[0]?.confidenceInterval[1].toFixed(2)}]
                          </span>
                        </div>
                        <div className="relative h-4 rounded bg-muted">
                          <div
                            className={cn('absolute h-full rounded', colors.light)}
                            style={{
                              left: `${Math.max(0, ((variant.metrics[0]?.confidenceInterval[0] || 0) / 10) * 100)}%`,
                              right: `${Math.max(0, 100 - ((variant.metrics[0]?.confidenceInterval[1] || 10) / 10) * 100)}%`,
                            }}
                          >
                            <div
                              className={cn(
                                'absolute top-1/2 -translate-y-1/2 w-1 h-3 rounded-full',
                                colors.bg
                              )}
                              style={{ left: '50%', transform: 'translateX(-50%) translateY(-50%)' }}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Daily Metrics Chart */}
        {experiment.dailyMetrics && experiment.dailyMetrics.length > 0 && (
          <Card className="border-border bg-background">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <LineChart className="h-4 w-4" />
                Daily Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end gap-1">
                {experiment.dailyMetrics.slice(-14).map((day, dayIndex) => (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div className="flex-1 w-full flex items-end gap-0.5">
                      {day.variants.map((v, vIndex) => {
                        const variant = experiment.variants.find((ev) => ev.id === v.id);
                        const colors = getVariantColor(experiment.variants.findIndex((ev) => ev.id === v.id));
                        const maxValue = Math.max(
                          ...experiment.dailyMetrics!.flatMap((d) =>
                            d.variants.map((dv) => dv.value)
                          )
                        );
                        const height = (v.value / maxValue) * 100;

                        return (
                          <Tooltip key={v.id}>
                            <TooltipTrigger asChild>
                              <div
                                className={cn('flex-1 rounded-t transition-all hover:opacity-80', colors.bg)}
                                style={{ height: `${height}%` }}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">{variant?.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(day.date), 'MMM d')}: {v.value.toFixed(2)}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                    {dayIndex % 2 === 0 && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(day.date), 'd')}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex justify-center gap-6 mt-4">
                {experiment.variants.map((variant, index) => {
                  const colors = getVariantColor(index);
                  return (
                    <div key={variant.id} className="flex items-center gap-2">
                      <div className={cn('h-3 w-3 rounded', colors.bg)} />
                      <span className="text-sm">{variant.name}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recommendations */}
        {experiment.status === 'running' && (
          <Card className="border-border bg-background">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4" />
                Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {experiment.statisticalSignificance >= experiment.confidenceThreshold ? (
                <div className="flex items-start gap-3 text-green-500">
                  <Check className="h-5 w-5 mt-0.5" />
                  <div>
                    <p className="font-medium">Ready to declare winner</p>
                    <p className="text-sm text-green-500/80 mt-1">
                      Statistical significance has reached {experiment.statisticalSignificance.toFixed(1)}%,
                      exceeding your {experiment.confidenceThreshold}% threshold.{' '}
                      {bestVariant && `${bestVariant.name} is outperforming the control.`}
                    </p>
                  </div>
                </div>
              ) : experiment.statisticalSignificance >= 80 ? (
                <div className="flex items-start gap-3 text-amber-500">
                  <AlertTriangle className="h-5 w-5 mt-0.5" />
                  <div>
                    <p className="font-medium">Trending toward significance</p>
                    <p className="text-sm text-amber-500/80 mt-1">
                      Results are trending but not yet statistically significant.
                      Continue running the experiment to reach your {experiment.confidenceThreshold}% threshold.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 text-muted-foreground">
                  <Clock className="h-5 w-5 mt-0.5" />
                  <div>
                    <p className="font-medium">Collecting data</p>
                    <p className="text-sm text-muted-foreground/80 mt-1">
                      Not enough data to draw conclusions yet.
                      {experiment.currentSampleSize < experiment.minimumSampleSize &&
                        ` Need ${(experiment.minimumSampleSize - experiment.currentSampleSize).toLocaleString()} more samples.`}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Declare Winner Dialog */}
        <AlertDialog open={showDeclareWinnerDialog} onOpenChange={setShowDeclareWinnerDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                Declare Winner
              </AlertDialogTitle>
              <AlertDialogDescription>
                Select the winning variant. This will end the experiment and can optionally
                roll out the winning configuration to all users.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="py-4 space-y-2">
              {experiment.variants.map((variant, index) => {
                const colors = getVariantColor(index);
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setSelectedWinner(variant.id)}
                    className={cn(
                      'w-full rounded-lg border p-4 text-left transition-colors',
                      selectedWinner === variant.id
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-border bg-card hover:bg-muted/50'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn('h-3 w-3 rounded-full', colors.bg)} />
                        <span className="font-medium">{variant.name}</span>
                        {variant.isControl && (
                          <Badge variant="secondary" className="text-xs">
                            Control
                          </Badge>
                        )}
                      </div>
                      <span className="text-lg font-bold">
                        {variant.primaryMetric.value.toFixed(2)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeclareWinner}
                disabled={!selectedWinner || isSubmitting}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Declaring...
                  </>
                ) : (
                  <>
                    <Trophy className="mr-2 h-4 w-4" />
                    Declare Winner
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Stop Experiment Dialog */}
        <AlertDialog open={showStopDialog} onOpenChange={setShowStopDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Stop Experiment
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to stop this experiment? This will end data collection
                and the experiment cannot be resumed. No winner will be declared.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleStopExperiment}
                disabled={isSubmitting}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isSubmitting ? 'Stopping...' : 'Stop Experiment'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}

/**
 * ExperimentResultsSkeleton - Loading skeleton
 */
export function ExperimentResultsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-96 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-muted rounded animate-pulse" />
          <div className="h-9 w-32 bg-muted rounded animate-pulse" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-border bg-background">
            <CardContent className="py-6">
              <div className="h-4 w-24 bg-muted rounded animate-pulse mb-2" />
              <div className="h-8 w-20 bg-muted rounded animate-pulse mb-2" />
              <div className="h-2 w-full bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border bg-background">
        <CardContent className="py-6">
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-64 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
