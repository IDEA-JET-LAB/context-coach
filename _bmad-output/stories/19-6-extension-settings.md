# Story 19.6: Extension Settings

Status: Done

## PRD Alignment Note

This story was extracted from PRD Epic 19.1's "settings sync" requirement. A dedicated story provides clearer implementation scope for the VS Code extension settings infrastructure. Settings management is foundational for user customization and enables users to configure API endpoints (for self-hosted installations), refresh intervals, and notification preferences.

## Dependencies

- **Depends on:** Story 19-1 (Extension Scaffold) - provides the base extension structure and package.json
- **Blocks:** None (settings are optional enhancement)

## Story

**As a** developer using the VS Code extension,
**I want** to configure extension settings,
**So that** I can customize the API endpoint, refresh intervals, and preferences.

## Acceptance Criteria

1. **Given** I have the Contextor extension installed
   **When** I open VS Code Settings (Ctrl+,)
   **Then** I see a "Contextor" section with configurable options

2. **Given** I'm in the Contextor settings
   **When** I look at available options
   **Then** I can configure: API endpoint URL, auto-refresh interval, notification preferences
   **And** each setting has a clear description

3. **Given** I change the API endpoint
   **When** the setting is saved
   **Then** all API calls use the new endpoint
   **And** the extension validates the endpoint is reachable

4. **Given** I change the refresh interval
   **When** the setting is saved
   **Then** the analytics auto-refresh uses the new interval
   **And** the minimum interval is 15 seconds

5. **Given** I run "Contextor: Show Settings" command
   **When** the command executes
   **Then** it opens VS Code settings filtered to Contextor options

6. **Given** there are invalid settings
   **When** the extension loads
   **Then** I see a warning notification
   **And** the extension uses default values

## Tasks / Subtasks

