/**
 * Analytics Service - Story 18-5
 *
 * Tracks usage events for the session recovery feature.
 * Events are queued and sent in batches to reduce API calls.
 * Respects user privacy settings.
 *
 * Features:
 * - Event tracking with privacy controls
 * - Event queuing for batch sending
 * - Automatic batch sending at intervals
 * - Manual flush capability
 * - Persistent queue for unsent events
 */

import * as vscode from "vscode";
import type { SettingsService } from "./settings";
import type { AuthService } from "./auth";

/**
 * Session recovered event properties.
 */
export interface SessionRecoveredEvent {
  event: "session_recovered";
  properties: {
    /** Session ID that was recovered */
    sessionId: string;
    /** Recovery method used */
    method: "clipboard" | "manual";
    /** Time from detection to recovery in ms */
    timeToRecover: number;
    /** Length of the recovery prompt */
    promptLength?: number;
    /** Whether the prompt was AI-generated */
    isAIGenerated?: boolean;
  };
}

/**
 * Session dismissed event properties.
 */
export interface SessionDismissedEvent {
  event: "session_dismissed";
  properties: {
    /** Session ID that was dismissed */
    sessionId: string;
    /** Whether it was bulk dismissed */
    bulk: boolean;
  };
}

/**
 * Recovery panel viewed event properties.
 */
export interface RecoveryPanelViewedEvent {
  event: "recovery_panel_viewed";
  properties: {
    /** Number of sessions shown */
    sessionCount: number;
  };
}

/**
 * Union type of all analytics events.
 */
export type AnalyticsEvent =
  | SessionRecoveredEvent
  | SessionDismissedEvent
  | RecoveryPanelViewedEvent;

/**
 * Queued event with timestamp.
 */
interface QueuedEvent {
  event: AnalyticsEvent;
  timestamp: number;
}

/**
 * Storage key for event queue.
 */
const QUEUE_STORAGE_KEY = "contextor.analytics.queue";

/**
 * Maximum events to queue before forcing a flush.
 */
const MAX_QUEUE_SIZE = 50;

/**
 * Batch send interval in milliseconds (5 minutes).
 */
const BATCH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * AnalyticsService tracks usage events for session recovery.
 */
export class AnalyticsService implements vscode.Disposable {
  private readonly context: vscode.ExtensionContext;
  private readonly settingsService: SettingsService;
  private readonly authService: AuthService;
  private outputChannel: vscode.OutputChannel | null = null;

  /** Event queue for batch sending */
  private eventQueue: QueuedEvent[] = [];

  /** Timer for batch sending */
  private batchTimer: NodeJS.Timeout | null = null;

  /** Whether the service is disposed */
  private disposed = false;

  constructor(
    context: vscode.ExtensionContext,
    settingsService: SettingsService,
    authService: AuthService
  ) {
    this.context = context;
    this.settingsService = settingsService;
    this.authService = authService;

    // Load queued events from storage
    this.loadQueue();
  }

  /**
   * Initializes the service with an output channel for logging.
   */
  initialize(outputChannel: vscode.OutputChannel): void {
    this.outputChannel = outputChannel;
    this.log("AnalyticsService initialized");

    // Start batch timer
    this.startBatchTimer();
  }

  /**
   * Tracks an analytics event.
   *
   * @param event - The event to track
   */
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    if (this.disposed) {
      return;
    }

    // Check if analytics is enabled
    if (!this.isAnalyticsEnabled()) {
      this.log(`Analytics disabled, skipping event: ${event.event}`);
      return;
    }

    // Queue the event
    this.eventQueue.push({
      event,
      timestamp: Date.now(),
    });

    this.log(`Queued event: ${event.event}`);

    // Persist queue
    await this.saveQueue();

