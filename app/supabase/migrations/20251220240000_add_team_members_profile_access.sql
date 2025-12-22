-- Allow team members to view profiles of other team members
-- This is needed for displaying member names in the team members list

-- Create helper function to get all user IDs in user's teams
CREATE OR REPLACE FUNCTION get_team_member_user_ids()
RETURNS SETOF UUID AS $$
  SELECT DISTINCT tm2.user_id
  FROM team_members tm1
  JOIN team_members tm2 ON tm1.team_id = tm2.team_id
  WHERE tm1.user_id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Add policy allowing team members to view each other's profiles
CREATE POLICY "Team members can view each other's profiles"
  ON public.users FOR SELECT
  USING (
    id IN (SELECT get_team_member_user_ids())
  );
