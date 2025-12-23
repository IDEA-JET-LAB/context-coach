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
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Split,
  Users,
  Percent,
  TrendingUp,
  RefreshCw,
  Save,
  Play,
  Pause,
  AlertTriangle,
  Check,
  Search,
  UserPlus,
  UserMinus,
  Lock,
  Unlock,
  Loader2,
  PieChart,
  BarChart3,
} from 'lucide-react';

/**
 * Traffic Splitting Visualization
 *
 * Visualizes and controls traffic allocation with:
 * - Traffic allocation bar/pie visualization
 * - User segment selection
 * - Gradual rollout controls
 * - Manual assignment override
 */

export interface ExperimentVariant {
  id: string;
  name: string;
  description?: string;
  trafficPercentage: number;
  isControl: boolean;
  userCount: number;
  color: string;
}

export interface UserAssignment {
  userId: string;
  userName: string;
  email: string;
  variantId: string;
  isManual: boolean;
  assignedAt: string;
}

export interface TrafficSplitProps {
  experimentId: string;
  experimentName: string;
  variants: ExperimentVariant[];
  totalUsers: number;
  assignments?: UserAssignment[];
  isRunning: boolean;
  onUpdateTraffic?: (variantId: string, percentage: number) => Promise<{ success: boolean; error?: string }>;
  onManualAssign?: (userId: string, variantId: string) => Promise<{ success: boolean; error?: string }>;
  onRemoveManualAssign?: (userId: string) => Promise<{ success: boolean; error?: string }>;
  onPause?: () => Promise<{ success: boolean; error?: string }>;
  onResume?: () => Promise<{ success: boolean; error?: string }>;
  readOnly?: boolean;
}

