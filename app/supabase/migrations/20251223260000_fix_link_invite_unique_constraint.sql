-- Fix Link Invite Unique Constraint
-- Bug: The unique index on (team_id, email) prevented creating multiple link invites
-- because link invites all have empty email ('')
--
-- Solution: Exclude empty emails (link invites) from the unique constraint

-- Drop the existing problematic index
DROP INDEX IF EXISTS idx_team_invitations_unique_email;

-- Recreate with exclusion for empty emails (link invites)
CREATE UNIQUE INDEX idx_team_invitations_unique_email
  ON team_invitations(team_id, LOWER(email))
  WHERE status != 'revoked' AND email != '';

-- Verification
DO $$
BEGIN
  RAISE NOTICE '=== LINK INVITE UNIQUE CONSTRAINT FIX COMPLETE ===';
  RAISE NOTICE 'Modified unique index to exclude empty emails (link invites)';
  RAISE NOTICE 'Multiple link invites per team are now allowed';
  RAISE NOTICE '=================================================';
END $$;
