# Story 19.1: Extension Scaffold

Status: Ready

## PRD Alignment Note

Epic 19 (VS Code Extension) was expanded from 4 PRD stories to 7 implementation stories for better modularity and incremental delivery:

| PRD Story | Implementation Stories |
|-----------|----------------------|
| 19.1 Extension scaffold + auth + settings | 19-1 (scaffold), 19-2 (auth), 19-6 (settings) |
| 19.2 Sidebar panel | 19-3 (sidebar panel) |
| 19.3 Real-time analytics | 19-4 (realtime analytics) |
| 19.4 Quick coaching tips | 19-5 (coaching tips) |
| (new) Marketplace publishing | 19-7 (marketplace publishing) |

This decomposition enables parallel development and clearer testing boundaries.

## Scope Note

This story focuses exclusively on the **core extension scaffold and project architecture**. The following capabilities mentioned in PRD 19.1 are intentionally deferred to dedicated stories:

- **Authentication Flow**: Implemented in Story 19-2 (Authentication Flow)
- **Settings Sync**: Implemented in Story 19-6 (Extension Settings)

This separation provides:
1. A testable scaffold that can be validated independently
2. Cleaner separation of concerns
3. Smaller, reviewable increments
4. Parallel development capability for auth and settings

## Story

**As a** developer,
**I want** a VS Code extension project with proper TypeScript structure,
**So that** I can build Contextor features into my IDE workflow.

## Acceptance Criteria

1. **Given** I have VS Code installed
   **When** I load the extension in development mode
   **Then** I see "Contextor" in the Extensions view
   **And** the extension activates without errors

2. **Given** the extension project structure
   **When** this story is complete
   **Then** `packages/vscode-extension/` exists with proper VS Code extension configuration
   **And** TypeScript compilation produces valid JavaScript
   **And** the extension can be packaged with `vsce package`
   **And** the extension icon and branding are configured

3. **Given** the extension is loaded
   **When** I open the command palette
   **Then** I see "Contextor: Show Analytics" command available
   **And** I see "Contextor: Show Settings" command available

4. **Given** the extension structure follows the architecture
   **When** reviewing the codebase
   **Then** the directory structure matches the Phase 2 architecture document
   **And** all placeholder files are created for commands, providers, services, and watchers

## Tasks / Subtasks

