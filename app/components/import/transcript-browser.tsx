'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Folder,
  FolderOpen,
  FileJson,
  ChevronRight,
  ChevronDown,
  Search,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  HardDrive,
} from 'lucide-react';
import { format } from 'date-fns';

export type TranscriptStatus = 'new' | 'imported' | 'error' | 'partial';

export interface TranscriptFile {
  /** Unique identifier */
  id: string;
  /** File name */
  name: string;
  /** Full file path */
  path: string;
  /** File size in bytes */
  size: number;
  /** Last modified date */
  modifiedAt: Date;
  /** Number of sessions in the file */
  sessionCount: number;
  /** Number of prompts in the file */
  promptCount: number;
  /** Import status */
  status: TranscriptStatus;
  /** Error message if status is error */
  errorMessage?: string;
}

export interface TranscriptFolder {
  /** Unique identifier */
  id: string;
  /** Folder name */
  name: string;
  /** Full path */
  path: string;
  /** Child folders */
  folders: TranscriptFolder[];
  /** Files in this folder */
  files: TranscriptFile[];
  /** Whether folder is expanded */
  expanded?: boolean;
}

export interface TranscriptBrowserProps {
  /** Root folders to display */
  folders: TranscriptFolder[];
  /** Currently selected file IDs */
  selectedIds: string[];
  /** Handler when selection changes */
  onSelectionChange: (ids: string[]) => void;
  /** Handler to expand/collapse folder */
  onToggleFolder?: (folderId: string) => void;
  /** Handler to refresh file list */
  onRefresh?: () => void;
  /** Whether browser is loading */
  loading?: boolean;
  /** Error message */
  error?: string;
  /** Additional class names */
  className?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const statusConfig: Record<
  TranscriptStatus,
  { icon: React.ElementType; color: string; label: string }
> = {
  new: {
    icon: FileJson,
    color: 'text-info',
    label: 'New',
  },
  imported: {
    icon: CheckCircle,
    color: 'text-score-high',
    label: 'Imported',
  },
  error: {
    icon: AlertCircle,
    color: 'text-destructive',
    label: 'Error',
  },
  partial: {
    icon: Clock,
    color: 'text-score-medium',
    label: 'Partial',
  },
};

interface FileRowProps {
  file: TranscriptFile;
  selected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  depth: number;
}

function FileRow({ file, selected, onSelect, depth }: FileRowProps) {
  const config = statusConfig[file.status];
  const StatusIcon = config.icon;

  return (
    <div
      className={cn(
        'group flex items-center gap-3 py-2 px-3 rounded-md transition-colors hover:bg-surface-hover',
        selected && 'bg-primary/5'
      )}
      style={{ paddingLeft: `${depth * 24 + 12}px` }}
      data-testid={`file-row-${file.id}`}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={(checked) => onSelect(file.id, checked === true)}
        aria-label={`Select ${file.name}`}
      />
      <StatusIcon className={cn('h-4 w-4 shrink-0', config.color)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">
            {file.name}
          </span>
          {file.status !== 'new' && (
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded-full',
                file.status === 'imported' && 'bg-score-high/10 text-score-high',
                file.status === 'error' && 'bg-destructive/10 text-destructive',
                file.status === 'partial' && 'bg-score-medium/10 text-score-medium'
              )}
            >
              {config.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 mt-0.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(file.modifiedAt, 'MMM d, yyyy')}
          </span>
          <span>{file.sessionCount} sessions</span>
          <span>{file.promptCount} prompts</span>
          <span>{formatFileSize(file.size)}</span>
        </div>
      </div>
    </div>
  );
}

interface FolderRowProps {
  folder: TranscriptFolder;
  selectedIds: string[];
  onSelect: (id: string, selected: boolean) => void;
  onSelectAll: (ids: string[], selected: boolean) => void;
  onToggle: () => void;
  depth: number;
}

function FolderRow({
  folder,
  selectedIds,
  onSelect,
  onSelectAll,
  onToggle,
  depth,
}: FolderRowProps) {
  const allFileIds = useMemo(() => {
    const collectIds = (f: TranscriptFolder): string[] => {
      const ids = f.files.map((file) => file.id);
      f.folders.forEach((sub) => ids.push(...collectIds(sub)));
      return ids;
    };
    return collectIds(folder);
  }, [folder]);

  const selectedCount = allFileIds.filter((id) => selectedIds.includes(id)).length;
  const allSelected = selectedCount === allFileIds.length && allFileIds.length > 0;
  const someSelected = selectedCount > 0 && selectedCount < allFileIds.length;

  return (
    <>
      <div
        className={cn(
          'group flex items-center gap-3 py-2 px-3 rounded-md transition-colors hover:bg-surface-hover cursor-pointer'
        )}
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
        data-testid={`folder-row-${folder.id}`}
      >
        <Checkbox
          checked={allSelected}
          data-state={someSelected ? 'indeterminate' : allSelected ? 'checked' : 'unchecked'}
          onCheckedChange={(checked) => onSelectAll(allFileIds, checked === true)}
          aria-label={`Select all in ${folder.name}`}
        />
        <button
          onClick={onToggle}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          {folder.expanded ? (
            <>
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              <FolderOpen className="h-4 w-4 text-score-medium shrink-0" />
            </>
          ) : (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <Folder className="h-4 w-4 text-score-medium shrink-0" />
            </>
          )}
          <span className="text-sm font-medium text-foreground truncate">
            {folder.name}
          </span>
          <span className="text-xs text-muted-foreground ml-auto shrink-0">
            {allFileIds.length} files
          </span>
        </button>
      </div>
      {folder.expanded && (
        <>
          {folder.folders.map((subFolder) => (
            <FolderRow
              key={subFolder.id}
              folder={subFolder}
              selectedIds={selectedIds}
              onSelect={onSelect}
              onSelectAll={onSelectAll}
              onToggle={onToggle}
              depth={depth + 1}
            />
          ))}
          {folder.files.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              selected={selectedIds.includes(file.id)}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </>
      )}
    </>
  );
}

export function TranscriptBrowser({
  folders,
  selectedIds,
  onSelectionChange,
  onToggleFolder,
  onRefresh,
  loading = false,
  error,
  className,
}: TranscriptBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<TranscriptStatus | 'all'>('all');

  const allFiles = useMemo(() => {
    const collectFiles = (folder: TranscriptFolder): TranscriptFile[] => {
      const files = [...folder.files];
      folder.folders.forEach((sub) => files.push(...collectFiles(sub)));
      return files;
    };
    return folders.flatMap(collectFiles);
  }, [folders]);

  const filteredFiles = useMemo(() => {
    return allFiles.filter((file) => {
      if (filterStatus !== 'all' && file.status !== filterStatus) return false;
      if (searchQuery && !file.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [allFiles, filterStatus, searchQuery]);

  const handleSelect = (id: string, selected: boolean) => {
    if (selected) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    }
  };

  const handleSelectAll = (ids: string[], selected: boolean) => {
    if (selected) {
      const newIds = [...new Set([...selectedIds, ...ids])];
      onSelectionChange(newIds);
    } else {
      onSelectionChange(selectedIds.filter((id) => !ids.includes(id)));
    }
  };

  const handleSelectAllVisible = () => {
    const visibleIds = filteredFiles.map((f) => f.id);
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      onSelectionChange(selectedIds.filter((id) => !visibleIds.includes(id)));
    } else {
      onSelectionChange([...new Set([...selectedIds, ...visibleIds])]);
    }
  };

  if (loading) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12 text-center',
          className
        )}
        data-testid="transcript-browser-loading"
      >
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-sm font-medium text-foreground">Scanning for transcripts...</p>
        <p className="text-xs text-muted-foreground mt-1">
          This may take a moment for large directories
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12 text-center',
          className
        )}
        data-testid="transcript-browser-error"
      >
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <p className="text-sm font-medium text-foreground">Failed to scan transcripts</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">{error}</p>
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
      </div>
    );
  }

  if (folders.length === 0 || allFiles.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12 text-center',
          className
        )}
        data-testid="transcript-browser-empty"
      >
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <HardDrive className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">No transcripts found</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Claude Code transcripts are typically located in ~/.claude/projects/
        </p>
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Rescan
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-4', className)} data-testid="transcript-browser">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search transcripts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="transcript-search"
          />
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'new', 'imported', 'partial'] as const).map((status) => (
            <Button
              key={status}
              variant={filterStatus === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus(status)}
              data-testid={`filter-${status}`}
            >
              {status === 'all' ? 'All' : statusConfig[status].label}
            </Button>
          ))}
        </div>
        {onRefresh && (
          <Button variant="ghost" size="icon" onClick={onRefresh} data-testid="refresh-button">
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Selection Info */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface rounded-lg">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={
              filteredFiles.length > 0 &&
              filteredFiles.every((f) => selectedIds.includes(f.id))
            }
            onCheckedChange={handleSelectAllVisible}
            aria-label="Select all visible"
          />
          <span className="text-sm text-muted-foreground">
            {selectedIds.length} of {filteredFiles.length} selected
          </span>
        </div>
        {selectedIds.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectionChange([])}
            data-testid="clear-selection"
          >
            Clear selection
          </Button>
        )}
      </div>

      {/* File Tree */}
      <div className="border border-border rounded-lg overflow-hidden bg-background">
        <div className="max-h-[400px] overflow-y-auto">
          {searchQuery || filterStatus !== 'all' ? (
            // Flat list when filtering
            <div className="divide-y divide-border">
              {filteredFiles.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  selected={selectedIds.includes(file.id)}
                  onSelect={handleSelect}
                  depth={0}
                />
              ))}
            </div>
          ) : (
            // Tree view
            <div className="divide-y divide-border">
              {folders.map((folder) => (
                <FolderRow
                  key={folder.id}
                  folder={folder}
                  selectedIds={selectedIds}
                  onSelect={handleSelect}
                  onSelectAll={handleSelectAll}
                  onToggle={() => onToggleFolder?.(folder.id)}
                  depth={0}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
