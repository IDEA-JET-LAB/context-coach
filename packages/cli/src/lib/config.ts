import { mkdir, writeFile, readFile, unlink, access, chmod } from 'fs/promises';
import { join } from 'path';
import { constants } from 'fs';
import type { InstallToken } from './token.js';

export const CONTEXTOR_DIR = '.contextor';
export const CONFIG_FILE = 'config.json';
export const USER_FILE = '.user';

/**
 * Shared project configuration stored in .contextor/config.json
 * This file is committed to git and shared with team members
 */
export interface SharedConfig {
  project_id: string;
  project_name: string;
  team_id: string;
  team_name: string;
  api_endpoint: string;
  created_at: string;
  created_by: string;
}

/**
 * Personal user configuration stored in .contextor/.user
 * This file is gitignored and contains the API key
 *
 * SECURITY NOTE: The API key is stored in plaintext JSON. While this file
 * is gitignored, it remains readable by any process with file access on the
 * local machine. The file permissions are set to 0600 (owner read/write only)
 * to limit exposure, but this does not protect against malicious processes
 * running as the same user. For high-security environments, consider using
 * OS-level secret management (e.g., macOS Keychain, Windows Credential Manager).
 */
export interface UserConfig {
  user_id: string;
  user_name: string;
  api_key: string;
  configured_at: string;
}

/**
 * Create shared config from install token
 */
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

/**
 * Create user config from install token
 */
export function createUserConfig(token: InstallToken): UserConfig {
  return {
    user_id: token.user_id,
    user_name: token.user_name,
    api_key: token.api_key,
    configured_at: new Date().toISOString(),
  };
}

/**
 * Write shared config to .contextor/config.json
 */
export async function writeSharedConfig(config: SharedConfig, cwd: string): Promise<void> {
  const dir = join(cwd, CONTEXTOR_DIR);
  const filePath = join(dir, CONFIG_FILE);
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

/**
 * Write user config to .contextor/.user
 *
 * Sets file permissions to 0600 (owner read/write only) to limit exposure
 * of the plaintext API key stored in this file.
 */
export async function writeUserConfig(config: UserConfig, cwd: string): Promise<void> {
  const dir = join(cwd, CONTEXTOR_DIR);
  const filePath = join(dir, USER_FILE);
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  // Set restrictive permissions: owner read/write only (0600)
  // This limits exposure but does not protect against processes running as the same user
  await chmod(filePath, 0o600);
}

/**
 * Read user config from .contextor/.user
 */
export async function readUserConfig(path: string): Promise<UserConfig | null> {
  try {
    const content = await readFile(path, 'utf-8');
    const parsed = JSON.parse(content) as UserConfig;
    if (!parsed.user_id || !parsed.api_key) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Delete a file, ignoring if it doesn't exist
 */
export async function safeUnlink(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // Ignore errors - file may not exist
  }
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Map file system error codes to user-friendly messages
 */
export function getFileErrorMessage(error: unknown): string {
  if (error instanceof Error && 'code' in error) {
    const code = (error as NodeJS.ErrnoException).code;
    switch (code) {
      case 'EACCES':
        return 'Permission denied. Cannot write configuration files.';
      case 'ENOSPC':
        return 'Disk full. Cannot write configuration files.';
      case 'EROFS':
        return 'Read-only filesystem. Cannot write configuration files.';
      default:
        return 'Failed to create configuration files.';
    }
  }
  return 'Failed to create configuration files.';
}
