import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { join } from 'path';
import { parseToken, TokenParseError, isTokenExpired, type InstallToken } from '../lib/token.js';
import { validateToken, testCapture } from '../lib/api-client.js';
import { formatSuccessMessage, formatFailureMessage, formatInstallationSummary } from '../lib/messages.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8')
) as { version: string };
import { detectInstallState, InstallState } from '../lib/detection.js';
import {
  createSharedConfig,
  createUserConfig,
  writeSharedConfig,
  writeUserConfig,
  safeUnlink,
  getFileErrorMessage,
  CONTEXTOR_DIR,
  CONFIG_FILE,
  USER_FILE,
  type SharedConfig,
  type UserConfig,
} from '../lib/config.js';
import { ensureGitignore } from '../lib/gitignore.js';
import { setupClaudeHooks, CLAUDE_DIR, HOOKS_DIR, CAPTURE_SCRIPT, SETTINGS_FILE } from '../lib/hooks.js';

export function registerInitCommand(program: Command): void {
  program
    .command('init <token>')
    .description('Initialize Contextor in this project')
    .option('-f, --force', 'Force installation, overwriting existing config')
    .action(async (tokenString: string, options: { force?: boolean }) => {
      const cwd = process.cwd();

      // Parse token
      let token: InstallToken;
      try {
        token = parseToken(tokenString);
      } catch (error) {
        if (error instanceof TokenParseError) {
          console.error(chalk.red(error.message));
          process.exit(1);
        }
        throw error;
      }

      // Check local expiry before API call
      if (isTokenExpired(token)) {
        console.error(
          chalk.red('This install token has expired. Please generate a new one.')
        );
        process.exit(1);
      }

      // Validate with API
      const validationSpinner = ora('Validating install token...').start();

      const result = await validateToken(token);

      if (result.expired) {
        validationSpinner.fail('Token validation failed');
        console.error(
          chalk.red('This install token has expired. Please generate a new one.')
        );
        process.exit(1);
      }

      if (!result.valid) {
        validationSpinner.fail('Token validation failed');
        console.error(chalk.red(result.error ?? 'Invalid token'));
        process.exit(1);
      }

      validationSpinner.succeed('Token validated');

      // Detect installation state
      const detectionSpinner = ora('Checking existing configuration...').start();
      const { state, existingConfig, warning } = await detectInstallState(cwd, token.project_id);
      detectionSpinner.stop();

      if (warning) {
        console.log(chalk.yellow(`Note: ${warning}`));
      }

      // Determine what to create
      let createShared = false;
      let sharedConfig: SharedConfig | undefined;
      let userConfig: UserConfig | undefined;

      // Handle each state
      switch (state) {
        case InstallState.FRESH:
          console.log(chalk.blue('Setting up Contextor for the first time...'));
          createShared = true;
          break;

        case InstallState.JOINING:
          console.log(chalk.blue(`Joining project: ${existingConfig?.project_name}`));
          console.log('Creating your personal configuration...');
          createShared = false;
          sharedConfig = existingConfig;
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
          createShared = true;
          break;
      }

      // Track created files for potential rollback
      const createdFiles: string[] = [];

      try {
        // Create shared config if needed
        if (createShared) {
          const sharedSpinner = ora('Creating shared configuration...').start();
          sharedConfig = createSharedConfig(token);
          await writeSharedConfig(sharedConfig, cwd);
          createdFiles.push(join(CONTEXTOR_DIR, CONFIG_FILE));
          sharedSpinner.succeed(`Created ${CONTEXTOR_DIR}/${CONFIG_FILE}`);
        }

        // Always create user config
        const userSpinner = ora('Creating personal configuration...').start();
        userConfig = createUserConfig(token);
        await writeUserConfig(userConfig, cwd);
        createdFiles.push(join(CONTEXTOR_DIR, USER_FILE));
        userSpinner.succeed(`Created ${CONTEXTOR_DIR}/${USER_FILE}`);

        // Ensure gitignore
        const gitignoreSpinner = ora('Updating .gitignore...').start();
        const gitignoreUpdated = await ensureGitignore(cwd);
        if (gitignoreUpdated) {
          gitignoreSpinner.succeed(`Added ${CONTEXTOR_DIR}/${USER_FILE} to .gitignore`);
        } else {
          gitignoreSpinner.succeed('.gitignore already configured');
        }

        // Configure Claude Code hooks
        const hookSpinner = ora('Configuring Claude Code hook...').start();
        await setupClaudeHooks(cwd);
        hookSpinner.succeed('Claude Code hook configured');

        // Test connection to API
        const testSpinner = ora('Testing connection...').start();
        const testResult = await testCapture(
          { api_key: userConfig.api_key, user_id: userConfig.user_id },
          { api_endpoint: sharedConfig!.api_endpoint, project_id: sharedConfig!.project_id },
          packageJson.version
        );

        // Prepare files list for summary
        const filesCreated = [
          `${CONTEXTOR_DIR}/${CONFIG_FILE}`,
          `${CONTEXTOR_DIR}/${USER_FILE}`,
          `${CLAUDE_DIR}/${SETTINGS_FILE}`,
          `${CLAUDE_DIR}/${HOOKS_DIR}/${CAPTURE_SCRIPT}`,
        ];

        if (testResult.success) {
          testSpinner.succeed('Connection verified');
          console.log(formatInstallationSummary(sharedConfig!, filesCreated));
          console.log(formatSuccessMessage(sharedConfig!, userConfig));
          process.exit(0);
        } else {
          testSpinner.fail('Connection test failed');
          console.log(formatFailureMessage(testResult.error!));
          console.log(chalk.yellow('\nNote: Configuration files were created successfully.'));
          console.log(chalk.yellow('Run `npx @contextor/cli status` to retry the connection test.\n'));
          // Exit 0 because files were created successfully - connection can be retried
          process.exit(0);
        }

      } catch (error) {
        // Rollback created files
        for (const file of createdFiles) {
          await safeUnlink(join(cwd, file));
        }

        const message = getFileErrorMessage(error);
        console.error(chalk.red(message));
        if (error instanceof Error && !message.includes(error.message)) {
          console.error(chalk.gray(error.message));
        }
        process.exit(1);
      }
    });
}
