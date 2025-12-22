import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export interface UserProfile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  is_super_admin: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get the current session, or null if not authenticated.
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error("[AUTH] getSession error:", error.message);
    return null;
  }

  return session;
}

/**
 * Require an active session or redirect to login.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();

  if (!session) {
    redirect("/login?message=session-expired");
  }

  return session;
}

/**
 * Get the current authenticated user, or null if not authenticated.
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("[AUTH] getUser error:", error.message);
    return null;
  }

  return user;
}

/**
 * Get the user's profile from the users table.
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("[AUTH] getUserProfile error:", error.message);
    return null;
  }

  return profile as UserProfile;
}

/**
 * Check if the current user is a platform super admin.
 */
export async function isSuperAdmin(): Promise<boolean> {
  const profile = await getUserProfile();
  return profile?.is_super_admin ?? false;
}

/**
 * Require super admin access or redirect.
 */
export async function requireSuperAdmin(): Promise<UserProfile> {
  const profile = await getUserProfile();

  if (!profile) {
    redirect("/login?message=session-expired");
  }

  if (!profile.is_super_admin) {
    console.warn(
      "[AUTH] non-admin attempted admin access: user_id=%s",
      profile.id
    );
    redirect("/prompts?message=no-access");
  }

  return profile;
}
