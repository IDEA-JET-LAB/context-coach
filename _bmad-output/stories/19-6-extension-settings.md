# Story 19.6: Extension Settings

Status: Ready

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

- [ ] **Task 1: Define configuration schema** (AC: #1, #2)
  - [ ] Add `contributes.configuration` to package.json
  - [ ] Define `contextor.apiEndpoint` setting (string)
  - [ ] Define `contextor.refreshInterval` setting (number, min 15)
  - [ ] Define `contextor.showNotifications` setting (boolean)
  - [ ] Define `contextor.showStatusBarItem` setting (boolean)
  - [ ] Add descriptions and defaults for each setting

- [ ] **Task 2: Create settings service** (AC: #3, #4)
  - [ ] Create `src/services/settings.ts`
  - [ ] Implement `SettingsService` class
  - [ ] Add getters for each setting
  - [ ] Add `onDidChangeSettings` event emitter
  - [ ] Validate settings on load

- [ ] **Task 3: Implement API endpoint configuration** (AC: #3)
  - [ ] Read API endpoint from settings
  - [ ] Default to `https://contextor.co/api` (production URL includes `/api` path)
  - [ ] Validate URL format on change
  - [ ] Test endpoint reachability on change (use `/health` endpoint)
  - [ ] Update `ContextorAPI` instance with new endpoint
  - [ ] Show validation error if endpoint unreachable

- [ ] **Task 4: Implement refresh interval configuration** (AC: #4)
  - [ ] Read refresh interval from settings
  - [ ] Default to 30 seconds
  - [ ] Enforce minimum of 15 seconds
  - [ ] Update refresh timer when setting changes
  - [ ] Show warning if below minimum

- [ ] **Task 5: Implement notification preferences** (AC: #2)
  - [ ] Read notification preference from settings
  - [ ] Default to true (enabled)
  - [ ] Gate all `vscode.window.showInformationMessage` calls
  - [ ] Keep error messages always visible
  - [ ] Allow per-notification type settings (future)

- [ ] **Task 6: Implement settings command** (AC: #5)
  - [ ] Register `contextor.showSettings` command
  - [ ] Open Settings UI with query: `@ext:contextor.contextor-vscode`
  - [ ] Alternatively open Settings JSON with cursor at Contextor section

- [ ] **Task 7: Add settings validation and defaults** (AC: #6)
  - [ ] Create `validateSettings()` function
  - [ ] Check all required settings have valid values
  - [ ] Show warning for invalid settings
  - [ ] Fall back to defaults for invalid values
  - [ ] Log validation errors for debugging

- [ ] **Task 8: Handle settings changes** (AC: #3, #4)
  - [ ] Subscribe to `vscode.workspace.onDidChangeConfiguration`
  - [ ] Filter to `contextor.*` changes only
  - [ ] Update affected services on change
  - [ ] Show confirmation for significant changes

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
   - [ ] Returns correct default values when no settings configured
   - [ ] Enforces minimum refresh interval of 15 seconds
   - [ ] Emits change events when configuration changes
   - [ ] Validates API endpoint URL format
   - [ ] Handles invalid URL gracefully with default fallback

2. **Settings Validation Tests**
   - [ ] `validateSettings()` detects invalid API endpoint URL
   - [ ] `validateSettings()` detects refresh interval below minimum
   - [ ] Shows warning notification for invalid settings
   - [ ] Falls back to defaults for invalid values

3. **Notification Gating Tests**
   - [ ] `showInfo()` respects `showNotifications` setting
   - [ ] `showError()` always displays regardless of setting

### Integration Tests

4. **Configuration Schema Tests**
   - [ ] All settings appear in VS Code Settings UI
   - [ ] Settings have correct types (string, number, boolean)
   - [ ] Settings descriptions are displayed
   - [ ] Minimum/maximum constraints are enforced by VS Code

5. **Settings Command Tests**
   - [ ] `contextor.showSettings` command opens Settings UI
   - [ ] Settings are filtered to Contextor section

6. **API Endpoint Validation Tests**
   - [ ] Valid endpoint passes validation
   - [ ] Invalid URL format shows error
   - [ ] Unreachable endpoint shows warning
   - [ ] Endpoint change updates `ContextorAPI` instance

### Manual Verification Checklist

- [ ] Open VS Code Settings and verify Contextor section appears
- [ ] Change API endpoint and verify API calls use new endpoint
- [ ] Set refresh interval below 15s and verify warning + enforcement
- [ ] Toggle notifications off and verify info messages are suppressed
- [ ] Toggle status bar item off and verify it disappears
- [ ] Run "Contextor: Show Settings" command and verify it works


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