    // Flush if queue is full
    if (this.eventQueue.length >= MAX_QUEUE_SIZE) {
      await this.flush();
    }
  }

  /**
   * Convenience method to track a session recovered event.
   */
  async trackSessionRecovered(
    sessionId: string,
    method: "clipboard" | "manual",
    timeToRecover: number,
    promptLength?: number,
    isAIGenerated?: boolean
  ): Promise<void> {
    await this.trackEvent({
      event: "session_recovered",
      properties: {
        sessionId,
        method,
        timeToRecover,
        promptLength,
        isAIGenerated,
      },
    });
  }

  /**
   * Convenience method to track a session dismissed event.
   */
  async trackSessionDismissed(sessionId: string, bulk = false): Promise<void> {
    await this.trackEvent({
      event: "session_dismissed",
      properties: {
        sessionId,
        bulk,
      },
    });
  }

  /**
   * Convenience method to track a recovery panel viewed event.
   */
  async trackRecoveryPanelViewed(sessionCount: number): Promise<void> {
    await this.trackEvent({
      event: "recovery_panel_viewed",
      properties: {
        sessionCount,
      },
    });
  }

  /**
   * Flushes queued events to the server.
   */
  async flush(): Promise<void> {
    if (this.disposed || this.eventQueue.length === 0) {
      return;
    }

    if (!this.isAnalyticsEnabled()) {
      // Clear queue if analytics was disabled
      this.eventQueue = [];
      await this.saveQueue();
      return;
    }

    // Check authentication
    const isAuthenticated = await this.authService.isAuthenticated();
    if (!isAuthenticated) {
      this.log("Not authenticated, skipping analytics flush");
      return;
    }

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await this.sendEvents(eventsToSend);
      this.log(`Sent ${eventsToSend.length} analytics event(s)`);
      await this.saveQueue();
    } catch (error) {
      // Re-queue failed events
      this.eventQueue = [...eventsToSend, ...this.eventQueue];
      await this.saveQueue();
      this.log(
        `Failed to send analytics: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Checks if analytics is enabled in settings.
   */
  isAnalyticsEnabled(): boolean {
    const config = vscode.workspace.getConfiguration("contextor");
    return config.get<boolean>("analytics.enabled", true);
  }

  /**
   * Gets the current queue size.
   */
  getQueueSize(): number {
    return this.eventQueue.length;
  }

  /**
   * Disposes of the service.
   */
  dispose(): void {
    this.disposed = true;

    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    // Try to flush remaining events
    void this.flush();
  }

  /**
   * Sends events to the Contextor API.
   */
  private async sendEvents(events: QueuedEvent[]): Promise<void> {
    const accessToken = await this.authService.getAccessToken();
    if (!accessToken) {
      throw new Error("No access token available");
    }

    const apiEndpoint = this.settingsService.apiEndpoint;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${apiEndpoint}/analytics/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          events: events.map((e) => ({
            name: e.event.event,
            properties: e.event.properties,
            timestamp: new Date(e.timestamp).toISOString(),
          })),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Starts the batch sending timer.
   */
  private startBatchTimer(): void {
    if (this.batchTimer) {
      return;
    }

    this.batchTimer = setInterval(() => {
      void this.flush();
    }, BATCH_INTERVAL_MS);
  }

  /**
   * Loads the event queue from storage.
   */
  private loadQueue(): void {
    const stored =
      this.context.globalState.get<QueuedEvent[]>(QUEUE_STORAGE_KEY);
    if (stored && Array.isArray(stored)) {
      this.eventQueue = stored;
    }
  }

  /**
   * Saves the event queue to storage.
   */
  private async saveQueue(): Promise<void> {
    await this.context.globalState.update(QUEUE_STORAGE_KEY, this.eventQueue);
  }

  /**
   * Logs a message to the output channel.
   */
  private log(message: string): void {
    if (this.outputChannel) {
      const timestamp = new Date().toISOString();
      this.outputChannel.appendLine(
        `[${timestamp}] [AnalyticsService] ${message}`
      );
    }
  }
}

/**
 * Creates a new AnalyticsService instance.
 */
export function createAnalyticsService(
  context: vscode.ExtensionContext,
  settingsService: SettingsService,
  authService: AuthService
): AnalyticsService {
  return new AnalyticsService(context, settingsService, authService);
}
