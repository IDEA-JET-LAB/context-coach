-- Migration: Add Link Invites Support
-- Story 11.3: Improve Team Invitations Discoverability
--
-- Adds support for URL-based team invitations alongside email invitations

-- ============================================
-- ADD COLUMNS TO TEAM_INVITATIONS
-- ============================================
ALTER TABLE team_invitations
ADD COLUMN IF NOT EXISTS invite_type VARCHAR(10) DEFAULT 'email'
  CHECK (invite_type IN ('email', 'link')),
ADD COLUMN IF NOT EXISTS invite_token UUID UNIQUE,
ADD COLUMN IF NOT EXISTS max_uses INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS current_uses INTEGER DEFAULT 0;

-- ============================================
-- ADD INDEX FOR INVITE TOKEN LOOKUPS
-- ============================================
CREATE INDEX IF NOT EXISTS idx_team_invitations_invite_token
  ON team_invitations(invite_token)
  WHERE invite_token IS NOT NULL;

-- ============================================
-- CREATE LINK INVITE FUNCTION
-- ============================================
-- Creates a shareable link invite that can be used multiple times
CREATE OR REPLACE FUNCTION create_link_invite(
  p_team_id UUID,
  p_inviter_id UUID,
  p_max_uses INTEGER DEFAULT 10,
  p_expires_days INTEGER DEFAULT 7
)
RETURNS team_invitations AS $$
DECLARE
  v_invitation team_invitations;
BEGIN
  -- Validate inviter is admin
  IF NOT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id AND user_id = p_inviter_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: Only team admins can create invite links';
  END IF;

  -- Create link invitation
  INSERT INTO team_invitations (
    team_id,
    email,
    invited_by,
    token,
    invite_type,
    invite_token,
    max_uses,
    current_uses,
    expires_at
  )
  VALUES (
    p_team_id,
    '', -- No email for link invites
    p_inviter_id,
    encode(gen_random_bytes(32), 'hex'), -- Legacy token field
    'link',
    gen_random_uuid(), -- New invite_token for URL
    p_max_uses,
    0,
    now() + (p_expires_days || ' days')::interval
  )
  RETURNING * INTO v_invitation;

  RETURN v_invitation;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- GET LINK INVITE BY TOKEN FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION get_link_invite_by_token(p_invite_token UUID)
RETURNS TABLE (
  id UUID,
  team_id UUID,
  invite_type VARCHAR,
  status VARCHAR,
  expires_at TIMESTAMPTZ,
  max_uses INTEGER,
  current_uses INTEGER,
  team_name VARCHAR,
  invited_by_name VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ti.id,
    ti.team_id,
    ti.invite_type,
    ti.status,
    ti.expires_at,
    ti.max_uses,
    ti.current_uses,
    t.name::VARCHAR as team_name,
    COALESCE(u.name, 'Team Admin')::VARCHAR as invited_by_name
  FROM team_invitations ti
  JOIN teams t ON t.id = ti.team_id
  LEFT JOIN users u ON u.id = ti.invited_by
  WHERE ti.invite_token = p_invite_token
    AND ti.invite_type = 'link';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ACCEPT LINK INVITE FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION accept_link_invite(p_invite_token UUID, p_user_id UUID)
RETURNS teams AS $$
DECLARE
  v_invitation team_invitations;
  v_team teams;
BEGIN
  -- Find valid link invitation
  SELECT * INTO v_invitation FROM team_invitations
  WHERE invite_token = p_invite_token
    AND invite_type = 'link'
    AND status = 'pending'
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_TOKEN: Invalid or expired invitation link';
  END IF;

  -- Check max uses
  IF v_invitation.max_uses IS NOT NULL AND v_invitation.current_uses >= v_invitation.max_uses THEN
    RAISE EXCEPTION 'MAX_USES_REACHED: This invitation link has reached its maximum uses';
  END IF;

  -- Check if user is already a team member
  IF EXISTS (
    SELECT 1 FROM team_members WHERE team_id = v_invitation.team_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'ALREADY_MEMBER: You are already a member of this team';
  END IF;

  -- Add user to team as member
  INSERT INTO team_members (team_id, user_id, role)
  VALUES (v_invitation.team_id, p_user_id, 'member');

  -- Increment current_uses
  UPDATE team_invitations
  SET current_uses = current_uses + 1
  WHERE id = v_invitation.id;

  -- Get and return team info
  SELECT * INTO v_team FROM teams WHERE id = v_invitation.team_id;

  RETURN v_team;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- UPDATE RLS POLICY FOR LINK INVITES
-- ============================================
-- Link invites have empty email so we need to ensure they're still accessible

-- Drop and recreate the select policy to include link invites
DROP POLICY IF EXISTS "Team admins can view invitations" ON team_invitations;

CREATE POLICY "Team admins can view invitations" ON team_invitations
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- REVOKE LINK INVITE FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION revoke_link_invite(p_invitation_id UUID)
RETURNS team_invitations AS $$
DECLARE
  v_invitation team_invitations;
  v_team_id UUID;
BEGIN
  -- Get the invitation's team_id
  SELECT team_id INTO v_team_id FROM team_invitations
  WHERE id = p_invitation_id AND invite_type = 'link';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_INVITATION: Link invitation not found';
  END IF;

  -- Validate user is team admin
  IF NOT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = v_team_id AND user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: Only team admins can revoke invitations';
  END IF;

  -- Update status to revoked
  UPDATE team_invitations
  SET status = 'revoked'
  WHERE id = p_invitation_id AND status = 'pending'
  RETURNING * INTO v_invitation;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_INVITATION: Invitation not found or already processed';
  END IF;

  RETURN v_invitation;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '=== LINK INVITES MIGRATION COMPLETE ===';
  RAISE NOTICE 'Added columns: invite_type, invite_token, max_uses, current_uses';
  RAISE NOTICE 'Created functions: create_link_invite, get_link_invite_by_token, accept_link_invite, revoke_link_invite';
  RAISE NOTICE '=========================================';
END $$;
