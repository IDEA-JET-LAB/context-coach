/**
 * Project Types
 * Story 2.6: Project Creation
 * Story 2.7: Project Management
 */

export interface Project {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  api_key_prefix: string | null;
  created_at: string;
  created_by: string | null;
  is_archived: boolean;
  /** Whether this project was created via historical import */
  isImported?: boolean;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
}

export interface CreateProjectResponse {
  project: Project;
  apiKey: string; // Shown only once at creation
  installToken: string; // Install token for CLI
}

export interface UpdateProjectInput {
  name: string;
  description?: string | null;
}

export interface UpdateProjectResponse {
  project: Project;
}

export interface RegenerateKeyResponse {
  project: Project;
  apiKey: string; // Shown only once at regeneration
  installToken: string; // New install token
}

export interface ProjectWithTeam extends Project {
  team: {
    id: string;
    name: string;
  };
}
