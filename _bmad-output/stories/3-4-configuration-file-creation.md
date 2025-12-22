# Story 3.4: Configuration File Creation

Status: ✅ Done

## Story

**As a** developer,
**I want** the CLI to create the necessary configuration files,
**So that** prompt capture works automatically.

## Acceptance Criteria

1. **Given** a fresh install
   **When** the CLI completes successfully
   **Then** `.contextor/config.json` is created with: project_id, project_name, team_id, team_name, api_endpoint, created_at, created_by
   **And** `.contextor/.user` is created with: user_id, user_name, api_key, configured_at
   **And** `.gitignore` is updated to include `.contextor/.user`

2. **Given** `.gitignore` doesn't exist
   **When** the CLI runs
   **Then** `.gitignore` is created with `.contextor/.user`

3. **Given** `.gitignore` already contains `.contextor/.user`
   **When** the CLI runs
   **Then** no duplicate entry is added

## Tasks / Subtasks

- [ ] **Task 1: Create config module** (AC: #1)
  - [ ] Create `packages/cli/src/lib/config.ts`
  - [ ] Define `SharedConfig` interface (project_id, project_name, team_id, team_name, api_endpoint, created_at, created_by)
  - [ ] Define `UserConfig` interface (user_id, user_name, api_key, configured_at)
  - [ ] Export config file path constants: `CONTEXTOR_DIR`, `CONFIG_FILE`, `USER_FILE`

- [ ] **Task 2: Implement shared config creation** (AC: #1)
  - [ ] Create function `createSharedConfig(token: InstallToken): SharedConfig`
  - [ ] Generate `created_at` as ISO 8601 timestamp
  - [ ] Set `created_by` to token.user_name
  - [ ] Implement `writeSharedConfig(config: SharedConfig, cwd: string): Promise<void>`
  - [ ] Create `.contextor/` directory with `mkdir(dir, { recursive: true })`
  - [ ] Write config.json with 2-space indent JSON formatting
  - [ ] Verify written file is valid JSON before returning

- [ ] **Task 3: Implement user config creation** (AC: #1)
  - [ ] Create function `createUserConfig(token: InstallToken): UserConfig`
  - [ ] Generate `configured_at` as ISO 8601 timestamp
  - [ ] Implement `writeUserConfig(config: UserConfig, cwd: string): Promise<void>`
  - [ ] Write `.user` file (no .json extension for security obscurity)
  - [ ] Use JSON format with 2-space indent formatting

- [ ] **Task 4: Implement gitignore management** (AC: #1, #2, #3)
  - [ ] Create `packages/cli/src/lib/gitignore.ts`
  - [ ] Implement `ensureGitignore(cwd: string): Promise<boolean>` (returns true if modified)
  - [ ] Check if `.gitignore` exists using `access()` with `constants.F_OK`
  - [ ] If not exists: create with `.contextor/.user` entry and header comment
  - [ ] If exists: read contents and check for existing entry
  - [ ] Append `.contextor/.user` only if not already present
  - [ ] Ensure newline before entry if file doesn't end with newline

- [ ] **Task 5: Implement duplicate check for gitignore** (AC: #3)
  - [ ] Parse existing gitignore content line by line
  - [ ] Check for exact match of `.contextor/.user`
  - [ ] Check for broader patterns: `.contextor/`, `.contextor`, `.contextor/*`
  - [ ] Skip adding if already covered by any pattern
  - [ ] Handle comment lines (starting with `#`) and empty lines gracefully

- [ ] **Task 6: Integrate config creation into init command** (AC: #1, #2, #3)
  - [ ] Import config module in init command
  - [ ] For FRESH state: create both config files, then ensure gitignore
  - [ ] For JOINING state: create only .user file, verify existing config matches token
  - [ ] For MISMATCH with --force: overwrite both files
  - [ ] Call `ensureGitignore()` in all successful cases
  - [ ] Display progress spinner for each step using ora

- [ ] **Task 7: Add error handling for file operations** (AC: #1, #2)
  - [ ] Wrap all file operations in try/catch
  - [ ] Handle EACCES (permission denied): display "Permission denied. Cannot write configuration files."
  - [ ] Handle ENOSPC (disk full): display "Disk full. Cannot write configuration files."
  - [ ] Handle EROFS (read-only filesystem): display "Read-only filesystem. Cannot write configuration files."
  - [ ] Implement rollback: delete partially created files on failure
  - [ ] Exit with code 1 on any file operation error

## Dev Notes

### Configuration File Schemas

```typescript
// packages/cli/src/lib/config.ts

export interface SharedConfig {
  project_id: string;
  project_name: string;
  team_id: string;
  team_name: string;
  api_endpoint: string;
  created_at: string;       // ISO 8601
  created_by: string;
}

export interface UserConfig {
  user_id: string;
  user_name: string;
  api_key: string;          // Stored locally, gitignored
  configured_at: string;    // ISO 8601
}

export const CONTEXTOR_DIR = '.contextor';
export const CONFIG_FILE = 'config.json';
export const USER_FILE = '.user';
```

### Implementation Reference

```typescript
// packages/cli/src/lib/config.ts
import { mkdir, writeFile, readFile, access, unlink } from 'fs/promises';
import { join } from 'path';
import type { InstallToken } from './token.js';

export function createSharedConfig(token: InstallToken): SharedConfig {
  return {
    project_id: token.project_id,
    project_name: token.project_name,
    team_id: token.team_id,
    team_name: token.team_name,
    api_endpoint: token.api_endpoint,
    created_at: new Date().toISOString(),
    created_by: token.user_name,
  };
}

export function createUserConfig(token: InstallToken): UserConfig {
  return {
    user_id: token.user_id,
    user_name: token.user_name,
    api_key: token.api_key,
    configured_at: new Date().toISOString(),
  };
}

export async function writeSharedConfig(config: SharedConfig, cwd: string): Promise<void> {
  const dir = join(cwd, CONTEXTOR_DIR);
  const filePath = join(dir, CONFIG_FILE);
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export async function writeUserConfig(config: UserConfig, cwd: string): Promise<void> {
  const dir = join(cwd, CONTEXTOR_DIR);
  const filePath = join(dir, USER_FILE);
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}
```

### Gitignore Management

```typescript
// packages/cli/src/lib/gitignore.ts
import { readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';
import { constants } from 'fs';

const GITIGNORE_ENTRY = '.contextor/.user';

export async function ensureGitignore(cwd: string): Promise<boolean> {
  const gitignorePath = join(cwd, '.gitignore');
  let content = '';
  let exists = false;

  try {
    await access(gitignorePath, constants.F_OK);
    content = await readFile(gitignorePath, 'utf-8');
    exists = true;
  } catch {
    exists = false;
  }

  if (isEntryCovered(content)) {
    return false;
  }

  const newContent = addEntry(content);
  await writeFile(gitignorePath, newContent, 'utf-8');
  return true;
}

function isEntryCovered(content: string): boolean {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed === '') continue;
    if (trimmed === GITIGNORE_ENTRY) return true;
    if (trimmed === '.contextor/' || trimmed === '.contextor' || trimmed === '.contextor/*') return true;
  }
  return false;
}

function addEntry(content: string): string {
  if (!content.trim()) {
    return `# Contextor user configuration (personal, not shared)\n${GITIGNORE_ENTRY}\n`;
  }
  const base = content.endsWith('\n') ? content : content + '\n';
  return base + `\n# Contextor user configuration\n${GITIGNORE_ENTRY}\n`;
}
```

### Init Command Integration

```typescript
// packages/cli/src/commands/init.ts (config creation section)
import { createSharedConfig, createUserConfig, writeSharedConfig, writeUserConfig } from '../lib/config.js';
import { ensureGitignore } from '../lib/gitignore.js';
import ora from 'ora';
import chalk from 'chalk';

const cwd = process.cwd();
const createdFiles: string[] = [];

try {
  if (state === InstallState.FRESH || (state === InstallState.MISMATCH && options.force)) {
    const sharedSpinner = ora('Creating shared configuration...').start();
    const sharedConfig = createSharedConfig(token);
    await writeSharedConfig(sharedConfig, cwd);
    createdFiles.push('.contextor/config.json');
    sharedSpinner.succeed('Created .contextor/config.json');
  }

  const userSpinner = ora('Creating personal configuration...').start();
  const userConfig = createUserConfig(token);
  await writeUserConfig(userConfig, cwd);
  createdFiles.push('.contextor/.user');
  userSpinner.succeed('Created .contextor/.user');

  const gitignoreSpinner = ora('Updating .gitignore...').start();
  const gitignoreUpdated = await ensureGitignore(cwd);
  if (gitignoreUpdated) {
    gitignoreSpinner.succeed('Added .contextor/.user to .gitignore');
  } else {
    gitignoreSpinner.succeed('.gitignore already configured');
  }

} catch (error) {
  // Rollback created files
  for (const file of createdFiles) {
    try { await unlink(join(cwd, file)); } catch {}
  }

  if (error.code === 'EACCES') {
    console.error(chalk.red('Permission denied. Cannot write configuration files.'));
  } else if (error.code === 'ENOSPC') {
    console.error(chalk.red('Disk full. Cannot write configuration files.'));
  } else if (error.code === 'EROFS') {
    console.error(chalk.red('Read-only filesystem. Cannot write configuration files.'));
  } else {
    console.error(chalk.red('Failed to create configuration files.'));
    console.error(chalk.gray(error.message));
  }
  process.exit(1);
}
```

### Example Config Files

**.contextor/config.json (committed):**
```json
{
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "project_name": "My Awesome Project",
  "team_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "team_name": "Engineering Team",
  "api_endpoint": "https://api.contextor.co",
  "created_at": "2025-01-15T10:30:00.000Z",
  "created_by": "John Developer"
}
```

**.contextor/.user (gitignored):**
```json
{
  "user_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "user_name": "Jane Developer",
  "api_key": "sk_live_abc123...",
  "configured_at": "2025-01-16T14:22:00.000Z"
}
```

### Directory Structure After This Story

```
packages/cli/
├── src/
│   ├── bin/
│   │   └── contextor.ts
│   ├── commands/
│   │   ├── init.ts              # Updated: config creation
│   │   ├── status.ts
│   │   └── uninstall.ts
│   └── lib/
│       ├── token.ts
│       ├── api-client.ts
│       ├── detection.ts
│       ├── config.ts            # New: config management
│       ├── gitignore.ts         # New: gitignore management
│       └── __tests__/
│           ├── token.test.ts
│           ├── detection.test.ts
│           ├── config.test.ts   # New
│           └── gitignore.test.ts # New
```

### Critical Constraints

From architecture and project-context:
- `.contextor/config.json` is **committed** to git (shared team config)
- `.contextor/.user` is **gitignored** (personal, contains API key)
- Never store API keys in plaintext in committed files
- Use async fs/promises for all file operations
- Hook config in `.claude/settings.json` is handled in Story 3.5

### Common Pitfalls

1. **DO NOT** put API key in config.json - only in .user file
2. **DO NOT** forget to add .user to gitignore
3. **DO NOT** overwrite config.json in JOINING state
4. **DO NOT** add duplicate gitignore entries
5. **DO NOT** create files without error handling and rollback
6. **DO NOT** use synchronous file operations

### Verification Checklist

- [ ] Fresh install creates both config.json and .user
- [ ] config.json has all required fields with correct values
- [ ] .user has all required fields with correct values
- [ ] .user contains the API key (not config.json)
- [ ] .gitignore is created if missing
- [ ] .gitignore is updated if .contextor/.user not present
- [ ] No duplicate entries added to .gitignore
- [ ] JOINING state creates only .user file
- [ ] Permission errors display user-friendly message and exit code 1
- [ ] Partial failures trigger rollback of created files
- [ ] Config files use pretty JSON formatting (2-space indent)

### References

- [Source: _bmad-output/epics.md#Story-3.4-Configuration-File-Creation]
- [Source: _bmad-output/project-context.md#Local-Files-Created]
- [Source: _bmad-output/architecture.md#CLI-Package-Architecture]

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
