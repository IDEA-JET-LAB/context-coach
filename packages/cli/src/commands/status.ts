import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync } from 'fs';
import { join } from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { readConfigFile, CONTEXTOR_DIR, CONFIG_FILE, USER_FILE } from '../lib/detection.js';
import { readUserConfig } from '../lib/config.js';
import { testCapture, getLastCapture } from '../lib/api-client.js';
import { formatTimeAgo, formatDate } from '../lib/messages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8')
) as { version: string };

function notInstalledMessage(): string {
  return `
${chalk.yellow('Contextor is not installed in this project.')}

To install, run:
  ${chalk.cyan('npx @contextor/cli init <TOKEN>')}

Get your install token from:
  ${chalk.underline.blue('https://app.contextor.co/projects')}
`;
}

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Check Contextor installation status')
    .action(async () => {
      const cwd = process.cwd();
      const contextorDir = join(cwd, CONTEXTOR_DIR);
      const configPath = join(contextorDir, CONFIG_FILE);
      const userPath = join(contextorDir, USER_FILE);

      // Check if installed
      if (!existsSync(contextorDir) || !existsSync(configPath)) {
        console.log(notInstalledMessage());
        process.exit(0);
      }

      // Read shared config with error handling
      const sharedConfig = readConfigFile(configPath);
      if (!sharedConfig) {
        console.log(chalk.red('Configuration file is corrupted or invalid.'));
        console.log(chalk.gray('Run `npx @contextor/cli init <TOKEN>` to reinstall.'));
        process.exit(1);
      }

      // Check for user config
      const userConfig = existsSync(userPath)
        ? await readUserConfig(userPath)
        : null;

      // Display status header
      console.log();
      console.log(chalk.white.bold('Contextor Status'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log();
      console.log(`${chalk.white('Project:')} ${chalk.cyan(sharedConfig.project_name)}`);
      console.log(`${chalk.white('Team:')} ${chalk.cyan(sharedConfig.team_name)}`);

      if (userConfig) {
        console.log(`${chalk.white('User:')} ${chalk.cyan(userConfig.user_name)}`);
        console.log(`${chalk.white('Configured:')} ${chalk.gray(formatDate(userConfig.configured_at))}`);

        // Test connection with spinner
        const spinner = ora('Checking connection...').start();
        const testResult = await testCapture(
          { api_key: userConfig.api_key, user_id: userConfig.user_id },
          { api_endpoint: sharedConfig.api_endpoint, project_id: sharedConfig.project_id },
          packageJson.version
        );

        spinner.stop();

        if (testResult.success) {
          console.log(`${chalk.white('Connection:')} ${chalk.green('Connected')}`);

          // Get last capture
          const lastCapture = await getLastCapture(
            { api_key: userConfig.api_key, user_id: userConfig.user_id },
            { api_endpoint: sharedConfig.api_endpoint, project_id: sharedConfig.project_id }
          );

          if (lastCapture) {
            console.log(`${chalk.white('Last capture:')} ${chalk.gray(formatTimeAgo(lastCapture))}`);
          } else {
            console.log(`${chalk.white('Last capture:')} ${chalk.gray('No prompts captured yet')}`);
          }
        } else {
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
