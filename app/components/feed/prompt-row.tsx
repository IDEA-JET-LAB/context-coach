'use client';

import { formatDistanceToNow } from 'date-fns';
import { Terminal, User } from 'lucide-react';
import { ScoreBadge } from './score-badge';
import { AnalysisStatus } from './analysis-status';
import { HighlightText } from '@/lib/utils/highlight-text';
import type { PromptWithAnalysis } from '@/lib/types/prompt';
import { TEXT_TRUNCATION } from '@/lib/constants/analytics';

interface PromptRowProps {
  prompt: PromptWithAnalysis;
  userName?: string;
  onClick?: () => void;
  searchTerm?: string;
}

/**
 * Extract command name from prompt text (e.g., "/dev" from "/dev help me")
 */
function extractCommand(text: string): string | null {
  const match = text.match(/^(\/[a-zA-Z][a-zA-Z0-9_:-]*)/);
  return match?.[1] ?? null;
}

export function PromptRow({ prompt, userName, onClick, searchTerm }: PromptRowProps) {
  const isCommand = prompt.prompt_type === 'command';
  const isCommandWithPrompt = prompt.prompt_type === 'command_with_prompt';
  const command = (isCommand || isCommandWithPrompt) ? extractCommand(prompt.text) : null;

  const truncatedText =
    prompt.text.length > TEXT_TRUNCATION.PROMPT_ROW
      ? prompt.text.slice(0, TEXT_TRUNCATION.PROMPT_ROW) + '...'
      : prompt.text;

  // Get first name or initials for the badge
  const displayName = userName ? userName.split(' ')[0] : null;

  return (
    <div
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors ${
        isCommand
          ? 'border-muted bg-surface hover:bg-card opacity-70'
          : 'border-border bg-card hover:bg-surface-hover'
      }`}
      data-testid="prompt-row"
      data-prompt-id={prompt.id}
      data-prompt-type={prompt.prompt_type}
    >
      {isCommand ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Terminal className="h-5 w-5 text-muted-foreground" />
        </div>
      ) : (
        <ScoreBadge
          score={prompt.analysis?.overall_score}
          status={prompt.analysis_status}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {command && (
            <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
              {command}
            </span>
          )}
          {isCommand && (
            <span className="text-xs text-muted-foreground">Command</span>
          )}
        </div>
        <p className={`text-sm line-clamp-2 ${isCommand ? 'text-muted-foreground' : 'text-foreground'}`} data-testid="prompt-text">
          {searchTerm ? (
            <HighlightText text={truncatedText} search={searchTerm} />
          ) : (
            truncatedText
          )}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {displayName && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-foreground/80">
              <User className="h-3 w-3" />
              {displayName}
            </span>
          )}
          <span data-testid="prompt-time">
            {formatDistanceToNow(new Date(prompt.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>
      {isCommand ? (
        <span className="text-xs text-muted-foreground whitespace-nowrap">Not analyzed</span>
      ) : (
        <AnalysisStatus status={prompt.analysis_status} />
      )}
    </div>
  );
}
