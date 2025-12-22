-- Fix prompts.user_id to have proper FK to public.users
-- This enables PostgREST to detect the relationship for embedded resource queries
-- Similar to the team_members fix in 20251222200000

-- Step 1: Convert user_id from TEXT to UUID
-- Note: All user_id values should already be valid UUIDs stored as text
ALTER TABLE prompts
ALTER COLUMN user_id TYPE UUID USING user_id::uuid;

-- Step 2: Add foreign key constraint to public.users
-- This allows PostgREST to join prompts with users table
ALTER TABLE prompts
ADD CONSTRAINT prompts_user_id_users_fkey
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Step 3: Add index for the FK (improves join performance)
CREATE INDEX IF NOT EXISTS idx_prompts_user_id_uuid ON prompts(user_id);

-- Add comment explaining the relationship
COMMENT ON CONSTRAINT prompts_user_id_users_fkey ON prompts IS
  'FK to public.users for PostgREST embedded resource queries (e.g., select user:users(...))';

-- Notify completion
DO $$
BEGIN
  RAISE NOTICE '=== PROMPTS USER_ID FK MIGRATION COMPLETE ===';
  RAISE NOTICE 'Converted user_id from TEXT to UUID';
  RAISE NOTICE 'Added FK constraint prompts_user_id_users_fkey';
  RAISE NOTICE '============================================';
END $$;
