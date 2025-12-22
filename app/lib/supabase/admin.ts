import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client with service role privileges.
 * This client bypasses RLS and should ONLY be used server-side.
 *
 * Use cases:
 * - API key validation (lookup across all projects)
 * - Admin operations
 * - Background jobs
 *
 * NEVER import this in client components or expose to the browser.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
