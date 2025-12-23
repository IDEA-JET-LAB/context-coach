'use client';

import { useState, useCallback, useMemo } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { showToast } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  History,
  GitCommit,
  RotateCcw,
  Eye,
  Tag,
  User,
  Clock,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  ArrowRight,
  FileText,
  Copy,
  Loader2,
  AlertTriangle,
  Zap,
} from 'lucide-react';

/**
 * Version History Component
 *
 * Provides version control UI with:
 * - Version history timeline
 * - Version comparison (diff view)
 * - Rollback confirmation flow
 * - Version tagging/naming
 */

export interface ConfigVersion {
  id: string;
  version: number;
  name: string;
  description?: string;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  changes: {
    type: 'added' | 'modified' | 'removed';
    field: string;
    oldValue?: string;
    newValue?: string;
  }[];
  snapshot: {
    systemPrompt?: string;
    dimensions?: { name: string; weight: number }[];
    model?: string;
  };
}

export interface VersionHistoryProps {
  versions: ConfigVersion[];
  currentVersionId?: string;
  onRollback?: (versionId: string) => Promise<{ success: boolean; error?: string }>;
  onAddTag?: (versionId: string, tag: string) => Promise<{ success: boolean; error?: string }>;
  onRemoveTag?: (versionId: string, tag: string) => Promise<{ success: boolean; error?: string }>;
  onViewVersion?: (version: ConfigVersion) => void;
  readOnly?: boolean;
}

