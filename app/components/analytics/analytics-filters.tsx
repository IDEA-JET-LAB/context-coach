'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Calendar,
  ChevronDown,
  Download,
  Share2,
  Camera,
  FileText,
  FileSpreadsheet,
  Filter,
  X,
  Check,
  Users,
  FolderKanban,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';

export type TimeRange =
  | 'today'
  | '7d'
  | '30d'
  | '90d'
  | 'this_month'
  | 'last_month'
  | 'custom'
  | 'all';

export type ExportFormat = 'csv' | 'pdf' | 'json';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface FilterOption {
  id: string;
  label: string;
  count?: number;
}

export interface AnalyticsFiltersProps {
  /** Selected time range */
  timeRange: TimeRange;
  /** Time range change handler */
  onTimeRangeChange: (range: TimeRange) => void;
  /** Custom date range */
  customRange?: DateRange;
  /** Custom range change handler */
  onCustomRangeChange?: (range: DateRange) => void;
  /** Available projects */
  projects?: FilterOption[];
  /** Selected project IDs */
  selectedProjects?: string[];
  /** Project selection handler */
  onProjectsChange?: (projectIds: string[]) => void;
  /** Available users (for team view) */
  users?: FilterOption[];
  /** Selected user IDs */
  selectedUsers?: string[];
  /** User selection handler */
  onUsersChange?: (userIds: string[]) => void;
  /** Export handler */
  onExport?: (format: ExportFormat) => void;
  /** Share/screenshot handler */
  onShare?: () => void;
  /** Refresh handler */
  onRefresh?: () => void;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Show user filter (team admins only) */
  showUserFilter?: boolean;
  /** Additional class names */
  className?: string;
}

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
];

const EXPORT_OPTIONS: { value: ExportFormat; label: string; icon: typeof FileText }[] = [
  { value: 'csv', label: 'Export as CSV', icon: FileSpreadsheet },
  { value: 'pdf', label: 'Export as PDF', icon: FileText },
  { value: 'json', label: 'Export as JSON', icon: FileText },
];

