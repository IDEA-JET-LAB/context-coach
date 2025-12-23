'use client';

import { useState, useCallback, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { showToast } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Search,
  Filter,
  Download,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit,
  Trash2,
  RotateCcw,
  Zap,
  Archive,
  Copy,
  Send,
  Check,
  Pause,
  Play,
  Trophy,
  Settings2,
  FileText,
  Scale,
  Users,
  Beaker,
  Tag,
} from 'lucide-react';
import type {
  AuditLogEntry,
  AuditLogFilters,
  AuditAction,
  AuditEntityType,
} from '@/lib/types/audit';
import { AUDIT_ACTION_CONFIGS, AUDIT_ENTITY_CONFIGS } from '@/lib/types/audit';

// Icon mapping for actions
const ACTION_ICONS = {
  Plus,
  Edit,
  Trash2,
  RotateCcw,
  Zap,
  Archive,
  Copy,
  Send,
  Check,
  X,
  Pause,
  Play,
  Trophy,
  Scale,
} as const;

// Icon mapping for entities
const ENTITY_ICONS = {
  Settings2,
  FileText,
  Filter,
  Tag,
  Scale,
  Users,
  Beaker,
} as const;

interface AuditLogContentProps {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  users: { id: string; email: string }[];
  filters: AuditLogFilters;
}

