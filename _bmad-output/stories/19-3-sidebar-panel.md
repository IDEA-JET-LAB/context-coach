# Story 19.3: Sidebar Panel

Status: Ready

## Dependencies

- **Story 19-1:** Extension Scaffold (provides VS Code extension structure, package.json, build config)
- **Story 19-2:** Authentication Flow (provides AuthService, OAuth integration, token management)

## PRD Alignment Note

The PRD describes Epic 19.3 as "Session Browser and History View" while this story implements a "Sidebar Panel" with an analytics webview. This implementation intentionally combines both features into a unified sidebar experience:

- **Analytics Panel** (`analyticsPanel.ts`): Provides the webview-based analytics dashboard described in the architecture, displaying prompt scores, trends, and coaching tips in a rich UI
- **Session Awareness**: The sidebar includes a `contextor.sessionView` (tree view) that serves as the session browser, showing recent sessions and history
- **Webview Approach**: Using a webview rather than tree view alone enables richer visualization (charts, styled cards, responsive layouts) that matches the web app experience
- **Architecture Alignment**: Both `sessionBrowser.ts` and `analyticsPanel.ts` from the architecture document are utilized within this unified sidebar implementation

The sidebar panel serves as the primary container for all Contextor extension UI, with analytics and session browsing as complementary views within the same Activity Bar container.

## Story

**As a** developer using the VS Code extension,
**I want** a dedicated sidebar panel for Contextor,
**So that** I can view my analytics and coaching tips without leaving VS Code.

## Acceptance Criteria

1. **Given** the Contextor extension is installed
   **When** I click the Contextor icon in the Activity Bar
   **Then** a sidebar panel opens with the Contextor view

2. **Given** I am not authenticated
   **When** I open the Contextor sidebar
   **Then** I see a welcome message and "Sign In" button
   **And** clicking the button initiates the OAuth flow

3. **Given** I am authenticated
   **When** I open the Contextor sidebar
   **Then** I see my analytics dashboard in a webview
   **And** I see my recent prompts and scores
   **And** the view uses consistent styling with the web app:
   - Color palette uses CSS variables matching the web app theme (primary blue `#3B82F6`, success green `#22C55E`, etc.)
   - Typography uses Inter font family with consistent sizing (14px base, 12px small, 16px headings)
   - Spacing follows 4px grid system (8px, 16px, 24px increments)
   - Components use same border-radius (8px cards, 4px buttons) and shadow styles
   - Respects VS Code theme variables for background and text colors to ensure light/dark mode compatibility

4. **Given** the sidebar is open
   **When** I resize the sidebar
   **Then** the webview content responds appropriately
   **And** the layout remains usable at narrow widths

5. **Given** the webview is loaded
   **When** there is a communication error
   **Then** I see an error state with retry option
   **And** the extension logs the error for debugging

## Tasks / Subtasks

