/**
 * RealtimeService - Supabase Realtime subscription for instant updates
 *
 * Subscribes to the prompts table to detect new prompt analyses in real-time.
 * When a new prompt is analyzed, it triggers a callback to refresh the UI.
 */

import * as vscode from "vscode";
import { createClient, SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { AuthService } from "./auth";
import { SettingsService } from "./settings";

/**
 * Callback when a new prompt is received
 */
export type NewPromptCallback = (promptId: string) => void;

/**
 * RealtimeService manages Supabase Realtime subscriptions for the extension.
 */
export class RealtimeService {
  private supabase: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private userId: string | null = null;
  private isConnected = false;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private readonly disposables: vscode.Disposable[] = [];

  private onNewPromptCallbacks: NewPromptCallback[] = [];

  constructor(
    private readonly authService: AuthService,
    private readonly outputChannel: vscode.OutputChannel
  ) {
    // Listen for auth changes to connect/disconnect
    const authDisposable = this.authService.onDidChangeAuth(() => {
      void this.handleAuthChange();
    });
    this.disposables.push(authDisposable);
  }

  /**
   * Register a callback to be called when a new prompt is analyzed.
   */
  onNewPrompt(callback: NewPromptCallback): vscode.Disposable {
    this.onNewPromptCallbacks.push(callback);
    return {
      dispose: () => {
        const index = this.onNewPromptCallbacks.indexOf(callback);
        if (index >= 0) {
          this.onNewPromptCallbacks.splice(index, 1);
        }
      },
    };
  }

  /**
   * Initialize the Supabase client and connect if authenticated.
   */
  async initialize(): Promise<void> {
    this.log("Initializing Realtime service");

    // Get Supabase config from settings
    const settings = SettingsService.getInstance();
    const apiEndpoint = settings.apiEndpoint;
    this.log(`API endpoint: ${apiEndpoint}`);

    // Extract Supabase URL from API endpoint
    // API endpoint: https://contextor.co/api or http://127.0.0.1:3050/api
    // We need the Supabase URL directly for realtime
    const supabaseUrl = this.getSupabaseUrl();
    const supabaseAnonKey = this.getSupabaseAnonKey();

    this.log(`Supabase URL: ${supabaseUrl}`);
    this.log(`Supabase anon key: ${supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + '...' : 'NOT SET'}`);

    if (!supabaseUrl || !supabaseAnonKey) {
      this.log("Supabase URL or anon key not configured, realtime disabled");
      return;
    }

    this.log("Creating Supabase client for Realtime...");
    this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 2,
        },
      },
    });
    this.log("Supabase client created successfully");

    // Try to connect if already authenticated
    await this.handleAuthChange();
  }

  /**
   * Handle authentication state changes.
   */
  private async handleAuthChange(): Promise<void> {
    this.log("handleAuthChange called");
    const isAuth = await this.authService.isAuthenticated();
    this.log(`isAuthenticated: ${isAuth}`);

    if (isAuth) {
      const user = await this.authService.getUser();
      const accessToken = await this.authService.getAccessToken();
      this.log(`User: ${user?.id || 'null'}, email: ${user?.email || 'null'}`);
      this.log(`Access token: ${accessToken ? accessToken.substring(0, 20) + '...' : 'NOT SET'}`);

      if (user?.id && user.id !== this.userId) {
        this.userId = user.id;
        this.log(`User ID changed, setting up Realtime for: ${user.id}`);

        // Set the user's access token on the Supabase client for RLS
        if (this.supabase && accessToken) {
          this.log("Setting Supabase auth session...");
          try {
            const { data, error } = await this.supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: '', // We manage refresh separately
            });
            if (error) {
              this.logError("Failed to set Supabase session", error);
            } else {
              this.log(`Supabase session set successfully. User: ${data?.user?.id || 'null'}`);
            }
          } catch (err) {
            this.logError("Exception setting Supabase session", err);
          }
        } else {
          this.log(`Cannot set session: supabase=${!!this.supabase}, accessToken=${!!accessToken}`);
        }

        await this.connect();
      } else {
        this.log(`User ID unchanged or null: ${user?.id}, current: ${this.userId}`);
      }
    } else {
      this.log("Not authenticated, disconnecting Realtime");
      this.disconnect();
      this.userId = null;
    }
  }

  /**
   * Connect to Supabase Realtime and subscribe to prompt changes.
   */
  private async connect(): Promise<void> {
    this.log("connect() called");

    if (!this.supabase || !this.userId) {
      this.log(`Cannot connect: supabase=${!!this.supabase}, userId=${this.userId}`);
      return;
    }

    if (this.isConnected) {
      this.log("Already connected to realtime");
      return;
    }

    const channelName = `prompts:user:${this.userId}`;
    this.log(`Connecting to realtime channel: ${channelName}`);

    try {
      // Subscribe to UPDATE events on prompts table to catch analysis completion
      // When analysis_status changes from 'pending' to 'complete', we notify
      // Note: We don't filter by user_id because:
      // 1. prompts.user_id is a TEXT field from CLI (e.g., "Edgars")
      // 2. auth.uid() is a UUID that doesn't match
      // 3. RLS policy already ensures we only see prompts from our teams
      this.log("Creating channel subscription...");
      this.channel = this.supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "prompts",
            // No filter - RLS handles access control via team_members table
          },
          (payload) => {
            this.log(`Received postgres_changes event!`);
            this.log(`Payload: ${JSON.stringify(payload, null, 2).substring(0, 500)}`);

            const newRecord = payload.new as Record<string, unknown>;
            const oldRecord = payload.old as Record<string, unknown>;

            this.log(`Old status: ${oldRecord.analysis_status}, New status: ${newRecord.analysis_status}`);

            // Only notify if analysis just completed
            if (
              newRecord.analysis_status === "complete" &&
              oldRecord.analysis_status !== "complete"
            ) {
              this.log(`Analysis completed for prompt: ${newRecord.id}`);
              this.notifyNewPrompt(newRecord.id as string);
            } else {
              this.log(`Ignoring update: status change was ${oldRecord.analysis_status} -> ${newRecord.analysis_status}`);
            }
          }
        )
        .subscribe((status, err) => {
          this.log(`Realtime subscription status: ${status}`);
          if (err) {
            this.logError(`Subscription error`, err);
          }
          if (status === "SUBSCRIBED") {
            this.isConnected = true;
            this.log("Successfully subscribed to prompt analysis updates");
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            this.log(`Subscription failed with status: ${status}`);
            this.isConnected = false;
            this.scheduleReconnect();
          } else if (status === "CLOSED") {
            this.log("Channel closed");
            this.isConnected = false;
          }
        });

      this.log("Channel subscription created, waiting for status...");
    } catch (error) {
      this.logError("Failed to connect to realtime", error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from Supabase Realtime.
   */
  private disconnect(): void {
    if (this.channel) {
      this.log("Disconnecting from realtime");
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.isConnected = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  /**
   * Schedule a reconnection attempt.
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    this.log("Scheduling reconnect in 5 seconds...");
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connect();
    }, 5000);
  }

  /**
   * Notify all registered callbacks of a new prompt.
   */
  private notifyNewPrompt(promptId: string): void {
    for (const callback of this.onNewPromptCallbacks) {
      try {
        callback(promptId);
      } catch (error) {
        this.logError("Error in new prompt callback", error);
      }
    }
  }

  /**
   * Get the Supabase URL from configuration.
   */
  private getSupabaseUrl(): string | undefined {
    // Check VS Code settings first
    const config = vscode.workspace.getConfiguration("contextor");
    const url = config.get<string>("supabaseUrl");
    if (url) return url;

    // Fall back to known production URL
    return "https://ddskanjiobrjphscskog.supabase.co";
  }

  /**
   * Get the Supabase anonymous key from configuration.
   * This is the publishable (anon) key, safe to include in client code.
   */
  private getSupabaseAnonKey(): string | undefined {
    // Check VS Code settings first
    const config = vscode.workspace.getConfiguration("contextor");
    const key = config.get<string>("supabaseAnonKey");
    if (key) return key;

    // Fall back to known production anon key (this is PUBLIC, not a secret)
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkc2thbmppb2JyanBoc2Nza29nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMTMzNTIsImV4cCI6MjA4MTg4OTM1Mn0.lB5CtFZunXFR6QbE2OvKRaMWVhZ-zOEb1GmAVqdtKTA";
  }

  /**
   * Dispose of resources.
   */
  dispose(): void {
    this.disconnect();
    this.disposables.forEach((d) => d.dispose());
    this.disposables.length = 0;
    this.onNewPromptCallbacks = [];
  }

  /**
   * Log a message to the output channel.
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] [Realtime] ${message}`);
  }

  /**
   * Log an error to the output channel.
   */
  private logError(message: string, error: unknown): void {
    const timestamp = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.outputChannel.appendLine(
      `[${timestamp}] [Realtime] ERROR: ${message}: ${errorMessage}`
    );
  }
}
