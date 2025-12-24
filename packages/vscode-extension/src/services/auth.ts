import * as vscode from "vscode";
import { randomBytes } from "crypto";
import { SettingsService } from "./settings";

/**
 * User profile information from the Contextor API
 */
export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
}

/**
 * Token response from the API
 */
interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: "Bearer";
  user: UserProfile;
}

/**
 * Refresh response from the API
 */
interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: "Bearer";
}

/**
 * Error response from the API
 */
interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

/**
 * Secret storage keys
 */
const KEYS = {
  ACCESS_TOKEN: "contextor.accessToken",
  REFRESH_TOKEN: "contextor.refreshToken",
  TOKEN_EXPIRY: "contextor.tokenExpiry",
  USER_PROFILE: "contextor.userProfile",
  PENDING_STATE: "contextor.pendingState",
} as const;

/**
 * Buffer time (in seconds) before token expiry to trigger refresh
 * Refresh 60 seconds before actual expiry to avoid race conditions
 */
const TOKEN_REFRESH_BUFFER_SECONDS = 60;

/**
 * AuthService handles OAuth authentication flow for the VS Code extension.
 * Uses SecretStorage for secure credential storage in the OS keychain.
 */
export class AuthService {
  private readonly secrets: vscode.SecretStorage;
  private readonly outputChannel: vscode.OutputChannel;
  private readonly settingsService: SettingsService;
  private readonly disposables: vscode.Disposable[] = [];

  /**
   * Event emitter for auth state changes.
   * Fires when user logs in or logs out.
   */
  private readonly _onDidChangeAuth = new vscode.EventEmitter<void>();

  /**
   * Event that fires when the authentication state changes.
   * Subscribe to this to react to login/logout.
   */
  public readonly onDidChangeAuth = this._onDidChangeAuth.event;

  constructor(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel
  ) {
    this.secrets = context.secrets;
    this.outputChannel = outputChannel;

    // Use SettingsService for configuration
    this.settingsService = SettingsService.getInstance();

    // Subscribe to settings changes for API endpoint
    const settingsDisposable = this.settingsService.onDidChange((changes) => {
      if (changes.apiEndpoint) {
        this.log(`API endpoint updated to: ${changes.apiEndpoint}`);
      }
    });
    this.disposables.push(settingsDisposable);
    this.disposables.push(this._onDidChangeAuth);
  }

  /**
   * Gets the current API endpoint from settings.
   */
  private get apiEndpoint(): string {
    return this.settingsService.apiEndpoint;
  }

