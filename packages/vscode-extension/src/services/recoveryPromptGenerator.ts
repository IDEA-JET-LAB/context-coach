/**
 * Recovery Prompt Generator Service - Story 18-3
 *
 * Generates recovery prompts from session snapshots to help users
 * seamlessly continue interrupted work.
 *
 * Features:
 * - AI-powered summary via Contextor API
 * - Local template fallback when API unavailable
 * - Caching to avoid redundant API calls
 * - Handles minimal snapshots gracefully
 * - Keeps prompts under 500 characters
 */

import * as vscode from "vscode";
import type { SessionStateSnapshot } from "../types/sessionState";
import {
  RecoveryPrompt,
  RecoverySummary,
  RecoveryApiResponse,
  RECOVERY_CONSTANTS,
} from "../types/recovery";
import { RecoveryPromptCache } from "./recoveryPromptCache";
import { AuthService } from "./auth";
import { SettingsService } from "./settings";

/**
 * RecoveryPromptGenerator creates contextual prompts for resuming interrupted sessions.
 */
export class RecoveryPromptGenerator {
  private readonly cache: RecoveryPromptCache;
  private readonly authService: AuthService;
  private readonly settingsService: SettingsService;
  private outputChannel: vscode.OutputChannel | null = null;

  constructor(
    cache: RecoveryPromptCache,
    authService: AuthService,
    settingsService?: SettingsService
  ) {
    this.cache = cache;
    this.authService = authService;
    this.settingsService = settingsService || SettingsService.getInstance();
  }

  /**
   * Sets the output channel for logging.
   */
  initialize(outputChannel: vscode.OutputChannel): void {
    this.outputChannel = outputChannel;
    this.log("RecoveryPromptGenerator initialized");
  }

  /**
   * Generates a recovery prompt from a session snapshot.
   *
   * Flow:
   * 1. Check cache for existing valid prompt
   * 2. If not cached, try AI generation via API
   * 3. Fall back to local template if API fails
   * 4. Cache the result
   *
   * @param snapshot - The session state snapshot to generate a prompt for
   * @returns The generated recovery prompt
   */
  async generateRecoveryPrompt(
    snapshot: SessionStateSnapshot
  ): Promise<RecoveryPrompt> {
    // Check cache first
    const cached = this.cache.get(snapshot.sessionId, snapshot);
    if (cached) {
      this.log(`Using cached recovery prompt for session: ${snapshot.sessionId}`);
      return cached;
    }

    // Handle empty or minimal snapshots
    if (snapshot.recentMessages.length === 0) {
      this.log(`Empty snapshot for session: ${snapshot.sessionId}`);
      return this.createMinimalPrompt(snapshot);
    }

    // Try API-based generation
    let prompt: RecoveryPrompt;

    if (await this.authService.isAuthenticated()) {
      const apiResult = await this.generateViaAPI(snapshot);
      if (apiResult) {
        prompt = apiResult;
      } else {
        prompt = this.generateLocalPrompt(snapshot);
      }
    } else {
      this.log("Not authenticated, using local generation");
      prompt = this.generateLocalPrompt(snapshot);
    }

    // Cache the result
    await this.cache.set(prompt, snapshot);

    return prompt;
  }

