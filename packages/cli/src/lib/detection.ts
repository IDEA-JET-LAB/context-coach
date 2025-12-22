import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { SharedConfig } from './config.js';

export const CONTEXTOR_DIR = '.contextor';
export const CONFIG_FILE = 'config.json';
export const USER_FILE = '.user';

/**
 * Possible installation states for a project
 */
export enum InstallState {
  /** No .contextor/ directory exists - first time install */
  FRESH = 'fresh',
  /** config.json exists but .user missing - team member joining */
  JOINING = 'joining',
  /** Both files exist for same project */
  CONFIGURED = 'configured',
  /** Token project_id doesn't match existing config */
  MISMATCH = 'mismatch',
}

/**
 * Result of install state detection
 */
export interface DetectionResult {
  state: InstallState;
  existingConfig?: SharedConfig;
  warning?: string;
}

/**
 * Read and parse the shared config file
 * Returns null if file doesn't exist or is invalid
 */
export function readConfigFile(path: string): SharedConfig | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    const content = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(content) as SharedConfig;

    // Validate required fields
    if (!parsed.project_id || !parsed.team_id) {
      return null;
    }

    return parsed;
  } catch {
    // JSON parse error or other read error
    return null;
  }
}

/**
 * Check if user config file exists
 */
export function userConfigExists(cwd: string): boolean {
  const userPath = join(cwd, CONTEXTOR_DIR, USER_FILE);
  return existsSync(userPath);
}

/**
 * Detect the current installation state for a project
 */
export async function detectInstallState(
  cwd: string,
  tokenProjectId: string
): Promise<DetectionResult> {
  const contextorDir = join(cwd, CONTEXTOR_DIR);
  const configPath = join(contextorDir, CONFIG_FILE);

  // Check if .contextor directory exists
  if (!existsSync(contextorDir)) {
    return { state: InstallState.FRESH };
  }

  // Try to read existing config
  const config = readConfigFile(configPath);

  // If config is missing or invalid, treat as fresh install with warning
  if (!config) {
    return {
      state: InstallState.FRESH,
      warning: 'Existing .contextor directory found with invalid config. Treating as fresh install.',
    };
  }

  // Check if user config exists
  const hasUserConfig = userConfigExists(cwd);

  // Check if project IDs match
  const projectMatches = config.project_id === tokenProjectId;

  // If project doesn't match, it's a mismatch
  if (!projectMatches) {
    return { state: InstallState.MISMATCH, existingConfig: config };
  }

  // If no user config, user is joining existing project
  if (!hasUserConfig) {
    return { state: InstallState.JOINING, existingConfig: config };
  }

  // Both exist and match - already configured
  return { state: InstallState.CONFIGURED, existingConfig: config };
}
