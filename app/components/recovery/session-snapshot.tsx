'use client';

import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Clock, FileText, Terminal, GitBranch, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/forms/code-block';

export interface SessionSnapshotProps {
  /** Session start time */
  startTime: Date;
  /** Last activity time */
  lastActivityTime: Date;
  /** Working directory */
  workingDirectory: string;
  /** Git branch (if available) */
  gitBranch?: string;
  /** Number of prompts in session */
  promptCount: number;
  /** Last prompt text (truncated) */
  lastPrompt: string;
  /** Terminal/IDE context */
  context?: string;
  /** Additional class names */
  className?: string;
}

export function SessionSnapshot({
  startTime,
  lastActivityTime,
  workingDirectory,
  gitBranch,
  promptCount,
  lastPrompt,
  context,
  className,
}: SessionSnapshotProps) {
  const duration = Math.round((lastActivityTime.getTime() - startTime.getTime()) / 60000);

  return (
    <div
      className={cn('rounded-lg border border-border bg-card', className)}
      data-testid="session-snapshot"
    >
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Session Snapshot</h3>
          <Badge variant="outline" className="text-info border-info/30">
            {duration} min session
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Where you left off
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Time info */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Started</p>
              <p className="text-sm text-foreground">
                {format(startTime, 'MMM d, yyyy HH:mm')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Last Activity</p>
              <p className="text-sm text-foreground">
                {format(lastActivityTime, 'MMM d, yyyy HH:mm')}
              </p>
            </div>
          </div>
        </div>

        {/* Context info */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Terminal className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Working Directory</p>
              <p className="text-sm text-foreground truncate">{workingDirectory}</p>
            </div>
          </div>

          {gitBranch && (
            <div className="flex items-center gap-3">
              <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Git Branch</p>
                <p className="text-sm text-foreground">{gitBranch}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Prompts Captured</p>
              <p className="text-sm text-foreground">{promptCount}</p>
            </div>
          </div>
        </div>

        {/* Last prompt */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Last Prompt</p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-sm text-foreground line-clamp-3">{lastPrompt}</p>
          </div>
        </div>

        {/* Optional context */}
        {context && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Context</p>
            <CodeBlock
              code={context}
              language="bash"
              copyable={false}
              maxHeight={100}
            />
          </div>
        )}
      </div>
    </div>
  );
}
