'use client';

import { useState, useCallback, useMemo } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { showToast } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  History,
  Search,
  Filter,
  Download,
  User,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  Eye,
  Plus,
  Minus,
  ArrowRight,
  Edit,
  Trash2,
  RotateCcw,
  Zap,
  FileText,
  Settings2,
  Scale,
  Beaker,
  X,
  Check,
} from 'lucide-react';

/**
 * Audit Trail View
 *
 * Displays configuration change history with:
 * - Audit log table with filters
 * - Change detail expansion
 * - User/action filters
 * - Export audit log option
 * - Diff viewer for configuration changes
 */

// Action types and their icons/colors
const ACTION_CONFIG = {
  create: { icon: Plus, label: 'Created', color: 'text-green-500', bgColor: 'bg-green-500/10' },
  update: { icon: Edit, label: 'Updated', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  delete: { icon: Trash2, label: 'Deleted', color: 'text-red-500', bgColor: 'bg-red-500/10' },
  rollback: { icon: RotateCcw, label: 'Rolled back', color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  publish: { icon: Zap, label: 'Published', color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
} as const;

// Resource types and their icons
const RESOURCE_CONFIG = {
  prompt: { icon: FileText, label: 'Prompt Template' },
  weight: { icon: Scale, label: 'Scoring Weights' },
  rule: { icon: Settings2, label: 'Classification Rule' },
  experiment: { icon: Beaker, label: 'Experiment' },
  config: { icon: Settings2, label: 'Configuration' },
} as const;

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: 'create' | 'update' | 'delete' | 'rollback' | 'publish';
  resourceType: 'prompt' | 'weight' | 'rule' | 'experiment' | 'config';
  resourceId: string;
  resourceName?: string;
  description: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    reason?: string;
  };
}

export interface AuditTrailProps {
  entries: AuditEntry[];
  totalCount?: number;
  onLoadMore?: () => Promise<void>;
  onExport?: () => Promise<{ success: boolean; data?: string; error?: string }>;
  onFilter?: (filters: AuditFilters) => void;
}

export interface AuditFilters {
  search?: string;
  action?: string;
  resourceType?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

export function AuditTrail({
  entries,
  totalCount,
  onLoadMore,
  onExport,
  onFilter,
}: AuditTrailProps) {
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [showDiffDialog, setShowDiffDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [filters, setFilters] = useState<AuditFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Get unique users for filter
  const uniqueUsers = useMemo(() => {
    const users = new Map<string, { id: string; name: string }>();
    entries.forEach((entry) => {
      if (!users.has(entry.userId)) {
        users.set(entry.userId, { id: entry.userId, name: entry.userName });
      }
    });
    return Array.from(users.values());
  }, [entries]);

  // Handle filter change
  const handleFilterChange = useCallback(
    (key: keyof AuditFilters, value: string | undefined) => {
      const newFilters = { ...filters, [key]: value || undefined };
      setFilters(newFilters);
      onFilter?.(newFilters);
    },
    [filters, onFilter]
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({});
    onFilter?.({});
  }, [onFilter]);

  // Handle export
  const handleExport = useCallback(async () => {
    if (!onExport) return;

    setIsLoading(true);
    const result = await onExport();
    setIsLoading(false);

    if (result.success && result.data) {
      const blob = new Blob([result.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      showToast.success('Audit log exported');
    } else {
      showToast.error(result.error || 'Failed to export audit log');
    }
  }, [onExport]);

  // Handle load more
  const handleLoadMore = useCallback(async () => {
    if (!onLoadMore) return;

    setIsLoading(true);
    await onLoadMore();
    setIsLoading(false);
  }, [onLoadMore]);

  // View diff
  const viewDiff = useCallback((entry: AuditEntry) => {
    setSelectedEntry(entry);
    setShowDiffDialog(true);
  }, []);

  // Toggle expand
  const toggleExpand = useCallback((entryId: string) => {
    setExpandedEntryId((prev) => (prev === entryId ? null : entryId));
  }, []);

  // Check if any filters are active
  const hasActiveFilters = Object.values(filters).some((v) => v);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <History className="h-5 w-5" />
              Audit Trail
            </h3>
            <p className="text-sm text-muted-foreground">
              {totalCount?.toLocaleString() || entries.length} total entries
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(hasActiveFilters && 'border-primary')}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2">
                  Active
                </Badge>
              )}
            </Button>

            {onExport && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={isLoading}
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <Card className="border-border bg-background">
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-4">
                {/* Search */}
                <div className="space-y-2">
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search descriptions..."
                      value={filters.search || ''}
                      onChange={(e) => handleFilterChange('search', e.target.value)}
                      className="pl-9 bg-card"
                    />
                  </div>
                </div>

                {/* Action */}
                <div className="space-y-2">
                  <Label>Action</Label>
                  <Select
                    value={filters.action || 'all'}
                    onValueChange={(value) =>
                      handleFilterChange('action', value === 'all' ? undefined : value)
                    }
                  >
                    <SelectTrigger className="bg-card">
                      <SelectValue placeholder="All actions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All actions</SelectItem>
                      {Object.entries(ACTION_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Resource Type */}
                <div className="space-y-2">
                  <Label>Resource Type</Label>
                  <Select
                    value={filters.resourceType || 'all'}
                    onValueChange={(value) =>
                      handleFilterChange('resourceType', value === 'all' ? undefined : value)
                    }
                  >
                    <SelectTrigger className="bg-card">
                      <SelectValue placeholder="All resources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All resources</SelectItem>
                      {Object.entries(RESOURCE_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* User */}
                <div className="space-y-2">
                  <Label>User</Label>
                  <Select
                    value={filters.userId || 'all'}
                    onValueChange={(value) =>
                      handleFilterChange('userId', value === 'all' ? undefined : value)
                    }
                  >
                    <SelectTrigger className="bg-card">
                      <SelectValue placeholder="All users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All users</SelectItem>
                      {uniqueUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date Range */}
              <div className="grid gap-4 md:grid-cols-4 mt-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={filters.startDate || ''}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    className="bg-card"
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={filters.endDate || ''}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    className="bg-card"
                  />
                </div>
                <div className="col-span-2 flex items-end">
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="mr-2 h-4 w-4" />
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Audit Log Table */}
        <Card className="border-border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <History className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground">No audit entries found</p>
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => {
                  const isExpanded = expandedEntryId === entry.id;
                  const actionConfig = ACTION_CONFIG[entry.action];
                  const resourceConfig = RESOURCE_CONFIG[entry.resourceType];
                  const ActionIcon = actionConfig.icon;
                  const ResourceIcon = resourceConfig.icon;

                  return (
                    <>
                      <TableRow
                        key={entry.id}
                        className={cn(isExpanded && 'border-b-0')}
                      >
                        <TableCell>
                          <button
                            onClick={() => toggleExpand(entry.id)}
                            className="p-1 hover:bg-muted rounded"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">
                                  {formatDistanceToNow(new Date(entry.timestamp), {
                                    addSuffix: true,
                                  })}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {format(new Date(entry.timestamp), 'PPpp')}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{entry.userName}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>{entry.userEmail}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(actionConfig.bgColor, actionConfig.color, 'gap-1')}
                          >
                            <ActionIcon className="h-3 w-3" />
                            {actionConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ResourceIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{resourceConfig.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground line-clamp-1">
                            {entry.description}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {(entry.previousValue || entry.newValue) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => viewDiff(entry)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/30">
                            <div className="py-4 px-2 space-y-4">
                              <div className="grid gap-4 md:grid-cols-3">
                                <div>
                                  <Label className="text-xs text-muted-foreground">
                                    Resource ID
                                  </Label>
                                  <p className="text-sm font-mono">{entry.resourceId}</p>
                                </div>
                                {entry.resourceName && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">
                                      Resource Name
                                    </Label>
                                    <p className="text-sm">{entry.resourceName}</p>
                                  </div>
                                )}
                                <div>
                                  <Label className="text-xs text-muted-foreground">
                                    Full Timestamp
                                  </Label>
                                  <p className="text-sm">
                                    {format(new Date(entry.timestamp), 'PPpp')}
                                  </p>
                                </div>
                              </div>

                              {entry.metadata && (
                                <div className="grid gap-4 md:grid-cols-3">
                                  {entry.metadata.ipAddress && (
                                    <div>
                                      <Label className="text-xs text-muted-foreground">
                                        IP Address
                                      </Label>
                                      <p className="text-sm font-mono">
                                        {entry.metadata.ipAddress}
                                      </p>
                                    </div>
                                  )}
                                  {entry.metadata.reason && (
                                    <div className="md:col-span-2">
                                      <Label className="text-xs text-muted-foreground">
                                        Reason
                                      </Label>
                                      <p className="text-sm">{entry.metadata.reason}</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              <div>
                                <Label className="text-xs text-muted-foreground">
                                  Description
                                </Label>
                                <p className="text-sm">{entry.description}</p>
                              </div>

                              {(entry.previousValue || entry.newValue) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => viewDiff(entry)}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Changes
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Load More */}
          {onLoadMore && totalCount && entries.length < totalCount && (
            <div className="p-4 border-t border-border">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleLoadMore}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : `Load More (${totalCount - entries.length} remaining)`}
              </Button>
            </div>
          )}
        </Card>

        {/* Diff Dialog */}
        <Dialog open={showDiffDialog} onOpenChange={setShowDiffDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configuration Changes</DialogTitle>
              <DialogDescription>
                {selectedEntry && (
                  <>
                    {ACTION_CONFIG[selectedEntry.action].label} by {selectedEntry.userName} on{' '}
                    {format(new Date(selectedEntry.timestamp), 'PPpp')}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            {selectedEntry && (
              <div className="space-y-6 py-4">
                {/* Side by Side Diff */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Previous Value */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Minus className="h-4 w-4 text-red-500" />
                      <Label>Previous Value</Label>
                    </div>
                    <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 max-h-96 overflow-auto">
                      {selectedEntry.previousValue ? (
                        <pre className="text-xs font-mono whitespace-pre-wrap">
                          {JSON.stringify(selectedEntry.previousValue, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-muted-foreground text-sm">(None)</span>
                      )}
                    </div>
                  </div>

                  {/* New Value */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-green-500" />
                      <Label>New Value</Label>
                    </div>
                    <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 max-h-96 overflow-auto">
                      {selectedEntry.newValue ? (
                        <pre className="text-xs font-mono whitespace-pre-wrap">
                          {JSON.stringify(selectedEntry.newValue, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-muted-foreground text-sm">(Deleted)</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Field-level Changes */}
                {selectedEntry.previousValue && selectedEntry.newValue && (
                  <div className="space-y-2">
                    <Label>Changed Fields</Label>
                    <div className="rounded-lg border border-border bg-card overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Field</TableHead>
                            <TableHead>Previous</TableHead>
                            <TableHead></TableHead>
                            <TableHead>New</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.keys({
                            ...selectedEntry.previousValue,
                            ...selectedEntry.newValue,
                          }).map((key) => {
                            const prev = (selectedEntry.previousValue as Record<string, unknown>)?.[key];
                            const next = (selectedEntry.newValue as Record<string, unknown>)?.[key];
                            const changed = JSON.stringify(prev) !== JSON.stringify(next);

                            if (!changed) return null;

                            return (
                              <TableRow key={key}>
                                <TableCell className="font-mono text-sm">
                                  {key}
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    'text-sm',
                                    prev !== undefined
                                      ? 'text-red-500 bg-red-500/5'
                                      : 'text-muted-foreground'
                                  )}
                                >
                                  {prev !== undefined
                                    ? typeof prev === 'object'
                                      ? JSON.stringify(prev)
                                      : String(prev)
                                    : '-'}
                                </TableCell>
                                <TableCell>
                                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    'text-sm',
                                    next !== undefined
                                      ? 'text-green-500 bg-green-500/5'
                                      : 'text-muted-foreground'
                                  )}
                                >
                                  {next !== undefined
                                    ? typeof next === 'object'
                                      ? JSON.stringify(next)
                                      : String(next)
                                    : '-'}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDiffDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

/**
 * AuditTrailCompact - A compact version for sidebars
 */
export function AuditTrailCompact({
  entries,
  onViewAll,
}: {
  entries: AuditEntry[];
  onViewAll?: () => void;
}) {
  return (
    <div className="space-y-3">
      {entries.slice(0, 5).map((entry) => {
        const actionConfig = ACTION_CONFIG[entry.action];
        const ActionIcon = actionConfig.icon;

        return (
          <div key={entry.id} className="flex items-start gap-3">
            <div
              className={cn(
                'rounded-full p-1.5',
                actionConfig.bgColor
              )}
            >
              <ActionIcon className={cn('h-3 w-3', actionConfig.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{entry.description}</p>
              <p className="text-xs text-muted-foreground">
                {entry.userName} &middot;{' '}
                {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
              </p>
            </div>
          </div>
        );
      })}

      {onViewAll && entries.length > 5 && (
        <Button variant="ghost" size="sm" onClick={onViewAll} className="w-full">
          View all activity
        </Button>
      )}
    </div>
  );
}

/**
 * AuditTrailSkeleton - Loading skeleton
 */
export function AuditTrailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-32 bg-muted rounded animate-pulse" />
          <div className="h-4 w-24 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-muted rounded animate-pulse" />
          <div className="h-9 w-24 bg-muted rounded animate-pulse" />
        </div>
      </div>

      <Card className="border-border bg-background">
        <div className="p-4 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-8 w-8 bg-muted rounded animate-pulse" />
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="h-4 w-20 bg-muted rounded animate-pulse" />
              <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              <div className="flex-1 h-4 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
