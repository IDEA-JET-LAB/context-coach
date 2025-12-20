# Story 3.3: Installation State Detection

Status: ready-for-dev

## Story

**As a** developer joining an existing project,
**I want** the CLI to detect if Contextor is already installed,
**So that** I don't accidentally overwrite team configuration.

## Acceptance Criteria

1. **Given** no `.contextor/` directory exists
   **When** I run `npx @contextor/cli init <TOKEN>`
   **Then** the CLI detects "fresh install" state
   **And** creates both shared and personal configuration

2. **Given** `.contextor/config.json` exists but `.contextor/.user` does not
   **When** I run `npx @contextor/cli init <TOKEN>`
   **Then** the CLI detects "joining project" state
   **And** validates the token matches the existing project_id
   **And** creates only the personal `.user` configuration

3. **Given** both config files exist for a different project
   **When** I run `npx @contextor/cli init <TOKEN>`
   **Then** I see "This project is configured for a different Contextor project. Use --force to override."
   **And** the CLI exits with code 1

4. **Given** `.contextor/` directory exists but config.json is malformed or missing
   **When** I run `npx @contextor/cli init <TOKEN>`
   **Then** the CLI treats this as a fresh install state
   **And** logs a warning about the corrupted state

## Tasks / Subtasks

- [ ] **Task 1: Create detection module** (AC: #1, #2, #3, #4)
  - [ ] Create `packages/cli/src/lib/detection.ts`
  - [ ] Define `InstallState` enum: `FRESH`, `JOINING`, `CONFIGURED`, `MISMATCH`
  - [ ] Implement `detectInstallState(cwd: string, tokenProjectId: string): Promise<DetectionResult>`
  - [ ] Handle file system errors gracefully (permission denied, etc.)

- [ ] **Task 2: Implement config file reading** (AC: #2, #3, #4)
  - [ ] Create `readConfigFile(path: string): ProjectConfig | null`
  - [ ] Parse `.contextor/config.json` with JSON error handling
  - [ ] Log warning on malformed JSON (do not expose to user)
  - [ ] Validate required fields: `project_id`, `team_id`

- [ ] **Task 3: Implement user file detection** (AC: #1, #2)
  - [ ] Create `userConfigExists(cwd: string): boolean`
  - [ ] Check `.contextor/.user` existence
  - [ ] Handle corrupted .user file (treat as non-existent)

- [ ] **Task 4: Implement state detection logic** (AC: #1, #2, #3, #4)
  - [ ] No `.contextor/` directory: return `FRESH`
  - [ ] config.json exists, .user missing, project_id matches: return `JOINING`
  - [ ] Both exist, project_id matches: return `CONFIGURED`
  - [ ] project_id mismatch (any state): return `MISMATCH`
  - [ ] Corrupted/missing config.json with directory: return `FRESH` + log warning

- [ ] **Task 5: Update init command with detection** (AC: #1, #2, #3)
  - [ ] Import detection module in `commands/init.ts`
  - [ ] Call `detectInstallState()` after token validation
  - [ ] Handle each state with appropriate messaging
  - [ ] Exit with code 0 for success, code 1 for errors

- [ ] **Task 6: Implement --force flag** (AC: #3)
  - [ ] Add `--force` option to init command
  - [ ] Override `MISMATCH` state when flag present
  - [ ] Display warning about overwriting existing config

- [ ] **Task 7: Write unit tests** (AC: #1, #2, #3, #4)
  - [ ] Test fresh install detection
  - [ ] Test joining project detection
  - [ ] Test configured state detection
  - [ ] Test mismatch detection
  - [ ] Test corrupted config handling
  - [ ] Test --force flag behavior

## Dev Notes

### Installation States

```typescript
// packages/cli/src/lib/detection.ts
export enum InstallState {
  FRESH = 'fresh',
  JOINING = 'joining',
  CONFIGURED = 'configured',
  MISMATCH = 'mismatch',
}

export interface ProjectConfig {
  project_id: string;
  project_name: string;
  team_id: string;
  team_name: string;
  api_endpoint: string;
  created_at: string;
  created_by: string;
}

export interface DetectionResult {
  state: InstallState;
  existingConfig?: ProjectConfig;
  warning?: string;
}
```

### Detection Logic

```typescript
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const CONTEXTOR_DIR = '.contextor';
const CONFIG_FILE = 'config.json';
const USER_FILE = '.user';

export async function detectInstallState(
  cwd: string,
  tokenProjectId: string
): Promise<DetectionResult> {
  const contextorDir = join(cwd, CONTEXTOR_DIR);
  const configPath = join(contextorDir, CONFIG_FILE);
  const userPath = join(contextorDir, USER_FILE);

  if (!existsSync(contextorDir)) {
    return { state: InstallState.FRESH };
  }

  const config = readConfigFile(configPath);
  if (!config) {
    return {
      state: InstallState.FRESH,
      warning: 'Existing .contextor directory found with invalid config. Treating as fresh install.'
    };
  }

  const hasUserConfig = existsSync(userPath);
  const projectMatches = config.project_id === tokenProjectId;

  if (!projectMatches) {
    return { state: InstallState.MISMATCH, existingConfig: config };
  }

  if (!hasUserConfig) {
    return { state: InstallState.JOINING, existingConfig: config };
  }

  return { state: InstallState.CONFIGURED, existingConfig: config };
}

function readConfigFile(path: string): ProjectConfig | null {
  if (!existsSync(path)) return null;
  try {
    const content = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(content);
    if (!parsed.project_id || !parsed.team_id) return null;
    return parsed as ProjectConfig;
  } catch {
    return null;
  }
}
```

### Init Command State Handling

```typescript
// packages/cli/src/commands/init.ts
import { detectInstallState, InstallState } from '../lib/detection.js';
import chalk from 'chalk';
import ora from 'ora';

// Inside action handler after token validation:
const spinner = ora('Checking existing configuration...').start();
const { state, existingConfig, warning } = await detectInstallState(cwd, token.project_id);
spinner.stop();

if (warning) {
  console.log(chalk.yellow(`Note: ${warning}`));
}

switch (state) {
  case InstallState.FRESH:
    console.log(chalk.blue('Setting up Contextor for the first time...'));
    // Proceed with full installation (Story 3.4)
    break;

  case InstallState.JOINING:
    console.log(chalk.blue(`Joining project: ${existingConfig?.project_name}`));
    console.log('Creating your personal configuration...');
    // Create only .user file (Story 3.4)
    break;

  case InstallState.CONFIGURED:
    console.log(chalk.green('Contextor is already set up for this project.'));
    console.log(`Project: ${existingConfig?.project_name}`);
    console.log('Run `npx @contextor/cli status` to check your configuration.');
    process.exit(0);
    break;

  case InstallState.MISMATCH:
    if (!options.force) {
      console.error(chalk.red(
        'This project is configured for a different Contextor project.'
      ));
      console.log(`Current: ${existingConfig?.project_name}`);
      console.log(`Token: ${token.project_name}`);
      console.log(chalk.dim('Use --force to override existing configuration.'));
      process.exit(1);
    }
    console.log(chalk.yellow('Overwriting existing configuration...'));
    // Proceed with full installation
    break;
}
```

### CLI Output (Coaching-Positive Framing)

**Fresh Install:**
```
$ npx @contextor/cli init ctx_abc123...
Validating token... done
Setting up Contextor for the first time...
```

**Joining Project:**
```
$ npx @contextor/cli init ctx_abc123...
Validating token... done
Joining project: My Project
Creating your personal configuration...
```

**Already Configured:**
```
$ npx @contextor/cli init ctx_abc123...
Validating token... done
Contextor is already set up for this project.
Project: My Project
Run `npx @contextor/cli status` to check your configuration.
```

**Mismatch Error:**
```
$ npx @contextor/cli init ctx_abc123...
Validating token... done
This project is configured for a different Contextor project.
Current: Old Project
Token: New Project
Use --force to override existing configuration.
```

### File System Paths

| Path | Purpose | Git |
|------|---------|-----|
| `.contextor/` | Configuration directory | - |
| `.contextor/config.json` | Shared project config | Committed |
| `.contextor/.user` | Personal config + API key | Gitignored |

### Directory Structure After This Story

```
packages/cli/src/
├── commands/
│   └── init.ts              # Updated with state detection
└── lib/
    ├── detection.ts         # New: State detection module
    └── __tests__/
        └── detection.test.ts # New: Detection tests
```

### Test Scenarios

| Scenario | Input State | Expected Result |
|----------|-------------|-----------------|
| Empty directory | No .contextor/ | FRESH |
| Valid config, no .user | config.json exists | JOINING |
| Both files, same project | Both exist, IDs match | CONFIGURED |
| Both files, different project | Both exist, IDs differ | MISMATCH |
| Corrupted config.json | Invalid JSON | FRESH + warning |
| Missing project_id field | Incomplete config | FRESH + warning |
| .contextor exists, empty | Directory only | FRESH + warning |
| MISMATCH with --force | --force flag | Proceed with install |

### Error Codes

| Code | Scenario | Exit Code |
|------|----------|-----------|
| `ALREADY_CONFIGURED` | Same user, same project | 0 |
| `PROJECT_MISMATCH` | Different project without --force | 1 |
| `FS_ERROR` | Permission denied, etc. | 1 |

### Architecture Constraints

From project-context.md:
- `.contextor/config.json` is committed to git (shared)
- `.contextor/.user` is gitignored (personal)
- CLI must auto-detect: fresh install vs joining existing project
- Token project_id must match existing config project_id for JOINING state

### Pitfalls to Avoid

1. DO NOT overwrite config.json without --force flag
2. DO NOT assume .contextor directory means valid installation
3. DO NOT fail silently on malformed JSON - log warning, treat as fresh
4. DO NOT expose file system errors to user - use generic messages
5. DO NOT skip project_id validation when joining

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

| Date | Change | Author |
|------|--------|--------|
| | | |

### File List

*To be filled by dev agent - list all files created/modified*
