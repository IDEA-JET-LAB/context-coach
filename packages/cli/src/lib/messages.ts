import chalk from 'chalk';
import type { TestError } from './api-client.js';
import type { SharedConfig, UserConfig } from './config.js';
import { getDashboardProjectUrl } from './constants.js';

/**
 * Troubleshooting steps for each error type
 */
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

/**
 * Format success message with coaching-positive framing
 */
export function formatSuccessMessage(
  sharedConfig: SharedConfig,
  userConfig: UserConfig
): string {
  const dashboardUrl = getDashboardProjectUrl(sharedConfig.project_id);

  return `
${chalk.green.bold('Success! Contextor is ready.')}

Project: ${chalk.cyan(sharedConfig.project_name)}
Team: ${chalk.cyan(sharedConfig.team_name)}
User: ${chalk.cyan(userConfig.user_name)}

Dashboard: ${chalk.underline.blue(dashboardUrl)}

${chalk.gray('Your prompts will appear there as you work.')}
${chalk.gray('Start coding with Claude Code to begin capturing!')}
`;
}

/**
 * Format failure message with troubleshooting steps
 */
export function formatFailureMessage(error: TestError): string {
  const steps = TROUBLESHOOTING_STEPS[error.code] ?? TROUBLESHOOTING_STEPS.SERVER_ERROR;
  const stepsText = steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n');

  return `
${chalk.red.bold('Connection test failed')}

${chalk.red(error.message)}

${chalk.yellow('Troubleshooting steps:')}
${stepsText}

${chalk.gray('Documentation:')} ${chalk.underline.blue('https://docs.contextor.co/troubleshooting')}
`;
}

/**
 * Format installation summary
 */
export function formatInstallationSummary(
  sharedConfig: SharedConfig,
  filesCreated: string[]
): string {
  const filesList = filesCreated.map(f => `  - ${f}`).join('\n');

  return `
Installation Summary
${'─'.repeat(40)}

Files created:
${chalk.gray(filesList)}

Configuration:
  Project ID: ${chalk.gray(sharedConfig.project_id)}
  API Endpoint: ${chalk.gray(sharedConfig.api_endpoint)}

${'─'.repeat(40)}
`;
}

/**
 * Format time ago for last capture display
 */
export function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

/**
 * Format date for display
 */
export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
