"use client";

/**
 * AnalysisChatPanel - Story 30-7: Interactive Chat Interface
 *
 * Main container for the "Analyze Conversation" chat interface.
 * Allows users to ask questions about a conversation using AI analysis.
 */

import { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import type { AnthropicModel } from "@/lib/analysis/anthropic-client";
import {
  estimateConversationTokens,
  estimateCost,
  type TokenEstimate,
  type CostEstimate as CostEstimateType,
} from "@/lib/analysis/token-estimator";
import {
  QUICK_ANALYSES,
  type QuickAnalysis,
} from "@/lib/analysis/quick-analyses";
import {
  useConversationContent,
  usePastAnalyses,
  useInvalidatePastAnalyses,
} from "@/lib/hooks/use-conversation-analysis";
import type { ConversationAnalysis } from "@/lib/types/conversation-analysis";
import { ModelSelector } from "./ModelSelector";
import { ContentSelector, type ContentOptions } from "./ContentSelector";
import { CostEstimate } from "./CostEstimate";
import { AnalysisInput } from "./AnalysisInput";
import { AnalysisResponse } from "./AnalysisResponse";
import { PastAnalysesList } from "./PastAnalysesList";
import { QuickAnalysisButtons, type TokenEstimateMap } from "./QuickAnalysisButtons";

interface AnalysisChatPanelProps {
  sessionId: string;
  teamId: string;
}

export function AnalysisChatPanel({ sessionId, teamId }: AnalysisChatPanelProps) {
  // ========================================================================
  // State
  // ========================================================================
  const [model, setModel] = useState<AnthropicModel>("sonnet");
  const [contentOptions, setContentOptions] = useState<ContentOptions>({
    includePrompts: true,
    includeResponses: true,
    includeThinking: false,
    includeTools: true,
  });
  const [question, setQuestion] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isEnlargedOpen, setIsEnlargedOpen] = useState(false);

  // ========================================================================
  // Data Fetching
  // ========================================================================
  const { data: contentData, isPending: isContentLoading } =
    useConversationContent(sessionId);

  const { data: pastAnalysesData, isPending: isPastAnalysesLoading } =
    usePastAnalyses(sessionId);

  const invalidatePastAnalyses = useInvalidatePastAnalyses();

  // ========================================================================
  // Token & Cost Estimation
  // ========================================================================
  const tokenCounts = useMemo((): TokenEstimate => {
    if (!contentData?.data) {
      return {
        prompts: 0,
        responses: 0,
        thinking: 0,
        tools: 0,
        systemPrompt: 0,
        total: 0,
      };
    }

    // Estimate tokens for the full content
    const fullEstimate = estimateConversationTokens(contentData.data);

    return fullEstimate;
  }, [contentData]);

  // Calculate selected tokens based on content options
  const selectedTokens = useMemo(() => {
    let total = tokenCounts.systemPrompt;

    if (contentOptions.includePrompts) {
      total += tokenCounts.prompts;
    }
    if (contentOptions.includeResponses) {
      total += tokenCounts.responses;
    }
    if (contentOptions.includeThinking) {
      total += tokenCounts.thinking;
    }
    if (contentOptions.includeTools) {
      total += tokenCounts.tools;
    }

    return total;
  }, [tokenCounts, contentOptions]);

  const costEstimate = useMemo((): CostEstimateType => {
    return estimateCost(selectedTokens);
  }, [selectedTokens]);

  // Calculate token estimates for each quick analysis type
  const quickAnalysisTokenEstimates = useMemo((): TokenEstimateMap => {
    const estimates: TokenEstimateMap = {};

    for (const analysis of QUICK_ANALYSES) {
      let total = tokenCounts.systemPrompt;

      if (analysis.contentSettings.includePrompts) {
        total += tokenCounts.prompts;
      }
      if (analysis.contentSettings.includeResponses) {
        total += tokenCounts.responses;
      }
      if (analysis.contentSettings.includeThinking) {
        total += tokenCounts.thinking;
      }
      if (analysis.contentSettings.includeTools) {
        total += tokenCounts.tools;
      }

      estimates[analysis.id] = total;
    }

    return estimates;
  }, [tokenCounts]);

  // ========================================================================
  // Refs
  // ========================================================================
  const submitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ========================================================================
  // Handlers
  // ========================================================================

  /**
   * Handles quick analysis button click.
   * Uses the current model and content selections (respects user's choices).
   * Only sets the question prompt from the quick analysis preset.
   */
  const handleQuickAnalysis = useCallback((analysis: QuickAnalysis) => {
    // Clear any pending auto-submit
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current);
    }

    // NOTE: We intentionally do NOT override the user's model or content selections.
    // User has full control over which model to use and what content to include.
    // The quick analysis button only provides the question prompt.

    // Set question to prompt
    setQuestion(analysis.prompt);

    // Auto-submit after a short delay to allow state to update
    submitTimeoutRef.current = setTimeout(() => {
      // We need to submit directly rather than calling handleSubmit
      // because state updates are batched and the question might not be set yet
      setIsAnalyzing(true);
      setResponse("");
      setError(null);

      // Use current model and content options instead of preset values
      fetch(`/api/conversations/${sessionId}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: analysis.prompt,
          model: model, // Use user's selected model
          includePrompts: contentOptions.includePrompts, // Use user's content selections
          includeResponses: contentOptions.includeResponses,
          includeThinking: contentOptions.includeThinking,
          includeTools: contentOptions.includeTools,
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(
              errorData.error?.message || `Analysis failed: ${res.status}`
            );
          }

          const reader = res.body?.getReader();
          if (!reader) {
            throw new Error("No response body");
          }

          const decoder = new TextDecoder();
          let accumulated = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            accumulated += chunk;
            setResponse(accumulated);
          }

          setQuestion("");
          invalidatePastAnalyses(sessionId);
        })
        .catch((err) => {
          const message =
            err instanceof Error ? err.message : "An unexpected error occurred";
          setError(message);
        })
        .finally(() => {
          setIsAnalyzing(false);
        });
    }, 100);
  }, [sessionId, model, contentOptions, invalidatePastAnalyses]);

  const handleSubmit = useCallback(async () => {
    if (!question.trim() || isAnalyzing) return;

    setIsAnalyzing(true);
    setResponse("");
    setError(null);

    try {
      const res = await fetch(`/api/conversations/${sessionId}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: question.trim(),
          model,
          includePrompts: contentOptions.includePrompts,
          includeResponses: contentOptions.includeResponses,
          includeThinking: contentOptions.includeThinking,
          includeTools: contentOptions.includeTools,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `Analysis failed: ${res.status}`
        );
      }

      // Stream the response
      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setResponse(accumulated);
      }

      // Clear the question after successful analysis
      setQuestion("");

      // Invalidate past analyses cache to show the new analysis
      invalidatePastAnalyses(sessionId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
    } finally {
      setIsAnalyzing(false);
    }
  }, [question, model, contentOptions, sessionId, isAnalyzing, invalidatePastAnalyses]);

  /**
   * Handles selecting a past analysis from the list.
   * Loads the response into the main view and opens the enlarged dialog.
   */
  const handleSelectPastAnalysis = useCallback((analysis: ConversationAnalysis) => {
    // Clear any current state
    setError(null);

    // Load the past analysis response
    setResponse(analysis.response);

    // Open the enlarged view immediately
    setIsEnlargedOpen(true);
  }, []);

  // ========================================================================
  // Render
  // ========================================================================
  return (
    <div className="space-y-4">
      {/* Main Analysis Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Analyze Conversation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Analysis Buttons */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Quick Analysis
            </label>
            <QuickAnalysisButtons
              tokenEstimates={quickAnalysisTokenEstimates}
              onSelect={handleQuickAnalysis}
              disabled={isAnalyzing || isContentLoading}
            />
          </div>

          {/* Model Selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Model
            </label>
            <ModelSelector
              value={model}
              onChange={setModel}
              disabled={isAnalyzing}
            />
          </div>

          {/* Content Selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Content to analyze
            </label>
            <ContentSelector
              value={contentOptions}
              onChange={setContentOptions}
              tokenCounts={tokenCounts}
              disabled={isAnalyzing}
            />
          </div>

          {/* Cost Estimate */}
          <CostEstimate costs={costEstimate} selectedModel={model} />

          {/* Analysis Input */}
          <AnalysisInput
            value={question}
            onChange={setQuestion}
            onSubmit={handleSubmit}
            isLoading={isAnalyzing}
            disabled={isContentLoading}
          />

          {/* Analysis Response */}
          <AnalysisResponse
            response={response}
            isStreaming={isAnalyzing}
            error={error}
            isEnlargedOpen={isEnlargedOpen}
            onEnlargedOpenChange={setIsEnlargedOpen}
          />
        </CardContent>
      </Card>

      {/* Past Analyses */}
      <PastAnalysesList
        analyses={pastAnalysesData?.data || []}
        isLoading={isPastAnalysesLoading}
        onSelect={handleSelectPastAnalysis}
      />
    </div>
  );
}
