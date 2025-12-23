'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  Clock,
  MessageSquare,
  Copy,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FileText,
  Layers,
} from 'lucide-react';
import { format } from 'date-fns';

export type SessionDuplicateStatus = 'new' | 'duplicate' | 'partial';

export interface SessionPromptSample {
  id: string;
  text: string;
  timestamp: Date;
}

export interface SessionPreview {
  /** Unique session identifier */
  id: string;
  /** Session name or first prompt text */
  title: string;
  /** When session started */
  startTime: Date;
  /** When session ended */
  endTime?: Date;
  /** Session duration in minutes */
  durationMinutes: number;
  /** Number of prompts in session */
  promptCount: number;
  /** Sample prompts (first few) */
  samplePrompts: SessionPromptSample[];
  /** Whether this session already exists in the database */
  duplicateStatus: SessionDuplicateStatus;
  /** Number of new prompts (if partial duplicate) */
  newPromptCount?: number;
  /** Project name if detected */
  projectName?: string;
}

export interface ConflictResolution {
  /** How to handle duplicates */
  duplicateAction: 'skip' | 'overwrite' | 'merge';
}

export interface ImportPreviewProps {
  /** Sessions to preview */
  sessions: SessionPreview[];
  /** Selected session IDs */
  selectedIds: string[];
  /** Handler when selection changes */
  onSelectionChange: (ids: string[]) => void;
  /** Available projects to assign to */
  availableProjects?: { id: string; name: string }[];
  /** Currently selected project for import */
  selectedProjectId?: string;
  /** Handler when project changes */
  onProjectChange?: (projectId: string) => void;
  /** Conflict resolution settings */
  conflictResolution?: ConflictResolution;
  /** Handler when conflict resolution changes */
  onConflictResolutionChange?: (resolution: ConflictResolution) => void;
  /** Additional class names */
  className?: string;
}

const duplicateStatusConfig: Record<
  SessionDuplicateStatus,
  { icon: React.ElementType; color: string; bgColor: string; label: string }
> = {
  new: {
    icon: FileText,
    color: 'text-info',
    bgColor: 'bg-info/10',
    label: 'New',
  },
  duplicate: {
    icon: Copy,
    color: 'text-score-medium',
    bgColor: 'bg-score-medium/10',
    label: 'Already imported',
  },
  partial: {
    icon: Layers,
    color: 'text-score-growth',
    bgColor: 'bg-score-growth/10',
    label: 'Partial match',
  },
};

interface SessionCardProps {
  session: SessionPreview;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}