  /**
   * Disposes of resources held by this service.
   */
  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables.length = 0;
  }

  /**
   * Initiates the OAuth login flow.
   * Opens the browser to authenticate with Contextor.
   */
  async login(): Promise<void> {
    this.log("Starting OAuth login flow");

    try {
      // Generate a random state token for CSRF protection
      const state = this.generateState();
      await this.secrets.store(KEYS.PENDING_STATE, state);

      // Build the authorization URL
      const redirectUri = this.getCallbackUri();
      const authorizeUrl = new URL(`${this.apiEndpoint}/auth/vscode/authorize`);
      authorizeUrl.searchParams.set("state", state);
      authorizeUrl.searchParams.set("redirect_uri", redirectUri);

      this.log(`Opening browser for authentication`);
      this.log(`Callback URI: ${redirectUri}`);

      // Open the authorization URL in the default browser
      const opened = await vscode.env.openExternal(
        vscode.Uri.parse(authorizeUrl.toString())
      );

      if (!opened) {
        throw new Error("Failed to open browser for authentication");
      }

      vscode.window.showInformationMessage(
        "Please complete authentication in your browser."
      );
    } catch (error) {
      this.logError("Login failed", error);
      throw error;
    }
  }

  /**
   * Logs the user out by clearing all stored credentials.
   */
  async logout(): Promise<void> {
    this.log("Logging out - clearing all credentials");

    try {
      await Promise.all([
        this.secrets.delete(KEYS.ACCESS_TOKEN),
        this.secrets.delete(KEYS.REFRESH_TOKEN),
        this.secrets.delete(KEYS.TOKEN_EXPIRY),
        this.secrets.delete(KEYS.USER_PROFILE),
        this.secrets.delete(KEYS.PENDING_STATE),
      ]);

      this.log("Successfully logged out");
      vscode.window.showInformationMessage("Successfully signed out of Contextor.");

      // Notify listeners of auth change
      this._onDidChangeAuth.fire();
    } catch (error) {
      this.logError("Logout failed", error);
      throw error;
    }
  }

  /**
   * Waits for SecretStorage to be ready.
   * On VS Code reload, SecretStorage may take time to initialize.
   * Returns true when ready, false if timeout reached.
   */
  async waitForReady(maxWaitMs: number = 3000): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 100; // Check every 100ms

    while (Date.now() - startTime < maxWaitMs) {
      try {
        // Try to read a known key - if we previously had a token, this should work
        // If SecretStorage is not ready, this might return undefined even if token exists
        const accessToken = await this.secrets.get(KEYS.ACCESS_TOKEN);

        // If we get a token, SecretStorage is definitely ready
        if (accessToken) {
          this.log("SecretStorage ready (token found)");
          return true;
        }

        // Try to read the expiry too - if both are undefined, either:
        // 1. User is not logged in (legit)
        // 2. SecretStorage isn't ready yet
        const expiry = await this.secrets.get(KEYS.TOKEN_EXPIRY);
        if (expiry) {
          // We have expiry but no token - might be corrupted state
          this.log("SecretStorage ready (expiry found, but no token)");
          return true;
        }

        // Neither found - could be not logged in or not ready
        // Wait a bit and check again
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      } catch (error) {
        // SecretStorage threw an error - definitely not ready
        this.log(`SecretStorage not ready: ${error instanceof Error ? error.message : String(error)}`);
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
    }

    // Timeout reached - SecretStorage should be ready by now
    this.log("SecretStorage warmup timeout - assuming ready");
    return true;
  }

  /**
   * Checks if the user is currently authenticated.
   * Returns true if we have a valid (or refreshable) token.
   */
  async isAuthenticated(): Promise<boolean> {
    const accessToken = await this.secrets.get(KEYS.ACCESS_TOKEN);
    if (!accessToken) {
      return false;
    }

    // Check if token is expired
    const expiryStr = await this.secrets.get(KEYS.TOKEN_EXPIRY);
    if (expiryStr) {
      const expiry = parseInt(expiryStr, 10);
      const now = Date.now();

      // If token is expired, check if we can refresh
      if (now >= expiry - TOKEN_REFRESH_BUFFER_SECONDS * 1000) {
        const refreshToken = await this.secrets.get(KEYS.REFRESH_TOKEN);
        if (refreshToken) {
          // We have a refresh token, so we're still "authenticated"
          // The actual refresh will happen when getAccessToken is called
          return true;
        }
        // No refresh token and access token is expired
        return false;
      }
    }

    return true;
  }

  /**
   * Gets the current access token, refreshing if necessary.
   * Returns undefined if not authenticated.
   */
  async getAccessToken(): Promise<string | undefined> {
    const accessToken = await this.secrets.get(KEYS.ACCESS_TOKEN);
    if (!accessToken) {
      return undefined;
    }

    // Check if token needs refresh
    const expiryStr = await this.secrets.get(KEYS.TOKEN_EXPIRY);
    if (expiryStr) {
      const expiry = parseInt(expiryStr, 10);
      const now = Date.now();

      // Refresh if within buffer window
      if (now >= expiry - TOKEN_REFRESH_BUFFER_SECONDS * 1000) {
        this.log("Access token expired or expiring soon, attempting refresh");
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          return this.secrets.get(KEYS.ACCESS_TOKEN);
        }
        // Refresh failed, clear tokens
        await this.logout();
        return undefined;
      }
    }

    return accessToken;
  }

  /**
   * Gets the current user profile, if authenticated.
   * Will attempt to fetch from API if not cached locally.
   */
  async getUser(): Promise<UserProfile | undefined> {
    // First try to get from cache
    const profileStr = await this.secrets.get(KEYS.USER_PROFILE);
    if (profileStr) {
      try {
        return JSON.parse(profileStr) as UserProfile;
      } catch {
        // Invalid JSON, will try to fetch from API
      }
    }

    // If not cached, try to fetch from API using access token
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return undefined;
    }

    try {
      this.log("User profile not cached, fetching from API");
      const response = await fetch(`${this.apiEndpoint}/auth/vscode/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        this.log(`Failed to fetch user profile: ${response.status}`);
        return undefined;
      }

      const user = (await response.json()) as UserProfile;

      // Cache the profile
      await this.secrets.store(KEYS.USER_PROFILE, JSON.stringify(user));
      this.log(`Fetched and cached user profile: ${user.email}`);

      return user;
    } catch (error) {
      this.logError("Failed to fetch user profile from API", error);
      return undefined;
    }
  }

  /**
   * Handles the OAuth callback from the browser.
   * Validates the state and exchanges the code for tokens.
   */
  async handleCallback(uri: vscode.Uri): Promise<void> {
    this.log(`Handling OAuth callback: ${uri.toString()}`);

    try {
      // Parse the callback URI
      const params = new URLSearchParams(uri.query);
      const code = params.get("code");
      const state = params.get("state");
      const error = params.get("error");

      // Handle error from the auth server
      if (error) {
        const message =
          error === "access_denied"
            ? "Authentication was cancelled"
            : `Authentication failed: ${error}`;
        throw new Error(message);
      }

      if (!code || !state) {
        throw new Error("Invalid callback: missing code or state");
      }

      // Validate state to prevent CSRF
      const pendingState = await this.secrets.get(KEYS.PENDING_STATE);
      if (!pendingState || pendingState !== state) {
        this.log("State mismatch - possible CSRF attack");
        throw new Error("Invalid state parameter. Please try signing in again.");
      }

      // Clear pending state
      await this.secrets.delete(KEYS.PENDING_STATE);

      // Exchange code for tokens
      this.log("Exchanging authorization code for tokens");
      const tokenResponse = await this.exchangeCodeForTokens(code, state);

      // Store tokens and user profile
      await this.storeTokens(tokenResponse);

      this.log(`Successfully authenticated user: ${tokenResponse.user.email}`);
      vscode.window.showInformationMessage(
        `Welcome to Contextor, ${tokenResponse.user.name || tokenResponse.user.email}!`
      );

      // Notify listeners of auth change
      this._onDidChangeAuth.fire();
    } catch (error) {
      this.logError("OAuth callback failed", error);
      vscode.window.showErrorMessage(
        error instanceof Error
          ? error.message
          : "Authentication failed. Please try again."
      );
      throw error;
    }
  }

  /**
   * Generates a cryptographically secure random state token.
   */
  private generateState(): string {
    return randomBytes(32).toString("hex");
  }

  /**
   * Gets the VS Code callback URI for OAuth.
   * Format: vscode://{publisher}.{extension-name}/callback
   */
  private getCallbackUri(): string {
    // Use the extension's URI handler
    // Publisher: ideajetlab, Name: contextor-vscode (from package.json)
    return `vscode://ideajetlab.contextor-vscode/callback`;
  }

  /**
   * Exchanges an authorization code for tokens.
   */
  private async exchangeCodeForTokens(
    code: string,
    state: string
  ): Promise<TokenResponse> {
    const response = await fetch(`${this.apiEndpoint}/auth/vscode/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code, state }),
    });

    if (!response.ok) {
      const errorBody = (await response.json()) as ApiError;
      throw new Error(
        errorBody.error?.message || `Token exchange failed: ${response.status}`
      );
    }

    return response.json() as Promise<TokenResponse>;
  }

  /**
   * Refreshes the access token using the refresh token.
   * Returns true if successful, false if refresh failed.
   */
  private async refreshAccessToken(): Promise<boolean> {
    const refreshToken = await this.secrets.get(KEYS.REFRESH_TOKEN);
    if (!refreshToken) {
      this.log("No refresh token available");
      return false;
    }

    try {
      this.log("Attempting token refresh");

      const response = await fetch(`${this.apiEndpoint}/auth/vscode/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        const errorBody = (await response.json()) as ApiError;
        this.log(`Token refresh failed: ${errorBody.error?.message}`);
        return false;
      }

      const refreshResponse = (await response.json()) as RefreshResponse;

      // Calculate new expiry time
      const expiryTime = Date.now() + refreshResponse.expires_in * 1000;

      // Store new tokens
      await Promise.all([
        this.secrets.store(KEYS.ACCESS_TOKEN, refreshResponse.access_token),
        this.secrets.store(KEYS.REFRESH_TOKEN, refreshResponse.refresh_token),
        this.secrets.store(KEYS.TOKEN_EXPIRY, expiryTime.toString()),
      ]);

      this.log("Token refresh successful");
      return true;
    } catch (error) {
      this.logError("Token refresh error", error);
      return false;
    }
  }

  /**
   * Stores tokens and user profile in SecretStorage.
   */
  private async storeTokens(tokenResponse: TokenResponse): Promise<void> {
    // Calculate expiry time
    const expiryTime = Date.now() + tokenResponse.expires_in * 1000;

    await Promise.all([
      this.secrets.store(KEYS.ACCESS_TOKEN, tokenResponse.access_token),
      this.secrets.store(KEYS.REFRESH_TOKEN, tokenResponse.refresh_token),
      this.secrets.store(KEYS.TOKEN_EXPIRY, expiryTime.toString()),
      this.secrets.store(KEYS.USER_PROFILE, JSON.stringify(tokenResponse.user)),
    ]);
  }

  /**
   * Logs a message to the output channel.
   * IMPORTANT: Never log actual token values.
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] [Auth] ${message}`);
  }

  /**
   * Logs an error to the output channel.
   */
  private logError(message: string, error: unknown): void {
    const timestamp = new Date().toISOString();
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    this.outputChannel.appendLine(
      `[${timestamp}] [Auth] ERROR: ${message}: ${errorMessage}`
    );
  }
}
