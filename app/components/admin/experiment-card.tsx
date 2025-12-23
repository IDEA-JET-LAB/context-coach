'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { ExperimentStatusBadge } from './experiment-status-badge';
import { showToast } from '@/components/feedback';
import { cn } from '@/lib/utils';
import type { ExperimentWithVariants } from '@/lib/types/experiments';
import {
  Play,
  Pause,
  Square,
  Trash2,
  Edit,
  ChevronRight,
  Users,
  Beaker,
  Loader2,
  SplitSquareVertical,
} from 'lucide-react';
import {
  activateExperiment,
  pauseExperiment,
  resumeExperiment,
  stopExperimentEarly,
  deleteExperiment,
} from '@/lib/services/experiments';

interface ExperimentCardProps {
  experiment: ExperimentWithVariants;
}

export function ExperimentCard({ experiment }: ExperimentCardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'activate' | 'pause' | 'resume' | 'stop' | 'delete' | null>(null);

  const controlVariant = experiment.variants.find(v => v.variant_name === 'control');
  const variantVariant = experiment.variants.find(v => v.variant_name === 'variant');
  const totalSamples = (controlVariant?.sample_count ?? 0) + (variantVariant?.sample_count ?? 0);
  const controlPercentage = 100 - experiment.traffic_percentage;

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
        case 'delete':
          result = await deleteExperiment(experiment.id);
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
      case 'delete':
        return {
          title: 'Delete Experiment',
          description: 'This will permanently delete this experiment. This action cannot be undone.',
        };
      default:
        return { title: '', description: '' };
    }
  };

  return (
    <>
      <Card className="border-border bg-card hover:border-primary/50 transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Beaker className="h-5 w-5 text-muted-foreground" />
                <Link
                  href={`/admin/experiments/${experiment.id}`}
                  className="hover:text-primary transition-colors"
                >
                  {experiment.name}
                </Link>
              </CardTitle>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {experiment.hypothesis}
              </p>
            </div>
            <ExperimentStatusBadge status={experiment.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Traffic Split Visualization */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                <SplitSquareVertical className="h-4 w-4" />
                Traffic Split
              </span>
              <span className="font-medium">
                {controlPercentage}% / {experiment.traffic_percentage}%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden flex bg-muted">
              <div
                className="bg-blue-500 transition-all"
                style={{ width: `${controlPercentage}%` }}
              />
              <div
                className="bg-green-500 transition-all"
                style={{ width: `${experiment.traffic_percentage}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Control</span>
              <span>Variant</span>
            </div>
          </div>

          {/* Sample Counts */}
          {experiment.status !== 'draft' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Control</span>
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-500">
                    {controlVariant?.sample_count ?? 0}
                  </Badge>
                </div>
                {controlVariant?.mean_score && (
                  <p className="text-xs text-muted-foreground">
                    Avg: {controlVariant.mean_score.toFixed(1)}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Variant</span>
                  <Badge variant="secondary" className="bg-green-500/20 text-green-500">
                    {variantVariant?.sample_count ?? 0}
                  </Badge>
                </div>
                {variantVariant?.mean_score && (
                  <p className="text-xs text-muted-foreground">
                    Avg: {variantVariant.mean_score.toFixed(1)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Progress to minimum samples */}
          {experiment.status === 'running' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Samples
                </span>
                <span>
                  {totalSamples} / {experiment.min_sample_size * 2}
                </span>
              </div>
              <Progress
                value={Math.min(100, (totalSamples / (experiment.min_sample_size * 2)) * 100)}
                className="h-1"
              />
            </div>
          )}

          {/* Results */}
          {experiment.status === 'completed' && experiment.winner_variant && (
            <div className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Winner</span>
                <Badge
                  className={cn(
                    experiment.winner_variant === 'control'
                      ? 'bg-blue-500/20 text-blue-500'
                      : experiment.winner_variant === 'variant'
                      ? 'bg-green-500/20 text-green-500'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {experiment.winner_variant === 'inconclusive'
                    ? 'Inconclusive'
                    : experiment.winner_variant.charAt(0).toUpperCase() + experiment.winner_variant.slice(1)}
                </Badge>
              </div>
              {experiment.p_value && (
                <p className="text-xs text-muted-foreground mt-1">
                  p-value: {experiment.p_value.toFixed(4)}
                </p>
              )}
            </div>
          )}

          {/* Meta info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
            <span>
              Created {formatDistanceToNow(new Date(experiment.created_at), { addSuffix: true })}
            </span>
            {experiment.activated_at && (
              <span>
                Started {formatDistanceToNow(new Date(experiment.activated_at), { addSuffix: true })}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            {experiment.status === 'draft' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setConfirmAction('activate')}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Activate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <Link href={`/admin/experiments/${experiment.id}`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmAction('delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}

            {experiment.status === 'running' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
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
                  Stop
                </Button>
              </>
            )}

            {experiment.status === 'paused' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
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
                  Stop
                </Button>
              </>
            )}

            {(experiment.status === 'completed' || experiment.status === 'analyzing') && (
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link href={`/admin/experiments/${experiment.id}`}>
                  View Results
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getConfirmDialogContent().title}</AlertDialogTitle>
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
                confirmAction === 'delete' || confirmAction === 'stop'
                  ? 'bg-destructive hover:bg-destructive/90'
                  : ''
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