  /**
   * Generates a recovery prompt using the Contextor API.
   * Returns null if API call fails.
   */
  private async generateViaAPI(
    snapshot: SessionStateSnapshot
  ): Promise<RecoveryPrompt | null> {
    try {
      const accessToken = await this.authService.getAccessToken();
      if (!accessToken) {
        this.log("No access token available");
        return null;
      }

      const apiEndpoint = this.settingsService.apiEndpoint;

      // Prepare messages for API
      const messages = snapshot.recentMessages
        .slice(-RECOVERY_CONSTANTS.MAX_MESSAGES_FOR_API)
        .map((m) => ({
          type: m.type,
          content: m.content.slice(0, 500), // Truncate for API
        }));

      // Prepare request body
      const requestBody = {
        messages,
        filesAffected: snapshot.filesAffected.slice(0, 10).map((f) => f.path),
        lastTool: snapshot.toolsUsed[0]?.name,
      };

      // Set up timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        RECOVERY_CONSTANTS.API_TIMEOUT_MS
      );

      this.log(`Calling API for session: ${snapshot.sessionId}`);

      const response = await fetch(
        `${apiEndpoint}/recovery/${snapshot.sessionId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        this.log(`Rate limited, retry after: ${retryAfter || "unknown"} seconds`);
        return null;
      }

      // Handle other errors
      if (!response.ok) {
        this.log(`API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = (await response.json()) as RecoveryApiResponse;

      if (!data.success || !data.summary) {
        this.log("API returned unsuccessful response");
        return null;
      }

      // Build the prompt from AI summary
      const promptText = this.buildAIPrompt(
        data.summary,
        snapshot.conversationContext.currentTask
      );

      this.log(`API generation successful for session: ${snapshot.sessionId}`);

      return {
        sessionId: snapshot.sessionId,
        prompt: promptText,
        generatedAt: new Date(),
        isAIGenerated: true,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          this.log("API call timed out");
        } else {
          this.log(`API call failed: ${error.message}`);
        }
      }
      return null;
    }
  }

  /**
   * Builds a recovery prompt from an AI-generated summary.
   */
  private buildAIPrompt(summary: RecoverySummary, lastRequest: string): string {
    const truncatedLastRequest = lastRequest.slice(
      0,
      RECOVERY_CONSTANTS.MAX_DESCRIPTION_LENGTH
    );

    let prompt = `Continue from where we left off. Here's the context:

- We were working on: ${summary.task}
- Last action: ${summary.lastAction}
- Pending: ${summary.pending}`;

    if (truncatedLastRequest) {
      prompt += `
- My last request was: "${truncatedLastRequest}${lastRequest.length > RECOVERY_CONSTANTS.MAX_DESCRIPTION_LENGTH ? "..." : ""}"`;
    }

    prompt += `

Please continue.`;

    // Ensure we stay under max length
    if (prompt.length > RECOVERY_CONSTANTS.MAX_PROMPT_LENGTH) {
      prompt = prompt.slice(0, RECOVERY_CONSTANTS.MAX_PROMPT_LENGTH - 3) + "...";
    }

    return prompt;
  }

  /**
   * Generates a recovery prompt using local template (no API).
   */
  private generateLocalPrompt(snapshot: SessionStateSnapshot): RecoveryPrompt {
    this.log(`Generating local prompt for session: ${snapshot.sessionId}`);

    const { conversationContext, filesAffected, toolsUsed, recentMessages } =
      snapshot;

    // Get the last user message as "last request"
    const lastUserMessage = [...recentMessages]
      .reverse()
      .find((m) => m.type === "user");
    const lastRequest = lastUserMessage?.content.slice(
      0,
      RECOVERY_CONSTANTS.MAX_DESCRIPTION_LENGTH
    );

    // Get first user message as context
    const firstUserMessage = recentMessages.find((m) => m.type === "user");
    const task =
      conversationContext.currentTask ||
      firstUserMessage?.content.slice(0, RECOVERY_CONSTANTS.MAX_DESCRIPTION_LENGTH) ||
      "previous task";

    // Get files touched (top 3)
    const files = filesAffected
      .slice(0, 3)
      .map((f) => this.getFileName(f.path))
      .join(", ");

    // Get last tool used
    const lastTool = toolsUsed[0]?.name || "N/A";

    let prompt = `Resume my previous session. Context:

- Last working on: ${task}`;

    if (files) {
      prompt += `
- Files touched: ${files}`;
    }

    if (lastTool !== "N/A") {
      prompt += `
- Last tool used: ${lastTool}`;
    }

    if (lastRequest) {
      prompt += `
- Last request: "${lastRequest}${(lastUserMessage?.content.length || 0) > RECOVERY_CONSTANTS.MAX_DESCRIPTION_LENGTH ? "..." : ""}"`;
    }

    prompt += `

Continue where we left off.`;

    // Ensure we stay under max length
    if (prompt.length > RECOVERY_CONSTANTS.MAX_PROMPT_LENGTH) {
      prompt = prompt.slice(0, RECOVERY_CONSTANTS.MAX_PROMPT_LENGTH - 3) + "...";
    }

    return {
      sessionId: snapshot.sessionId,
      prompt,
      generatedAt: new Date(),
      isAIGenerated: false,
    };
  }

  /**
   * Creates a minimal prompt for empty or very small snapshots.
   */
  private createMinimalPrompt(snapshot: SessionStateSnapshot): RecoveryPrompt {
    const prompt = "Resume my previous session. Please continue where we left off.";

    return {
      sessionId: snapshot.sessionId,
      prompt,
      generatedAt: new Date(),
      isAIGenerated: false,
    };
  }

  /**
   * Extracts the filename from a path.
   */
  private getFileName(filePath: string): string {
    const parts = filePath.split("/");
    return parts[parts.length - 1] || filePath;
  }

  /**
   * Invalidates the cache for a specific session.
   */
  async invalidateCache(sessionId: string): Promise<boolean> {
    return this.cache.delete(sessionId);
  }

  /**
   * Clears all cached prompts.
   */
  async clearCache(): Promise<number> {
    return this.cache.clearAll();
  }

  /**
   * Logs a message to the output channel.
   */
  private log(message: string): void {
    if (this.outputChannel) {
      const timestamp = new Date().toISOString();
      this.outputChannel.appendLine(
        `[${timestamp}] [RecoveryPromptGenerator] ${message}`
      );
    }
  }
}

/**
 * Creates a RecoveryPromptGenerator instance.
 */
export function createRecoveryPromptGenerator(
  cache: RecoveryPromptCache,
  authService: AuthService,
  settingsService?: SettingsService
): RecoveryPromptGenerator {
  return new RecoveryPromptGenerator(cache, authService, settingsService);
}