export function AnalyticsFilters({
  timeRange,
  onTimeRangeChange,
  customRange,
  onCustomRangeChange,
  projects = [],
  selectedProjects = [],
  onProjectsChange,
  users = [],
  selectedUsers = [],
  onUsersChange,
  onExport,
  onShare,
  onRefresh,
  isLoading = false,
  showUserFilter = false,
  className,
}: AnalyticsFiltersProps) {
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  // Close all dropdowns
  const closeAllDropdowns = useCallback(() => {
    setShowTimeDropdown(false);
    setShowProjectDropdown(false);
    setShowUserDropdown(false);
    setShowExportDropdown(false);
    setShowCustomDatePicker(false);
  }, []);

  // Handle time range selection
  const handleTimeRangeSelect = (range: TimeRange) => {
    if (range === 'custom') {
      setShowCustomDatePicker(true);
      setShowTimeDropdown(false);
    } else {
      onTimeRangeChange(range);
      closeAllDropdowns();
    }
  };

  // Get display label for time range
  const getTimeRangeLabel = (): string => {
    if (timeRange === 'custom' && customRange) {
      return `${format(customRange.start, 'MMM d')} - ${format(customRange.end, 'MMM d')}`;
    }
    return TIME_RANGE_OPTIONS.find((o) => o.value === timeRange)?.label || 'Select';
  };

  // Toggle project selection
  const toggleProject = (projectId: string) => {
    if (!onProjectsChange) return;
    const newSelection = selectedProjects.includes(projectId)
      ? selectedProjects.filter((id) => id !== projectId)
      : [...selectedProjects, projectId];
    onProjectsChange(newSelection);
  };

  // Toggle user selection
  const toggleUser = (userId: string) => {
    if (!onUsersChange) return;
    const newSelection = selectedUsers.includes(userId)
      ? selectedUsers.filter((id) => id !== userId)
      : [...selectedUsers, userId];
    onUsersChange(newSelection);
  };

  // Count active filters
  const activeFilterCount =
    (selectedProjects.length > 0 ? 1 : 0) + (selectedUsers.length > 0 ? 1 : 0);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 p-3 rounded-lg bg-card border border-border',
        className
      )}
      data-testid="analytics-filters"
    >
      {/* Time Range Selector */}
      <div className="relative">
        <button
          onClick={() => {
            setShowTimeDropdown(!showTimeDropdown);
            setShowProjectDropdown(false);
            setShowUserDropdown(false);
            setShowExportDropdown(false);
          }}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background',
            'text-sm text-foreground hover:bg-muted transition-colors',
            showTimeDropdown && 'ring-2 ring-primary/20'
          )}
          data-testid="time-range-button"
        >
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>{getTimeRangeLabel()}</span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              showTimeDropdown && 'rotate-180'
            )}
          />
        </button>

        {showTimeDropdown && (
          <div
            className="absolute top-full left-0 mt-1 w-48 py-1 rounded-md border border-border bg-card shadow-lg z-50"
            data-testid="time-range-dropdown"
          >
            {TIME_RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleTimeRangeSelect(option.value)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 text-sm text-left',
                  'hover:bg-muted transition-colors',
                  timeRange === option.value && 'text-primary font-medium'
                )}
              >
                <span>{option.label}</span>
                {timeRange === option.value && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Project Filter */}
      {projects.length > 0 && (
        <div className="relative">
          <button
            onClick={() => {
              setShowProjectDropdown(!showProjectDropdown);
              setShowTimeDropdown(false);
              setShowUserDropdown(false);
              setShowExportDropdown(false);
            }}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background',
              'text-sm text-foreground hover:bg-muted transition-colors',
              showProjectDropdown && 'ring-2 ring-primary/20',
              selectedProjects.length > 0 && 'border-primary/50'
            )}
            data-testid="project-filter-button"
          >
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
            <span>
              {selectedProjects.length === 0
                ? 'All Projects'
                : selectedProjects.length === 1
                  ? projects.find((p) => p.id === selectedProjects[0])?.label || '1 project'
                  : `${selectedProjects.length} projects`}
            </span>
            {selectedProjects.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onProjectsChange?.([]);
                }}
                className="ml-1 p-0.5 rounded hover:bg-muted"
                aria-label="Clear project filter"
              >
                <X className="h-3 w-3" />
              </button>
            )}
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                showProjectDropdown && 'rotate-180'
              )}
            />
          </button>

          {showProjectDropdown && (
            <div
              className="absolute top-full left-0 mt-1 w-56 py-1 rounded-md border border-border bg-card shadow-lg z-50 max-h-64 overflow-y-auto"
              data-testid="project-filter-dropdown"
            >
              <button
                onClick={() => {
                  onProjectsChange?.([]);
                  setShowProjectDropdown(false);
                }}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 text-sm text-left',
                  'hover:bg-muted transition-colors',
                  selectedProjects.length === 0 && 'text-primary font-medium'
                )}
              >
                <span>All Projects</span>
                {selectedProjects.length === 0 && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
              <div className="h-px bg-border my-1" />
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => toggleProject(project.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 text-sm text-left',
                    'hover:bg-muted transition-colors'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center',
                        selectedProjects.includes(project.id)
                          ? 'bg-primary border-primary'
                          : 'border-border'
                      )}
                    >
                      {selectedProjects.includes(project.id) && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <span className="truncate">{project.label}</span>
                  </div>
                  {project.count !== undefined && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {project.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* User Filter (Team Admins) */}
      {showUserFilter && users.length > 0 && (
        <div className="relative">
          <button
            onClick={() => {
              setShowUserDropdown(!showUserDropdown);
              setShowTimeDropdown(false);
              setShowProjectDropdown(false);
              setShowExportDropdown(false);
            }}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background',
              'text-sm text-foreground hover:bg-muted transition-colors',
              showUserDropdown && 'ring-2 ring-primary/20',
              selectedUsers.length > 0 && 'border-primary/50'
            )}
            data-testid="user-filter-button"
          >
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>
              {selectedUsers.length === 0
                ? 'All Members'
                : selectedUsers.length === 1
                  ? users.find((u) => u.id === selectedUsers[0])?.label || '1 member'
                  : `${selectedUsers.length} members`}
            </span>
            {selectedUsers.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUsersChange?.([]);
                }}
                className="ml-1 p-0.5 rounded hover:bg-muted"
                aria-label="Clear user filter"
              >
                <X className="h-3 w-3" />
              </button>
            )}
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                showUserDropdown && 'rotate-180'
              )}
            />
          </button>

          {showUserDropdown && (
            <div
              className="absolute top-full left-0 mt-1 w-56 py-1 rounded-md border border-border bg-card shadow-lg z-50 max-h-64 overflow-y-auto"
              data-testid="user-filter-dropdown"
            >
              <button
                onClick={() => {
                  onUsersChange?.([]);
                  setShowUserDropdown(false);
                }}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 text-sm text-left',
                  'hover:bg-muted transition-colors',
                  selectedUsers.length === 0 && 'text-primary font-medium'
                )}
              >
                <span>All Members</span>
                {selectedUsers.length === 0 && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
              <div className="h-px bg-border my-1" />
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => toggleUser(user.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 text-sm text-left',
                    'hover:bg-muted transition-colors'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center',
                        selectedUsers.includes(user.id)
                          ? 'bg-primary border-primary'
                          : 'border-border'
                      )}
                    >
                      {selectedUsers.includes(user.id) && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <span className="truncate">{user.label}</span>
                  </div>
                  {user.count !== undefined && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {user.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Filters Badge */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">
          <Filter className="h-3 w-3" />
          <span>{activeFilterCount} filter(s)</span>
          <button
            onClick={() => {
              onProjectsChange?.([]);
              onUsersChange?.([]);
            }}
            className="ml-1 p-0.5 rounded hover:bg-primary/20"
            aria-label="Clear all filters"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action Buttons */}
      <div className="flex items-center gap-1">
        {/* Refresh */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className={cn(
              'p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
              isLoading && 'animate-spin'
            )}
            aria-label="Refresh data"
            data-testid="refresh-button"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}

        {/* Share/Screenshot */}
        {onShare && (
          <button
            onClick={onShare}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Share or screenshot"
            data-testid="share-button"
          >
            <Camera className="h-4 w-4" />
          </button>
        )}

        {/* Export Dropdown */}
        {onExport && (
          <div className="relative">
            <button
              onClick={() => {
                setShowExportDropdown(!showExportDropdown);
                setShowTimeDropdown(false);
                setShowProjectDropdown(false);
                setShowUserDropdown(false);
              }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-md',
                'text-sm text-foreground bg-primary hover:bg-primary/90 transition-colors'
              )}
              data-testid="export-button"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
              <ChevronDown
                className={cn(
                  'h-3 w-3 transition-transform',
                  showExportDropdown && 'rotate-180'
                )}
              />
            </button>

            {showExportDropdown && (
              <div
                className="absolute top-full right-0 mt-1 w-48 py-1 rounded-md border border-border bg-card shadow-lg z-50"
                data-testid="export-dropdown"
              >
                {EXPORT_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={() => {
                        onExport(option.value);
                        setShowExportDropdown(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted transition-colors"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom Date Picker Modal */}
      {showCustomDatePicker && (
        <CustomDatePickerModal
          currentRange={customRange}
          onSelect={(range) => {
            onCustomRangeChange?.(range);
            onTimeRangeChange('custom');
            setShowCustomDatePicker(false);
          }}
          onClose={() => setShowCustomDatePicker(false)}
        />
      )}

      {/* Click outside handler */}
      {(showTimeDropdown || showProjectDropdown || showUserDropdown || showExportDropdown) && (
        <div
          className="fixed inset-0 z-40"
          onClick={closeAllDropdowns}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/**
 * Custom date picker modal
 */
interface CustomDatePickerModalProps {
  currentRange?: DateRange;
  onSelect: (range: DateRange) => void;
  onClose: () => void;
}

function CustomDatePickerModal({
  currentRange,
  onSelect,
  onClose,
}: CustomDatePickerModalProps) {
  const [startDate, setStartDate] = useState(
    currentRange?.start ? format(currentRange.start, 'yyyy-MM-dd') : ''
  );
  const [endDate, setEndDate] = useState(
    currentRange?.end ? format(currentRange.end, 'yyyy-MM-dd') : ''
  );

  const handleSubmit = () => {
    if (startDate && endDate) {
      onSelect({
        start: new Date(startDate),
        end: new Date(endDate),
      });
    }
  };

  // Quick select options
  const quickOptions = [
    {
      label: 'Last 14 days',
      range: { start: subDays(new Date(), 14), end: new Date() },
    },
    {
      label: 'Last 60 days',
      range: { start: subDays(new Date(), 60), end: new Date() },
    },
    {
      label: 'This month',
      range: { start: startOfMonth(new Date()), end: new Date() },
    },
    {
      label: 'Last month',
      range: {
        start: startOfMonth(subMonths(new Date(), 1)),
        end: endOfMonth(subMonths(new Date(), 1)),
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md p-4 rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-foreground">
            Select Date Range
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Quick Select */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {quickOptions.map((option) => (
            <button
              key={option.label}
              onClick={() => {
                setStartDate(format(option.range.start, 'yyyy-MM-dd'));
                setEndDate(format(option.range.end, 'yyyy-MM-dd'));
              }}
              className="px-3 py-2 text-sm rounded-md border border-border hover:bg-muted transition-colors text-left"
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Date Inputs */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!startDate || !endDate}
            className={cn(
              'px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground',
              'hover:bg-primary/90 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact filter badge for displaying active filters
 */
export function FilterBadge({
  label,
  onRemove,
  className,
}: {
  label: string;
  onRemove: () => void;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs text-foreground',
        className
      )}
      data-testid="filter-badge"
    >
      <span>{label}</span>
      <button
        onClick={onRemove}
        className="p-0.5 rounded hover:bg-muted-foreground/20"
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
