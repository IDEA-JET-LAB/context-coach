# Story 19.2: Authentication Flow

Status: Ready

## PRD Alignment Note

> **Story Number Mapping:** During implementation planning, Epic 19 was reorganized for better modularity. The PRD's original feature 19.2 ("Analytics Dashboard Panel") content is distributed across Stories 19-3 (Sidebar Panel) and 19-4 (Realtime Analytics Display). This Authentication Flow story was extracted as a separate foundational story because authentication is a prerequisite for all other extension features.
>
> **Authentication Requirements Source:** This story implements the authentication requirements implied by PRD 19.1's "Integration with Contextor web API" - the extension needs authenticated access to fetch user/team data.
>
> **OAuth vs API Key:** The architecture document shows `apiKey` in the sidebar configuration. This story implements OAuth instead because:
> 1. **Better security** - OAuth tokens can be scoped, refreshed, and revoked without user action
> 2. **Better UX** - Users authenticate once via browser rather than copying API keys
> 3. **Consistency** - Matches the web app's authentication model
> 4. **Token refresh** - Automatic token refresh eliminates manual re-authentication
>
> **Architecture Implementation Details:** The `/api/auth/vscode/*` endpoints and `services/auth.ts` patterns are implementation details that extend the high-level architecture. The architecture document focuses on extension structure, not these backend/service specifics.

## Story

**As a** developer using the VS Code extension,
**I want** to authenticate with my Contextor account,
**So that** I can access my team analytics and personalized coaching.

## Acceptance Criteria

1. **Given** I open VS Code with Contextor extension installed
   **When** I am not authenticated
   **Then** I see "Sign in to Contextor" in the sidebar
   **And** clicking it opens a browser for OAuth authentication

2. **Given** I complete authentication in the browser
   **When** the OAuth flow completes
   **Then** the extension receives the access token
   **And** my authentication state persists across VS Code restarts
   **And** I see my name/email in the extension sidebar

3. **Given** I am authenticated
   **When** I run "Contextor: Sign Out" command
   **Then** my credentials are securely removed
   **And** I see the sign-in prompt again

4. **Given** my access token expires
   **When** the extension tries to make an API call
   **Then** the extension automatically refreshes the token
   **Or** prompts me to re-authenticate if refresh fails

5. **Given** the authentication flow
   **When** reviewing security
   **Then** tokens are stored in VS Code SecretStorage (not plain text)
   **And** no credentials are logged or exposed

## Tasks / Subtasks