export function VersionHistory({
  versions,
  currentVersionId,
  onRollback,
  onAddTag,
  onRemoveTag,
  onViewVersion,
  readOnly = false,
}: VersionHistoryProps) {
  const [selectedVersion, setSelectedVersion] = useState<ConfigVersion | null>(null);
  const [compareVersions, setCompareVersions] = useState<{
    left: ConfigVersion | null;
    right: ConfigVersion | null;
  }>({ left: null, right: null });
  const [showComparison, setShowComparison] = useState(false);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [rollbackVersion, setRollbackVersion] = useState<ConfigVersion | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [tagVersion, setTagVersion] = useState<ConfigVersion | null>(null);
  const [newTag, setNewTag] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

  // Sort versions by version number descending
  const sortedVersions = useMemo(
    () => [...versions].sort((a, b) => b.version - a.version),
    [versions]
  );

  // Handle rollback
  const handleRollback = useCallback(async () => {
    if (!rollbackVersion || !onRollback) return;

    setIsRollingBack(true);
    const result = await onRollback(rollbackVersion.id);
    setIsRollingBack(false);

    if (result.success) {
      showToast.success(`Rolled back to version ${rollbackVersion.version}`);
      setShowRollbackDialog(false);
      setRollbackVersion(null);
    } else {
      showToast.error(result.error || 'Failed to rollback');
    }
  }, [rollbackVersion, onRollback]);

  // Handle add tag
  const handleAddTag = useCallback(async () => {
    if (!tagVersion || !newTag.trim() || !onAddTag) return;

    setIsAddingTag(true);
    const result = await onAddTag(tagVersion.id, newTag.trim());
    setIsAddingTag(false);

    if (result.success) {
      showToast.success('Tag added');
      setShowTagDialog(false);
      setTagVersion(null);
      setNewTag('');
    } else {
      showToast.error(result.error || 'Failed to add tag');
    }
  }, [tagVersion, newTag, onAddTag]);

  // Handle remove tag
  const handleRemoveTag = useCallback(
    async (version: ConfigVersion, tag: string) => {
      if (!onRemoveTag) return;

      const result = await onRemoveTag(version.id, tag);
      if (result.success) {
        showToast.success('Tag removed');
      } else {
        showToast.error(result.error || 'Failed to remove tag');
      }
    },
    [onRemoveTag]
  );

  // Start comparison
  const startComparison = useCallback(
    (version: ConfigVersion) => {
      if (!compareVersions.left) {
        setCompareVersions({ left: version, right: null });
        showToast.info('Select another version to compare');
      } else if (!compareVersions.right) {
        setCompareVersions((prev) => ({ ...prev, right: version }));
        setShowComparison(true);
      }
    },
    [compareVersions.left]
  );

  // Reset comparison
  const resetComparison = useCallback(() => {
    setCompareVersions({ left: null, right: null });
    setShowComparison(false);
  }, []);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <History className="h-5 w-5" />
              Version History
            </h3>
            <p className="text-sm text-muted-foreground">
              Track changes and rollback to previous configurations
            </p>
          </div>

          {(compareVersions.left || compareVersions.right) && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                Comparing: {compareVersions.left?.version || '?'} vs{' '}
                {compareVersions.right?.version || '?'}
              </Badge>
              <Button variant="outline" size="sm" onClick={resetComparison}>
                Cancel
              </Button>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />

          {/* Version Items */}
          <div className="space-y-4">
            {sortedVersions.map((version, index) => {
              const isCurrent = version.id === currentVersionId || version.isActive;
              const isSelected = selectedVersion?.id === version.id;
              const isInComparison =
                compareVersions.left?.id === version.id ||
                compareVersions.right?.id === version.id;

              return (
                <div
                  key={version.id}
                  className={cn(
                    'relative flex gap-4',
                    isInComparison && 'bg-primary/5 rounded-lg p-2 -ml-2 -mr-2'
                  )}
                >
                  {/* Timeline Node */}
                  <div
                    className={cn(
                      'relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2',
                      isCurrent
                        ? 'border-green-500 bg-green-500/20'
                        : isInComparison
                        ? 'border-primary bg-primary/20'
                        : 'border-border bg-background'
                    )}
                  >
                    {isCurrent ? (
                      <Zap className="h-5 w-5 text-green-500" />
                    ) : (
                      <GitCommit className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Version Card */}
                  <Card
                    className={cn(
                      'flex-1 border-border bg-background transition-all cursor-pointer',
                      isSelected && 'border-primary',
                      isInComparison && 'border-primary/50'
                    )}
                    onClick={() => setSelectedVersion(isSelected ? null : version)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">
                              v{version.version}
                              {version.name && (
                                <span className="text-muted-foreground font-normal">
                                  {' '}
                                  - {version.name}
                                </span>
                              )}
                            </CardTitle>
                            {isCurrent && (
                              <Badge className="bg-green-500/20 text-green-500">
                                Active
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {version.createdBy.name}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(version.createdAt), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Tags */}
                        {version.tags.length > 0 && (
                          <div className="flex items-center gap-1">
                            {version.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="text-xs gap-1"
                              >
                                <Tag className="h-2.5 w-2.5" />
                                {tag}
                                {!readOnly && onRemoveTag && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveTag(version, tag);
                                    }}
                                    className="ml-1 hover:text-destructive"
                                  >
                                    <Minus className="h-2.5 w-2.5" />
                                  </button>
                                )}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardHeader>

                    {/* Expanded Content */}
                    {isSelected && (
                      <CardContent className="pt-0">
                        <Separator className="my-3" />

                        {version.description && (
                          <p className="text-sm text-muted-foreground mb-3">
                            {version.description}
                          </p>
                        )}

                        {/* Changes Summary */}
                        {version.changes.length > 0 && (
                          <div className="space-y-2 mb-4">
                            <Label className="text-xs">Changes</Label>
                            <div className="space-y-1">
                              {version.changes.slice(0, 5).map((change, i) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-2 text-xs"
                                >
                                  {change.type === 'added' && (
                                    <Plus className="h-3 w-3 text-green-500" />
                                  )}
                                  {change.type === 'modified' && (
                                    <ArrowRight className="h-3 w-3 text-amber-500" />
                                  )}
                                  {change.type === 'removed' && (
                                    <Minus className="h-3 w-3 text-red-500" />
                                  )}
                                  <span className="text-muted-foreground">
                                    {change.field}
                                  </span>
                                </div>
                              ))}
                              {version.changes.length > 5 && (
                                <span className="text-xs text-muted-foreground">
                                  +{version.changes.length - 5} more changes
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {onViewVersion && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onViewVersion(version);
                              }}
                            >
                              <Eye className="mr-2 h-3.5 w-3.5" />
                              View
                            </Button>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              startComparison(version);
                            }}
                          >
                            <Copy className="mr-2 h-3.5 w-3.5" />
                            Compare
                          </Button>

                          {!readOnly && !isCurrent && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTagVersion(version);
                                  setShowTagDialog(true);
                                }}
                              >
                                <Tag className="mr-2 h-3.5 w-3.5" />
                                Add Tag
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRollbackVersion(version);
                                  setShowRollbackDialog(true);
                                }}
                              >
                                <RotateCcw className="mr-2 h-3.5 w-3.5" />
                                Rollback
                              </Button>
                            </>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                </div>
              );
            })}
          </div>
        </div>

        {/* Empty State */}
        {sortedVersions.length === 0 && (
          <Card className="border-dashed border-border bg-background">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <History className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No version history available</p>
            </CardContent>
          </Card>
        )}

        {/* Comparison Dialog */}
        <Dialog open={showComparison} onOpenChange={setShowComparison}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Version Comparison: v{compareVersions.left?.version} vs v
                {compareVersions.right?.version}
              </DialogTitle>
              <DialogDescription>
                Side-by-side comparison of configuration changes
              </DialogDescription>
            </DialogHeader>

            {compareVersions.left && compareVersions.right && (
              <div className="space-y-6 py-4">
                {/* Version Headers */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-border p-4 bg-card">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">v{compareVersions.left.version}</Badge>
                      {compareVersions.left.isActive && (
                        <Badge className="bg-green-500/20 text-green-500">Active</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(compareVersions.left.createdAt), 'PPpp')}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-4 bg-card">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">v{compareVersions.right.version}</Badge>
                      {compareVersions.right.isActive && (
                        <Badge className="bg-green-500/20 text-green-500">Active</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(compareVersions.right.createdAt), 'PPpp')}
                    </p>
                  </div>
                </div>

                {/* Diff View */}
                <div className="space-y-4">
                  {/* System Prompt Comparison */}
                  {(compareVersions.left.snapshot.systemPrompt ||
                    compareVersions.right.snapshot.systemPrompt) && (
                    <div className="space-y-2">
                      <Label>System Prompt</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-lg border border-border bg-card p-3">
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                            {compareVersions.left.snapshot.systemPrompt || '(empty)'}
                          </pre>
                        </div>
                        <div className="rounded-lg border border-border bg-card p-3">
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                            {compareVersions.right.snapshot.systemPrompt || '(empty)'}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dimensions Comparison */}
                  {(compareVersions.left.snapshot.dimensions ||
                    compareVersions.right.snapshot.dimensions) && (
                    <div className="space-y-2">
                      <Label>Dimensions</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          {compareVersions.left.snapshot.dimensions?.map((dim) => (
                            <div
                              key={dim.name}
                              className="flex items-center justify-between rounded-lg border border-border p-2"
                            >
                              <span className="text-sm">{dim.name}</span>
                              <Badge variant="secondary">{dim.weight}%</Badge>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-2">
                          {compareVersions.right.snapshot.dimensions?.map((dim) => {
                            const leftDim = compareVersions.left?.snapshot.dimensions?.find(
                              (d) => d.name === dim.name
                            );
                            const diff = leftDim
                              ? dim.weight - leftDim.weight
                              : dim.weight;
                            return (
                              <div
                                key={dim.name}
                                className="flex items-center justify-between rounded-lg border border-border p-2"
                              >
                                <span className="text-sm">{dim.name}</span>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary">{dim.weight}%</Badge>
                                  {diff !== 0 && (
                                    <Badge
                                      className={cn(
                                        diff > 0
                                          ? 'bg-green-500/20 text-green-500'
                                          : 'bg-red-500/20 text-red-500'
                                      )}
                                    >
                                      {diff > 0 ? '+' : ''}
                                      {diff}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Model Comparison */}
                  {(compareVersions.left.snapshot.model ||
                    compareVersions.right.snapshot.model) && (
                    <div className="space-y-2">
                      <Label>Model</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <Badge variant="secondary">
                          {compareVersions.left.snapshot.model || 'Not specified'}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={cn(
                            compareVersions.left.snapshot.model !==
                              compareVersions.right.snapshot.model &&
                              'border-amber-500'
                          )}
                        >
                          {compareVersions.right.snapshot.model || 'Not specified'}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={resetComparison}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rollback Confirmation Dialog */}
        <AlertDialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Rollback Configuration
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to rollback to version {rollbackVersion?.version}
                {rollbackVersion?.name && ` (${rollbackVersion.name})`}?
                <br />
                <br />
                This will:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Create a new version with the rolled-back configuration</li>
                  <li>Activate the new version immediately</li>
                  <li>Affect all future analyses</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRollback}
                disabled={isRollingBack}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {isRollingBack ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Rolling back...
                  </>
                ) : (
                  <>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Rollback
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add Tag Dialog */}
        <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Tag to v{tagVersion?.version}</DialogTitle>
              <DialogDescription>
                Tags help you identify and find important versions quickly
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tag">Tag Name</Label>
                <Input
                  id="tag"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="e.g., production, stable, v2-release"
                  className="bg-card"
                />
              </div>

              {tagVersion && tagVersion.tags.length > 0 && (
                <div className="space-y-2">
                  <Label>Existing Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {tagVersion.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        <Tag className="mr-1 h-3 w-3" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowTagDialog(false);
                  setTagVersion(null);
                  setNewTag('');
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleAddTag} disabled={!newTag.trim() || isAddingTag}>
                {isAddingTag ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Tag
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
 * VersionHistorySkeleton - Loading skeleton
 */
export function VersionHistorySkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-36 bg-muted rounded animate-pulse" />
          <div className="h-4 w-56 bg-muted rounded animate-pulse" />
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="relative flex gap-4">
              <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
              <Card className="flex-1 border-border bg-background">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-16 bg-muted rounded animate-pulse" />
                    <div className="h-5 w-24 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="flex gap-4">
                    <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                  </div>
                </CardHeader>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * VersionHistoryCompact - A compact timeline view
 */
export function VersionHistoryCompact({
  versions,
  onViewAll,
}: {
  versions: ConfigVersion[];
  onViewAll?: () => void;
}) {
  const recentVersions = versions.slice(0, 3);

  return (
    <div className="space-y-3">
      {recentVersions.map((version) => (
        <div
          key={version.id}
          className="flex items-center gap-3 text-sm"
        >
          <div
            className={cn(
              'h-2 w-2 rounded-full',
              version.isActive ? 'bg-green-500' : 'bg-muted-foreground'
            )}
          />
          <span className="font-medium">v{version.version}</span>
          {version.name && (
            <span className="text-muted-foreground truncate">{version.name}</span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
          </span>
        </div>
      ))}

      {onViewAll && versions.length > 3 && (
        <Button variant="ghost" size="sm" onClick={onViewAll} className="w-full">
          View all {versions.length} versions
        </Button>
      )}
    </div>
  );
}