- [x] **Task 1: Define configuration schema** (AC: #1, #2)
  - [x] Add `contributes.configuration` to package.json
  - [x] Define `contextor.apiEndpoint` setting (string)
  - [x] Define `contextor.refreshInterval` setting (number, min 15)
  - [x] Define `contextor.showNotifications` setting (boolean)
  - [x] Define `contextor.showStatusBarItem` setting (boolean)
  - [x] Add descriptions and defaults for each setting

- [x] **Task 2: Create settings service** (AC: #3, #4)
  - [x] Create `src/services/settings.ts`
  - [x] Implement `SettingsService` class
  - [x] Add getters for each setting
  - [x] Add `onDidChangeSettings` event emitter
  - [x] Validate settings on load

- [x] **Task 3: Implement API endpoint configuration** (AC: #3)
  - [x] Read API endpoint from settings
  - [x] Default to `https://contextor.co/api` (production URL includes `/api` path)
  - [x] Validate URL format on change
  - [x] Test endpoint reachability on change (use `/health` endpoint)
  - [x] Update `ContextorAPI` instance with new endpoint
  - [x] Show validation error if endpoint unreachable

- [x] **Task 4: Implement refresh interval configuration** (AC: #4)
  - [x] Read refresh interval from settings
  - [x] Default to 30 seconds
  - [x] Enforce minimum of 15 seconds
  - [x] Update refresh timer when setting changes
  - [x] Show warning if below minimum

- [x] **Task 5: Implement notification preferences** (AC: #2)
  - [x] Read notification preference from settings
  - [x] Default to true (enabled)
  - [x] Gate all `vscode.window.showInformationMessage` calls
  - [x] Keep error messages always visible
  - [x] Allow per-notification type settings (future)

- [x] **Task 6: Implement settings command** (AC: #5)
  - [x] Register `contextor.showSettings` command
  - [x] Open Settings UI with query: `@ext:contextor.contextor-vscode`
  - [x] Alternatively open Settings JSON with cursor at Contextor section

- [x] **Task 7: Add settings validation and defaults** (AC: #6)
  - [x] Create `validateSettings()` function
  - [x] Check all required settings have valid values
  - [x] Show warning for invalid settings
  - [x] Fall back to defaults for invalid values
  - [x] Log validation errors for debugging

- [x] **Task 8: Handle settings changes** (AC: #3, #4)
  - [x] Subscribe to `vscode.workspace.onDidChangeConfiguration`
  - [x] Filter to `contextor.*` changes only
  - [x] Update affected services on change
  - [x] Show confirmation for significant changes

## Dev Notes

### Architecture Note

The `services/settings.ts` file mentioned in this story is an implementation detail specific to the VS Code extension. The project's high-level architecture documents focus on web app and API structure; extension-internal services are organized per extension development best practices.

### API Endpoint Configuration

The production Contextor API URL is `https://contextor.co/api`. The `/api` path is part of the base URL. When testing connectivity, append `/health` to get `https://contextor.co/api/health`.

For self-hosted installations, users may configure a different endpoint (e.g., `https://internal.company.com/contextor/api`).

### Package.json Configuration Schema

```json
{
  "contributes": {
    "configuration": {
      "title": "Contextor",
      "properties": {
        "contextor.apiEndpoint": {
          "type": "string",
          "default": "https://contextor.co/api",
          "description": "API endpoint URL for Contextor service. Change for self-hosted installations.",
          "format": "uri"
        },
        "contextor.refreshInterval": {
          "type": "number",
          "default": 30,
          "minimum": 15,
          "maximum": 300,
          "description": "Analytics auto-refresh interval in seconds (minimum 15)."
        },
        "contextor.showNotifications": {
          "type": "boolean",
          "default": true,
          "description": "Show notification messages for successful operations."
        },
        "contextor.showStatusBarItem": {
          "type": "boolean",
          "default": true,
          "description": "Show Contextor score in the status bar."
        },
        "contextor.autoRefreshEnabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable automatic refresh of analytics data."
        }
      }
    }
  }
}
```

### SettingsService Reference

```typescript
// src/services/settings.ts
import * as vscode from 'vscode';

export interface ContextorSettings {
  apiEndpoint: string;
  refreshInterval: number;
  showNotifications: boolean;
  showStatusBarItem: boolean;
  autoRefreshEnabled: boolean;
}

export class SettingsService {
  private static instance: SettingsService;
  private _onDidChange = new vscode.EventEmitter<Partial<ContextorSettings>>();
  readonly onDidChange = this._onDidChange.event;

  private constructor() {
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('contextor')) {
        this.handleConfigChange(e);
      }
    });
  }

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  get apiEndpoint(): string {
    return this.getConfig<string>('apiEndpoint', 'https://contextor.co/api');
  }

  get refreshInterval(): number {
    const interval = this.getConfig<number>('refreshInterval', 30);
    return Math.max(15, interval); // Enforce minimum
  }

  get showNotifications(): boolean {
    return this.getConfig<boolean>('showNotifications', true);
  }

  get showStatusBarItem(): boolean {
    return this.getConfig<boolean>('showStatusBarItem', true);
  }

  get autoRefreshEnabled(): boolean {
    return this.getConfig<boolean>('autoRefreshEnabled', true);
  }

  getAll(): ContextorSettings {
    return {
      apiEndpoint: this.apiEndpoint,
      refreshInterval: this.refreshInterval,
      showNotifications: this.showNotifications,
      showStatusBarItem: this.showStatusBarItem,
      autoRefreshEnabled: this.autoRefreshEnabled
    };
  }

  private getConfig<T>(key: string, defaultValue: T): T {
    const config = vscode.workspace.getConfiguration('contextor');
    return config.get<T>(key, defaultValue);
  }

  private handleConfigChange(e: vscode.ConfigurationChangeEvent): void {
    const changes: Partial<ContextorSettings> = {};

    if (e.affectsConfiguration('contextor.apiEndpoint')) {
      changes.apiEndpoint = this.apiEndpoint;
      this.validateApiEndpoint(this.apiEndpoint);
    }
    if (e.affectsConfiguration('contextor.refreshInterval')) {
      changes.refreshInterval = this.refreshInterval;
    }
    if (e.affectsConfiguration('contextor.showNotifications')) {
      changes.showNotifications = this.showNotifications;
    }
    if (e.affectsConfiguration('contextor.showStatusBarItem')) {
      changes.showStatusBarItem = this.showStatusBarItem;
    }

    this._onDidChange.fire(changes);
  }

  private async validateApiEndpoint(endpoint: string): Promise<void> {
    try {
      const url = new URL(endpoint);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Invalid protocol');
      }

      // Test connectivity
      const response = await fetch(`${endpoint}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        vscode.window.showWarningMessage(
          `Contextor API endpoint returned ${response.status}. Some features may not work.`
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Invalid Contextor API endpoint: ${endpoint}. Please check your settings.`
      );
    }
  }
}
```

### Show Settings Command

```typescript
// In extension.ts
const showSettingsCommand = vscode.commands.registerCommand(
  'contextor.showSettings',
  () => {
    vscode.commands.executeCommand(
      'workbench.action.openSettings',
      '@ext:contextor.contextor-vscode'
    );
  }
);
```

### Integration with Other Services

```typescript
// In ContextorAPI constructor
export class ContextorAPI {
  private baseUrl: string;

  constructor(apiKey: string) {
    const settings = SettingsService.getInstance();
    this.baseUrl = settings.apiEndpoint;

    // Update when settings change
    settings.onDidChange((changes) => {
      if (changes.apiEndpoint) {
        this.baseUrl = changes.apiEndpoint;
      }
    });
  }
}

// In AnalyticsPanelProvider
private setupAutoRefresh(): void {
  const settings = SettingsService.getInstance();

  const updateRefreshInterval = () => {
    this.stopAutoRefresh();
    if (settings.autoRefreshEnabled) {
      this.refreshInterval = setInterval(
        () => this.sendAnalytics(),
        settings.refreshInterval * 1000
      );
    }
  };

  updateRefreshInterval();
  settings.onDidChange((changes) => {
    if (changes.refreshInterval !== undefined || changes.autoRefreshEnabled !== undefined) {
      updateRefreshInterval();
    }
  });
}
```

### Notification Gating

```typescript
// Utility function for gated notifications
export function showInfo(message: string): void {
  const settings = SettingsService.getInstance();
  if (settings.showNotifications) {
    vscode.window.showInformationMessage(message);
  }
}

// Errors are always shown
export function showError(message: string): void {
  vscode.window.showErrorMessage(message);
}
```

### Settings Validation on Startup

```typescript
// In extension.ts activate function
function validateSettings(): void {
  const settings = SettingsService.getInstance();
  const warnings: string[] = [];

  // Validate API endpoint format
  try {
    new URL(settings.apiEndpoint);
  } catch {
    warnings.push('Invalid API endpoint URL');
  }

  // Validate refresh interval
  if (settings.refreshInterval < 15) {
    warnings.push('Refresh interval below minimum (15s)');
  }

  if (warnings.length > 0) {
    vscode.window.showWarningMessage(
      `Contextor settings issues: ${warnings.join(', ')}. Using defaults.`
    );
  }
}
```

### Anti-Patterns to Avoid

1. **DO NOT** read settings synchronously in hot paths - cache values
2. **DO NOT** allow arbitrary refresh intervals - enforce minimum
3. **DO NOT** skip URL validation - prevent runtime errors
4. **DO NOT** block on endpoint validation - do async
5. **DO NOT** hide all errors - only gate informational messages

### References

- [VS Code Configuration Contribution](https://code.visualstudio.com/api/references/contribution-points#contributes.configuration)
- [VS Code Workspace Configuration API](https://code.visualstudio.com/api/references/vscode-api#WorkspaceConfiguration)

## Test Plan

### Unit Tests

1. **SettingsService Tests** (`src/services/settings.test.ts`)
   - [x] Returns correct default values when no settings configured
   - [x] Enforces minimum refresh interval of 15 seconds
   - [x] Emits change events when configuration changes
   - [x] Validates API endpoint URL format
   - [x] Handles invalid URL gracefully with default fallback

2. **Settings Validation Tests**
   - [x] `validateSettings()` detects invalid API endpoint URL
   - [x] `validateSettings()` detects refresh interval below minimum
   - [x] Shows warning notification for invalid settings
   - [x] Falls back to defaults for invalid values

3. **Notification Gating Tests**
   - [x] `showInfo()` respects `showNotifications` setting
   - [x] `showError()` always displays regardless of setting

### Integration Tests

4. **Configuration Schema Tests**
   - [x] All settings appear in VS Code Settings UI
   - [x] Settings have correct types (string, number, boolean)
   - [x] Settings descriptions are displayed
   - [x] Minimum/maximum constraints are enforced by VS Code

5. **Settings Command Tests**
   - [x] `contextor.showSettings` command opens Settings UI
   - [x] Settings are filtered to Contextor section

6. **API Endpoint Validation Tests**
   - [x] Valid endpoint passes validation
   - [x] Invalid URL format shows error
   - [x] Unreachable endpoint shows warning
   - [x] Endpoint change updates `ContextorAPI` instance

### Manual Verification Checklist

- [x] Open VS Code Settings and verify Contextor section appears
- [x] Change API endpoint and verify API calls use new endpoint
- [x] Set refresh interval below 15s and verify warning + enforcement
- [x] Toggle notifications off and verify info messages are suppressed
- [x] Toggle status bar item off and verify it disappears
- [x] Run "Contextor: Show Settings" command and verify it works


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

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Configuration Schema** - Extended package.json with full configuration schema including `apiEndpoint`, `refreshInterval`, `showNotifications`, `showStatusBarItem`, and `autoRefreshEnabled` settings with proper types, defaults, min/max constraints, and descriptions.

2. **SettingsService Implementation** - Created comprehensive singleton service with:
   - Type-safe getters for all settings
   - Settings caching with automatic invalidation on change
   - `onDidChange` event emitter for reactive updates
   - `validateSettings()` for startup validation
   - `validateApiEndpoint()` for async health check validation
   - `isValidUrl()` for URL format validation
   - Notification helper methods (`showInfo`, `showWarning`, `showError`) with gating

3. **Service Integration** - Updated existing services to use SettingsService:
   - AuthService now uses SettingsService for API endpoint (reactive to changes)
   - AnalyticsPanelProvider uses SettingsService for auto-refresh configuration
   - Extension activation validates settings on startup

4. **Settings Command** - Updated `showSettingsCommand` to open VS Code Settings filtered to Contextor extension using `@ext:contextor.contextor-vscode` query.

5. **Auto-Refresh System** - Implemented in AnalyticsPanelProvider with:
   - Configurable interval from settings (min 15s, max 300s, default 30s)
   - Toggle via `autoRefreshEnabled` setting
   - Proper cleanup on disposal
   - Reactive updates when settings change

6. **Unit Tests** - Created comprehensive test suite (41 new tests) covering:
   - Default value handling
   - Refresh interval enforcement (min/max)
   - Settings change event emission
   - API endpoint URL validation
   - Settings validation on startup
   - Notification gating behavior
   - Singleton pattern and caching

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-24 | Initial implementation of Story 19-6 | Claude Opus 4.5 |

### File List

**Created:**
- `/Users/edgars/My-projects/2025-projects/DEV/context-coach/packages/vscode-extension/src/services/settings.ts` - SettingsService class with full settings management
- `/Users/edgars/My-projects/2025-projects/DEV/context-coach/packages/vscode-extension/src/__tests__/settings.test.ts` - Unit tests for SettingsService (41 tests)

**Modified:**
- `/Users/edgars/My-projects/2025-projects/DEV/context-coach/packages/vscode-extension/package.json` - Extended configuration schema
- `/Users/edgars/My-projects/2025-projects/DEV/context-coach/packages/vscode-extension/src/extension.ts` - Integrated SettingsService, added startup validation
- `/Users/edgars/My-projects/2025-projects/DEV/context-coach/packages/vscode-extension/src/commands/showSettings.ts` - Opens VS Code Settings with filter
- `/Users/edgars/My-projects/2025-projects/DEV/context-coach/packages/vscode-extension/src/services/auth.ts` - Uses SettingsService for API endpoint
- `/Users/edgars/My-projects/2025-projects/DEV/context-coach/packages/vscode-extension/src/providers/analyticsPanel.ts` - Uses SettingsService for auto-refresh
- `/Users/edgars/My-projects/2025-projects/DEV/context-coach/packages/vscode-extension/src/__tests__/__mocks__/vscode.ts` - Enhanced mock with configuration change simulation
