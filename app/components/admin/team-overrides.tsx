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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Building2,
  Settings2,
  RotateCcw,
  Eye,
  MoreVertical,
  Check,
  X,
  ArrowRight,
  GitBranch,
  Search,
  Plus,
  Edit,
  Trash2,
  Copy,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

/**
 * Team Override Management
 *
 * Allows admins to manage team-specific weight overrides with:
 * - Team list with override status
 * - Override inheritance visualization
 * - Team-specific weight editor
 * - "Reset to default" action
 * - Comparison view (team vs default)
 */

// Default dimensions (same as weight-configuration)
const DEFAULT_DIMENSIONS = [
  { id: 'clarity', name: 'Clarity', color: 'bg-blue-500', defaultWeight: 20 },
  { id: 'context', name: 'Context', color: 'bg-purple-500', defaultWeight: 20 },
  { id: 'specificity', name: 'Specificity', color: 'bg-green-500', defaultWeight: 25 },
  { id: 'goal', name: 'Goal Definition', color: 'bg-amber-500', defaultWeight: 20 },
  { id: 'constraints', name: 'Constraints', color: 'bg-rose-500', defaultWeight: 15 },
] as const;

export interface Team {
  id: string;
  name: string;
  memberCount: number;
  promptCount: number;
  createdAt: string;
}

export interface TeamOverride {
  teamId: string;
  weights: Record<string, number>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface TeamOverridesProps {
  teams: Team[];
  overrides: TeamOverride[];
  defaultWeights: Record<string, number>;
  onCreateOverride?: (teamId: string, weights: Record<string, number>) => Promise<{ success: boolean; error?: string }>;
  onUpdateOverride?: (teamId: string, weights: Record<string, number>) => Promise<{ success: boolean; error?: string }>;
  onDeleteOverride?: (teamId: string) => Promise<{ success: boolean; error?: string }>;
  readOnly?: boolean;
}

export function TeamOverrides({
  teams,
  overrides,
  defaultWeights,
  onCreateOverride,
  onUpdateOverride,
  onDeleteOverride,
  readOnly = false,
}: TeamOverridesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [editingWeights, setEditingWeights] = useState<Record<string, number> | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonTeam, setComparisonTeam] = useState<Team | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTeamId, setDeleteTeamId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Get override for a team
  const getTeamOverride = useCallback(
    (teamId: string): TeamOverride | undefined => {
      return overrides.find((o) => o.teamId === teamId);
    },
    [overrides]
  );

  // Get effective weights for a team (override or default)
  const getEffectiveWeights = useCallback(
    (teamId: string): Record<string, number> => {
      const override = getTeamOverride(teamId);
      return override?.weights || defaultWeights;
    },
    [defaultWeights, getTeamOverride]
  );

