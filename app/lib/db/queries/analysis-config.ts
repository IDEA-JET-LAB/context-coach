/**
 * Analysis Configuration Query Helpers
 * Story 5.6: Analysis Configuration Management
 *
 * Query functions for analysis configs and dimensions.
 * Uses Supabase client with RLS (not service role).
 */

import { createClient } from "@/lib/supabase/server";
import type { AnalysisConfig } from "@/lib/types/analysis-config";

/**
 * Get the currently active analysis configuration with all its dimensions
 *
 * @returns The active config with dimensions, or null if none found
 * @throws Error if database query fails
 */
export async function getActiveConfig(): Promise<AnalysisConfig | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("analysis_configs")
    .select(
      `
      *,
      analysis_dimensions (*)
    `
    )
    .eq("is_active", true)
    .order("sort_order", { referencedTable: "analysis_dimensions" })
    .single();

  // PGRST116 = "JSON object requested, multiple (or no) rows returned"
  // This means no active config found
  if (error?.code === "PGRST116") {
    return null;
  }

  if (error) {
    throw error;
  }

  return data as AnalysisConfig;
}

/**
 * Get all analysis configurations with their dimensions
 * Ordered by version descending (newest first)
 *
 * @returns Array of configs with dimensions, empty if none found
 * @throws Error if database query fails
 */
export async function getAllConfigs(): Promise<AnalysisConfig[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("analysis_configs")
    .select(
      `
      *,
      analysis_dimensions (*)
    `
    )
    .order("version", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as AnalysisConfig[]) ?? [];
}

/**
 * Get a specific analysis configuration by ID
 *
 * @param configId - UUID of the config
 * @returns The config with dimensions, or null if not found
 * @throws Error if database query fails
 */
export async function getConfigById(
  configId: string
): Promise<AnalysisConfig | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("analysis_configs")
    .select(
      `
      *,
      analysis_dimensions (*)
    `
    )
    .eq("id", configId)
    .order("sort_order", { referencedTable: "analysis_dimensions" })
    .single();

  if (error?.code === "PGRST116") {
    return null;
  }

  if (error) {
    throw error;
  }

  return data as AnalysisConfig;
}

/**
 * Get a specific analysis configuration by version number
 *
 * @param version - Version number of the config
 * @returns The config with dimensions, or null if not found
 * @throws Error if database query fails
 */
export async function getConfigByVersion(
  version: number
): Promise<AnalysisConfig | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("analysis_configs")
    .select(
      `
      *,
      analysis_dimensions (*)
    `
    )
    .eq("version", version)
    .order("sort_order", { referencedTable: "analysis_dimensions" })
    .single();

  if (error?.code === "PGRST116") {
    return null;
  }

  if (error) {
    throw error;
  }

  return data as AnalysisConfig;
}
