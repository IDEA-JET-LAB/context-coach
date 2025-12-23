-- Add foreign key from team_members.user_id to public.users.id
-- This enables PostgREST to detect the relationship for embedded resource queries
-- The relationship is needed for queries like: select user:users(id, name, avatar_url)

-- Note: team_members.user_id already references auth.users(id)
-- We add a second FK to public.users(id) since public.users.id also references auth.users(id)
-- This allows PostgREST to resolve the join between team_members and public.users

-- First, ensure any existing team_members have corresponding public.users records
-- This handles edge cases where team_members were created but profile wasn't
INSERT INTO public.users (id, name, avatar_url, email)
SELECT DISTINCT
  tm.user_id,
  COALESCE(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'full_name'),
  au.raw_user_meta_data->>'avatar_url',
  au.email
FROM team_members tm
JOIN auth.users au ON tm.user_id = au.id
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = tm.user_id)
ON CONFLICT (id) DO NOTHING;

-- Add the foreign key constraint
ALTER TABLE team_members
ADD CONSTRAINT team_members_user_id_public_users_fkey
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Add a comment explaining the dual FK setup
COMMENT ON CONSTRAINT team_members_user_id_public_users_fkey ON team_members IS
  'FK to public.users for PostgREST embedded resource queries. team_members.user_id also references auth.users(id) for cascade deletes.';
