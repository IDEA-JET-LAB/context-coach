-- ============================================
-- Fix Feedback Foreign Key Reference
-- Change from auth.users to public.users
-- ============================================

-- Drop existing foreign key constraint
ALTER TABLE feedback
  DROP CONSTRAINT IF EXISTS feedback_user_id_fkey;

-- Add new foreign key referencing public.users
ALTER TABLE feedback
  ADD CONSTRAINT feedback_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Keep the reviewed_by foreign key pointing to auth.users
-- (admin users might not have public.users entries in edge cases)