- [ ] **Task 1: Create authentication service** (AC: #1, #2, #5)
  - [ ] Create `src/services/auth.ts`
  - [ ] Implement `AuthService` class
  - [ ] Add constructor accepting `vscode.ExtensionContext`
  - [ ] Create `login()` method that initiates OAuth flow
  - [ ] Create `logout()` method that clears credentials
  - [ ] Create `getAccessToken()` method for API calls
  - [ ] Create `isAuthenticated()` method for state checks
  - [ ] Create `getUser()` method to return user profile

- [ ] **Task 2: Implement secure token storage** (AC: #5)
  - [ ] Use `context.secrets` (SecretStorage API)
  - [ ] Store access token with key `contextor.accessToken`
  - [ ] Store refresh token with key `contextor.refreshToken`
  - [ ] Store user profile with key `contextor.userProfile`
  - [ ] Add `clearCredentials()` private method
  - [ ] Never log token values (only "[REDACTED]")

- [ ] **Task 3: Implement OAuth browser flow** (AC: #1, #2)
  - [ ] Generate random state parameter for CSRF protection
  - [ ] Create authorization URL with state and redirect URI
  - [ ] Use `vscode.env.openExternal()` to open browser
  - [ ] Register URI handler: `vscode.window.registerUriHandler()`
  - [ ] Handle callback URI: `vscode://contextor.contextor-vscode/callback`
  - [ ] Exchange authorization code for tokens via API
  - [ ] Validate state parameter matches

- [ ] **Task 4: Create API endpoint for VS Code OAuth** (AC: #2)
  - [ ] Create `/api/auth/vscode/authorize` endpoint in Next.js app
  - [ ] Create `/api/auth/vscode/token` endpoint for code exchange
  - [ ] Add `redirect_uri` validation for VS Code URI scheme
  - [ ] Return access token, refresh token, and user profile
  - [ ] Add CORS headers for extension requests

- [ ] **Task 5: Implement token refresh logic** (AC: #4)
  - [ ] Create `refreshAccessToken()` method
  - [ ] Check token expiration before API calls
  - [ ] Call `/api/auth/vscode/refresh` endpoint
  - [ ] Update stored tokens on successful refresh
  - [ ] Emit event for UI to show re-auth prompt on failure
  - [ ] Use `vscode.EventEmitter` for auth state changes

- [ ] **Task 6: Add authentication commands** (AC: #1, #3)
  - [ ] Register `contextor.signIn` command
  - [ ] Register `contextor.signOut` command
  - [ ] Add commands to `package.json` contributes section
  - [ ] Show success message on sign-in
  - [ ] Show confirmation dialog before sign-out
  - [ ] Refresh sidebar on auth state change

- [ ] **Task 7: Create authentication status bar item** (AC: #2)
  - [ ] Create status bar item showing auth state
  - [ ] Show "Sign in" when not authenticated
  - [ ] Show user email when authenticated
  - [ ] Click action opens sign-in or shows menu
  - [ ] Update on auth state changes

- [ ] **Task 8: Integration testing** (AC: #1, #2, #3, #4)
  - [ ] Test complete OAuth flow in development
  - [ ] Verify token persistence across restarts
  - [ ] Test sign-out clears all credentials
  - [ ] Test token refresh mechanism
  - [ ] Verify no tokens in logs or telemetry

## Dev Notes

### OAuth Flow Diagram

```
User clicks "Sign In"
        │
        ▼
┌─────────────────────┐
│ Generate state +    │
│ open browser        │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ User authenticates  │
│ on contextor.co     │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ Redirect to VS Code │
│ vscode://contextor/ │
│ callback?code=...   │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ Exchange code for   │
│ tokens via API      │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ Store in            │
│ SecretStorage       │
└─────────────────────┘
```

### AuthService Reference

```typescript
// src/services/auth.ts
import * as vscode from 'vscode';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  teamId: string;
  teamName: string;
}

export class AuthService {
  private static instance: AuthService;
  private context: vscode.ExtensionContext;
  private _onDidChangeAuth = new vscode.EventEmitter<boolean>();
  readonly onDidChangeAuth = this._onDidChangeAuth.event;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  static initialize(context: vscode.ExtensionContext): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService(context);
    }
    return AuthService.instance;
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      throw new Error('AuthService not initialized');
    }
    return AuthService.instance;
  }

  async login(): Promise<void> {
    const state = this.generateState();
    await this.context.secrets.store('contextor.oauthState', state);

    const authUrl = new URL('https://contextor.co/api/auth/vscode/authorize');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('redirect_uri', 'vscode://contextor.contextor-vscode/callback');

    await vscode.env.openExternal(vscode.Uri.parse(authUrl.toString()));
  }

  async handleCallback(uri: vscode.Uri): Promise<void> {
    const params = new URLSearchParams(uri.query);
    const code = params.get('code');
    const state = params.get('state');

    const storedState = await this.context.secrets.get('contextor.oauthState');
    if (state !== storedState) {
      throw new Error('Invalid OAuth state - possible CSRF attack');
    }

    const tokens = await this.exchangeCodeForTokens(code!);
    await this.storeCredentials(tokens);

    this._onDidChangeAuth.fire(true);
    vscode.window.showInformationMessage('Successfully signed in to Contextor!');
  }

  async logout(): Promise<void> {
    await this.clearCredentials();
    this._onDidChangeAuth.fire(false);
    vscode.window.showInformationMessage('Signed out of Contextor');
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.context.secrets.get('contextor.accessToken');
    return !!token;
  }

  async getAccessToken(): Promise<string | undefined> {
    const token = await this.context.secrets.get('contextor.accessToken');
    if (!token) return undefined;

    // Check expiration and refresh if needed
    const expiry = await this.context.secrets.get('contextor.tokenExpiry');
    if (expiry && Date.now() > parseInt(expiry) - 60000) {
      return this.refreshAccessToken();
    }

    return token;
  }

  async getUser(): Promise<UserProfile | undefined> {
    const profileJson = await this.context.secrets.get('contextor.userProfile');
    if (!profileJson) return undefined;
    return JSON.parse(profileJson);
  }

  private generateState(): string {
    const array = new Uint8Array(32);
    require('crypto').randomFillSync(array);
    return Buffer.from(array).toString('hex');
  }

  private async exchangeCodeForTokens(code: string): Promise<TokenResponse> {
    const response = await fetch('https://contextor.co/api/auth/vscode/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        redirect_uri: 'vscode://contextor.contextor-vscode/callback'
      })
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for tokens');
    }

    return response.json();
  }

  private async storeCredentials(tokens: TokenResponse): Promise<void> {
    await this.context.secrets.store('contextor.accessToken', tokens.access_token);
    await this.context.secrets.store('contextor.refreshToken', tokens.refresh_token);
    await this.context.secrets.store('contextor.tokenExpiry', String(Date.now() + tokens.expires_in * 1000));
    await this.context.secrets.store('contextor.userProfile', JSON.stringify(tokens.user));
  }

  private async clearCredentials(): Promise<void> {
    await this.context.secrets.delete('contextor.accessToken');
    await this.context.secrets.delete('contextor.refreshToken');
    await this.context.secrets.delete('contextor.tokenExpiry');
    await this.context.secrets.delete('contextor.userProfile');
    await this.context.secrets.delete('contextor.oauthState');
  }

  private async refreshAccessToken(): Promise<string | undefined> {
    const refreshToken = await this.context.secrets.get('contextor.refreshToken');
    if (!refreshToken) {
      this._onDidChangeAuth.fire(false);
      return undefined;
    }

    try {
      const response = await fetch('https://contextor.co/api/auth/vscode/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      if (!response.ok) {
        throw new Error('Refresh failed');
      }

      const tokens = await response.json();
      await this.storeCredentials(tokens);
      return tokens.access_token;
    } catch {
      this._onDidChangeAuth.fire(false);
      vscode.window.showWarningMessage('Session expired. Please sign in again.');
      return undefined;
    }
  }
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: UserProfile;
}
```

### URI Handler Reference

```typescript
// In extension.ts activate function
const uriHandler: vscode.UriHandler = {
  handleUri(uri: vscode.Uri) {
    if (uri.path === '/callback') {
      AuthService.getInstance().handleCallback(uri);
    }
  }
};
context.subscriptions.push(vscode.window.registerUriHandler(uriHandler));
```

### Package.json Additions

```json
{
  "contributes": {
    "commands": [
      {
        "command": "contextor.signIn",
        "title": "Contextor: Sign In"
      },
      {
        "command": "contextor.signOut",
        "title": "Contextor: Sign Out"
      }
    ]
  }
}
```

### Security Considerations

1. **SecretStorage** - Uses OS keychain (Keychain on macOS, Credential Manager on Windows)
2. **State parameter** - Prevents CSRF attacks in OAuth flow
3. **Token refresh** - Access tokens expire, refresh tokens are longer-lived
4. **No logging** - Tokens must never appear in logs
5. **HTTPS only** - All API calls use HTTPS

### Anti-Patterns to Avoid

1. **DO NOT** store tokens in `globalState` - use `secrets`
2. **DO NOT** log token values - use "[REDACTED]"
3. **DO NOT** skip state validation - CSRF risk
4. **DO NOT** hardcode client secrets in extension - use PKCE flow
5. **DO NOT** expose user data in telemetry

### Story Dependencies

- **Depends on:** Story 19.1 (Extension Scaffold)
- **Blocks:** Stories 19.3, 19.4, 19.5 (require auth for API calls)

### References

- [VS Code SecretStorage API](https://code.visualstudio.com/api/references/vscode-api#SecretStorage)
- [VS Code URI Handler](https://code.visualstudio.com/api/references/vscode-api#UriHandler)
- [OAuth 2.0 for Native Apps](https://datatracker.ietf.org/doc/html/rfc8252)


## Design System Requirements

**MANDATORY:** This story MUST use existing design system components exclusively.

### Pre-Implementation Checklist
- [ ] Reviewed `_bmad-output/DESIGN-SYSTEM-MANDATE.md` for component inventory
- [ ] Checked `/design` route for component examples
- [ ] Identified required components from the inventory below
- [ ] Confirmed no hardcoded colors - using semantic tokens only
- [ ] No new UI patterns needed (or Design Epic story created)

### Required Components
<!-- Dev agent: Fill in specific components needed from DESIGN-SYSTEM-MANDATE.md -->
- Review `/design` route and `components/` directory before implementation
- Use semantic tokens: `bg-surface-*`, `text-content-*`, `border-border-*`

### Styling Rules
- NO hardcoded colors (no `bg-zinc-*`, `text-gray-*`, etc.)
- Use existing components from `components/` directory
- Extend existing components before creating new ones

## Dev Agent Record

### Agent Model Used

<!-- To be filled by implementing agent -->

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

| Date | Change | Author |
|------|--------|--------|

### File List

*To be filled by dev agent - list all files created/modified*