- [ ] **Task 1: Initialize VS Code extension package** (AC: #2, #4)
  - [ ] Create `packages/vscode-extension/` directory at project root
  - [ ] Run `yo code` or manually create extension scaffold
  - [ ] Create `package.json` with name `contextor-vscode`
  - [ ] Set display name to "Contextor - Prompt Analytics"
  - [ ] Set publisher to "contextor"
  - [ ] Set version to `0.1.0`
  - [ ] Set VS Code engine compatibility: `"vscode": "^1.85.0"`
  - [ ] Add extension icon (128x128 PNG) to `images/icon.png`
  - [ ] Configure activation events: `onStartupFinished`

- [ ] **Task 2: Configure TypeScript for extension** (AC: #2)
  - [ ] Create `packages/vscode-extension/tsconfig.json`
  - [ ] Set `target: "ES2022"` and `module: "commonjs"` (VS Code requirement)
  - [ ] Set `outDir: "./dist"` and `rootDir: "./src"`
  - [ ] Enable `strict: true` mode
  - [ ] Set `moduleResolution: "node"`
  - [ ] Add `lib: ["ES2022"]`
  - [ ] Configure source maps for debugging

- [ ] **Task 3: Add package dependencies** (AC: #2)
  - [ ] Add `typescript` as dev dependency
  - [ ] Add `@types/vscode` as dev dependency
  - [ ] Add `@types/node` as dev dependency
  - [ ] Add `@vscode/vsce` for packaging
  - [ ] Add `esbuild` for bundling (faster than webpack)
  - [ ] Add build script: `"build": "esbuild src/extension.ts --bundle --outfile=dist/extension.js --external:vscode --format=cjs --platform=node"`
  - [ ] Add watch script: `"watch": "npm run build -- --watch"`
  - [ ] Add package script: `"package": "vsce package"`

- [ ] **Task 4: Create source directory structure** (AC: #4)
  - [ ] Create `packages/vscode-extension/src/extension.ts` (main entry)
  - [ ] Create `packages/vscode-extension/src/commands/` directory
  - [ ] Create `packages/vscode-extension/src/providers/` directory
  - [ ] Create `packages/vscode-extension/src/services/` directory
  - [ ] Create `packages/vscode-extension/src/watchers/` directory
  - [ ] Create `packages/vscode-extension/src/types/index.ts`
  - [ ] Create `packages/vscode-extension/webviews/` directory for React apps

- [ ] **Task 5: Create main extension entry point** (AC: #1, #3)
  - [ ] Implement `activate(context: vscode.ExtensionContext)` function
  - [ ] Implement `deactivate()` function
  - [ ] Register command: `contextor.showAnalytics`
  - [ ] Register command: `contextor.showSettings`
  - [ ] Add console.log for activation confirmation
  - [ ] Export both functions as required by VS Code

- [ ] **Task 6: Configure package.json contributions** (AC: #3)
  - [ ] Add `contributes.commands` section with command definitions
  - [ ] Add command titles with "Contextor:" prefix
  - [ ] Add command icons (optional, can use default)
  - [ ] Configure `main` entry point to `./dist/extension.js`
  - [ ] Add categories: `["Other"]`

- [ ] **Task 7: Create placeholder files for architecture** (AC: #4)
  - [ ] Create `src/commands/importHistory.ts` - export empty async function
  - [ ] Create `src/commands/recoverSession.ts` - export empty async function
  - [ ] Create `src/commands/improve-prompt.ts` - export empty async function (note: use kebab-case per architecture convention)
  - [ ] Create `src/providers/analyticsPanel.ts` - export class stub
  - [ ] Create `src/providers/sessionBrowser.ts` - export class stub
  - [ ] Create `src/providers/suggestionPanel.ts` - export class stub
  - [ ] Create `src/services/api.ts` - export ContextorAPI class stub
  - [ ] Create `src/services/transcripts.ts` - export functions stubs
  - [ ] Create `src/services/crashDetector.ts` - export functions stubs
  - [ ] Create `src/services/heuristics.ts` - export functions stubs
  - [ ] Create `src/watchers/suggestionWatcher.ts` - export class stub
  - [ ] Create `src/watchers/transcriptWatcher.ts` - export class stub

- [ ] **Task 8: Set up development and testing** (AC: #1, #2)
  - [ ] Create `.vscode/launch.json` for extension debugging
  - [ ] Create `.vscode/tasks.json` for build tasks
  - [ ] Add `.vscodeignore` to exclude source files from package
  - [ ] Run `npm run build` to verify compilation
  - [ ] Press F5 to launch Extension Development Host
  - [ ] Verify extension appears in Extensions view
  - [ ] Verify commands appear in Command Palette
  - [ ] Run `npm run package` to create `.vsix` file

## Dev Notes

### Critical Constraints

| Constraint | Value | Source |
|------------|-------|--------|
| VS Code Engine | >= 1.85.0 | Phase 2 Architecture |
| Module System | CommonJS (VS Code requirement) | VS Code Extension API |
| TypeScript | strict mode | architecture.md |
| Package location | `packages/vscode-extension/` | Phase 2 Architecture |

### package.json Reference

```json
{
  "name": "contextor-vscode",
  "displayName": "Contextor - Prompt Analytics",
  "description": "Real-time analytics and coaching for your AI prompts",
  "version": "0.1.0",
  "publisher": "contextor",
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": ["Other"],
  "icon": "images/icon.png",
  "activationEvents": ["onStartupFinished"],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "contextor.showAnalytics",
        "title": "Contextor: Show Analytics"
      },
      {
        "command": "contextor.showSettings",
        "title": "Contextor: Show Settings"
      }
    ]
  },
  "scripts": {
    "build": "esbuild src/extension.ts --bundle --outfile=dist/extension.js --external:vscode --format=cjs --platform=node",
    "watch": "npm run build -- --watch",
    "package": "vsce package",
    "prepublish": "npm run build"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/vscode": "^1.85.0",
    "@vscode/vsce": "^2.22.0",
    "esbuild": "^0.19.0",
    "typescript": "^5.3.0"
  }
}
```

### Extension Entry Point Reference

```typescript
// src/extension.ts
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  console.log('Contextor extension is now active');

  // Register commands
  const showAnalyticsCommand = vscode.commands.registerCommand(
    'contextor.showAnalytics',
    () => {
      vscode.window.showInformationMessage('Contextor Analytics - Coming soon!');
    }
  );

  const showSettingsCommand = vscode.commands.registerCommand(
    'contextor.showSettings',
    () => {
      vscode.window.showInformationMessage('Contextor Settings - Coming soon!');
    }
  );

  context.subscriptions.push(showAnalyticsCommand, showSettingsCommand);
}

export function deactivate() {
  console.log('Contextor extension deactivated');
}
```

### Directory Structure (Phase 2 Architecture)

```
packages/vscode-extension/
├── package.json
├── tsconfig.json
├── .vscodeignore
├── images/
│   └── icon.png
├── src/
│   ├── extension.ts              # Main entry point
│   ├── commands/
│   │   ├── importHistory.ts      # Historical import command
│   │   ├── recoverSession.ts     # Crash recovery command
│   │   └── improve-prompt.ts     # Pre-submission coaching (kebab-case per convention)
│   ├── providers/
│   │   ├── analyticsPanel.ts     # Webview for analytics
│   │   ├── sessionBrowser.ts     # Session tree view
│   │   └── suggestionPanel.ts    # Coaching suggestions
│   ├── services/
│   │   ├── api.ts                # Contextor API client
│   │   ├── transcripts.ts        # Local transcript reader
│   │   ├── crashDetector.ts      # Interrupted session detection
│   │   └── heuristics.ts         # Fast local analysis
│   ├── watchers/
│   │   ├── suggestionWatcher.ts  # Watch for suggestion file
│   │   └── transcriptWatcher.ts  # Watch for new transcripts
│   └── types/
│       └── index.ts
├── webviews/
│   ├── analytics/                # React app for analytics
│   └── coaching/                 # React app for coaching UI
├── dist/                         # Built output (vscodeignore)
└── test/
    └── suite/
```

### Launch Configuration Reference

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}/packages/vscode-extension"
      ],
      "outFiles": [
        "${workspaceFolder}/packages/vscode-extension/dist/**/*.js"
      ],
      "preLaunchTask": "npm: build - packages/vscode-extension"
    }
  ]
}
```

### File Naming Convention

The architecture documents specify **lowercase with hyphens (kebab-case)** for file names. Some task references may show camelCase (e.g., `improvePrompt.ts`); use kebab-case instead (e.g., `improve-prompt.ts`) for consistency with the project conventions.

### Anti-Patterns to Avoid

1. **DO NOT** use ESM modules - VS Code extensions require CommonJS
2. **DO NOT** forget to bundle external dependencies (except `vscode`)
3. **DO NOT** include node_modules in the extension package
4. **DO NOT** use synchronous file operations in activation
5. **DO NOT** activate on startup without reason - use `onStartupFinished`
6. **DO NOT** forget `.vscodeignore` - keeps package size small

### Story Dependencies

- **Depends on:** None (first story in Epic 19)
- **Blocks:** Stories 19.2-19.7 (all extension functionality)

### References

- Epic: Epic 19: VS Code Extension
- Architecture: Phase 2 Architecture - VS Code Extension Architecture
- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code Extension Samples](https://github.com/microsoft/vscode-extension-samples)
- [esbuild Documentation](https://esbuild.github.io/)


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

<!-- To be filled by implementing agent with model name and version -->

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

| Date | Change | Author |
|------|--------|--------|

### File List

*To be filled by dev agent - list all files created/modified*
