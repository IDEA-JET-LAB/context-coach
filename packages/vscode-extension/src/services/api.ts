/**
 * Contextor API Client Service
 * Story 19-4: Real-time Analytics Display
 *
 * Handles all API communication with the Contextor backend.
 */

import * as vscode from "vscode";
import { AuthService } from "./auth";
import {
  AnalyticsData,
  RecentPrompt,
  PromptDetail,
  TimeRange,
  ApiError,
} from "../types/analytics";
import {
  CoachingResponse,
  CoachingTip,
  WeakDimension,
  DismissTipRequest,
} from "../types/coaching";

/**
 * API response wrapper
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

/**
 * ContextorAPI handles all communication with the Contextor backend.
 */
export class ContextorAPI {
  private readonly apiEndpoint: string;
  private readonly authService: AuthService;
  private readonly outputChannel: vscode.OutputChannel;

  constructor(
    authService: AuthService,
    outputChannel: vscode.OutputChannel
  ) {
    this.authService = authService;
    this.outputChannel = outputChannel;

    // Get API endpoint from configuration
    const config = vscode.workspace.getConfiguration("contextor");
    this.apiEndpoint = config.get<string>(
      "apiEndpoint",
      "https://contextor.co/api"
    );
  }

  /**
   * Fetches analytics data for a time range.
   * @param timeRange - The time range to fetch analytics for
   * @returns Analytics data or error
   */
  async getAnalytics(timeRange: TimeRange = '7d'): Promise<ApiResponse<AnalyticsData>> {
    try {
      const response = await this.authenticatedFetch(
        `/analytics/summary?range=${timeRange}`
      );

      if (!response.ok) {
        return this.handleErrorResponse(response);
      }

      const data = await response.json();

      // Transform API response to match our types
      const analytics: AnalyticsData = {
        summary: {
          overallScore: data.overallScore ?? 0,
          promptCount: data.promptCount ?? 0,
          timeRange: timeRange,
          scoreChange: data.scoreChange,
          countChange: data.countChange,
        },
        dimensions: this.transformDimensions(data.dimensions),
        lastUpdated: new Date().toISOString(),
      };

      return { success: true, data: analytics };
    } catch (error) {
      return this.handleError("getAnalytics", error);
    }
  }

  /**
   * Fetches recent prompts for display.
   * @param limit - Maximum number of prompts to fetch (default: 5)
   * @returns Array of recent prompts or error
   */
  async getRecentPrompts(limit: number = 5): Promise<ApiResponse<RecentPrompt[]>> {
    try {
      const response = await this.authenticatedFetch(
        `/prompts/recent?limit=${limit}`
      );

      if (!response.ok) {
        return this.handleErrorResponse(response);
      }

      const data = await response.json();

      // Transform API response
      const prompts: RecentPrompt[] = (data.prompts || []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        text: this.truncateText(p.text as string, 100),
        score: this.normalizeScore(p.overall_score as number),
        timestamp: p.created_at as string,
        dimensions: this.flattenDimensions(p.dimension_scores as Record<string, { score: number }>),
        isNew: false,
      }));

