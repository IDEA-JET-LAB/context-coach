-- Team Invitations Schema Migration
-- Story 2.2: Team Member Invitation

-- ============================================
-- TEAM INVITATIONS TABLE
-- ============================================
CREATE TABLE team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  invited_by UUID REFERENCES auth.users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  token VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'revoked'))
);

-- ============================================
-- EMAIL NORMALIZATION TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION normalize_invitation_email()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email := LOWER(TRIM(NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invitation_email_normalize
  BEFORE INSERT OR UPDATE ON team_invitations
  FOR EACH ROW EXECUTE FUNCTION normalize_invitation_email();

-- ============================================
-- INDEXES
-- ============================================
-- Unique constraint: prevent duplicate pending invitations to same email per team
CREATE UNIQUE INDEX idx_team_invitations_unique_email
  ON team_invitations(team_id, LOWER(email))
  WHERE status != 'revoked';

CREATE INDEX idx_team_invitations_token ON team_invitations(token);
CREATE INDEX idx_team_invitations_team_id ON team_invitations(team_id);
CREATE INDEX idx_team_invitations_email ON team_invitations(LOWER(email));
CREATE INDEX idx_team_invitations_status ON team_invitations(status) WHERE status = 'pending';

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Team admins can view invitations for their team
CREATE POLICY "Team admins can view invitations" ON team_invitations
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Team admins can create invitations
CREATE POLICY "Team admins can create invitations" ON team_invitations
  FOR INSERT WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Team admins can update (revoke) invitations
CREATE POLICY "Team admins can revoke invitations" ON team_invitations
  FOR UPDATE USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- INVITE TEAM MEMBER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION invite_team_member(
  p_team_id UUID,
  p_email VARCHAR,
  p_inviter_id UUID
)
RETURNS team_invitations AS $$
DECLARE
  v_invitation team_invitations;
  v_normalized_email VARCHAR;
BEGIN
  v_normalized_email := LOWER(TRIM(p_email));

  -- Validate inviter is admin
  IF NOT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id AND user_id = p_inviter_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: Only team admins can invite members';
  END IF;

  -- Check if email already invited (not revoked)
  IF EXISTS (
    SELECT 1 FROM team_invitations
    WHERE team_id = p_team_id AND LOWER(email) = v_normalized_email AND status != 'revoked'
  ) THEN
    RAISE EXCEPTION 'EMAIL_ALREADY_INVITED: This email has a pending invitation';
  END IF;

  -- Check if user already a team member
  IF EXISTS (
    SELECT 1 FROM team_members tm
    JOIN auth.users u ON tm.user_id = u.id
    WHERE tm.team_id = p_team_id AND LOWER(u.email) = v_normalized_email
  ) THEN
    RAISE EXCEPTION 'EMAIL_ALREADY_MEMBER: This user is already a team member';
  END IF;

  -- Create invitation with secure token
  INSERT INTO team_invitations (team_id, email, invited_by, token, expires_at)
  VALUES (
    p_team_id,
    v_normalized_email,
    p_inviter_id,
    encode(gen_random_bytes(32), 'hex'),
    now() + interval '7 days'
  )
  RETURNING * INTO v_invitation;

  RETURN v_invitation;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- REVOKE INVITATION FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION revoke_team_invitation(p_invitation_id UUID)
RETURNS team_invitations AS $$
DECLARE
  v_invitation team_invitations;
  v_team_id UUID;
BEGIN
  -- Get the invitation's team_id
  SELECT team_id INTO v_team_id FROM team_invitations WHERE id = p_invitation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_INVITATION: Invitation not found';
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
-- ACCEPT INVITATION FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION accept_team_invitation(p_token VARCHAR, p_user_id UUID)
RETURNS teams AS $$
DECLARE
  v_invitation team_invitations;
  v_user_email VARCHAR;
  v_team teams;
BEGIN
  -- Find valid invitation
  SELECT * INTO v_invitation FROM team_invitations
  WHERE token = p_token AND status = 'pending' AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_TOKEN: Invalid or expired invitation';
  END IF;

  -- Get user's email
  SELECT LOWER(email) INTO v_user_email FROM auth.users WHERE id = p_user_id;

  -- Verify email matches invitation
  IF v_user_email != LOWER(v_invitation.email) THEN
    RAISE EXCEPTION 'EMAIL_MISMATCH: Invitation email does not match your account';
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

  -- Update invitation status
  UPDATE team_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_invitation.id;

  -- Get and return team info
  SELECT * INTO v_team FROM teams WHERE id = v_invitation.team_id;

  RETURN v_team;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- GET INVITATION BY TOKEN FUNCTION (for public lookup)
-- ============================================
CREATE OR REPLACE FUNCTION get_invitation_by_token(p_token VARCHAR)
RETURNS TABLE (
  id UUID,
  team_id UUID,
  email VARCHAR,
  status VARCHAR,
  expires_at TIMESTAMPTZ,
  team_name VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ti.id,
    ti.team_id,
    ti.email,
    ti.status,
    ti.expires_at,
    t.name::VARCHAR as team_name
  FROM team_invitations ti
  JOIN teams t ON t.id = ti.team_id
  WHERE ti.token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
