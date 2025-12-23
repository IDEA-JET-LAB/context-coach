'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  MessageSquare,
  FolderGit2,
  GitBranch,
  Terminal,
  FileText,
  Sparkles,
  RotateCcw,
  Copy,
  Check,
  ChevronRight,
  Loader2,
  AlertCircle,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import type { InterruptedSession } from './recovery-banner';

export interface RecoveryPromptItem {
  /** Prompt identifier */
  id: string;
  /** Prompt text */
  text: string;
  /** When the prompt was submitted */
  timestamp: Date;
  /** AI response preview (if available) */
  responsePreview?: string;
}

export interface RecoveryContext {
  /** Working directory */
  workingDirectory: string;
  /** Git branch */
  gitBranch?: string;
  /** Open files */
  openFiles?: string[];
  /** Recent commands */
  recentCommands?: string[];
  /** Environment variables (sanitized) */
  environment?: Record<string, string>;
}

export interface RecoveryOption {
  /** Option identifier */
  id: string;
  /** Option label */
  label: string;
  /** Option description */
  description: string;
  /** Generated recovery prompt */
  prompt: string;
}

export interface RecoveryDetailProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Handler when open state changes */
  onOpenChange: (open: boolean) => void;
  /** The interrupted session */
  session: InterruptedSession;
  /** Session prompts (last few) */
  prompts: RecoveryPromptItem[];
  /** Session context */
  context?: RecoveryContext;
  /** Recovery options */
  options?: RecoveryOption[];
  /** Handler when recovery starts */
  onRecover: (optionId: string, prompt: string) => void;
  /** Whether recovery is in progress */
  recovering?: boolean;
  /** Error message */
  error?: string;
  /** Additional class names */
  className?: string;
}

