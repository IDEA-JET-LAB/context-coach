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
        this.log(`Data API endpoint updated to: ${changes.apiEndpoint} (auth always uses production)`);
      }
    });
    this.disposables.push(settingsDisposable);
    this.disposables.push(this._onDidChangeAuth);
  }

  /**
   * Production API endpoint for authentication.
   * Auth always uses production because user identity doesn't change between environments.
   * Only data queries should switch based on DEV/PROD toggle.
   */
  private readonly PROD_API_ENDPOINT = "https://contextor.co/api";

  /**
   * Gets the API endpoint for authentication operations.
   * Always uses production to avoid state mismatch issues when switching environments.
   */
  private get authEndpoint(): string {
    return this.PROD_API_ENDPOINT;
  }

  /**
   * Gets the current API endpoint from settings (for non-auth operations).
   * @deprecated Use authEndpoint for auth operations
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

      // Build the authorization URL - always use production for auth
      const redirectUri = this.getCallbackUri();
      const authorizeUrl = new URL(`${this.authEndpoint}/auth/vscode/authorize`);
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
    this.log(`[AUTH DEBUG] Access token exists: ${!!accessToken}`);

    if (!accessToken) {
      this.log("[AUTH DEBUG] No access token found - returning false");
      return false;
    }

    // Check if token is expired
    const expiryStr = await this.secrets.get(KEYS.TOKEN_EXPIRY);
    this.log(`[AUTH DEBUG] Token expiry string: ${expiryStr}`);

    if (expiryStr) {
      const expiry = parseInt(expiryStr, 10);
      const now = Date.now();
      const timeUntilExpiry = expiry - now;
      const bufferMs = TOKEN_REFRESH_BUFFER_SECONDS * 1000;

      this.log(`[AUTH DEBUG] Token expires in: ${Math.round(timeUntilExpiry / 1000)}s, buffer: ${TOKEN_REFRESH_BUFFER_SECONDS}s`);

      // If token is expired, check if we can refresh
      if (now >= expiry - bufferMs) {
        this.log("[AUTH DEBUG] Token expired or within buffer window");
        const refreshToken = await this.secrets.get(KEYS.REFRESH_TOKEN);
        this.log(`[AUTH DEBUG] Refresh token exists: ${!!refreshToken}`);

        if (refreshToken) {
          // We have a refresh token, so we're still "authenticated"
          // The actual refresh will happen when getAccessToken is called
          this.log("[AUTH DEBUG] Has refresh token - returning true");
          return true;
        }
        // No refresh token and access token is expired
        this.log("[AUTH DEBUG] No refresh token and token expired - returning false");
        return false;
      }
    }

    this.log("[AUTH DEBUG] Token valid - returning true");
    return true;
  }

  /**
   * Gets the current access token, refreshing if necessary.
   * Returns undefined if not authenticated.
   */
  async getAccessToken(): Promise<string | undefined> {
    const accessToken = await this.secrets.get(KEYS.ACCESS_TOKEN);
    if (!accessToken) {
      this.log("getAccessToken: No access token stored");
      return undefined;
    }

    // Check if token needs refresh
    const expiryStr = await this.secrets.get(KEYS.TOKEN_EXPIRY);
    const now = Date.now();

    // If no expiry stored, treat token as potentially expired and try refresh
    if (!expiryStr) {
      this.log("getAccessToken: No expiry stored, attempting refresh to validate token");
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        return this.secrets.get(KEYS.ACCESS_TOKEN);
      }
      // Refresh failed - token might still work, return it and let the API decide
      this.log("getAccessToken: Refresh failed, returning existing token");
      return accessToken;
    }

    const expiry = parseInt(expiryStr, 10);
    const timeUntilExpiry = expiry - now;
    const bufferMs = TOKEN_REFRESH_BUFFER_SECONDS * 1000;

    // Refresh if within buffer window (60 seconds before expiry)
    if (now >= expiry - bufferMs) {
      this.log(`getAccessToken: Token expired or expiring in ${Math.round(timeUntilExpiry / 1000)}s, attempting refresh`);
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        this.log("getAccessToken: Refresh successful, returning new token");
        return this.secrets.get(KEYS.ACCESS_TOKEN);
      }
      // Refresh failed, clear tokens and prompt re-login
      this.log("getAccessToken: Refresh failed, logging out");
      await this.logout();
      return undefined;
    }

    this.log(`getAccessToken: Token valid for ${Math.round(timeUntilExpiry / 1000)}s`);
    return accessToken;
  }

  /**
   * Gets the current refresh token, if available.
   */
  async getRefreshToken(): Promise<string | undefined> {
    return this.secrets.get(KEYS.REFRESH_TOKEN);
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
      const response = await fetch(`${this.authEndpoint}/auth/vscode/me`, {
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
    const response = await fetch(`${this.authEndpoint}/auth/vscode/token`, {
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
      this.log("refreshAccessToken: No refresh token available");
      return false;
    }

    try {
      this.log(`refreshAccessToken: Attempting refresh via ${this.authEndpoint}/auth/vscode/refresh`);

      const response = await fetch(`${this.authEndpoint}/auth/vscode/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorBody = (await response.json()) as ApiError;
          errorMessage = `${errorBody.error?.code}: ${errorBody.error?.message}`;
        } catch {
          // Couldn't parse error body
        }
        this.log(`refreshAccessToken: Failed - ${errorMessage}`);
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

      this.log(`refreshAccessToken: Success, new token expires in ${refreshResponse.expires_in}s`);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log(`refreshAccessToken: Network error - ${errorMsg}`);
      return false;
    }
  }

  /**
   * Signs up a new user with email and password.
   * Returns a result indicating success, failure, or email confirmation required.
   */
  async signup(email: string, password: string): Promise<{
    success: boolean;
    message: string;
    requiresEmailConfirmation?: boolean;
    error?: string;
  }> {
    this.log(`Starting signup for: ${email}`);

    try {
      const response = await fetch(`${this.authEndpoint}/auth/vscode/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, confirmPassword: password }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error?.message || "Signup failed";
        this.log(`Signup failed: ${errorMessage}`);
        return {
          success: false,
          message: errorMessage,
          error: data.error?.code || "SIGNUP_FAILED",
        };
      }

      // Check if email confirmation is required
      if (data.requiresEmailConfirmation) {
        this.log("Signup successful - email confirmation required");
        return {
          success: true,
          message: data.message || "Please check your email to verify your account.",
          requiresEmailConfirmation: true,
        };
      }

      // If tokens were returned, store them and authenticate
      if (data.tokens) {
        await this.storeTokens(data.tokens);
        this.log(`Signup successful - user authenticated: ${data.tokens.user.email}`);
        vscode.window.showInformationMessage(
          `Welcome to Contextor, ${data.tokens.user.name || data.tokens.user.email}!`
        );
        this._onDidChangeAuth.fire();
        return {
          success: true,
          message: "Account created successfully!",
          requiresEmailConfirmation: false,
        };
      }

      // Success without tokens - user needs to sign in
      this.log("Signup successful - user needs to sign in");
      return {
        success: true,
        message: data.message || "Account created! Please sign in to continue.",
        requiresEmailConfirmation: false,
      };
    } catch (error) {
      this.logError("Signup error", error);
      return {
        success: false,
        message: "Unable to create account. Please check your connection and try again.",
        error: "NETWORK_ERROR",
      };
    }
  }

  /**
   * Opens Google OAuth signup in the browser.
   * After signing up, the user will need to use "Sign In" to authenticate the extension.
   */
  async signupWithGoogle(): Promise<void> {
    this.log("Opening Google signup in browser");

    // Open the web app's signup page with OAuth focus - always use production
    const signupUrl = new URL(`${this.authEndpoint.replace("/api", "")}/signup`);
    signupUrl.searchParams.set("from", "vscode");

    const opened = await vscode.env.openExternal(
      vscode.Uri.parse(signupUrl.toString())
    );

    if (!opened) {
      throw new Error("Failed to open browser for Google signup");
    }

    vscode.window.showInformationMessage(
      "Complete signup in your browser, then use 'Sign In' to connect the extension."
    );
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
