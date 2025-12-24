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

    // Extract Supabase URL from API endpoint
    // API endpoint: https://contextor.co/api or http://127.0.0.1:3050/api
    // We need the Supabase URL directly for realtime
    const supabaseUrl = this.getSupabaseUrl();
    const supabaseAnonKey = this.getSupabaseAnonKey();

    if (!supabaseUrl || !supabaseAnonKey) {
      this.log("Supabase URL or anon key not configured, realtime disabled");
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 2,
        },
      },
    });

    // Try to connect if already authenticated
    await this.handleAuthChange();
  }

  /**
   * Handle authentication state changes.
   */
  private async handleAuthChange(): Promise<void> {
    const isAuth = await this.authService.isAuthenticated();

    if (isAuth) {
      const user = await this.authService.getUser();
      const accessToken = await this.authService.getAccessToken();

      if (user?.id && user.id !== this.userId) {
        this.userId = user.id;

        // Set the user's access token on the Supabase client for RLS
        if (this.supabase && accessToken) {
          await this.supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: '', // We manage refresh separately
          });
          this.log(`Set Supabase session for user: ${user.id}`);
        }

        await this.connect();
      }
    } else {
      this.disconnect();
      this.userId = null;
    }
  }

  /**
   * Connect to Supabase Realtime and subscribe to prompt changes.
   */
  private async connect(): Promise<void> {
    if (!this.supabase || !this.userId) {
      this.log("Cannot connect: missing supabase client or user ID");
      return;
    }

    if (this.isConnected) {
      this.log("Already connected to realtime");
      return;
    }

    this.log(`Connecting to realtime for user: ${this.userId}`);

    try {
      // Subscribe to INSERT events on the prompts table for this user
      this.channel = this.supabase
        .channel(`prompts:user:${this.userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "prompts",
            filter: `user_id=eq.${this.userId}`,
          },
          (payload) => {
            this.log(`New prompt received: ${payload.new.id}`);
            this.notifyNewPrompt(payload.new.id as string);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "prompt_analyses",
            // Note: prompt_analyses has prompt_id, not user_id
            // We'll filter in the callback
          },
          (payload) => {
            this.log(`New analysis received for prompt: ${payload.new.prompt_id}`);
            this.notifyNewPrompt(payload.new.prompt_id as string);
          }
        )
        .subscribe((status) => {
          this.log(`Realtime subscription status: ${status}`);
          if (status === "SUBSCRIBED") {
            this.isConnected = true;
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            this.isConnected = false;
            this.scheduleReconnect();
          }
        });
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