  // Filter teams by search
  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) return teams;
    const query = searchQuery.toLowerCase();
    return teams.filter((team) => team.name.toLowerCase().includes(query));
  }, [teams, searchQuery]);

  // Teams with overrides first
  const sortedTeams = useMemo(() => {
    return [...filteredTeams].sort((a, b) => {
      const aHasOverride = !!getTeamOverride(a.id);
      const bHasOverride = !!getTeamOverride(b.id);
      if (aHasOverride && !bHasOverride) return -1;
      if (!aHasOverride && bHasOverride) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [filteredTeams, getTeamOverride]);

  // Open edit dialog
  const handleEditOverride = useCallback(
    (team: Team) => {
      const override = getTeamOverride(team.id);
      setSelectedTeam(team);
      setEditingWeights(override?.weights || { ...defaultWeights });
    },
    [defaultWeights, getTeamOverride]
  );

  // Save override
  const handleSaveOverride = useCallback(async () => {
    if (!selectedTeam || !editingWeights) return;

    // Validate weights sum to 100
    const total = Object.values(editingWeights).reduce((sum, w) => sum + w, 0);
    if (total !== 100) {
      showToast.error('Weights must sum to 100%');
      return;
    }

    setIsLoading(true);

    const existingOverride = getTeamOverride(selectedTeam.id);
    const handler = existingOverride ? onUpdateOverride : onCreateOverride;

    if (handler) {
      const result = await handler(selectedTeam.id, editingWeights);
      if (result.success) {
        showToast.success(
          existingOverride ? 'Override updated' : 'Override created'
        );
        setSelectedTeam(null);
        setEditingWeights(null);
      } else {
        showToast.error(result.error || 'Failed to save override');
      }
    }

    setIsLoading(false);
  }, [selectedTeam, editingWeights, getTeamOverride, onCreateOverride, onUpdateOverride]);

  // Delete override
  const handleDeleteOverride = useCallback(async () => {
    if (!deleteTeamId) return;

    setIsLoading(true);

    if (onDeleteOverride) {
      const result = await onDeleteOverride(deleteTeamId);
      if (result.success) {
        showToast.success('Override removed');
      } else {
        showToast.error(result.error || 'Failed to remove override');
      }
    }

    setDeleteTeamId(null);
    setShowDeleteDialog(false);
    setIsLoading(false);
  }, [deleteTeamId, onDeleteOverride]);

  // Reset to default
  const handleResetToDefault = useCallback(() => {
    setEditingWeights({ ...defaultWeights });
  }, [defaultWeights]);

  // Open comparison view
  const handleViewComparison = useCallback((team: Team) => {
    setComparisonTeam(team);
    setShowComparison(true);
  }, []);

  // Calculate weight difference from default
  const getWeightDiff = useCallback(
    (teamId: string, dimensionId: string): number => {
      const override = getTeamOverride(teamId);
      if (!override) return 0;
      const defaultWeight = defaultWeights[dimensionId] || 0;
      const overrideWeight = override.weights[dimensionId] || 0;
      return overrideWeight - defaultWeight;
    },
    [defaultWeights, getTeamOverride]
  );

  // Check if weights are different from default
  const hasDifferences = useCallback(
    (weights: Record<string, number>): boolean => {
      return Object.entries(weights).some(
        ([key, value]) => defaultWeights[key] !== value
      );
    },
    [defaultWeights]
  );

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Team Weight Overrides
            </h3>
            <p className="text-sm text-muted-foreground">
              Customize scoring weights for specific teams
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{overrides.length}</Badge>
              <span>team{overrides.length !== 1 ? 's' : ''} with overrides</span>
            </div>
          </div>
        </div>

        {/* Inheritance Visualization */}
        <Card className="border-border bg-background">
          <CardContent className="py-4">
            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <div className="rounded-lg border border-primary/50 bg-primary/10 p-3">
                  <Settings2 className="h-6 w-6 text-primary" />
                </div>
                <span className="text-xs text-muted-foreground">Default Config</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="h-px w-12 bg-border" />
                <GitBranch className="h-4 w-4 text-muted-foreground rotate-90" />
                <div className="h-px w-12 bg-border" />
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
                  <Building2 className="h-6 w-6 text-amber-500" />
                </div>
                <span className="text-xs text-muted-foreground">Team Override</span>
              </div>

              <ArrowRight className="h-4 w-4 text-muted-foreground" />

              <div className="flex flex-col items-center gap-1">
                <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3">
                  <Check className="h-6 w-6 text-green-500" />
                </div>
                <span className="text-xs text-muted-foreground">Effective Config</span>
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground mt-4">
              Teams without overrides inherit the default configuration.
              Team overrides completely replace default weights.
            </p>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>

        {/* Teams Table */}
        <Card className="border-border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Prompts</TableHead>
                <TableHead>Override Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTeams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <p className="text-muted-foreground">
                      {searchQuery ? 'No teams match your search' : 'No teams found'}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                sortedTeams.map((team) => {
                  const override = getTeamOverride(team.id);
                  const hasOverride = !!override;

                  return (
                    <TableRow key={team.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{team.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{team.memberCount}</TableCell>
                      <TableCell>{team.promptCount.toLocaleString()}</TableCell>
                      <TableCell>
                        {hasOverride ? (
                          <div className="flex items-center gap-2">
                            <Badge className="bg-amber-500/20 text-amber-500">
                              Custom Override
                            </Badge>
                            <Tooltip>
                              <TooltipTrigger>
                                <div className="flex gap-1">
                                  {DEFAULT_DIMENSIONS.slice(0, 3).map((dim) => {
                                    const diff = getWeightDiff(team.id, dim.id);
                                    if (diff === 0) return null;
                                    return (
                                      <span
                                        key={dim.id}
                                        className={cn(
                                          'text-xs',
                                          diff > 0 ? 'text-green-500' : 'text-red-500'
                                        )}
                                      >
                                        {dim.name.charAt(0)}
                                        {diff > 0 ? '+' : ''}
                                        {diff}
                                      </span>
                                    );
                                  })}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Weight differences from default</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        ) : (
                          <Badge variant="secondary">Using Default</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewComparison(team)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Comparison
                            </DropdownMenuItem>
                            {!readOnly && (
                              <>
                                <DropdownMenuItem onClick={() => handleEditOverride(team)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  {hasOverride ? 'Edit Override' : 'Create Override'}
                                </DropdownMenuItem>
                                {hasOverride && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setDeleteTeamId(team.id);
                                      setShowDeleteDialog(true);
                                    }}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Remove Override
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Edit Override Dialog */}
        <Dialog
          open={selectedTeam !== null}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedTeam(null);
              setEditingWeights(null);
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {getTeamOverride(selectedTeam?.id || '') ? 'Edit' : 'Create'} Override for{' '}
                {selectedTeam?.name}
              </DialogTitle>
              <DialogDescription>
                Configure custom scoring weights for this team. Changes will only affect this team.
              </DialogDescription>
            </DialogHeader>

            {editingWeights && (
              <div className="space-y-6 py-4">
                {/* Total indicator */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Weight</span>
                  <Badge
                    className={cn(
                      Object.values(editingWeights).reduce((a, b) => a + b, 0) === 100
                        ? 'bg-green-500/20 text-green-500'
                        : 'bg-amber-500/20 text-amber-500'
                    )}
                  >
                    {Object.values(editingWeights).reduce((a, b) => a + b, 0)}%
                  </Badge>
                </div>

                {/* Dimension sliders */}
                {DEFAULT_DIMENSIONS.map((dim) => {
                  const weight = editingWeights[dim.id] ?? dim.defaultWeight;
                  const defaultWeight = defaultWeights[dim.id] ?? dim.defaultWeight;
                  const diff = weight - defaultWeight;

                  return (
                    <div key={dim.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn('h-3 w-3 rounded-full', dim.color)} />
                          <Label>{dim.name}</Label>
                          {diff !== 0 && (
                            <span
                              className={cn(
                                'text-xs',
                                diff > 0 ? 'text-green-500' : 'text-red-500'
                              )}
                            >
                              ({diff > 0 ? '+' : ''}
                              {diff} from default)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={weight}
                            onChange={(e) =>
                              setEditingWeights((prev) => ({
                                ...prev!,
                                [dim.id]: Math.min(
                                  100,
                                  Math.max(0, parseInt(e.target.value) || 0)
                                ),
                              }))
                            }
                            className="w-16 text-center bg-card"
                            min={0}
                            max={100}
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      </div>
                      <Slider
                        value={[weight]}
                        onValueChange={([value]) =>
                          setEditingWeights((prev) => ({
                            ...prev!,
                            [dim.id]: value ?? 0,
                          }))
                        }
                        max={100}
                        step={1}
                      />
                    </div>
                  );
                })}

                {/* Warnings */}
                {Object.values(editingWeights).reduce((a, b) => a + b, 0) !== 100 && (
                  <div className="flex items-center gap-2 text-amber-500 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    Weights must sum to 100%
                  </div>
                )}

                {!hasDifferences(editingWeights) && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <X className="h-4 w-4" />
                    These weights are the same as the default configuration
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleResetToDefault}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset to Default
              </Button>
              <Button
                onClick={handleSaveOverride}
                disabled={
                  isLoading ||
                  !editingWeights ||
                  Object.values(editingWeights).reduce((a, b) => a + b, 0) !== 100
                }
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Save Override
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Comparison Dialog */}
        <Dialog open={showComparison} onOpenChange={setShowComparison}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                Weight Comparison: {comparisonTeam?.name}
              </DialogTitle>
              <DialogDescription>
                Compare team-specific weights with the default configuration
              </DialogDescription>
            </DialogHeader>

            {comparisonTeam && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="rounded-lg border border-border p-4">
                    <Settings2 className="h-8 w-8 mx-auto text-primary mb-2" />
                    <p className="font-medium">Default</p>
                    <p className="text-xs text-muted-foreground">Platform default</p>
                  </div>
                  <div className="flex items-center justify-center">
                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div
                    className={cn(
                      'rounded-lg border p-4',
                      getTeamOverride(comparisonTeam.id)
                        ? 'border-amber-500/50 bg-amber-500/5'
                        : 'border-border'
                    )}
                  >
                    <Building2 className="h-8 w-8 mx-auto text-amber-500 mb-2" />
                    <p className="font-medium">
                      {getTeamOverride(comparisonTeam.id) ? 'Override' : 'Inherited'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {getTeamOverride(comparisonTeam.id)
                        ? 'Custom config'
                        : 'Using default'}
                    </p>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dimension</TableHead>
                      <TableHead className="text-center">Default</TableHead>
                      <TableHead className="text-center">Team</TableHead>
                      <TableHead className="text-center">Difference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {DEFAULT_DIMENSIONS.map((dim) => {
                      const defaultWeight = defaultWeights[dim.id] ?? dim.defaultWeight;
                      const teamWeight = getEffectiveWeights(comparisonTeam.id)[dim.id] ?? defaultWeight;
                      const diff = teamWeight - defaultWeight;

                      return (
                        <TableRow key={dim.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={cn('h-3 w-3 rounded-full', dim.color)} />
                              {dim.name}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{defaultWeight}%</TableCell>
                          <TableCell className="text-center">{teamWeight}%</TableCell>
                          <TableCell className="text-center">
                            {diff !== 0 ? (
                              <Badge
                                className={cn(
                                  diff > 0
                                    ? 'bg-green-500/20 text-green-500'
                                    : 'bg-red-500/20 text-red-500'
                                )}
                              >
                                {diff > 0 ? '+' : ''}
                                {diff}%
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowComparison(false)}>
                Close
              </Button>
              {!readOnly && comparisonTeam && (
                <Button
                  onClick={() => {
                    setShowComparison(false);
                    handleEditOverride(comparisonTeam);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Override
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Override</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove the weight override for this team? The team will
                revert to using the default configuration.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteOverride}
                disabled={isLoading}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isLoading ? 'Removing...' : 'Remove Override'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}

/**
 * TeamOverridesSkeleton - Loading skeleton
 */
export function TeamOverridesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse" />
        </div>
      </div>

      <Card className="border-border bg-background">
        <CardContent className="py-8">
          <div className="flex justify-center gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 w-20 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="h-10 w-full bg-muted rounded animate-pulse" />

      <Card className="border-border bg-background">
        <div className="p-4 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-10 w-10 bg-muted rounded animate-pulse" />
              <div className="h-5 w-32 bg-muted rounded animate-pulse" />
              <div className="flex-1" />
              <div className="h-6 w-24 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