      return { success: true, data: prompts };
    } catch (error) {
      return this.handleError("getRecentPrompts", error);
    }
  }

  /**
   * Fetches detailed information for a specific prompt.
   * @param promptId - The UUID of the prompt
   * @returns Prompt detail or error
   */
  async getPromptDetail(promptId: string): Promise<ApiResponse<PromptDetail>> {
    try {
      const response = await this.authenticatedFetch(
        `/prompts/${promptId}/analysis`
      );

      if (!response.ok) {
        return this.handleErrorResponse(response);
      }

      const data = await response.json();

      // Transform API response
      const detail: PromptDetail = {
        id: data.id,
        text: data.text,
        score: this.normalizeScore(data.overall_score),
        timestamp: data.created_at,
        dimensions: this.flattenDimensions(data.dimension_scores),
        suggestions: this.transformSuggestions(data.suggestions),
      };

      return { success: true, data: detail };
    } catch (error) {
      return this.handleError("getPromptDetail", error);
    }
  }

  /**
   * Tests API connectivity.
   * @returns true if API is reachable
   */
  async checkConnectivity(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiEndpoint}/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Makes an authenticated fetch request to the API.
   */
  private async authenticatedFetch(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const accessToken = await this.authService.getAccessToken();

    if (!accessToken) {
      throw new Error("Not authenticated");
    }

    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
      ...options.headers,
    };

    return fetch(`${this.apiEndpoint}${path}`, {
      ...options,
      headers,
    });
  }

  /**
   * Transforms dimension scores from API format to display format.
   */
  private transformDimensions(
    dimensions: Record<string, { score: number; change?: number }> | undefined
  ) {
    const defaultDimension = { score: 0, trend: 'stable' as const };

    if (!dimensions) {
      return {
        clarity: defaultDimension,
        context: defaultDimension,
        specificity: defaultDimension,
        actionability: defaultDimension,
        efficiency: defaultDimension,
      };
    }

    const getTrend = (change?: number): 'up' | 'down' | 'stable' => {
      if (!change || Math.abs(change) < 1) return 'stable';
      return change > 0 ? 'up' : 'down';
    };

    return {
      clarity: {
        score: this.normalizeScore(dimensions.clarity?.score ?? dimensions.Clarity?.score ?? 0),
        trend: getTrend(dimensions.clarity?.change ?? dimensions.Clarity?.change),
        change: dimensions.clarity?.change ?? dimensions.Clarity?.change,
      },
      context: {
        score: this.normalizeScore(dimensions.context?.score ?? dimensions.Context?.score ?? 0),
        trend: getTrend(dimensions.context?.change ?? dimensions.Context?.change),
        change: dimensions.context?.change ?? dimensions.Context?.change,
      },
      specificity: {
        score: this.normalizeScore(dimensions.specificity?.score ?? dimensions.Specificity?.score ?? 0),
        trend: getTrend(dimensions.specificity?.change ?? dimensions.Specificity?.change),
        change: dimensions.specificity?.change ?? dimensions.Specificity?.change,
      },
      actionability: {
        score: this.normalizeScore(dimensions.actionability?.score ?? dimensions.Actionability?.score ?? 0),
        trend: getTrend(dimensions.actionability?.change ?? dimensions.Actionability?.change),
        change: dimensions.actionability?.change ?? dimensions.Actionability?.change,
      },
      efficiency: {
        score: this.normalizeScore(dimensions.efficiency?.score ?? dimensions.Efficiency?.score ?? 0),
        trend: getTrend(dimensions.efficiency?.change ?? dimensions.Efficiency?.change),
        change: dimensions.efficiency?.change ?? dimensions.Efficiency?.change,
      },
    };
  }

  /**
   * Flattens dimension scores to a simple name -> score map.
   */
  private flattenDimensions(
    dimensions: Record<string, { score: number }> | undefined
  ): Record<string, number> {
    if (!dimensions) return {};

    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(dimensions)) {
      result[key.toLowerCase()] = this.normalizeScore(value?.score ?? 0);
    }
    return result;
  }

  /**
   * Transforms suggestions from API format.
   */
  private transformSuggestions(
    suggestions: { byDimension?: Record<string, { type: string; message: string; example?: string }> } | undefined
  ) {
    if (!suggestions?.byDimension) return [];

    return Object.entries(suggestions.byDimension).map(([dimension, s]) => ({
      dimension: dimension.toLowerCase(),
      type: s.type as 'reinforcement' | 'improvement',
      message: s.message,
      example: s.example,
    }));
  }

  /**
   * Normalizes a score from 1-10 scale to 0-100 percentage.
   */
  private normalizeScore(score: number): number {
    // API returns scores 1-10, convert to percentage
    if (score <= 10) {
      return Math.round(score * 10);
    }
    // Already a percentage
    return Math.round(score);
  }

  /**
   * Truncates text to a maximum length.
   */
  private truncateText(text: string, maxLength: number): string {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + "...";
  }

  /**
   * Handles API error responses.
   */
  private async handleErrorResponse<T>(response: Response): Promise<ApiResponse<T>> {
    try {
      const errorBody = await response.json();
      return {
        success: false,
        error: {
          code: errorBody.error?.code || "API_ERROR",
          message: errorBody.error?.message || `Request failed: ${response.status}`,
          status: response.status,
        },
      };
    } catch {
      return {
        success: false,
        error: {
          code: "API_ERROR",
          message: `Request failed: ${response.status}`,
          status: response.status,
        },
      };
    }
  }

  /**
   * Handles errors during API calls.
   */
  private handleError<T>(operation: string, error: unknown): ApiResponse<T> {
    const message = error instanceof Error ? error.message : String(error);
    this.log(`${operation} failed: ${message}`);

    // Check for network errors
    if (message.includes("fetch") || message.includes("network")) {
      return {
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: "Unable to connect to server. Check your internet connection.",
        },
      };
    }

    // Check for auth errors
    if (message.includes("Not authenticated")) {
      return {
        success: false,
        error: {
          code: "AUTH_ERROR",
          message: "Please sign in to view analytics.",
        },
      };
    }

    return {
      success: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: message,
      },
    };
  }

  /**
   * Logs a message to the output channel.
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] [API] ${message}`);
  }

  // ============================================
  // Coaching API Methods (Story 19-5)
  // ============================================

  /**
   * Fetches personalized coaching tips based on user's prompt patterns.
   * Calls the /api/coaching/heuristics endpoint.
   * @returns Coaching response with tips and weak dimensions
   */
  async getCoachingTips(): Promise<ApiResponse<CoachingResponse>> {
    try {
      const response = await this.authenticatedFetch("/coaching/heuristics");

      if (!response.ok) {
        return this.handleErrorResponse(response);
      }

      const data = await response.json();

      // Transform API response to match our types
      const coaching: CoachingResponse = {
        tips: this.transformCoachingTips(data.tips || []),
        weakDimensions: this.transformWeakDimensions(data.weakDimensions || []),
        lastUpdated: data.lastUpdated || new Date().toISOString(),
      };

      return { success: true, data: coaching };
    } catch (error) {
      return this.handleError("getCoachingTips", error);
    }
  }

  /**
   * Dismisses a coaching tip for the current user.
   * @param tipId - The ID of the tip to dismiss
   * @param reason - Optional reason for dismissal
   * @returns Success or error
   */
  async dismissTip(
    tipId: string,
    reason?: DismissTipRequest["reason"]
  ): Promise<ApiResponse<void>> {
    try {
      const response = await this.authenticatedFetch(
        `/coaching/tips/${tipId}/dismiss`,
        {
          method: "POST",
          body: JSON.stringify({ reason }),
        }
      );

      if (!response.ok) {
        return this.handleErrorResponse(response);
      }

      return { success: true };
    } catch (error) {
      return this.handleError("dismissTip", error);
    }
  }

  /**
   * Transforms coaching tips from API format.
   */
  private transformCoachingTips(
    tips: Array<{
      id?: string;
      dimension?: string;
      title?: string;
      description?: string;
      example?: { before?: string; after?: string };
      priority?: string;
      source?: string;
      created_at?: string;
    }>
  ): CoachingTip[] {
    return tips.map((tip) => ({
      id: tip.id || `tip-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dimension: (tip.dimension?.toLowerCase() || "clarity") as CoachingTip["dimension"],
      title: tip.title || "Improvement Tip",
      description: tip.description || "",
      example: tip.example?.before && tip.example?.after
        ? { before: tip.example.before, after: tip.example.after }
        : undefined,
      priority: (tip.priority?.toLowerCase() || "medium") as CoachingTip["priority"],
      source: (tip.source?.toLowerCase() || "pattern") as CoachingTip["source"],
      createdAt: tip.created_at || new Date().toISOString(),
    }));
  }

  /**
   * Transforms weak dimensions from API format.
   */
  private transformWeakDimensions(
    dimensions: Array<{
      dimension?: string;
      average_score?: number;
      averageScore?: number;
      prompt_count?: number;
      promptCount?: number;
      trend?: string;
      strategies?: string[];
    }>
  ): WeakDimension[] {
    return dimensions.map((dim) => ({
      dimension: (dim.dimension?.toLowerCase() || "clarity") as WeakDimension["dimension"],
      averageScore: this.normalizeScore(dim.average_score ?? dim.averageScore ?? 0),
      promptCount: dim.prompt_count ?? dim.promptCount ?? 0,
      trend: (dim.trend?.toLowerCase() || "stable") as WeakDimension["trend"],
      strategies: dim.strategies || [],
    }));
  }
}
