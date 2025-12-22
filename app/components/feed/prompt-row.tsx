'use client';

import { formatDistanceToNow } from 'date-fns';
import { Terminal } from 'lucide-react';
import { ScoreBadge } from './score-badge';
import { AnalysisStatus } from './analysis-status';
import { HighlightText } from '@/lib/utils/highlight-text';
import type { PromptWithAnalysis } from '@/lib/types/prompt';

interface PromptRowProps {
  prompt: PromptWithAnalysis;
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

export function PromptRow({ prompt, onClick, searchTerm }: PromptRowProps) {
  const isCommand = prompt.prompt_type === 'command';
  const isCommandWithPrompt = prompt.prompt_type === 'command_with_prompt';
  const command = (isCommand || isCommandWithPrompt) ? extractCommand(prompt.text) : null;

  const truncatedText =
    prompt.text.length > 150 ? prompt.text.slice(0, 150) + '...' : prompt.text;

  return (
    <div
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors ${
        isCommand
          ? 'border-[#3a3a3a] bg-[#141414] hover:bg-[#1a1a1a] opacity-70'
          : 'border-[#2a2a2a] bg-[#1a1a1a] hover:bg-[#242424]'
      }`}
      data-testid="prompt-row"
      data-prompt-id={prompt.id}
      data-prompt-type={prompt.prompt_type}
    >
      {isCommand ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2a2a2a]">
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
            <span className="inline-flex items-center rounded bg-[#2a2a2a] px-2 py-0.5 text-xs font-mono text-muted-foreground">
              {command}
            </span>
          )}
          {isCommand && (
            <span className="text-xs text-muted-foreground">Command</span>
          )}
        </div>
        <p className={`text-sm line-clamp-2 ${isCommand ? 'text-muted-foreground' : 'text-[#fafafa]'}`} data-testid="prompt-text">
          {searchTerm ? (
            <HighlightText text={truncatedText} search={searchTerm} />
          ) : (
            truncatedText
          )}
        </p>
        <p className="mt-1 text-xs text-muted-foreground" data-testid="prompt-time">
          {formatDistanceToNow(new Date(prompt.created_at), { addSuffix: true })}
        </p>
      </div>
      {isCommand ? (
        <span className="text-xs text-muted-foreground whitespace-nowrap">Not analyzed</span>
      ) : (
        <AnalysisStatus status={prompt.analysis_status} />
      )}
    </div>
  );
}
