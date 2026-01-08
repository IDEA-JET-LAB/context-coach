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
      "http://127.0.0.1:3050/api"
    );
  }

  /**
   * Fetches analytics data for a time range.
   * @param timeRange - The time range to fetch analytics for
   * @param projectId - Optional project UUID to filter analytics to specific project
   * @returns Analytics data or error
   */
  async getAnalytics(timeRange: TimeRange = '7d', projectId?: string | null): Promise<ApiResponse<AnalyticsData>> {
    try {
      // Add cache-buster to ensure fresh data
      const cacheBuster = Date.now();
      let url = `/analytics/summary?range=${timeRange}&_=${cacheBuster}`;
      if (projectId) {
        url += `&project_id=${encodeURIComponent(projectId)}`;
      }
      const response = await this.authenticatedFetch(url);
      this.log(`Fetching analytics for range=${timeRange}, projectId=${projectId || 'all'}`);

      if (!response.ok) {
        return this.handleErrorResponse(response);
      }

      const data = await response.json() as Record<string, unknown>;

      // Transform API response to match our types
      const analytics: AnalyticsData = {
        summary: {
          overallScore: (data.overallScore as number) ?? 0,
          promptCount: (data.promptCount as number) ?? 0,
          timeRange: timeRange,
          scoreChange: data.scoreChange as number | undefined,
          countChange: data.countChange as number | undefined,
        },
        dimensions: this.transformDimensions(data.dimensions as Record<string, { score: number; label: string }> | undefined),
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
   * @param projectId - Optional project UUID to filter prompts to specific project
   * @returns Array of recent prompts or error
   */
  async getRecentPrompts(limit: number = 5, projectId?: string | null): Promise<ApiResponse<RecentPrompt[]>> {
    try {
      let url = `/prompts/recent?limit=${limit}`;
      if (projectId) {
        url += `&project_id=${encodeURIComponent(projectId)}`;
      }
      const response = await this.authenticatedFetch(url);

      if (!response.ok) {
        return this.handleErrorResponse(response);
      }

      const data = await response.json() as Record<string, unknown>;

      // Transform API response
      const prompts: RecentPrompt[] = ((data.prompts as Array<Record<string, unknown>>) || []).map((p: Record<string, unknown>) => ({
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

      const data = await response.json() as Record<string, unknown>;

      // Transform API response
      const detail: PromptDetail = {
        id: data.id as string,
        text: data.text as string,
        score: this.normalizeScore(data.overall_score as number),
        timestamp: data.created_at as string,
        dimensions: this.flattenDimensions(data.dimension_scores as Record<string, { score: number }>),
        suggestions: this.transformSuggestions(data.suggestions as { byDimension?: Record<string, { type: string; message: string; example?: string }> } | undefined),
      };

      return { success: true, data: detail };
    } catch (error) {
      return this.handleError("getPromptDetail", error);
    }
  }

/**
   * Fetches the most recent prompt with its analysis.
   * @param projectId - Optional project UUID to filter prompts by current workspace
   * @returns Last prompt data or null if no prompts exist
   */
  async getLastPrompt(projectId?: string | null): Promise<ApiResponse<{
    id: string;
    text: string;
    overall_score: number;
    clarity_score: number;
    context_score: number;
    specificity_score: number;
    actionability_score: number;
    efficiency_score: number;
    created_at: string;
  } | null>> {
    try {
      // Build query with optional project filter
      let url = "/prompts/recent?limit=1";
      if (projectId) {
        url += `&project_id=${encodeURIComponent(projectId)}`;
      }

      // Fetch the most recent prompt with analysis
      const response = await this.authenticatedFetch(url);

      if (!response.ok) {
        return this.handleErrorResponse(response);
      }

      const data = await response.json() as { prompts?: Array<Record<string, unknown>> };
      const prompts = data.prompts || [];

      if (prompts.length === 0) {
        return { success: true, data: null };
      }

      const p = prompts[0];

      // API already returns individual score fields (clarity_score, etc.)
      // They are already in 0-100 scale from the API
      const lastPrompt = {
        id: p.id as string,
        text: p.text as string,
        overall_score: (p.overall_score as number) || 0,
        clarity_score: (p.clarity_score as number) || 0,
        context_score: (p.context_score as number) || 0,
        specificity_score: (p.specificity_score as number) || 0,
        actionability_score: (p.actionability_score as number) || 0,
        efficiency_score: (p.efficiency_score as number) || 0,
        created_at: p.created_at as string,
      };

      this.log(`Last prompt fetched: overall=${lastPrompt.overall_score}, clarity=${lastPrompt.clarity_score}`);

      return { success: true, data: lastPrompt };
    } catch (error) {
      return this.handleError("getLastPrompt", error);
    }
  }

  /**
   * Fetches user's team memberships.
   * @returns Array of teams the user belongs to
   */
  async getUserTeams(): Promise<ApiResponse<Array<{ id: string; name: string; role: string }>>> {
    try {
      const response = await this.authenticatedFetch("/teams");

      if (!response.ok) {
        return this.handleErrorResponse(response);
      }

      const data = await response.json() as { teams?: Array<{ id: string; name: string; role: string }> };
      return { success: true, data: data.teams || [] };
    } catch (error) {
      return this.handleError("getUserTeams", error);
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
      const errorBody = await response.json() as Record<string, { code?: string; message?: string }>;
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

      const data = await response.json() as {
        tips?: Array<{
          id?: string;
          dimension?: string;
          title?: string;
          description?: string;
          example?: { before?: string; after?: string };
          priority?: string;
          source?: string;
          created_at?: string;
        }>;
        weakDimensions?: Array<{
          dimension?: string;
          score?: number;
          label?: string;
          threshold?: number;
        }>;
        lastUpdated?: string;
      };

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

  // ============================================
  // Conversation API Methods (Phase 3)
  // ============================================

  /**
   * Fetches recent conversations (sessions) for the user.
   * @param limit - Maximum number of conversations to fetch (default: 20)
   * @returns Array of conversation summaries
   */
  async getConversations(limit: number = 20): Promise<ApiResponse<ConversationSummary[]>> {
    try {
      const response = await this.authenticatedFetch(`/sessions?limit=${limit}`);

      if (!response.ok) {
        return this.handleErrorResponse(response);
      }

      const data = await response.json() as { sessions?: Array<Record<string, unknown>> };

      // Transform API response to conversation summaries
      const conversations: ConversationSummary[] = (data.sessions || []).map((s: Record<string, unknown>) => ({
        id: s.id as string,
        sessionId: s.id as string,
        slug: (s.slug as string) || (s.first_prompt_text as string)?.slice(0, 50) || "Unnamed Session",
        projectName: (s.project_name as string) || (s.cwd as string)?.split("/").pop() || null,
        startedAt: s.started_at as string,
        endedAt: (s.ended_at as string) || null,
        messageCount: (s.prompt_count as number) || 0,
        primaryStage: (s.primary_stage as string) || null,
        hasDebuggingLoop: (s.has_debugging_loop as boolean) || false,
        conversationScore: (s.average_score as number) || null,
        gitBranch: (s.git_branch as string) || null,
      }));

      return { success: true, data: conversations };
    } catch (error) {
      return this.handleError("getConversations", error);
    }
  }

  /**
   * Fetches messages for a specific conversation (session).
   * @param sessionId - The session ID to fetch messages for
   * @returns Array of conversation messages
   */
  async getConversationMessages(sessionId: string): Promise<ApiResponse<ConversationMessage[]>> {
    try {
      const response = await this.authenticatedFetch(`/sessions/${sessionId}/thread`);

      if (!response.ok) {
        return this.handleErrorResponse(response);
      }

      const data = await response.json() as { messages?: Array<Record<string, unknown>> };

      // Transform API response to conversation messages
      const messages: ConversationMessage[] = (data.messages || []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        role: (m.role as "user" | "assistant") || "user",
        content: m.content as string,
        timestamp: m.timestamp as string,
        promptType: (m.prompt_type as string) || undefined,
        score: (m.score as number) || undefined,
        toolsUsed: (m.tools_used as string[]) || undefined,
      }));

      return { success: true, data: messages };
    } catch (error) {
      return this.handleError("getConversationMessages", error);
    }
  }

  /**
   * Fetches the list of teams the current user belongs to.
   * @returns Array of teams or error
   */
  async getMyTeams(): Promise<ApiResponse<TeamInfo[]>> {
    try {
      this.log("Fetching user's teams");

      const response = await this.authenticatedFetch("/teams");

      if (!response.ok) {
        return this.handleErrorResponse(response);
      }

      const result = await response.json() as { data: { teams: TeamInfo[] } };
      this.log(`Found ${result.data.teams.length} teams`);

      return { success: true, data: result.data.teams };
    } catch (error) {
      return this.handleError("getMyTeams", error);
    }
  }

  /**
   * Registers a project from the VS Code extension.
   * Creates a new project in the backend and returns config for local storage.
   * @param projectName - Name of the project (usually workspace folder name)
   * @param workspacePath - Path to the workspace (for reference)
   * @param teamId - Optional team ID (uses current team if not specified)
   * @returns Project config to save locally or error
   */
  async registerProject(
    projectName: string,
    workspacePath?: string,
    teamId?: string
  ): Promise<ApiResponse<RegisterProjectResponse>> {
    try {
      this.log(`Registering project: ${projectName}`);

      const response = await this.authenticatedFetch("/extension/register-project", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: projectName,
          workspacePath,
          teamId,
        }),
      });

      if (!response.ok) {
        return this.handleErrorResponse(response);
      }

      const result = await response.json() as { data: RegisterProjectResponse };
      this.log(`Project registered successfully: ${result.data.project.id}`);

      return { success: true, data: result.data };
    } catch (error) {
      return this.handleError("registerProject", error);
    }
  }
}

/**
 * Response from project registration API
 */
interface RegisterProjectResponse {
  project: {
    id: string;
    name: string;
    team_id: string;
    team_name: string;
  };
  installToken: string;
  config: {
    project_id: string;
    project_name: string;
    team_id: string;
    team_name: string;
    api_endpoint: string;
    created_at: string;
    created_by: string;
  };
}

/**
 * Team info from API
 */
interface TeamInfo {
  id: string;
  name: string;
  role: string;
}

/**
 * Conversation summary for API response (Phase 3)
 */
interface ConversationSummary {
  id: string;
  sessionId: string;
  slug: string;
  projectName: string | null;
  startedAt: string;
  endedAt: string | null;
  messageCount: number;
  primaryStage: string | null;
  hasDebuggingLoop: boolean;
  conversationScore: number | null;
  gitBranch: string | null;
}

/**
 * Conversation message for API response (Phase 3)
 */
interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  promptType?: string;
  score?: number;
  toolsUsed?: string[];
}
