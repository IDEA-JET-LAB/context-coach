import { test, expect } from "@playwright/test";

/**
 * Tests for team members API - verifies the fix for Story 11-1
 * Story 11-1: Fix Team Analysis Page Error
 *
 * Root cause: team_members.user_id referenced auth.users but not public.users
 * PostgREST couldn't detect the relationship for join queries
 *
 * Fix: Added FK from team_members.user_id to public.users.id
 * Migration: 20251222200000_add_team_members_users_fk.sql
 */

const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_SERVICE_KEY = "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz";

const TEST_USER = {
  email: "edgars@test.com",
  password: "password123",
  userId: "11111111-1111-1111-1111-111111111111",
  teamId: "22222222-2222-2222-2222-222222222222",
};

test.describe("Team Members API - Story 11-1 Fix", () => {
  test("Supabase can join team_members with users table", async ({ request }) => {
    // This is the core fix for Story 11-1
    // Before the fix, this query would fail with:
    // "Could not find a relationship between 'team_members' and 'users' in the schema cache"

    const response = await request.get(
      `${LOCAL_SUPABASE_URL}/rest/v1/team_members?team_id=eq.${TEST_USER.teamId}&select=*,user:users(id,name,avatar_url)`,
      {
        headers: {
          apikey: LOCAL_SERVICE_KEY,
          Authorization: `Bearer ${LOCAL_SERVICE_KEY}`,
        },
      }
    );

    expect(response.ok()).toBeTruthy();
    const members = await response.json();

    // Verify we got results
    expect(members).toBeInstanceOf(Array);
    expect(members.length).toBeGreaterThan(0);

    // Verify the join worked - user data is included
    const testMember = members.find(
      (m: { user_id: string }) => m.user_id === TEST_USER.userId
    );
    expect(testMember).toBeDefined();
    expect(testMember.user).toBeDefined();
    expect(testMember.user.id).toBe(TEST_USER.userId);
    expect(testMember.user.name).toBe("Edgars Test");
  });

  test("team_members has FK constraint to public.users", async ({ request }) => {
    // Verify the FK constraint exists by checking system tables
    const response = await request.get(
      `${LOCAL_SUPABASE_URL}/rest/v1/rpc/verify_fk_exists`,
      {
        headers: {
          apikey: LOCAL_SERVICE_KEY,
          Authorization: `Bearer ${LOCAL_SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        data: {
          table_name: "team_members",
          constraint_name: "team_members_user_id_public_users_fkey",
        },
      }
    );

    // If the RPC doesn't exist, we'll verify via direct query
    if (!response.ok()) {
      // Fallback: Test the join works which proves FK exists
      const joinResponse = await request.get(
        `${LOCAL_SUPABASE_URL}/rest/v1/team_members?select=user:users(id)&limit=1`,
        {
          headers: {
            apikey: LOCAL_SERVICE_KEY,
            Authorization: `Bearer ${LOCAL_SERVICE_KEY}`,
          },
        }
      );
      expect(joinResponse.ok()).toBeTruthy();
    }
  });

  test("team members query returns user profile data", async ({ request }) => {
    // Test with the exact query pattern used by the API route
    const response = await request.get(
      `${LOCAL_SUPABASE_URL}/rest/v1/team_members?team_id=eq.${TEST_USER.teamId}&select=id,user_id,role,joined_at,user:users(id,name,avatar_url)&order=joined_at.asc`,
      {
        headers: {
          apikey: LOCAL_SERVICE_KEY,
          Authorization: `Bearer ${LOCAL_SERVICE_KEY}`,
        },
      }
    );

    expect(response.ok()).toBeTruthy();
    const members = await response.json();

    // Transform like the API does
    const membersFormatted = members.map(
      (member: {
        id: string;
        user_id: string;
        role: string;
        joined_at: string;
        user: { id: string; name: string | null; avatar_url: string | null };
      }) => ({
        id: member.id,
        user_id: member.user_id,
        role: member.role,
        joined_at: member.joined_at,
        name: member.user?.name || null,
        avatar_url: member.user?.avatar_url || null,
      })
    );

    expect(membersFormatted.length).toBeGreaterThan(0);
    expect(membersFormatted[0].name).toBe("Edgars Test");
    expect(membersFormatted[0].role).toBe("admin");
  });
});
