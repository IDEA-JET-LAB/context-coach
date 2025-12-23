/**
 * Timeout constants for API and hook operations
 */
export const TIMEOUTS = {
  /** Timeout for token validation and API test requests (10 seconds) */
  API_REQUEST_MS: 10000,
  /** Timeout for capture hook execution (5 seconds) */
  HOOK_EXECUTION_MS: 5000,
} as const;

/**
 * Dashboard URL configuration
 */
export const DASHBOARD_BASE_URL = 'https://contextor.co';

/**
 * Build dashboard URL for a specific project
 */
export function getDashboardProjectUrl(projectId: string): string {
  return `${DASHBOARD_BASE_URL}/projects/${projectId}`;
}

/**
 * Get dashboard projects list URL
 */
export function getDashboardProjectsUrl(): string {
  return `${DASHBOARD_BASE_URL}/projects`;
}
