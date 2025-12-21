import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { createInterface } from 'readline';
import {
  readClaudeSettings,
  writeClaudeSettings,
  removeContextorHook,
  CLAUDE_DIR,
  SETTINGS_FILE,
} from '../lib/hooks.js';
import { CONTEXTOR_DIR, USER_FILE } from '../lib/detection.js';

export function registerUninstallCommand(program: Command): void {
  program
    .command('uninstall')
    .description('Remove Contextor personal configuration')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (options: { yes?: boolean }) => {
      const cwd = process.cwd();
      const userPath = join(cwd, CONTEXTOR_DIR, USER_FILE);

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
      console.log(chalk.red(`  - ${CONTEXTOR_DIR}/${USER_FILE} (personal configuration)`));
      console.log(chalk.red(`  - Contextor hook from ${CLAUDE_DIR}/${SETTINGS_FILE}`));
      console.log();
      console.log(chalk.white('This will preserve:'));
      console.log(chalk.green(`  - ${CONTEXTOR_DIR}/config.json (shared team config)`));
      console.log(chalk.green(`  - ${CLAUDE_DIR}/hooks/contextor-capture.sh (shared script)`));
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
        const settings = await readClaudeSettings(cwd);
        const updatedSettings = removeContextorHook(settings);
        await writeClaudeSettings(updatedSettings, cwd);

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