function PromptCard({
  prompt,
  isLast,
}: {
  prompt: RecoveryPromptItem;
  isLast?: boolean;
}) {
  return (
    <div
      className={cn(
        'p-4 rounded-lg border border-border bg-background',
        isLast && 'ring-2 ring-info/30'
      )}
      data-testid={`prompt-card-${prompt.id}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">
          {format(prompt.timestamp, 'h:mm:ss a')}
        </span>
        {isLast && (
          <Badge variant="outline" className="text-info border-info/30 text-xs">
            Last prompt
          </Badge>
        )}
      </div>
      <p className="text-sm text-foreground">{prompt.text}</p>
      {prompt.responsePreview && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground mb-1">AI Response:</p>
          <p className="text-sm text-muted-foreground line-clamp-3">
            {prompt.responsePreview}
          </p>
        </div>
      )}
    </div>
  );
}

function RecoveryOptionCard({
  option,
  selected,
  onSelect,
}: {
  option: RecoveryOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(option.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        'p-4 rounded-lg border cursor-pointer transition-all',
        selected
          ? 'border-primary bg-primary/5 ring-2 ring-primary'
          : 'border-border hover:border-muted-foreground'
      )}
      onClick={onSelect}
      data-testid={`recovery-option-${option.id}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-sm font-medium text-foreground">{option.label}</h4>
          <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
        </div>
        <div
          className={cn(
            'h-5 w-5 rounded-full border-2 shrink-0 transition-colors',
            selected
              ? 'border-primary bg-primary'
              : 'border-muted-foreground bg-transparent'
          )}
        >
          {selected && <Check className="h-4 w-4 text-primary-foreground" />}
        </div>
      </div>

      {selected && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPrompt(!showPrompt);
              }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {showPrompt ? (
                <>
                  <Minimize2 className="h-3 w-3" />
                  Hide recovery prompt
                </>
              ) : (
                <>
                  <Maximize2 className="h-3 w-3" />
                  Preview recovery prompt
                </>
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy
                </>
              )}
            </button>
          </div>
          {showPrompt && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-xs text-foreground font-mono whitespace-pre-wrap">
                {option.prompt}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function RecoveryDetail({
  open,
  onOpenChange,
  session,
  prompts,
  context,
  options = [],
  onRecover,
  recovering = false,
  error,
  className,
}: RecoveryDetailProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(
    options.length > 0 ? (options[0]?.id ?? null) : null
  );
  const [activeTab, setActiveTab] = useState<'prompts' | 'context' | 'options'>('prompts');

  const handleRecover = () => {
    const option = options.find((o) => o.id === selectedOption);
    if (option) {
      onRecover(option.id, option.prompt);
    }
  };

  const defaultOptions: RecoveryOption[] = [
    {
      id: 'full',
      label: 'Full Context',
      description: 'Resume with complete session history and context',
      prompt: `I was working on a session that was interrupted. Here's my context:

Last prompt: "${session.lastPromptPreview || prompts[prompts.length - 1]?.text || ''}"

Please help me continue where I left off.`,
    },
    {
      id: 'summary',
      label: 'Summary Only',
      description: 'Resume with a brief summary of progress',
      prompt: `I need to resume a previous session. In brief: ${session.sessionName}. Help me continue.`,
    },
    {
      id: 'fresh',
      label: 'Fresh Start',
      description: 'Start a new conversation with minimal context',
      prompt: 'I would like to continue working on what I was doing before.',
    },
  ];

  const recoveryOptions = options.length > 0 ? options : defaultOptions;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn('max-w-2xl max-h-[85vh] overflow-hidden flex flex-col', className)}
        data-testid="recovery-detail-modal"
      >
        <DialogHeader className="pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-info/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-info" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                Resume Session
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {session.sessionName} - {formatDistanceToNow(session.interruptedAt, { addSuffix: true })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Session Summary */}
        <div className="py-4 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-6 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              {session.promptCount} prompts
            </span>
            {session.durationMinutes !== undefined && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" />
                {session.durationMinutes} min
              </span>
            )}
            {session.projectName && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <FolderGit2 className="h-4 w-4" />
                {session.projectName}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="prompts" className="gap-1">
              <MessageSquare className="h-4 w-4" />
              Prompts
            </TabsTrigger>
            <TabsTrigger value="context" className="gap-1" disabled={!context}>
              <Terminal className="h-4 w-4" />
              Context
            </TabsTrigger>
            <TabsTrigger value="options" className="gap-1">
              <RotateCcw className="h-4 w-4" />
              Options
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto py-4">
            <TabsContent value="prompts" className="mt-0 space-y-3">
              {prompts.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No prompts to display</p>
                </div>
              ) : (
                prompts.map((prompt, idx) => (
                  <PromptCard
                    key={prompt.id}
                    prompt={prompt}
                    isLast={idx === prompts.length - 1}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="context" className="mt-0 space-y-4">
              {context ? (
                <>
                  <div className="p-4 rounded-lg border border-border bg-background">
                    <div className="flex items-center gap-2 mb-2">
                      <Terminal className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">
                        Working Directory
                      </span>
                    </div>
                    <p className="text-sm text-foreground font-mono">
                      {context.workingDirectory}
                    </p>
                  </div>

                  {context.gitBranch && (
                    <div className="p-4 rounded-lg border border-border bg-background">
                      <div className="flex items-center gap-2 mb-2">
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">
                          Git Branch
                        </span>
                      </div>
                      <p className="text-sm text-foreground font-mono">
                        {context.gitBranch}
                      </p>
                    </div>
                  )}

                  {context.openFiles && context.openFiles.length > 0 && (
                    <div className="p-4 rounded-lg border border-border bg-background">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">
                          Open Files
                        </span>
                      </div>
                      <ul className="text-sm text-foreground font-mono space-y-1">
                        {context.openFiles.map((file, idx) => (
                          <li key={idx} className="truncate">
                            {file}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {context.recentCommands && context.recentCommands.length > 0 && (
                    <div className="p-4 rounded-lg border border-border bg-background">
                      <div className="flex items-center gap-2 mb-2">
                        <Terminal className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">
                          Recent Commands
                        </span>
                      </div>
                      <ul className="text-sm text-foreground font-mono space-y-1">
                        {context.recentCommands.map((cmd, idx) => (
                          <li key={idx} className="truncate">
                            $ {cmd}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <Terminal className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No context information available
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="options" className="mt-0 space-y-3">
              {recoveryOptions.map((option) => (
                <RecoveryOptionCard
                  key={option.id}
                  option={option}
                  selected={selectedOption === option.id}
                  onSelect={() => setSelectedOption(option.id)}
                />
              ))}
            </TabsContent>
          </div>
        </Tabs>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-4 border-t border-border flex items-center justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleRecover}
            disabled={recovering || !selectedOption}
            className="bg-info text-white hover:bg-info/90"
            data-testid="recovery-start-button"
          >
            {recovering ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Resuming...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-2" />
                Resume Session
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
