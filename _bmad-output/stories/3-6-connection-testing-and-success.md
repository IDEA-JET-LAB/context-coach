# Story 3.6: Connection Testing & Success

Status: ✅ Done

## Story

**As a** developer,
**I want** the CLI to verify the installation works,
**So that** I know prompts will be captured correctly.

## Acceptance Criteria

1. **Given** the installation is complete
   **When** the CLI runs the connection test
   **Then** a test request is sent to `api.contextor.co/cli/test-capture`
   **And** the API validates the API key
   **And** success or failure is reported

2. **Given** the connection test succeeds
   **When** the CLI finishes
   **Then** I see a success message with coaching-positive framing
   **And** the dashboard URL is displayed: `https://app.contextor.co/projects/<project_id>`
   **And** the message says "Your prompts will appear there as you work"

3. **Given** the connection test fails
   **When** the CLI reports the error
   **Then** I see specific troubleshooting steps
   **And** a link to documentation

## Tasks / Subtasks

- [ ] **Task 1: Implement test capture API call** (AC: #1)
  - [ ] Add function to api-client.ts: `testCapture(config: UserConfig, sharedConfig: SharedConfig): Promise<TestResult>`
  - [ ] Make POST request to `${api_endpoint}/cli/test-capture`
  - [ ] Include Authorization header with API key
  - [ ] Send project_id, user_id, and cli_version in request body
  - [ ] Handle HTTP response codes (200, 401, 403, 404, 429, 5xx)
  - [ ] Set request timeout to 10 seconds with AbortController

- [ ] **Task 2: Define test result types** (AC: #1, #3)
  - [ ] Create `TestResult` interface with success, error, details fields
  - [ ] Define error codes: `AUTH_FAILED`, `PROJECT_NOT_FOUND`, `FORBIDDEN`, `RATE_LIMITED`, `SERVER_ERROR`, `TIMEOUT`, `NETWORK_ERROR`
  - [ ] Map HTTP status codes to error codes (401->AUTH_FAILED, 403->FORBIDDEN, 404->PROJECT_NOT_FOUND, 429->RATE_LIMITED)
  - [ ] Include user-friendly error messages for each code

- [ ] **Task 3: Create success message formatter** (AC: #2)
  - [ ] Create `packages/cli/src/lib/messages.ts`
  - [ ] Implement `formatSuccessMessage(projectId: string, projectName: string): string`
  - [ ] Use coaching-positive language (encouraging, not technical)
  - [ ] Include dashboard URL: `https://app.contextor.co/projects/${projectId}`
  - [ ] Add "Your prompts will appear there as you work" message
  - [ ] Use chalk for colored output with `supportsColor` check for fallback

- [ ] **Task 4: Create failure message formatter** (AC: #3)
  - [ ] Implement `formatFailureMessage(error: TestError): string`
  - [ ] Include specific troubleshooting steps per error type
  - [ ] Add documentation link: `https://docs.contextor.co/troubleshooting`
  - [ ] Use chalk for colored output with `supportsColor` fallback
  - [ ] Suggest common fixes (check internet, regenerate token, etc.)

- [ ] **Task 5: Integrate connection test into init command** (AC: #1, #2, #3)
  - [ ] Call `testCapture()` after all configuration is complete
  - [ ] Display spinner with accessible text: "Testing connection..."
  - [ ] On success: show success message with dashboard URL, exit code 0
  - [ ] On failure: show failure message with troubleshooting steps, exit code 0 (files are valid)
  - [ ] Log note that configuration files were created successfully on failure

- [ ] **Task 6: Create installation summary output** (AC: #2)
  - [ ] Display installation summary after all steps complete
  - [ ] Show project name and team name
  - [ ] Show user who configured
  - [ ] Show files created (config.json, .user, capture script)
  - [ ] Show next steps for the developer

- [ ] **Task 7: Write unit tests** (AC: #1, #2, #3)
  - [ ] Test testCapture with mocked fetch responses (200, 401, 403, 404, 429, 500)
  - [ ] Test timeout handling with AbortController mock
  - [ ] Test network error handling
  - [ ] Test formatSuccessMessage output format
  - [ ] Test formatFailureMessage for each error code
  - [ ] Test formatInstallationSummary output

## Dev Notes

### Test Capture API

```typescript
// packages/cli/src/lib/api-client.ts

import { version } from '../../package.json';

export interface TestResult {
  success: boolean;
  error?: TestError;
}

export interface TestError {
  code: 'AUTH_FAILED' | 'PROJECT_NOT_FOUND' | 'FORBIDDEN' | 'RATE_LIMITED' | 'SERVER_ERROR' | 'TIMEOUT' | 'NETWORK_ERROR';
  message: string;
}

const ERROR_MAP: Record<number, TestError> = {
  401: { code: 'AUTH_FAILED', message: 'Authentication failed. Your API key may be invalid.' },
  403: { code: 'FORBIDDEN', message: 'Access denied. You may not have permission for this project.' },
  404: { code: 'PROJECT_NOT_FOUND', message: 'Project not found. It may have been deleted.' },
  429: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.' },
};

export async function testCapture(
  userConfig: UserConfig,
  sharedConfig: SharedConfig
): Promise<TestResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `${sharedConfig.api_endpoint}/cli/test-capture`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userConfig.api_key}`,
        },
        body: JSON.stringify({
          project_id: sharedConfig.project_id,
          user_id: userConfig.user_id,
          cli_version: version,
          test: true,
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (response.ok) return { success: true };

    const knownError = ERROR_MAP[response.status];
    if (knownError) return { success: false, error: knownError };

    return {
      success: false,
      error: { code: 'SERVER_ERROR', message: `Server error (${response.status}). Please try again later.` },
    };
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      return { success: false, error: { code: 'TIMEOUT', message: 'Connection timed out. Please check your internet connection.' } };
    }
    return { success: false, error: { code: 'NETWORK_ERROR', message: 'Could not connect to Contextor API. Please check your internet connection.' } };
  }
}
```

### Message Formatting

```typescript
// packages/cli/src/lib/messages.ts
import chalk from 'chalk';
import type { TestError } from './api-client.js';
import type { SharedConfig, UserConfig } from './config.js';

// Fallback for non-color terminals
const c = chalk.supportsColor ? chalk : {
  green: { bold: (s: string) => s },
  red: { bold: (s: string) => s },
  white: (s: string) => s,
  cyan: (s: string) => s,
  gray: (s: string) => s,
  yellow: (s: string) => s,
  underline: { blue: (s: string) => s },
};

const TROUBLESHOOTING_STEPS: Record<string, string[]> = {
  AUTH_FAILED: [
    'Regenerate your install token from the dashboard',
    'Run `npx @contextor/cli init <new-token>` again',
    'If the issue persists, contact support',
  ],
  PROJECT_NOT_FOUND: [
    'Verify the project exists in the dashboard',
    'Regenerate the install token from the correct project',
    'Run `npx @contextor/cli init <new-token>` again',
  ],
  FORBIDDEN: [
    'Verify you have access to this project in the dashboard',
    'Ask your team admin to add you to the project',
    'Regenerate the install token after getting access',
  ],
  RATE_LIMITED: [
    'Wait a few minutes before trying again',
    'Run `npx @contextor/cli status` to verify connection',
  ],
  TIMEOUT: [
    'Check your internet connection',
    'Verify api.contextor.co is accessible',
    'Check if a firewall or proxy is blocking the connection',
    'Try again with `npx @contextor/cli status`',
  ],
  NETWORK_ERROR: [
    'Check your internet connection',
    'Verify api.contextor.co is accessible',
    'Check if a firewall or proxy is blocking the connection',
    'Try again with `npx @contextor/cli status`',
  ],
  SERVER_ERROR: [
    'Wait a few minutes and try again',
    'Run `npx @contextor/cli status` to check connection',
    'If the issue persists, contact support',
  ],
};

export function formatSuccessMessage(sharedConfig: SharedConfig, userConfig: UserConfig): string {
  const dashboardUrl = `https://app.contextor.co/projects/${sharedConfig.project_id}`;
  return `
${c.green.bold('Success! Contextor is ready.')}

Project: ${c.cyan(sharedConfig.project_name)}
Team: ${c.cyan(sharedConfig.team_name)}
User: ${c.cyan(userConfig.user_name)}

Dashboard: ${c.underline.blue(dashboardUrl)}

${c.gray('Your prompts will appear there as you work.')}
${c.gray('Start coding with Claude Code to begin capturing!')}
`;
}

export function formatFailureMessage(error: TestError): string {
  const steps = TROUBLESHOOTING_STEPS[error.code] || TROUBLESHOOTING_STEPS.SERVER_ERROR;
  const stepsText = steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n');
  return `
${c.red.bold('Connection test failed')}

${c.red(error.message)}

${c.yellow('Troubleshooting steps:')}
${stepsText}

${c.gray('Documentation:')} ${c.underline.blue('https://docs.contextor.co/troubleshooting')}
`;
}

export function formatInstallationSummary(sharedConfig: SharedConfig, filesCreated: string[]): string {
  const filesList = filesCreated.map(f => `  - ${f}`).join('\n');
  return `
Installation Summary
${'─'.repeat(40)}

Files created:
${c.gray(filesList)}

Configuration:
  Project ID: ${c.gray(sharedConfig.project_id)}
  API Endpoint: ${c.gray(sharedConfig.api_endpoint)}

${'─'.repeat(40)}
`;
}
```

### Updated Init Command Flow

```typescript
// packages/cli/src/commands/init.ts (final section)
import ora from 'ora';
import { testCapture } from '../lib/api-client.js';
import { formatSuccessMessage, formatFailureMessage, formatInstallationSummary } from '../lib/messages.js';

// ... after hook configuration ...

const testSpinner = ora({ text: 'Testing connection...', discardStdin: false }).start();
const testResult = await testCapture(userConfig, sharedConfig);

if (testResult.success) {
  testSpinner.succeed('Connection verified');
  console.log(formatInstallationSummary(sharedConfig, [
    '.contextor/config.json',
    '.contextor/.user',
    '.claude/settings.json',
    '.claude/hooks/contextor-capture.sh',
  ]));
  console.log(formatSuccessMessage(sharedConfig, userConfig));
  process.exit(0);
} else {
  testSpinner.fail('Connection test failed');
  console.log(formatFailureMessage(testResult.error!));
  console.log(chalk.yellow('\nNote: Configuration files were created successfully.'));
  console.log(chalk.yellow('Run `npx @contextor/cli status` to retry the connection test.\n'));
  process.exit(0); // Files created successfully, connection can be retried
}
```

### Example CLI Output

**Success:**
```
$ npx @contextor/cli init ctx_abc123...
✓ Token validated
✓ Created .contextor/config.json
✓ Created .contextor/.user
✓ Added .contextor/.user to .gitignore
✓ Claude Code hook configured
✓ Connection verified

Installation Summary
────────────────────────────────────────

Files created:
  - .contextor/config.json
  - .contextor/.user
  - .claude/settings.json
  - .claude/hooks/contextor-capture.sh

Configuration:
  Project ID: 550e8400-e29b-41d4-a716-446655440000
  API Endpoint: https://api.contextor.co

────────────────────────────────────────

Success! Contextor is ready.

Project: My Awesome Project
Team: Engineering Team
User: Jane Developer

Dashboard: https://app.contextor.co/projects/550e8400-e29b-41d4-a716-446655440000

Your prompts will appear there as you work.
Start coding with Claude Code to begin capturing!
```

**Failure:**
```
$ npx @contextor/cli init ctx_abc123...
✓ Token validated
✓ Created .contextor/config.json
✓ Created .contextor/.user
✓ Added .contextor/.user to .gitignore
✓ Claude Code hook configured
✗ Connection test failed

Connection test failed

Connection timed out. Please check your internet connection.

Troubleshooting steps:
  1. Check your internet connection
  2. Verify api.contextor.co is accessible
  3. Check if a firewall or proxy is blocking the connection
  4. Try again with npx @contextor/cli status

Documentation: https://docs.contextor.co/troubleshooting

Note: Configuration files were created successfully.
Run `npx @contextor/cli status` to retry the connection test.
```

### Directory Structure After This Story

```
packages/cli/
├── src/
│   ├── commands/
│   │   ├── init.ts              # UPDATED: Connection test integration
│   │   ├── status.ts
│   │   └── uninstall.ts
│   └── lib/
│       ├── api-client.ts        # UPDATED: testCapture function
│       ├── messages.ts          # NEW: Message formatting
│       ├── token.ts
│       ├── detection.ts
│       ├── config.ts
│       ├── gitignore.ts
│       ├── hooks.ts
│       └── __tests__/
│           ├── api-client.test.ts  # NEW
│           └── messages.test.ts    # NEW
```

### Critical Architecture Constraints

- API endpoint: `https://api.contextor.co/cli/test-capture` (from project-context.md)
- Dashboard URL: `https://app.contextor.co/projects/<project_id>`
- Coaching-positive framing required (encouraging, not punitive)
- Use chalk with supportsColor fallback for terminal compatibility
- Exit code 0 even on test failure (files are still valid)

### Common Pitfalls to Avoid

1. **DO NOT** fail installation if connection test fails - files are still valid
2. **DO NOT** expose technical error details - use user-friendly messages
3. **DO NOT** forget timeout handling - network can be slow
4. **DO NOT** use generic error messages - be specific about the problem
5. **DO NOT** skip color fallback - some terminals don't support colors
6. **DO NOT** forget to include cli_version in test request for debugging

### Verification Checklist

After completing this story, verify:
- [ ] Test capture API call is made after configuration
- [ ] Successful response shows green success message
- [ ] Dashboard URL is correctly formatted with project_id
- [ ] Coaching-positive language is used in success message
- [ ] Failed response shows red error message
- [ ] Troubleshooting steps are specific to error type
- [ ] Documentation link is included in failure message
- [ ] Timeout after 10 seconds is handled
- [ ] Network errors are handled gracefully
- [ ] Installation files are preserved even on test failure
- [ ] Exit code is 0 for both success and failure (files created)
- [ ] Color output has fallback for non-color terminals
- [ ] Unit tests cover all error scenarios

### References

- [Source: _bmad-output/epics.md#Story-3.6-Connection-Testing-Success]
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

### File List

*To be filled by dev agent - list all files created/modified*
