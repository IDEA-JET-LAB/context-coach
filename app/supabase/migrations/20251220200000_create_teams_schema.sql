-- Teams Schema Migration
-- Story 2.1: Team Creation & Schema

-- ============================================
-- ROLE ENUM
-- ============================================
CREATE TYPE team_role AS ENUM ('member', 'admin');

-- ============================================
-- TEAMS TABLE
-- ============================================
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- ============================================
-- TEAM MEMBERS TABLE
-- ============================================
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role team_role DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_teams_created_by ON teams(created_by);

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TEAMS RLS POLICIES
-- ============================================

-- Users can view teams they are members of
CREATE POLICY "Users can view their teams" ON teams
  FOR SELECT USING (
    id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

-- Authenticated users can create teams
CREATE POLICY "Authenticated users can create teams" ON teams
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Team admins can update their teams
CREATE POLICY "Team admins can update teams" ON teams
  FOR UPDATE USING (
    id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Team admins can delete teams
CREATE POLICY "Team admins can delete teams" ON teams
  FOR DELETE USING (
    id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- TEAM MEMBERS RLS POLICIES
-- ============================================

-- Users can view members of teams they belong to
CREATE POLICY "Users can view team members" ON team_members
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

-- Team admins can add members
CREATE POLICY "Team admins can add members" ON team_members
  FOR INSERT WITH CHECK (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'admin')
    OR NOT EXISTS (SELECT 1 FROM team_members WHERE team_id = team_members.team_id)
  );

-- Team admins can update members
CREATE POLICY "Team admins can update members" ON team_members
  FOR UPDATE USING (
    team_id IN (SELECT tm.team_id FROM team_members tm WHERE tm.user_id = auth.uid() AND tm.role = 'admin')
  );

-- Team admins can remove members
CREATE POLICY "Team admins can remove members" ON team_members
  FOR DELETE USING (
    team_id IN (SELECT tm.team_id FROM team_members tm WHERE tm.user_id = auth.uid() AND tm.role = 'admin')
  );

-- ============================================
-- DATABASE FUNCTIONS
-- ============================================

-- Function to set team_id in JWT claims
CREATE OR REPLACE FUNCTION set_team_claim(team_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data =
    raw_app_meta_data || jsonb_build_object('team_id', team_id)
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear team claim
CREATE OR REPLACE FUNCTION clear_team_claim()
RETURNS VOID AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data - 'team_id'
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is last admin in team
CREATE OR REPLACE FUNCTION is_last_admin(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  admin_count INTEGER;
  is_admin BOOLEAN;
BEGIN
  -- Check if user is admin
  SELECT role = 'admin' INTO is_admin
  FROM team_members
  WHERE team_id = p_team_id AND user_id = p_user_id;

  IF NOT is_admin THEN
    RETURN FALSE;
  END IF;

  -- Count admins in team
  SELECT COUNT(*) INTO admin_count
  FROM team_members
  WHERE team_id = p_team_id AND role = 'admin';

  RETURN admin_count = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to create team with admin
CREATE OR REPLACE FUNCTION create_team_with_admin(
  team_name TEXT,
  team_description TEXT DEFAULT NULL
)
RETURNS teams AS $$
DECLARE
  new_team teams;
BEGIN
  -- Validate input
  IF team_name IS NULL OR length(trim(team_name)) = 0 THEN
    RAISE EXCEPTION 'Team name is required';
  END IF;

  IF length(trim(team_name)) > 100 THEN
    RAISE EXCEPTION 'Team name must be 100 characters or less';
  END IF;

  -- Create team
  INSERT INTO teams (name, description, created_by)
  VALUES (trim(team_name), team_description, auth.uid())
  RETURNING * INTO new_team;

  -- Add creator as admin
  INSERT INTO team_members (team_id, user_id, role)
  VALUES (new_team.id, auth.uid(), 'admin');

  -- Set JWT claim
  PERFORM set_team_claim(new_team.id);

  RETURN new_team;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to switch teams
CREATE OR REPLACE FUNCTION switch_team(new_team_id UUID)
RETURNS jsonb AS $$
DECLARE
  is_member BOOLEAN;
  team_info teams;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = new_team_id AND user_id = auth.uid()
  ) INTO is_member;

  IF NOT is_member THEN
    RETURN jsonb_build_object('error', 'NOT_A_MEMBER');
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('team_id', new_team_id)
  WHERE id = auth.uid();

  SELECT * INTO team_info FROM teams WHERE id = new_team_id;
  RETURN jsonb_build_object('success', true, 'team', row_to_json(team_info));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
