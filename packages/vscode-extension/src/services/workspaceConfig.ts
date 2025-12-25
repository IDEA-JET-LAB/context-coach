/**
 * Workspace Configuration Service
 *
 * Reads .contextor/config.json from the current workspace to identify
 * the project for filtering prompts.
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

/**
 * Shared project configuration stored in .contextor/config.json
 */
export interface ContextorWorkspaceConfig {
  project_id: string;
  project_name: string;
  team_id: string;
  team_name: string;
  api_endpoint: string;
  created_at: string;
  created_by: string;
}

/**
 * Service for reading Contextor workspace configuration
 */
export class WorkspaceConfigService {
  private readonly outputChannel: vscode.OutputChannel;
  private cachedConfig: ContextorWorkspaceConfig | null = null;
  private cachedWorkspaceFolder: string | null = null;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * Get the current workspace config, reading from .contextor/config.json
   * @returns The workspace config or null if not found
   */
  async getWorkspaceConfig(): Promise<ContextorWorkspaceConfig | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      this.log("No workspace folder open");
      return null;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    // Return cached config if workspace hasn't changed
    if (this.cachedConfig && this.cachedWorkspaceFolder === workspaceRoot) {
      return this.cachedConfig;
    }

    const configPath = path.join(workspaceRoot, ".contextor", "config.json");

    try {
      if (!fs.existsSync(configPath)) {
        this.log(`No config found at ${configPath}`);
        this.cachedConfig = null;
        this.cachedWorkspaceFolder = workspaceRoot;
        return null;
      }

      const content = fs.readFileSync(configPath, "utf-8");
      const config = JSON.parse(content) as ContextorWorkspaceConfig;

      // Validate required fields
      if (!config.project_id || !config.team_id) {
        this.log("Invalid config: missing required fields");
        this.cachedConfig = null;
        this.cachedWorkspaceFolder = workspaceRoot;
        return null;
      }

      this.log(`Loaded workspace config for project: ${config.project_name}`);
      this.cachedConfig = config;
      this.cachedWorkspaceFolder = workspaceRoot;
      return config;
    } catch (error) {
      this.log(`Error reading config: ${error instanceof Error ? error.message : String(error)}`);
      this.cachedConfig = null;
      this.cachedWorkspaceFolder = workspaceRoot;
      return null;
    }
  }

  /**
   * Get just the project_id from the workspace config
   * @returns The project UUID or null if not configured
   */
  async getProjectId(): Promise<string | null> {
    const config = await this.getWorkspaceConfig();
    return config?.project_id ?? null;
  }

  /**
   * Get just the project_name from the workspace config
   * @returns The project name or null if not configured
   */
  async getProjectName(): Promise<string | null> {
    const config = await this.getWorkspaceConfig();
    return config?.project_name ?? null;
  }

  /**
   * Clear the cached config (e.g., when workspace changes)
   */
  clearCache(): void {
    this.cachedConfig = null;
    this.cachedWorkspaceFolder = null;
  }

  /**
   * Check if the current workspace has Contextor configured
   */
  async isContextorConfigured(): Promise<boolean> {
    const config = await this.getWorkspaceConfig();
    return config !== null;
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] [WorkspaceConfig] ${message}`);
  }
}
