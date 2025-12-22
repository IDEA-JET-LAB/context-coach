-- Fix circular RLS reference in team_members table
-- The original policy used a subquery on team_members to authorize SELECT on team_members
-- which creates a circular dependency

-- Create helper function that bypasses RLS to get user's team IDs
CREATE OR REPLACE FUNCTION get_user_team_ids()
RETURNS SETOF UUID AS $$
  SELECT team_id FROM team_members WHERE user_id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Drop the old policy
DROP POLICY IF EXISTS "Users can view team members" ON team_members;

-- Create new policy using the helper function
CREATE POLICY "Users can view team members" ON team_members
  FOR SELECT USING (
    team_id IN (SELECT get_user_team_ids())
  );

-- Also fix the teams view policy which has the same issue
DROP POLICY IF EXISTS "Users can view their teams" ON teams;

CREATE POLICY "Users can view their teams" ON teams
  FOR SELECT USING (
    id IN (SELECT get_user_team_ids())
  );