export function AuditLogContent({
  entries,
  total,
  page,
  pageSize,
  totalPages,
  users,
  filters,
}: AuditLogContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [showDiffDialog, setShowDiffDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [showFilters, setShowFilters] = useState(
    Boolean(
      filters.action?.length ||
        filters.entity_type?.length ||
        filters.changed_by ||
        filters.date_from ||
        filters.date_to ||
        filters.search
    )
  );
  const [isExporting, setIsExporting] = useState(false);

  // Update URL with new filters
  const updateFilters = useCallback(
    (newFilters: Partial<AuditLogFilters>) => {
      const params = new URLSearchParams(searchParams.toString());

      // Reset to page 1 on filter change
      params.set('page', '1');

      // Update each filter
      if (newFilters.search !== undefined) {
        if (newFilters.search) {
          params.set('search', newFilters.search);
        } else {
          params.delete('search');
        }
      }

      if (newFilters.action !== undefined) {
        if (newFilters.action && newFilters.action.length > 0) {
          params.set('action', newFilters.action.join(','));
        } else {
          params.delete('action');
        }
      }

      if (newFilters.entity_type !== undefined) {
        if (newFilters.entity_type && newFilters.entity_type.length > 0) {
          params.set('entity_type', newFilters.entity_type.join(','));
        } else {
          params.delete('entity_type');
        }
      }

      if (newFilters.changed_by !== undefined) {
        if (newFilters.changed_by) {
          params.set('changed_by', newFilters.changed_by);
        } else {
          params.delete('changed_by');
        }
      }

      if (newFilters.date_from !== undefined) {
        if (newFilters.date_from) {
          params.set('date_from', newFilters.date_from);
        } else {
          params.delete('date_from');
        }
      }

      if (newFilters.date_to !== undefined) {
        if (newFilters.date_to) {
          params.set('date_to', newFilters.date_to);
        } else {
          params.delete('date_to');
        }
      }

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams]
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    startTransition(() => {
      router.push(pathname);
    });
  }, [pathname, router]);

  // Navigate to page
  const goToPage = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', String(newPage));

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams]
  );

  // Export audit logs
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.action?.length) params.set('action', filters.action.join(','));
      if (filters.entity_type?.length) params.set('entity_type', filters.entity_type.join(','));
      if (filters.changed_by) params.set('changed_by', filters.changed_by);
      if (filters.date_from) params.set('date_from', filters.date_from);
      if (filters.date_to) params.set('date_to', filters.date_to);
      if (filters.search) params.set('search', filters.search);

      const response = await fetch(`/api/admin/audit/export?${params.toString()}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      showToast.success('Audit log exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      showToast.error(error instanceof Error ? error.message : 'Failed to export audit log');
    } finally {
      setIsExporting(false);
    }
  }, [filters]);

  // View diff
  const viewDiff = useCallback((entry: AuditLogEntry) => {
    setSelectedEntry(entry);
    setShowDiffDialog(true);
  }, []);

  // Toggle expand
  const toggleExpand = useCallback((entryId: string) => {
    setExpandedEntryId((prev) => (prev === entryId ? null : entryId));
  }, []);

  // Check if any filters are active
  const hasActiveFilters = Boolean(
    filters.action?.length ||
      filters.entity_type?.length ||
      filters.changed_by ||
      filters.date_from ||
      filters.date_to ||
      filters.search
  );

  // Get action icon component
  const getActionIcon = (action: AuditAction) => {
    const iconName = AUDIT_ACTION_CONFIGS[action]?.icon || 'Edit';
    return ACTION_ICONS[iconName as keyof typeof ACTION_ICONS] || Edit;
  };

  // Get entity icon component
  const getEntityIcon = (entityType: AuditEntityType) => {
    const iconName = AUDIT_ENTITY_CONFIGS[entityType]?.icon || 'Settings2';
    return ENTITY_ICONS[iconName as keyof typeof ENTITY_ICONS] || Settings2;
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {total.toLocaleString()} total entries
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

            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting || isPending}
            >
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </Button>
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
                      placeholder="Search entries..."
                      value={filters.search || ''}
                      onChange={(e) => updateFilters({ search: e.target.value })}
                      className="pl-9 bg-card"
                    />
                  </div>
                </div>

                {/* Action Type */}
                <div className="space-y-2">
                  <Label>Action Type</Label>
                  <Select
                    value={filters.action?.[0] || 'all'}
                    onValueChange={(value) =>
                      updateFilters({
                        action: value === 'all' ? undefined : [value as AuditAction],
                      })
                    }
                  >
                    <SelectTrigger className="bg-card">
                      <SelectValue placeholder="All actions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All actions</SelectItem>
                      <SelectItem value="config_created">Config Created</SelectItem>
                      <SelectItem value="config_updated">Config Updated</SelectItem>
                      <SelectItem value="config_activated">Config Activated</SelectItem>
                      <SelectItem value="config_deleted">Config Deleted</SelectItem>
                      <SelectItem value="config_duplicated">Config Duplicated</SelectItem>
                      <SelectItem value="template_created">Template Created</SelectItem>
                      <SelectItem value="template_updated">Template Updated</SelectItem>
                      <SelectItem value="rule_created">Rule Created</SelectItem>
                      <SelectItem value="rule_updated">Rule Updated</SelectItem>
                      <SelectItem value="experiment_created">Experiment Created</SelectItem>
                      <SelectItem value="experiment_activated">Experiment Activated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Entity Type */}
                <div className="space-y-2">
                  <Label>Entity Type</Label>
                  <Select
                    value={filters.entity_type?.[0] || 'all'}
                    onValueChange={(value) =>
                      updateFilters({
                        entity_type:
                          value === 'all' ? undefined : [value as AuditEntityType],
                      })
                    }
                  >
                    <SelectTrigger className="bg-card">
                      <SelectValue placeholder="All entities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All entities</SelectItem>
                      <SelectItem value="analysis_config">Analysis Config</SelectItem>
                      <SelectItem value="prompt_template">Prompt Template</SelectItem>
                      <SelectItem value="classification_rule">Classification Rule</SelectItem>
                      <SelectItem value="classification_category">Category</SelectItem>
                      <SelectItem value="scoring_weight">Scoring Weight</SelectItem>
                      <SelectItem value="team_weight_override">Team Override</SelectItem>
                      <SelectItem value="experiment">Experiment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* User */}
                <div className="space-y-2">
                  <Label>User</Label>
                  <Select
                    value={filters.changed_by || 'all'}
                    onValueChange={(value) =>
                      updateFilters({ changed_by: value === 'all' ? undefined : value })
                    }
                  >
                    <SelectTrigger className="bg-card">
                      <SelectValue placeholder="All users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All users</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date Range */}
              <div className="grid gap-4 md:grid-cols-4 mt-4">
                <div className="space-y-2">
                  <Label>From Date</Label>
                  <Input
                    type="date"
                    value={filters.date_from || ''}
                    onChange={(e) => updateFilters({ date_from: e.target.value })}
                    className="bg-card"
                  />
                </div>
                <div className="space-y-2">
                  <Label>To Date</Label>
                  <Input
                    type="date"
                    value={filters.date_to || ''}
                    onChange={(e) => updateFilters({ date_to: e.target.value })}
                    className="bg-card"
                  />
                </div>
                <div className="col-span-2 flex items-end">
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      disabled={isPending}
                    >
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
                <TableHead>Entity</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <Filter className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground">No audit entries found</p>
                    {hasActiveFilters && (
                      <Button
                        variant="link"
                        onClick={clearFilters}
                        className="mt-2"
                      >
                        Clear filters
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => {
                  const isExpanded = expandedEntryId === entry.id;
                  const actionConfig = AUDIT_ACTION_CONFIGS[entry.action];
                  const entityConfig = AUDIT_ENTITY_CONFIGS[entry.entity_type];
                  const ActionIcon = getActionIcon(entry.action);
                  const EntityIcon = getEntityIcon(entry.entity_type);

                  return (
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
                                {formatDistanceToNow(new Date(entry.created_at), {
                                  addSuffix: true,
                                })}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {format(new Date(entry.created_at), 'PPpp')}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm truncate max-w-32">
                                {entry.changed_by_email || 'System'}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {entry.changed_by_email || 'System action'}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            'gap-1',
                            actionConfig?.bgColor || 'bg-muted',
                            actionConfig?.color || 'text-foreground'
                          )}
                        >
                          <ActionIcon className="h-3 w-3" />
                          {actionConfig?.label || entry.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <EntityIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {entityConfig?.label || entry.entity_type}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm text-muted-foreground line-clamp-1 max-w-xs">
                              {entry.change_summary || entry.entity_name || '-'}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            {entry.change_summary || entry.entity_name || 'No summary'}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-right">
                        {(entry.before_state || entry.after_state) && (
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
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(page - 1)}
                disabled={page === 1 || isPending}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(page + 1)}
                disabled={page === totalPages || isPending}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Diff Dialog */}
        <Dialog open={showDiffDialog} onOpenChange={setShowDiffDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configuration Changes</DialogTitle>
              <DialogDescription>
                {selectedEntry && (
                  <>
                    {AUDIT_ACTION_CONFIGS[selectedEntry.action]?.label || selectedEntry.action}{' '}
                    by {selectedEntry.changed_by_email || 'System'} on{' '}
                    {format(new Date(selectedEntry.created_at), 'PPpp')}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            {selectedEntry && (
              <JsonDiffViewer
                before={selectedEntry.before_state}
                after={selectedEntry.after_state}
              />
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
 * JSON Diff Viewer Component
 * Displays before and after states with diff highlighting
 */
interface JsonDiffViewerProps {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

interface DiffLine {
  key: string;
  type: 'added' | 'removed' | 'changed' | 'unchanged';
  oldValue?: unknown;
  newValue?: unknown;
}

function JsonDiffViewer({ before, after }: JsonDiffViewerProps) {
  // Compute diff
  const diff = computeDiff(before || {}, after || {});

  return (
    <div className="space-y-6 py-4">
      {/* Side by Side View */}
      <div className="grid grid-cols-2 gap-4">
        {/* Before */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-destructive" />
            <Label>Before</Label>
          </div>
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 max-h-64 overflow-auto">
            {before ? (
              <pre className="text-xs font-mono whitespace-pre-wrap">
                {JSON.stringify(before, null, 2)}
              </pre>
            ) : (
              <span className="text-muted-foreground text-sm">(None - new entity)</span>
            )}
          </div>
        </div>

        {/* After */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <Label>After</Label>
          </div>
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 max-h-64 overflow-auto">
            {after ? (
              <pre className="text-xs font-mono whitespace-pre-wrap">
                {JSON.stringify(after, null, 2)}
              </pre>
            ) : (
              <span className="text-muted-foreground text-sm">(Deleted)</span>
            )}
          </div>
        </div>
      </div>

      {/* Field-level Diff */}
      {before && after && diff.length > 0 && (
        <div className="space-y-2">
          <Label>Changed Fields</Label>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Field</TableHead>
                  <TableHead>Before</TableHead>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>After</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diff.map((line) => {
                  if (line.type === 'unchanged') return null;

                  return (
                    <TableRow key={line.key}>
                      <TableCell className="font-mono text-sm font-medium">
                        {line.key}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-sm font-mono',
                          (line.type === 'removed' || line.type === 'changed') &&
                            'text-destructive bg-destructive/5'
                        )}
                      >
                        {line.oldValue !== undefined
                          ? formatValue(line.oldValue)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <ChevronRight className="h-4 w-4 text-muted-foreground inline" />
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-sm font-mono',
                          (line.type === 'added' || line.type === 'changed') &&
                            'text-green-600 bg-green-500/5'
                        )}
                      >
                        {line.newValue !== undefined
                          ? formatValue(line.newValue)
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
  );
}

function computeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): DiffLine[] {
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const lines: DiffLine[] = [];

  for (const key of allKeys) {
    const oldValue = before[key];
    const newValue = after[key];

    if (!(key in before)) {
      lines.push({ key, type: 'added', newValue });
    } else if (!(key in after)) {
      lines.push({ key, type: 'removed', oldValue });
    } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      lines.push({ key, type: 'changed', oldValue, newValue });
    } else {
      lines.push({ key, type: 'unchanged', oldValue, newValue });
    }
  }

  // Sort: changed first, then added, then removed, then unchanged
  const order = { changed: 0, added: 1, removed: 2, unchanged: 3 };
  return lines.sort((a, b) => order[a.type] - order[b.type]);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value.length > 50 ? `${value.slice(0, 50)}...` : value;
  if (typeof value === 'object') {
    const str = JSON.stringify(value);
    return str.length > 100 ? `${str.slice(0, 100)}...` : str;
  }
  return String(value);
}
