'use client';

import { useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow, format } from 'date-fns';
import { ArrowLeft, Calendar, Folder, FileText, Cpu, Wrench, Bot, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScoreBadge } from '@/components/feed/score-badge';
import { CodeBlock } from '@/components/forms';
import { DimensionRadar, type RadarDimensionScore } from '@/components/analytics';
import { DimensionCard } from './dimension-card';
import type { PromptWithFullAnalysis, ToolExecution } from '@/lib/hooks/use-prompt';

interface PromptDetailViewProps {
  prompt: PromptWithFullAnalysis;
}

// Default dimension order
const DIMENSION_ORDER = ['Clarity', 'Context', 'Specificity', 'Goal', 'Constraints'];

export function PromptDetailView({ prompt }: PromptDetailViewProps) {
  const router = useRouter();

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // Handle Escape key to go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBack]);

  const dimensionScores = prompt.analysis?.dimension_scores ?? {};
  const suggestions = prompt.analysis?.suggestions;

  // Sort dimensions by the predefined order, with any extras at the end
  const sortedDimensions = Object.keys(dimensionScores).sort((a, b) => {
    const indexA = DIMENSION_ORDER.indexOf(a);
    const indexB = DIMENSION_ORDER.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  // Prepare data for DimensionRadar
  const radarData: RadarDimensionScore[] = useMemo(() => {
    return DIMENSION_ORDER.map((dimension) => ({
      dimension,
      score: dimensionScores[dimension]?.score ?? 0,
      fullMark: 10,
    }));
  }, [dimensionScores]);

  const hasAnalysis = prompt.analysis_status === 'complete' && Object.keys(dimensionScores).length > 0;

  return (
    <div className="max-w-3xl mx-auto" data-testid="prompt-detail-view">
      {/* Header with back button and overall score */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="gap-2"
          data-testid="back-button"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to feed
        </Button>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Overall Score</span>
          <ScoreBadge
            score={prompt.analysis?.overall_score}
            status={prompt.analysis_status}
            size="lg"
          />
        </div>
      </div>

      {/* Metadata bar */}
      <div className="flex flex-wrap items-center gap-4 mb-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5" data-testid="prompt-date">
          <Calendar className="h-4 w-4" />
          <span>{format(new Date(prompt.created_at), 'MMM d, yyyy h:mm a')}</span>
          <span className="text-xs">
            ({formatDistanceToNow(new Date(prompt.created_at), { addSuffix: true })})
          </span>
        </div>

        {prompt.project && (
          <div className="flex items-center gap-1.5" data-testid="prompt-project">
            <Folder className="h-4 w-4" />
            <span>{prompt.project.name}</span>
          </div>
        )}


        <div className="flex items-center gap-1.5" data-testid="prompt-stats">
          <FileText className="h-4 w-4" />
          <span>{prompt.word_count} words, {prompt.char_count} chars</span>
        </div>
      </div>

      {/* Full prompt text using CodeBlock */}
      <div data-testid="prompt-text-container">
        <CodeBlock
          code={prompt.text}
          title="Prompt"
          language="text"
          copyable={true}
          showLineNumbers={false}
          maxHeight="300px"
          className="mb-8"
        />
        {/* Hidden element for backwards compatibility with E2E tests */}
        <span className="sr-only" data-testid="prompt-full-text">{prompt.text}</span>
      </div>

      {/* Response Section */}
      {prompt.response && (
        <div className="mb-8" data-testid="response-section">
          <h2 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
            <Bot className="h-5 w-5 text-muted-foreground" />
            AI Response
          </h2>

          {/* Response metadata */}
          <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-muted-foreground">
            {prompt.response.model && (
              <div className="flex items-center gap-1.5" data-testid="response-model">
                <Cpu className="h-4 w-4" />
                <span>{prompt.response.model}</span>
              </div>
            )}

            {(prompt.response.tokens_in !== undefined || prompt.response.tokens_out !== undefined) && (
              <div className="flex items-center gap-1.5" data-testid="response-tokens">
                <Coins className="h-4 w-4" />
                <span>
                  {prompt.response.tokens_in?.toLocaleString() ?? 0} in / {prompt.response.tokens_out?.toLocaleString() ?? 0} out tokens
                </span>
              </div>
            )}

            {prompt.response.tool_count > 0 && (
              <div className="flex items-center gap-1.5" data-testid="response-tools-count">
                <Wrench className="h-4 w-4" />
                <span>{prompt.response.tool_count} tool{prompt.response.tool_count > 1 ? 's' : ''} used</span>
              </div>
            )}
          </div>

          {/* Response text */}
          {prompt.response.response_text && (
            <CodeBlock
              code={prompt.response.response_text}
              title="Response"
              language="markdown"
              copyable={true}
              showLineNumbers={false}
              maxHeight="400px"
              className="mb-4"
            />
          )}

          {/* Tool executions */}
          {prompt.response.tool_executions && prompt.response.tool_executions.length > 0 && (
            <div className="mt-4" data-testid="tool-executions">
              <h3 className="text-md font-medium text-foreground mb-3 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                Tool Executions ({prompt.response.tool_executions.length})
              </h3>
              <div className="space-y-2">
                {prompt.response.tool_executions.map((tool, index) => (
                  <ToolExecutionCard key={tool.id} tool={tool} index={index} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No response message */}
      {!prompt.response && (
        <div className="mb-8 p-4 rounded-lg border border-border bg-surface-secondary" data-testid="no-response">
          <p className="text-sm text-muted-foreground text-center">
            No response data available for this prompt. Response may not have been captured during import.
          </p>
        </div>
      )}

      {/* Dimension Radar Visualization */}
      {hasAnalysis && (
        <div className="mb-8" data-testid="dimension-radar-section">
          <h2 className="text-lg font-medium text-foreground mb-4">Dimension Overview</h2>
          <div className="rounded-lg border border-border bg-card p-4">
            <DimensionRadar
              data={radarData}
              height={280}
              showLegend={false}
              userLabel="Score"
            />
          </div>
        </div>
      )}

      {/* Dimension scores */}
      {hasAnalysis && (
        <div data-testid="dimension-breakdown">
          <h2 className="text-lg font-medium text-foreground mb-4">Score Breakdown</h2>
          <div className="space-y-3">
            {sortedDimensions.map((dimension) => {
              const score = dimensionScores[dimension];
              if (!score) return null;
              return (
                <DimensionCard
                  key={dimension}
                  name={dimension}
                  dimensionScore={score}
                  suggestion={suggestions?.byDimension?.[dimension]}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Analyzing state */}
      {(prompt.analysis_status === 'pending' || prompt.analysis_status === 'processing') && (
        <div
          className="text-center py-12"
          data-testid="analyzing-state"
        >
          <ScoreBadge status={prompt.analysis_status} size="lg" />
          <p className="mt-4 text-muted-foreground">
            {prompt.analysis_status === 'pending'
              ? 'This prompt is queued for analysis...'
              : 'Analyzing your prompt...'}
          </p>
        </div>
      )}

      {/* Failed state */}
      {prompt.analysis_status === 'failed' && (
        <div
          className="text-center py-12"
          data-testid="analysis-failed-state"
        >
          <ScoreBadge status="failed" size="lg" />
          <p className="mt-4 text-score-growth">Analysis could not be completed</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Please try again later or contact support if the problem persists.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Card component for displaying a single tool execution
 */
function ToolExecutionCard({ tool, index }: { tool: ToolExecution; index: number }) {
  // Get tool-specific color/style
  const getToolColor = (toolName: string): string => {
    switch (toolName) {
      case 'Read':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-950/30';
      case 'Write':
        return 'text-green-600 bg-green-50 dark:bg-green-950/30';
      case 'Edit':
        return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30';
      case 'Bash':
        return 'text-purple-600 bg-purple-50 dark:bg-purple-950/30';
      case 'Glob':
      case 'Grep':
        return 'text-orange-600 bg-orange-50 dark:bg-orange-950/30';
      case 'Task':
        return 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30';
      default:
        return 'text-gray-600 bg-gray-50 dark:bg-gray-950/30';
    }
  };

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card"
      data-testid={`tool-execution-${index}`}
    >
      <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-medium">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getToolColor(tool.tool_name)}`}>
            {tool.tool_name}
          </span>
          {tool.success !== undefined && (
            <span className={`text-xs ${tool.success ? 'text-green-600' : 'text-red-600'}`}>
              {tool.success ? '✓ Success' : '✗ Failed'}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground break-words">
          {tool.input_summary}
        </p>
      </div>
    </div>
  );
}
