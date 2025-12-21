#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { registerInitCommand } from '../commands/init.js';
import { registerStatusCommand } from '../commands/status.js';
import { registerUninstallCommand } from '../commands/uninstall.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json
const packageJsonPath = join(__dirname, '../../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { version: string };

const program = new Command();

program
  .name('contextor')
  .description('CLI for installing Contextor in your projects')
  .version(packageJson.version);

// Register commands
registerInitCommand(program);
registerStatusCommand(program);
registerUninstallCommand(program);

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
  console.error('An unexpected error occurred:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('An unexpected error occurred:', String(reason));
  process.exit(1);
});

program.parse();
