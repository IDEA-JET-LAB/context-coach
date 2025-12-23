'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow, format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { ExperimentStatusBadge } from './experiment-status-badge';
import { showToast } from '@/components/feedback';
import { cn } from '@/lib/utils';
import type { ExperimentWithDetails } from '@/lib/types/experiments';
import { SUCCESS_METRICS, DURATION_OPTIONS } from '@/lib/types/experiments';
import {
  Play,
  Pause,
  Square,
  Loader2,
  SplitSquareVertical,
  Target,
  Clock,
  Users,
  Settings2,
  BarChart3,
  Trophy,
  Calendar,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import {
  activateExperiment,
  pauseExperiment,
  resumeExperiment,
  stopExperimentEarly,
} from '@/lib/services/experiments';

interface ExperimentDetailViewProps {
  experiment: ExperimentWithDetails;
}

export function ExperimentDetailView({ experiment }: ExperimentDetailViewProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'activate' | 'pause' | 'resume' | 'stop' | null>(null);

  const controlVariant = experiment.variants.find(v => v.variant_name === 'control');
  const variantVariant = experiment.variants.find(v => v.variant_name === 'variant');
  const totalSamples = (controlVariant?.sample_count ?? 0) + (variantVariant?.sample_count ?? 0);
  const controlPercentage = 100 - experiment.traffic_percentage;

  const successMetric = SUCCESS_METRICS.find(m => m.value === experiment.success_metric);
  const durationOption = DURATION_OPTIONS.find(d => d.value === experiment.min_duration_hours);

  const handleAction = async () => {
    if (!confirmAction) return;
    setIsLoading(true);

    try {
      let result;
      switch (confirmAction) {
        case 'activate':
          result = await activateExperiment(experiment.id);
          break;
        case 'pause':
          result = await pauseExperiment(experiment.id);
          break;
        case 'resume':
          result = await resumeExperiment(experiment.id);
          break;
        case 'stop':
          result = await stopExperimentEarly(experiment.id);
          break;
      }

      if (result.success) {
        showToast.success(`Experiment ${confirmAction}d successfully`);
        router.refresh();
      } else {
        showToast.error(result.error.message);
      }
    } catch {
      showToast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
      setConfirmAction(null);
    }
  };

  const getConfirmDialogContent = () => {
    switch (confirmAction) {
      case 'activate':
        return {
          title: 'Activate Experiment',
          description: 'This will start traffic splitting. Config snapshots will be created and locked for the duration of the experiment.',
        };
      case 'pause':
        return {
          title: 'Pause Experiment',
          description: 'Traffic will stop being split. You can resume the experiment later.',
        };
      case 'resume':
        return {
          title: 'Resume Experiment',
          description: 'Traffic splitting will resume where it left off.',
        };
      case 'stop':
        return {
          title: 'Stop Experiment Early',
          description: 'This will stop the experiment and mark results as inconclusive. This action cannot be undone.',
        };
      default:
        return { title: '', description: '' };
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Action Bar */}
        <Card className="border-border bg-card">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <ExperimentStatusBadge status={experiment.status} />
                {experiment.activated_at && (
                  <span className="text-sm text-muted-foreground">
                    Started {formatDistanceToNow(new Date(experiment.activated_at), { addSuffix: true })}
                  </span>
                )}
                {experiment.completed_at && (
                  <span className="text-sm text-muted-foreground">
                    Completed {formatDistanceToNow(new Date(experiment.completed_at), { addSuffix: true })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {experiment.status === 'running' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmAction('pause')}
                    >
                      <Pause className="mr-2 h-4 w-4" />
                      Pause
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setConfirmAction('stop')}
                    >
                      <Square className="mr-2 h-4 w-4" />
                      Stop Early
                    </Button>
                  </>
                )}
                {experiment.status === 'paused' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmAction('resume')}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Resume
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setConfirmAction('stop')}
                    >
                      <Square className="mr-2 h-4 w-4" />
                      Stop Early
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results (for completed experiments) */}
        {experiment.status === 'completed' && (
          <Card className={cn(
            'border-2',
            experiment.winner_variant === 'control' && 'border-blue-500',
            experiment.winner_variant === 'variant' && 'border-green-500',
            experiment.winner_variant === 'inconclusive' && 'border-muted'
          )}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Experiment Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">Winner</p>
                  <Badge
                    className={cn(
                      'text-lg px-4 py-1',
                      experiment.winner_variant === 'control' && 'bg-blue-500/20 text-blue-500',
                      experiment.winner_variant === 'variant' && 'bg-green-500/20 text-green-500',
                      experiment.winner_variant === 'inconclusive' && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {experiment.winner_variant === 'inconclusive'
                      ? 'Inconclusive'
                      : (experiment.winner_variant?.charAt(0).toUpperCase() ?? '') + (experiment.winner_variant?.slice(1) ?? '')}
                  </Badge>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">P-Value</p>
                  <p className="text-2xl font-bold">
                    {experiment.p_value?.toFixed(4) ?? 'N/A'}
                  </p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">Effect Size</p>
                  <p className="text-2xl font-bold">
                    {experiment.effect_size ? `${(experiment.effect_size * 100).toFixed(1)}%` : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs for different sections */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Hypothesis */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">Hypothesis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{experiment.hypothesis}</p>
              </CardContent>
            </Card>

            {/* Traffic Split */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <SplitSquareVertical className="h-5 w-5" />
                  Traffic Split
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-4 rounded-full overflow-hidden flex bg-muted">
                  <div
                    className="bg-blue-500 transition-all"
                    style={{ width: `${controlPercentage}%` }}
                  />
                  <div
                    className="bg-green-500 transition-all"
                    style={{ width: `${experiment.traffic_percentage}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Control</span>
                      <Badge className="bg-blue-500/20 text-blue-500">
                        {controlPercentage}%
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {experiment.control_config?.name} (v{experiment.control_config?.version})
                    </p>
                    {controlVariant && (
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">Samples:</span>{' '}
                        <span className="font-medium">{controlVariant.sample_count}</span>
                        {controlVariant.mean_score && (
                          <>
                            <span className="text-muted-foreground ml-3">Avg:</span>{' '}
                            <span className="font-medium">{controlVariant.mean_score.toFixed(1)}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Variant</span>
                      <Badge className="bg-green-500/20 text-green-500">
                        {experiment.traffic_percentage}%
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {experiment.variant_config?.name} (v{experiment.variant_config?.version})
                    </p>
                    {variantVariant && (
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">Samples:</span>{' '}
                        <span className="font-medium">{variantVariant.sample_count}</span>
                        {variantVariant.mean_score && (
                          <>
                            <span className="text-muted-foreground ml-3">Avg:</span>{' '}
                            <span className="font-medium">{variantVariant.mean_score.toFixed(1)}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Progress */}
            {(experiment.status === 'running' || experiment.status === 'paused') && (
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        Samples Collected
                      </span>
                      <span className="font-medium">
                        {totalSamples} / {experiment.min_sample_size * 2}
                      </span>
                    </div>
                    <Progress
                      value={Math.min(100, (totalSamples / (experiment.min_sample_size * 2)) * 100)}
                    />
                  </div>

                  {experiment.activated_at && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          Time Elapsed
                        </span>
                        <span className="font-medium">
                          {formatDistanceToNow(new Date(experiment.activated_at))}
                        </span>
                      </div>
                      <Progress
                        value={Math.min(
                          100,
                          ((Date.now() - new Date(experiment.activated_at).getTime()) /
                            (experiment.min_duration_hours * 3600000)) *
                            100
                        )}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="metrics" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Experiment Parameters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4 md:grid-cols-2">
                  <div>
                    <dt className="text-sm text-muted-foreground">Success Metric</dt>
                    <dd className="font-medium">{successMetric?.label ?? experiment.success_metric}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Minimum Duration</dt>
                    <dd className="font-medium">{durationOption?.label ?? `${experiment.min_duration_hours} hours`}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Min Samples (per variant)</dt>
                    <dd className="font-medium">{experiment.min_sample_size}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Significance Threshold</dt>
                    <dd className="font-medium">p &lt; {experiment.significance_threshold}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Auto-promote Winner</dt>
                    <dd className="font-medium flex items-center gap-2">
                      {experiment.auto_promote_winner ? (
                        <>
                          <Sparkles className="h-4 w-4 text-green-500" />
                          Enabled
                        </>
                      ) : (
                        'Disabled'
                      )}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="space-y-4">
            {/* Config Snapshots */}
            {controlVariant?.config_snapshot && variantVariant?.config_snapshot && (
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Settings2 className="h-5 w-5 text-blue-500" />
                      Control Config Snapshot
                    </CardTitle>
                    <CardDescription>
                      Frozen at activation: {controlVariant.config_snapshot.name} v{controlVariant.config_snapshot.version}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Model: {controlVariant.config_snapshot.model}
                      </p>
                      <div className="space-y-1">
                        {controlVariant.config_snapshot.dimensions.map((dim) => (
                          <div key={dim.name} className="flex items-center justify-between text-sm">
                            <span>{dim.name}</span>
                            <Badge variant="secondary">{dim.weight}%</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Settings2 className="h-5 w-5 text-green-500" />
                      Variant Config Snapshot
                    </CardTitle>
                    <CardDescription>
                      Frozen at activation: {variantVariant.config_snapshot.name} v{variantVariant.config_snapshot.version}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Model: {variantVariant.config_snapshot.model}
                      </p>
                      <div className="space-y-1">
                        {variantVariant.config_snapshot.dimensions.map((dim) => (
                          <div key={dim.name} className="flex items-center justify-between text-sm">
                            <span>{dim.name}</span>
                            <Badge variant="secondary">{dim.weight}%</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Timeline */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2">
                  <div className="flex items-center justify-between">
                    <dt className="text-sm text-muted-foreground">Created</dt>
                    <dd className="text-sm font-medium">
                      {format(new Date(experiment.created_at), 'PPp')}
                    </dd>
                  </div>
                  {experiment.activated_at && (
                    <div className="flex items-center justify-between">
                      <dt className="text-sm text-muted-foreground">Activated</dt>
                      <dd className="text-sm font-medium">
                        {format(new Date(experiment.activated_at), 'PPp')}
                      </dd>
                    </div>
                  )}
                  {experiment.completed_at && (
                    <div className="flex items-center justify-between">
                      <dt className="text-sm text-muted-foreground">Completed</dt>
                      <dd className="text-sm font-medium">
                        {format(new Date(experiment.completed_at), 'PPp')}
                      </dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {confirmAction === 'stop' && <AlertTriangle className="h-5 w-5 text-destructive" />}
              {getConfirmDialogContent().title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {getConfirmDialogContent().description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              disabled={isLoading}
              className={cn(
                confirmAction === 'stop' ? 'bg-destructive hover:bg-destructive/90' : ''
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
