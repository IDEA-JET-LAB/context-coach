/**
 * Capture Config Pipeline Functions
 *
 * Non-admin functions for the capture pipeline.
 * These functions use the admin client but don't require auth checks
 * because they're called from server-side capture routes.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { CaptureConfig } from './capture-config-types';

/** Fixed ID for singleton config row */
const CAPTURE_CONFIG_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Cache for capture config.
 * TTL: 1 minute
 */
let configCache: { data: CaptureConfig; timestamp: number } | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute cache

/**
 * Get capture config for the capture pipeline.
 * Uses admin client - no auth check (called from server-side capture).
 * Cached for performance.
 */
export async function getCaptureConfigForPipeline(): Promise<CaptureConfig> {
  // Check cache
  if (configCache && Date.now() - configCache.timestamp < CACHE_TTL_MS) {
    return configCache.data;
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('capture_config')
    .select('*')
    .eq('id', CAPTURE_CONFIG_ID)
    .single();

  if (error || !data) {
    console.error('[CaptureConfig] Failed to fetch config for pipeline:', error);
    // Return defaults if fetch fails
    return {
      id: CAPTURE_CONFIG_ID,
      min_prompt_length: 10,
      max_prompt_length: 100000,
      garbage_patterns: [
        '^<bash-notification>',
        '^<system-reminder>',
        '^<output-file>',
        '^<shell-id>',
        '^<',
      ],
      skip_command_only: true,
      min_command_args_length: 10,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: null,
    };
  }

  const config: CaptureConfig = {
    ...data,
    garbage_patterns: Array.isArray(data.garbage_patterns)
      ? data.garbage_patterns
      : [],
  };

  // Update cache
  configCache = { data: config, timestamp: Date.now() };

  return config;
}

/**
 * Clear the capture config cache.
 * Called when config is updated to ensure pipeline uses new values.
 */
export function clearCaptureConfigCache(): void {
  configCache = null;
}
