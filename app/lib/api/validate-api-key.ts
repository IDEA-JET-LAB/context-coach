import { createAdminClient } from "@/lib/supabase/admin";
import { createHash, timingSafeEqual } from "crypto";

export interface ApiKeyValidationResult {
  valid: boolean;
  project_id?: string;
  team_id?: string;
}

/**
 * Validates an API key against the projects table.
 *
 * Security considerations:
 * - Uses SHA-256 hashing to compare keys
 * - Uses timing-safe comparison to prevent timing attacks
 * - Uses admin client to bypass RLS for cross-project lookup
 *
 * @param apiKey - The raw API key from the Authorization header
 * @returns Validation result with project_id and team_id if valid
 */
export async function validateApiKey(
  apiKey: string
): Promise<ApiKeyValidationResult> {
  if (!apiKey || typeof apiKey !== "string") {
    return { valid: false };
  }

  try {
    // Hash the incoming API key
    const keyHash = createHash("sha256").update(apiKey).digest("hex");

    const supabase = createAdminClient();

    // Look up project by API key hash
    const { data: project, error } = await supabase
      .from("projects")
      .select("id, team_id, api_key_hash, is_archived")
      .eq("api_key_hash", keyHash)
      .single();

    if (error || !project) {
      console.log("[API] validate-api-key: no matching project found");
      return { valid: false };
    }

    // Check if project is archived
    if (project.is_archived) {
      console.log("[API] validate-api-key: project is archived");
      return { valid: false };
    }

    // Constant-time comparison to prevent timing attacks
    const storedHash = Buffer.from(project.api_key_hash, "hex");
    const providedHash = Buffer.from(keyHash, "hex");

    if (storedHash.length !== providedHash.length) {
      return { valid: false };
    }

    if (!timingSafeEqual(storedHash, providedHash)) {
      return { valid: false };
    }

    return {
      valid: true,
      project_id: project.id,
      team_id: project.team_id,
    };
  } catch (error) {
    console.error("[API] validate-api-key: error during validation", error);
    return { valid: false };
  }
}

/**
 * Extracts API key from Authorization header.
 *
 * @param authHeader - The Authorization header value
 * @returns The API key or null if invalid format
 */
export function extractApiKey(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  const apiKey = authHeader.slice(7).trim();
  return apiKey.length > 0 ? apiKey : null;
}
