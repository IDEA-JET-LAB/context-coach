-- Projects Schema Migration
-- Story 2.6: Project Creation

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  api_key_hash VARCHAR(64) NOT NULL UNIQUE,
  api_key_prefix VARCHAR(16) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  is_archived BOOLEAN DEFAULT false
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_projects_team_id ON projects(team_id);
CREATE INDEX idx_projects_api_key_hash ON projects(api_key_hash);
CREATE INDEX idx_projects_created_by ON projects(created_by);

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROJECTS RLS POLICIES
-- ============================================

-- Team members can view projects (also allow service_role)
CREATE POLICY "Team members can view projects" ON projects
FOR SELECT USING (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  OR auth.role() = 'service_role'
);

-- Team admins can create projects
CREATE POLICY "Team admins can create projects" ON projects
FOR INSERT WITH CHECK (
  team_id IN (
    SELECT team_id FROM team_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Team admins can update projects
CREATE POLICY "Team admins can update projects" ON projects
FOR UPDATE USING (
  team_id IN (
    SELECT team_id FROM team_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Team admins can delete projects
CREATE POLICY "Team admins can delete projects" ON projects
FOR DELETE USING (
  team_id IN (
    SELECT team_id FROM team_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