- [ ] **Task 1: Register Activity Bar icon** (AC: #1)
  - [ ] Add Contextor icon SVG to `images/contextor-icon.svg`
  - [ ] Configure `viewsContainers.activitybar` in package.json
  - [ ] Set icon path and title
  - [ ] Configure view container ID: `contextor`

- [ ] **Task 2: Register sidebar views** (AC: #1, #2, #3)
  - [ ] Configure `contributes.views.contextor` array
  - [ ] Add view: `contextor.analyticsView` (webview)
  - [ ] Add view: `contextor.sessionView` (tree view - placeholder)
  - [ ] Set view titles and icons
  - [ ] Set `when` clause for auth-dependent views

- [ ] **Task 3: Create WebviewViewProvider** (AC: #3, #4)
  - [ ] Create `src/providers/analyticsPanel.ts`
  - [ ] Implement `vscode.WebviewViewProvider` interface
  - [ ] Implement `resolveWebviewView()` method
  - [ ] Enable scripts and local resources in webview
  - [ ] Set `retainContextWhenHidden: true` for state preservation

- [ ] **Task 4: Create welcome view for unauthenticated state** (AC: #2)
  - [ ] Configure `viewsWelcome` contribution for `contextor.analyticsView`
  - [ ] Add welcome message text
  - [ ] Add "Sign In" button linking to `contextor.signIn` command
  - [ ] Set `when` clause: `!contextor.authenticated`

- [ ] **Task 5: Build React webview app** (AC: #3, #4)
  - [ ] Create `webviews/analytics/` React app structure
  - [ ] Configure Vite for webview bundling
  - [ ] Create `App.tsx` main component
  - [ ] Create `Dashboard.tsx` analytics component
  - [ ] Apply Contextor styling (match web app)
  - [ ] Add responsive layout for narrow sidebar

- [ ] **Task 6: Implement extension-webview messaging** (AC: #3, #5)
  - [ ] Define message types in `src/types/messages.ts`
  - [ ] Send analytics data from extension to webview
  - [ ] Handle refresh requests from webview
  - [ ] Send auth state updates to webview
  - [ ] Handle error states and retry logic

- [ ] **Task 7: Create webview HTML template** (AC: #3)
  - [ ] Create HTML template with CSP headers
  - [ ] Include bundled React app script
  - [ ] Apply VS Code webview styles
  - [ ] Add nonce for script security
  - [ ] Handle dark/light theme

- [ ] **Task 8: Register provider and build** (AC: #1, #3)
  - [ ] Register `WebviewViewProvider` in `extension.ts`
  - [ ] Update esbuild config to bundle webview separately
  - [ ] Add webview build to npm scripts
  - [ ] Verify panel opens correctly
  - [ ] Test at various sidebar widths

## Dev Notes

### Package.json Contributions

```json
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "contextor",
          "title": "Contextor",
          "icon": "images/contextor-icon.svg"
        }
      ]
    },
    "views": {
      "contextor": [
        {
          "type": "webview",
          "id": "contextor.analyticsView",
          "name": "Analytics"
        },
        {
          "id": "contextor.sessionView",
          "name": "Sessions",
          "when": "contextor.authenticated"
        }
      ]
    },
    "viewsWelcome": [
      {
        "view": "contextor.analyticsView",
        "contents": "Welcome to Contextor!\n\nTrack and improve your AI prompting skills.\n\n[Sign In](command:contextor.signIn)",
        "when": "!contextor.authenticated"
      }
    ]
  }
}
```

### WebviewViewProvider Reference

```typescript
// src/providers/analyticsPanel.ts
import * as vscode from 'vscode';
import { AuthService } from '../services/auth';
import { ContextorAPI } from '../services/api';

export class AnalyticsPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'contextor.analyticsView';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly authService: AuthService
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'webviews', 'analytics', 'dist')
      ]
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'refresh':
          await this.sendAnalytics();
          break;
        case 'error':
          console.error('Webview error:', message.error);
          break;
      }
    });

    // Initial data load
    this.sendAnalytics();

    // Listen for auth changes
    this.authService.onDidChangeAuth(() => {
      this.sendAnalytics();
    });
  }

  private async sendAnalytics(): Promise<void> {
    if (!this._view) return;

    try {
      const isAuth = await this.authService.isAuthenticated();
      if (!isAuth) {
        this._view.webview.postMessage({ type: 'auth', authenticated: false });
        return;
      }

      const token = await this.authService.getAccessToken();
      const user = await this.authService.getUser();
      const api = new ContextorAPI(token!);
      const analytics = await api.getAnalytics(user!.teamId, '7d');

      this._view.webview.postMessage({
        type: 'analytics',
        data: analytics,
        user
      });
    } catch (error) {
      this._view.webview.postMessage({
        type: 'error',
        message: 'Failed to load analytics'
      });
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webviews', 'analytics', 'dist', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webviews', 'analytics', 'dist', 'index.css')
    );

    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <title>Contextor Analytics</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
```

### Webview React App Structure

```
webviews/analytics/
├── package.json
├── vite.config.ts
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── Dashboard.tsx
│   │   ├── ScoreCard.tsx
│   │   ├── RecentPrompts.tsx
│   │   ├── ErrorState.tsx
│   │   └── Loading.tsx
│   ├── hooks/
│   │   └── useVSCodeApi.ts
│   └── styles/
│       └── index.css
└── dist/                 # Build output
```

### Message Types

```typescript
// src/types/messages.ts
export type ExtensionToWebviewMessage =
  | { type: 'auth'; authenticated: boolean }
  | { type: 'analytics'; data: AnalyticsData; user: UserProfile }
  | { type: 'error'; message: string };

export type WebviewToExtensionMessage =
  | { type: 'refresh' }
  | { type: 'error'; error: string };
```

### Responsive Layout Considerations

- Minimum sidebar width: 200px
- Use flexbox column layout
- Collapse horizontal elements at narrow widths
- Prioritize score display and recent prompts
- Use VS Code theme variables for colors

### Anti-Patterns to Avoid

1. **DO NOT** forget CSP headers - security requirement
2. **DO NOT** use external URLs in webview - local resources only
3. **DO NOT** forget `retainContextWhenHidden` for state preservation
4. **DO NOT** block extension activation with webview loading
5. **DO NOT** use inline scripts without nonce

### Blocked Stories

- **Blocks:** Story 19.4 (Real-time Analytics Display)

### References

- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [VS Code Webview View](https://code.visualstudio.com/api/references/vscode-api#WebviewView)
- [Vite for Webviews](https://vitejs.dev/)


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

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

| Date | Change | Author |
|------|--------|--------|

### File List

*To be filled by dev agent - list all files created/modified*
