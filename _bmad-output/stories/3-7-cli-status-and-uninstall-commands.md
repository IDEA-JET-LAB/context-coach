# Story 3.7: CLI Status & Uninstall Commands

Status: ready-for-dev

## Story

**As a** developer,
**I want** to check my installation status or remove Contextor,
**So that** I can troubleshoot or clean up as needed.

## Acceptance Criteria

1. **Given** I run `npx @contextor/cli status`
   **When** Contextor is properly installed
   **Then** I see: project name, team name, user name, connection status
   **And** the last successful capture timestamp (if any)

2. **Given** I run `npx @contextor/cli status`
   **When** Contextor is not installed
   **Then** I see "Contextor is not installed in this project"
   **And** instructions to run `init`

3. **Given** I run `npx @contextor/cli uninstall`
   **When** I confirm the action
   **Then** `.contextor/.user` is deleted
   **And** the hook is removed from `.claude/settings.json`
   **And** `.contextor/config.json` is preserved (team shared)
   **And** I see "Personal configuration removed. Shared project config preserved."

## Tasks / Subtasks

- [ ] **Task 1: Implement status command** (AC: #1, #2)
  - [ ] Create `packages/cli/src/commands/status.ts`
  - [ ] Register `status` command with Commander (no arguments)
  - [ ] Check for `.contextor/` directory and config file existence
  - [ ] Handle corrupted/invalid JSON gracefully with specific error messages
  - [ ] Display installation status based on file presence

- [ ] **Task 2: Implement installed status display** (AC: #1)
  - [ ] Read `project_name` and `team_name` from `config.json`
  - [ ] Read `user_name` from `.user` file
  - [ ] Call `testCapture()` with 10-second timeout to verify connection
  - [ ] Display connection status (Connected/Disconnected)
  - [ ] Format output with chalk colors (green=good, yellow=warning, red=error)

- [ ] **Task 3: Fetch and display last capture timestamp** (AC: #1)
  - [ ] Call API endpoint: `GET /cli/last-capture?project_id=X&user_id=Y`
  - [ ] Display "Last capture: X minutes/hours/days ago" if available
  - [ ] Display "No prompts captured yet" if no captures exist
  - [ ] Handle API errors gracefully (show "Unknown" with gray text)

- [ ] **Task 4: Implement not installed status** (AC: #2)
  - [ ] Detect when `.contextor/` directory doesn't exist
  - [ ] Detect when config files are missing or corrupted
  - [ ] Display "Contextor is not installed in this project"
  - [ ] Show command: `npx @contextor/cli init <TOKEN>`
  - [ ] Include dashboard link: `https://app.contextor.co/projects`

- [ ] **Task 5: Implement uninstall command** (AC: #3)
  - [ ] Create `packages/cli/src/commands/uninstall.ts`
  - [ ] Register `uninstall` command with Commander
  - [ ] Add `--yes` / `-y` flag to skip confirmation (for CI/CD)
  - [ ] Display warning listing what will be removed vs preserved

- [ ] **Task 6: Implement uninstall confirmation** (AC: #3)
  - [ ] Use Node.js `readline` for interactive prompt (no external deps)
  - [ ] Ask "Are you sure you want to remove Contextor? (y/N)"
  - [ ] Default to "No" for safety
  - [ ] Skip confirmation if `--yes` flag provided or non-interactive (no TTY)
  - [ ] Exit gracefully if user cancels

- [ ] **Task 7: Implement uninstall file operations** (AC: #3)
  - [ ] Delete `.contextor/.user` file (handle if already missing)
  - [ ] Read `.claude/settings.json` and remove Contextor hook entry
  - [ ] Write updated `settings.json` preserving other hooks and formatting
  - [ ] Keep `.contextor/config.json` intact (team shared)
  - [ ] Keep `.claude/hooks/contextor-capture.sh` intact (shared)
  - [ ] Display success message listing what was removed/preserved

- [ ] **Task 8: Write unit tests** (AC: all)
  - [ ] Create `packages/cli/src/lib/__tests__/status.test.ts`
  - [ ] Create `packages/cli/src/lib/__tests__/uninstall.test.ts`
  - [ ] Test status with installed/not installed/corrupted scenarios
  - [ ] Test uninstall with confirmation/skip/cancel scenarios
  - [ ] Mock file system and API calls

## Dev Notes

### Status Command Implementation

```typescript
// packages/cli/src/commands/status.ts
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync } from 'fs';
import { join } from 'path';
import { readConfigFile, readUserConfig } from '../lib/config.js';
import { testCapture, getLastCapture } from '../lib/api-client.js';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Check Contextor installation status')
    .action(async () => {
      const cwd = process.cwd();
      const contextorDir = join(cwd, '.contextor');
      const configPath = join(contextorDir, 'config.json');
      const userPath = join(contextorDir, '.user');

      // Check if installed
      if (!existsSync(contextorDir) || !existsSync(configPath)) {
        console.log(notInstalledMessage());
        process.exit(0);
      }

      // Read shared config with error handling
      const sharedConfig = await readConfigFile(configPath);
      if (!sharedConfig) {
        console.log(chalk.red('Configuration file is corrupted or invalid.'));
        console.log(chalk.gray('Run `npx @contextor/cli init <TOKEN>` to reinstall.'));
        process.exit(1);
      }

      // Check for user config
      const userConfig = existsSync(userPath)
        ? await readUserConfig(userPath)
        : null;

      // Display status
      console.log();
      console.log(chalk.white.bold('Contextor Status'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log();
      console.log(`${chalk.white('Project:')} ${chalk.cyan(sharedConfig.project_name)}`);
      console.log(`${chalk.white('Team:')} ${chalk.cyan(sharedConfig.team_name)}`);

      if (userConfig) {
        console.log(`${chalk.white('User:')} ${chalk.cyan(userConfig.user_name)}`);
        console.log(`${chalk.white('Configured:')} ${chalk.gray(formatDate(userConfig.configured_at))}`);

        // Test connection with timeout
        const spinner = ora('Checking connection...').start();
        const testResult = await testCapture(userConfig, sharedConfig);

        if (testResult.success) {
          spinner.stop();
          console.log(`${chalk.white('Connection:')} ${chalk.green('Connected')}`);

          // Get last capture
          const lastCapture = await getLastCapture(userConfig, sharedConfig);
          if (lastCapture) {
            console.log(`${chalk.white('Last capture:')} ${chalk.gray(formatTimeAgo(lastCapture))}`);
          } else {
            console.log(`${chalk.white('Last capture:')} ${chalk.gray('No prompts captured yet')}`);
          }
        } else {
          spinner.stop();
          console.log(`${chalk.white('Connection:')} ${chalk.red('Disconnected')}`);
          if (testResult.error) {
            console.log(chalk.gray(`  ${testResult.error.message}`));
          }
        }
      } else {
        console.log(`${chalk.white('User:')} ${chalk.yellow('Not configured')}`);
        console.log();
        console.log(chalk.yellow('Personal configuration missing.'));
        console.log(chalk.gray('Run `npx @contextor/cli init <TOKEN>` to configure your user.'));
      }

      console.log();
      console.log(`${chalk.white('Dashboard:')} ${chalk.underline.blue(`https://app.contextor.co/projects/${sharedConfig.project_id}`)}`);
      console.log();
    });
}

function notInstalledMessage(): string {
  return `
${chalk.yellow('Contextor is not installed in this project.')}

To install, run:
  ${chalk.cyan('npx @contextor/cli init <TOKEN>')}

Get your install token from:
  ${chalk.underline.blue('https://app.contextor.co/projects')}
`;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}
```

### API Client Functions

```typescript
// packages/cli/src/lib/api-client.ts (additions)

const API_TIMEOUT_MS = 10000;

export async function getLastCapture(
  userConfig: UserConfig,
  sharedConfig: SharedConfig
): Promise<Date | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${sharedConfig.api_endpoint}/cli/last-capture?project_id=${sharedConfig.project_id}&user_id=${userConfig.user_id}`,
      {
        headers: { 'Authorization': `Bearer ${userConfig.api_key}` },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    return data.last_capture_at ? new Date(data.last_capture_at) : null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}
```

### Uninstall Command Implementation

```typescript
// packages/cli/src/commands/uninstall.ts
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync } from 'fs';
import { unlink, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { createInterface } from 'readline';

export function registerUninstallCommand(program: Command): void {
  program
    .command('uninstall')
    .description('Remove Contextor personal configuration')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (options: { yes?: boolean }) => {
      const cwd = process.cwd();
      const userPath = join(cwd, '.contextor', '.user');
      const settingsPath = join(cwd, '.claude', 'settings.json');

      // Check if installed
      if (!existsSync(userPath)) {
        console.log(chalk.yellow('Contextor personal configuration not found.'));
        console.log(chalk.gray('Nothing to uninstall.'));
        process.exit(0);
      }

      // Show what will be changed
      console.log();
      console.log(chalk.white.bold('Uninstall Contextor'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log();
      console.log(chalk.white('This will remove:'));
      console.log(chalk.red('  - .contextor/.user (personal configuration)'));
      console.log(chalk.red('  - Contextor hook from .claude/settings.json'));
      console.log();
      console.log(chalk.white('This will preserve:'));
      console.log(chalk.green('  - .contextor/config.json (shared team config)'));
      console.log(chalk.green('  - .claude/hooks/contextor-capture.sh (shared script)'));
      console.log();

      // Confirm unless --yes flag or non-interactive
      const isInteractive = process.stdin.isTTY;
      if (!options.yes && isInteractive) {
        const confirmed = await confirm('Are you sure you want to continue?');
        if (!confirmed) {
          console.log(chalk.gray('Uninstall cancelled.'));
          process.exit(0);
        }
      } else if (!options.yes && !isInteractive) {
        console.log(chalk.yellow('Non-interactive mode detected. Use --yes to confirm.'));
        process.exit(1);
      }

      // Perform uninstall
      const spinner = ora('Removing personal configuration...').start();

      try {
        // Delete .user file
        await unlink(userPath);
        spinner.text = 'Removing hook from settings...';

        // Remove hook from settings.json
        if (existsSync(settingsPath)) {
          await removeContextorHook(settingsPath);
        }

        spinner.succeed('Uninstall complete');

        console.log();
        console.log(chalk.green('Personal configuration removed. Shared project config preserved.'));
        console.log();
        console.log(chalk.gray('To reinstall, run:'));
        console.log(chalk.cyan('  npx @contextor/cli init <TOKEN>'));
        console.log();

      } catch (error) {
        spinner.fail('Uninstall failed');
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(chalk.red(message));
        process.exit(1);
      }
    });
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function removeContextorHook(settingsPath: string): Promise<void> {
  const content = await readFile(settingsPath, 'utf-8');
  let settings: Record<string, unknown>;

  try {
    settings = JSON.parse(content);
  } catch {
    // Settings file is corrupted, nothing to remove
    return;
  }

  const hooks = settings.hooks as Record<string, Array<{ command: string }>> | undefined;
  if (hooks?.UserPromptSubmit) {
    hooks.UserPromptSubmit = hooks.UserPromptSubmit.filter(
      (hook) => !hook.command.includes('contextor-capture')
    );

    // Remove empty arrays/objects
    if (hooks.UserPromptSubmit.length === 0) {
      delete hooks.UserPromptSubmit;
    }
    if (Object.keys(hooks).length === 0) {
      delete settings.hooks;
    }
  }

  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}
```

### Register Commands in Entry Point

```typescript
// packages/cli/src/bin/contextor.ts
import { Command } from 'commander';
import { registerInitCommand } from '../commands/init.js';
import { registerStatusCommand } from '../commands/status.js';
import { registerUninstallCommand } from '../commands/uninstall.js';

const program = new Command();

program
  .name('contextor')
  .description('CLI for installing Contextor in your projects')
  .version(packageJson.version);

registerInitCommand(program);
registerStatusCommand(program);
registerUninstallCommand(program);

program.parse();
```

### Directory Structure After This Story

```
packages/cli/
├── src/
│   ├── bin/
│   │   └── contextor.ts         # Register all commands
│   ├── commands/
│   │   ├── init.ts              # From Story 3.1-3.6
│   │   ├── status.ts            # NEW: Full implementation
│   │   └── uninstall.ts         # NEW: Full implementation
│   └── lib/
│       ├── token.ts
│       ├── api-client.ts        # UPDATED: getLastCapture
│       ├── detection.ts
│       ├── config.ts
│       ├── gitignore.ts
│       ├── hooks.ts
│       ├── messages.ts
│       └── __tests__/
│           ├── status.test.ts   # NEW
│           └── uninstall.test.ts # NEW
```

### Files Affected by Uninstall

| File | Action |
|------|--------|
| `.contextor/.user` | **Deleted** |
| `.claude/settings.json` | Hook entry removed, file preserved |
| `.contextor/config.json` | **Preserved** (team shared) |
| `.claude/hooks/contextor-capture.sh` | **Preserved** (shared) |
| `.gitignore` | **Preserved** |

### Critical Architecture Constraints

**From project-context.md:**
- `.contextor/config.json` is shared (committed) - must be preserved on uninstall
- `.contextor/.user` is personal (gitignored) - deleted on uninstall
- Hook must be removed cleanly without affecting other hooks in settings.json

### Common Pitfalls to Avoid

1. **DO NOT** delete `config.json` on uninstall - it's team shared
2. **DO NOT** delete the entire `.contextor` directory
3. **DO NOT** delete the capture script (other team members use it)
4. **DO NOT** skip confirmation without `--yes` flag in interactive mode
5. **DO NOT** leave orphaned hooks in `settings.json`
6. **DO NOT** fail if files are already missing - handle gracefully
7. **DO NOT** crash on corrupted JSON - display helpful error message

### Verification Checklist

After completing this story, verify:
- [ ] `status` shows project/team/user info when installed
- [ ] `status` shows connection status (Connected/Disconnected)
- [ ] `status` shows last capture timestamp or "No prompts captured yet"
- [ ] `status` on uninstalled project shows install instructions
- [ ] `status` handles corrupted config files gracefully
- [ ] `uninstall` shows what will be removed vs preserved
- [ ] `uninstall` asks for confirmation by default
- [ ] `uninstall --yes` skips confirmation
- [ ] `uninstall` in non-interactive mode requires `--yes`
- [ ] `uninstall` deletes only `.user` file
- [ ] `uninstall` removes hook from `settings.json`
- [ ] `uninstall` preserves `config.json` and capture script
- [ ] Other hooks in `settings.json` are not affected

### References

- [Source: _bmad-output/epics.md#Story-3.7-CLI-Status-Uninstall-Commands]
- [Source: _bmad-output/project-context.md#CLI-Package]
- [Source: _bmad-output/architecture.md#CLI-Package-Architecture]

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