// Color palette for variants
const VARIANT_COLORS = [
  { bg: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500' },
  { bg: 'bg-green-500', text: 'text-green-500', border: 'border-green-500' },
  { bg: 'bg-purple-500', text: 'text-purple-500', border: 'border-purple-500' },
  { bg: 'bg-amber-500', text: 'text-amber-500', border: 'border-amber-500' },
  { bg: 'bg-rose-500', text: 'text-rose-500', border: 'border-rose-500' },
] as const;

const DEFAULT_VARIANT_COLOR = VARIANT_COLORS[0];

type VariantColor = typeof VARIANT_COLORS[number];

function getVariantColor(index: number): VariantColor {
  return VARIANT_COLORS[index % VARIANT_COLORS.length] ?? DEFAULT_VARIANT_COLOR;
}

export function TrafficSplit({
  experimentId,
  experimentName,
  variants,
  totalUsers,
  assignments = [],
  isRunning,
  onUpdateTraffic,
  onManualAssign,
  onRemoveManualAssign,
  onPause,
  onResume,
  readOnly = false,
}: TrafficSplitProps) {
  const [localVariants, setLocalVariants] = useState(variants);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAssignment | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [visualMode, setVisualMode] = useState<'bar' | 'pie'>('bar');

  // Calculate total traffic
  const totalTraffic = useMemo(
    () => localVariants.reduce((sum, v) => sum + v.trafficPercentage, 0),
    [localVariants]
  );

  // Filter assignments by search
  const filteredAssignments = useMemo(() => {
    if (!searchQuery.trim()) return assignments;
    const query = searchQuery.toLowerCase();
    return assignments.filter(
      (a) =>
        a.userName.toLowerCase().includes(query) ||
        a.email.toLowerCase().includes(query)
    );
  }, [assignments, searchQuery]);

  // Manual assignments count
  const manualAssignCount = assignments.filter((a) => a.isManual).length;

  // Handle traffic change
  const handleTrafficChange = useCallback(
    (variantId: string, newPercentage: number) => {
      setLocalVariants((prev) =>
        prev.map((v) =>
          v.id === variantId ? { ...v, trafficPercentage: newPercentage } : v
        )
      );
      setHasChanges(true);
    },
    []
  );

  // Auto-balance traffic
  const autoBalance = useCallback(() => {
    const count = localVariants.length;
    const basePercentage = Math.floor(100 / count);
    const remainder = 100 % count;

    setLocalVariants((prev) =>
      prev.map((v, i) => ({
        ...v,
        trafficPercentage: i < remainder ? basePercentage + 1 : basePercentage,
      }))
    );
    setHasChanges(true);
    showToast.success('Traffic balanced evenly');
  }, [localVariants.length]);

  // Save changes
  const handleSave = useCallback(async () => {
    if (totalTraffic !== 100) {
      showToast.error('Traffic must sum to 100%');
      return;
    }

    setIsSaving(true);

    for (const variant of localVariants) {
      const original = variants.find((v) => v.id === variant.id);
      if (original && original.trafficPercentage !== variant.trafficPercentage) {
        if (onUpdateTraffic) {
          const result = await onUpdateTraffic(variant.id, variant.trafficPercentage);
          if (!result.success) {
            showToast.error(`Failed to update ${variant.name}: ${result.error}`);
            setIsSaving(false);
            return;
          }
        }
      }
    }

    showToast.success('Traffic allocation saved');
    setHasChanges(false);
    setIsSaving(false);
  }, [localVariants, variants, totalTraffic, onUpdateTraffic]);

  // Reset changes
  const handleReset = useCallback(() => {
    setLocalVariants(variants);
    setHasChanges(false);
  }, [variants]);

  // Manual assignment
  const handleManualAssign = useCallback(async () => {
    if (!selectedUser || !selectedVariant || !onManualAssign) return;

    setIsAssigning(true);
    const result = await onManualAssign(selectedUser.userId, selectedVariant);
    setIsAssigning(false);

    if (result.success) {
      showToast.success(`${selectedUser.userName} assigned to ${localVariants.find((v) => v.id === selectedVariant)?.name}`);
      setShowAssignDialog(false);
      setSelectedUser(null);
      setSelectedVariant(null);
    } else {
      showToast.error(result.error || 'Failed to assign user');
    }
  }, [selectedUser, selectedVariant, onManualAssign, localVariants]);

  // Remove manual assignment
  const handleRemoveManualAssign = useCallback(
    async (userId: string) => {
      if (!onRemoveManualAssign) return;

      const result = await onRemoveManualAssign(userId);
      if (result.success) {
        showToast.success('Manual assignment removed');
      } else {
        showToast.error(result.error || 'Failed to remove assignment');
      }
    },
    [onRemoveManualAssign]
  );

  // Toggle experiment
  const handleToggleExperiment = useCallback(async () => {
    const handler = isRunning ? onPause : onResume;
    if (!handler) return;

    const result = await handler();
    if (result.success) {
      showToast.success(isRunning ? 'Experiment paused' : 'Experiment resumed');
    } else {
      showToast.error(result.error || 'Failed to update experiment');
    }
  }, [isRunning, onPause, onResume]);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Split className="h-5 w-5" />
              Traffic Split
            </h3>
            <p className="text-sm text-muted-foreground">
              {experimentName} - {totalUsers.toLocaleString()} total users
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Visual mode toggle */}
            <div className="flex items-center border rounded-lg overflow-hidden">
              <button
                onClick={() => setVisualMode('bar')}
                className={cn(
                  'px-3 py-1.5 text-sm transition-colors',
                  visualMode === 'bar'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted'
                )}
              >
                <BarChart3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setVisualMode('pie')}
                className={cn(
                  'px-3 py-1.5 text-sm transition-colors',
                  visualMode === 'pie'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted'
                )}
              >
                <PieChart className="h-4 w-4" />
              </button>
            </div>

            {/* Status badge */}
            <Badge
              className={cn(
                isRunning
                  ? 'bg-green-500/20 text-green-500'
                  : 'bg-amber-500/20 text-amber-500'
              )}
            >
              {isRunning ? 'Running' : 'Paused'}
            </Badge>

            {/* Pause/Resume */}
            {!readOnly && (onPause || onResume) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleExperiment}
              >
                {isRunning ? (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Resume
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Traffic Visualization */}
        <Card className="border-border bg-background">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Traffic Allocation</CardTitle>
              {!readOnly && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={autoBalance}
                    disabled={isSaving}
                  >
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    Auto-balance
                  </Button>
                  {hasChanges && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReset}
                        disabled={isSaving}
                      >
                        Reset
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={isSaving || totalTraffic !== 100}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-3.5 w-3.5" />
                            Save
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Total indicator */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Allocation</span>
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

            {/* Bar visualization */}
            {visualMode === 'bar' && (
              <div className="space-y-2">
                <div className="h-12 rounded-lg overflow-hidden flex">
                  {localVariants.map((variant, index) => {
                    const colors = getVariantColor(index);
                    return (
                      <Tooltip key={variant.id}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              colors.bg,
                              'transition-all duration-300 flex items-center justify-center relative cursor-pointer hover:opacity-80'
                            )}
                            style={{ width: `${variant.trafficPercentage}%` }}
                          >
                            {variant.trafficPercentage > 8 && (
                              <div className="text-white text-center">
                                <div className="text-sm font-medium">{variant.name}</div>
                                <div className="text-xs opacity-80">
                                  {variant.trafficPercentage}%
                                </div>
                              </div>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{variant.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {variant.trafficPercentage}% ({variant.userCount.toLocaleString()} users)
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4">
                  {localVariants.map((variant, index) => {
                    const colors = getVariantColor(index);
                    return (
                      <div key={variant.id} className="flex items-center gap-2">
                        <div className={cn('h-3 w-3 rounded-full', colors.bg)} />
                        <span className="text-sm">{variant.name}</span>
                        {variant.isControl && (
                          <Badge variant="outline" className="text-xs">
                            Control
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pie visualization */}
            {visualMode === 'pie' && (
              <div className="flex items-center justify-center gap-8">
                <div className="relative w-48 h-48">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    {(() => {
                      let currentOffset = 0;
                      return localVariants.map((variant, index) => {
                        const colors = getVariantColor(index);
                        const percentage = variant.trafficPercentage;
                        const circumference = Math.PI * 2 * 40;
                        const strokeLength = (percentage / 100) * circumference;
                        const offset = currentOffset;
                        currentOffset += strokeLength;

                        return (
                          <circle
                            key={variant.id}
                            cx="50"
                            cy="50"
                            r="40"
                            fill="none"
                            strokeWidth="20"
                            className={colors.text}
                            stroke="currentColor"
                            strokeDasharray={`${strokeLength} ${circumference}`}
                            strokeDashoffset={-offset}
                          />
                        );
                      });
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{totalUsers.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">Users</div>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="space-y-3">
                  {localVariants.map((variant, index) => {
                    const colors = getVariantColor(index);
                    return (
                      <div key={variant.id} className="flex items-center gap-3">
                        <div className={cn('h-4 w-4 rounded', colors.bg)} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{variant.name}</span>
                            {variant.isControl && (
                              <Badge variant="outline" className="text-xs">
                                Control
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {variant.trafficPercentage}% ({variant.userCount.toLocaleString()})
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Traffic Sliders */}
            {!readOnly && (
              <div className="space-y-4 pt-4 border-t border-border">
                <Label className="text-sm text-muted-foreground">Adjust Allocation</Label>
                {localVariants.map((variant, index) => {
                  const colors = getVariantColor(index);
                  return (
                    <div key={variant.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn('h-3 w-3 rounded-full', colors.bg)} />
                          <span className="font-medium text-sm">{variant.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={variant.trafficPercentage}
                            onChange={(e) =>
                              handleTrafficChange(
                                variant.id,
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
                        onValueChange={([value]) => handleTrafficChange(variant.id, value ?? 0)}
                        max={100}
                        step={1}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Warning */}
            {totalTraffic !== 100 && (
              <div className="flex items-center gap-2 text-amber-500 text-sm">
                <AlertTriangle className="h-4 w-4" />
                Traffic allocation must sum to 100%
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gradual Rollout */}
        <Card className="border-border bg-background">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Gradual Rollout
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Gradually increase treatment traffic to reduce risk
            </p>

            <div className="grid grid-cols-4 gap-2">
              {[25, 50, 75, 100].map((percentage) => {
                const treatmentVariant = localVariants.find((v) => !v.isControl);
                const isActive = treatmentVariant?.trafficPercentage === percentage;
                return (
                  <Button
                    key={percentage}
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      if (readOnly || !treatmentVariant) return;
                      const controlVariant = localVariants.find((v) => v.isControl);
                      if (controlVariant) {
                        handleTrafficChange(treatmentVariant.id, percentage);
                        handleTrafficChange(controlVariant.id, 100 - percentage);
                      }
                    }}
                    disabled={readOnly}
                  >
                    {percentage}%
                  </Button>
                );
              })}
            </div>

            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
              <p>
                Start with low treatment traffic and gradually increase as you gain
                confidence in the results.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Manual Assignments */}
        <Card className="border-border bg-background">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                User Assignments
                {manualAssignCount > 0 && (
                  <Badge variant="secondary">{manualAssignCount} manual</Badge>
                )}
              </CardTitle>
              {!readOnly && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAssignDialog(true)}
                >
                  <UserPlus className="mr-2 h-3.5 w-3.5" />
                  Manual Assign
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-card"
              />
            </div>

            {/* Assignments Table */}
            {filteredAssignments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'No users match your search' : 'No user assignments to display'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.slice(0, 10).map((assignment) => {
                    const variant = localVariants.find(
                      (v) => v.id === assignment.variantId
                    );
                    const variantIndex = localVariants.findIndex(
                      (v) => v.id === assignment.variantId
                    );
                    const colors = getVariantColor(variantIndex);

                    return (
                      <TableRow key={assignment.userId}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{assignment.userName}</div>
                            <div className="text-xs text-muted-foreground">
                              {assignment.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(colors.bg, 'text-white')}>
                            {variant?.name || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {assignment.isManual ? (
                            <Badge variant="outline" className="gap-1">
                              <Lock className="h-3 w-3" />
                              Manual
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Auto</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!readOnly && assignment.isManual && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveManualAssign(assignment.userId)}
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {filteredAssignments.length > 10 && (
              <p className="text-sm text-muted-foreground text-center mt-4">
                Showing 10 of {filteredAssignments.length} assignments
              </p>
            )}
          </CardContent>
        </Card>

        {/* Manual Assignment Dialog */}
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manual User Assignment</DialogTitle>
              <DialogDescription>
                Override automatic assignment for a specific user
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select User</Label>
                <Input
                  placeholder="Search by name or email..."
                  className="bg-card"
                />
                {/* In a real implementation, this would be a searchable dropdown */}
              </div>

              <div className="space-y-2">
                <Label>Assign to Variant</Label>
                <div className="grid grid-cols-2 gap-2">
                  {localVariants.map((variant, index) => {
                    const colors = getVariantColor(index);
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => setSelectedVariant(variant.id)}
                        className={cn(
                          'rounded-lg border p-3 text-left transition-colors',
                          selectedVariant === variant.id
                            ? `${colors.border} bg-primary/5`
                            : 'border-border bg-card hover:bg-muted/50'
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={cn('h-3 w-3 rounded-full', colors.bg)} />
                          <span className="font-medium">{variant.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {variant.trafficPercentage}% traffic
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAssignDialog(false);
                  setSelectedUser(null);
                  setSelectedVariant(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleManualAssign}
                disabled={!selectedVariant || isAssigning}
              >
                {isAssigning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Assign
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

/**
 * TrafficSplitSkeleton - Loading skeleton
 */
export function TrafficSplitSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-32 bg-muted rounded animate-pulse" />
          <div className="h-4 w-48 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-8 w-24 bg-muted rounded animate-pulse" />
      </div>

      <Card className="border-border bg-background">
        <CardContent className="py-6">
          <div className="h-12 w-full bg-muted rounded-lg animate-pulse mb-4" />
          <div className="flex gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-3 w-3 bg-muted rounded-full animate-pulse" />
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-background">
        <CardContent className="py-6">
          <div className="h-40 w-full bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    </div>
  );
}