function SessionCard({
  session,
  selected,
  onSelect,
  expanded,
  onToggleExpand,
}: SessionCardProps) {
  const statusConfig = duplicateStatusConfig[session.duplicateStatus];
  const StatusIcon = statusConfig.icon;

  return (
    <div
      className={cn(
        'border border-border rounded-lg overflow-hidden transition-all',
        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )}
      data-testid={`session-card-${session.id}`}
    >
      <div
        className={cn(
          'flex items-start gap-3 p-4 transition-colors',
          selected && 'bg-primary/5'
        )}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={onSelect}
          className="mt-1"
          aria-label={`Select session ${session.title}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="text-sm font-medium text-foreground truncate">
                {session.title}
              </h4>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(session.startTime, 'MMM d, yyyy')}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {session.durationMinutes} min
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {session.promptCount} prompts
                </span>
              </div>
            </div>
            <div
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium shrink-0',
                statusConfig.bgColor,
                statusConfig.color
              )}
            >
              <StatusIcon className="h-3 w-3" />
              {statusConfig.label}
              {session.duplicateStatus === 'partial' && session.newPromptCount && (
                <span className="text-foreground">+{session.newPromptCount} new</span>
              )}
            </div>
          </div>
          {session.projectName && (
            <div className="mt-2 text-xs text-muted-foreground">
              Project: <span className="text-foreground">{session.projectName}</span>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleExpand}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-border bg-surface/50 p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Sample Prompts
          </p>
          <div className="space-y-2">
            {session.samplePrompts.map((prompt, idx) => (
              <div
                key={prompt.id}
                className="p-3 bg-background rounded-md border border-border"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">
                    {format(prompt.timestamp, 'h:mm a')}
                  </span>
                  <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                </div>
                <p className="text-sm text-foreground line-clamp-2">{prompt.text}</p>
              </div>
            ))}
          </div>
          {session.promptCount > session.samplePrompts.length && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              +{session.promptCount - session.samplePrompts.length} more prompts
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function ImportPreview({
  sessions,
  selectedIds,
  onSelectionChange,
  availableProjects,
  selectedProjectId,
  onProjectChange,
  conflictResolution,
  onConflictResolutionChange,
  className,
}: ImportPreviewProps) {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelect = (id: string, selected: boolean) => {
    if (selected) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    }
  };

  const handleSelectAll = () => {
    const newSessions = sessions.filter((s) => s.duplicateStatus !== 'duplicate');
    if (selectedIds.length === newSessions.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(newSessions.map((s) => s.id));
    }
  };

  const newSessions = sessions.filter((s) => s.duplicateStatus === 'new');
  const duplicateSessions = sessions.filter((s) => s.duplicateStatus === 'duplicate');
  const partialSessions = sessions.filter((s) => s.duplicateStatus === 'partial');

  const totalPrompts = sessions
    .filter((s) => selectedIds.includes(s.id))
    .reduce((sum, s) => {
      if (s.duplicateStatus === 'partial') {
        return sum + (s.newPromptCount || 0);
      }
      return sum + s.promptCount;
    }, 0);

  return (
    <div className={cn('space-y-4', className)} data-testid="import-preview">
      {/* Summary Bar */}
      <div className="flex items-center justify-between p-4 bg-surface rounded-lg border border-border">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{sessions.length}</p>
            <p className="text-xs text-muted-foreground">Sessions</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-info">
              <CheckCircle className="h-4 w-4" />
              {newSessions.length} new
            </span>
            <span className="flex items-center gap-1.5 text-score-medium">
              <Copy className="h-4 w-4" />
              {duplicateSessions.length} duplicates
            </span>
            {partialSessions.length > 0 && (
              <span className="flex items-center gap-1.5 text-score-growth">
                <Layers className="h-4 w-4" />
                {partialSessions.length} partial
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-foreground">
            {selectedIds.length} sessions selected
          </p>
          <p className="text-xs text-muted-foreground">{totalPrompts} prompts to import</p>
        </div>
      </div>

      {/* Settings Row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={
              selectedIds.length > 0 &&
              selectedIds.length === sessions.filter((s) => s.duplicateStatus !== 'duplicate').length
            }
            onCheckedChange={handleSelectAll}
            aria-label="Select all new sessions"
          />
          <span className="text-sm text-muted-foreground">Select all new sessions</span>
        </div>

        <div className="flex items-center gap-4">
          {availableProjects && availableProjects.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Assign to:</span>
              <Select value={selectedProjectId} onValueChange={onProjectChange}>
                <SelectTrigger className="w-[180px]" data-testid="project-select">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {availableProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {duplicateSessions.length > 0 && onConflictResolutionChange && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Duplicates:</span>
              <Select
                value={conflictResolution?.duplicateAction || 'skip'}
                onValueChange={(value) =>
                  onConflictResolutionChange({
                    ...conflictResolution,
                    duplicateAction: value as 'skip' | 'overwrite' | 'merge',
                  })
                }
              >
                <SelectTrigger className="w-[140px]" data-testid="conflict-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Skip</SelectItem>
                  <SelectItem value="overwrite">Overwrite</SelectItem>
                  <SelectItem value="merge">Merge</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Duplicate Warning */}
      {duplicateSessions.length > 0 &&
        conflictResolution?.duplicateAction !== 'skip' && (
          <div className="flex items-start gap-3 p-3 bg-score-medium/10 border border-score-medium/20 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-score-medium shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {conflictResolution?.duplicateAction === 'overwrite'
                  ? 'Existing data will be replaced'
                  : 'New prompts will be added to existing sessions'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {duplicateSessions.length} session(s) will be affected
              </p>
            </div>
          </div>
        )}

      {/* Session List */}
      <div className="space-y-3">
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            selected={selectedIds.includes(session.id)}
            onSelect={(selected) => handleSelect(session.id, selected)}
            expanded={expandedIds.includes(session.id)}
            onToggleExpand={() => toggleExpand(session.id)}
          />
        ))}
      </div>
    </div>
  );
}
