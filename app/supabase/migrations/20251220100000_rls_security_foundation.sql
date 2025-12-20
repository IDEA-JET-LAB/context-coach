-- RLS Security Foundation Migration
-- Creates helper functions and enhanced RLS policies

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Helper function to get current user's team_id from JWT
CREATE OR REPLACE FUNCTION public.current_team_id()
RETURNS UUID AS $$
BEGIN
  RETURN (auth.jwt() ->> 'team_id')::uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check if current user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND is_super_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- ENHANCED USERS TABLE RLS POLICIES
-- ============================================

-- Drop existing policies (from Story 1.1) to recreate with enhancements
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Super admins can view all profiles
CREATE POLICY "Super admins can view all profiles"
  ON public.users FOR SELECT
  USING (public.is_super_admin());

-- Users can update their own profile (except is_super_admin)
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      -- Cannot change is_super_admin unless already super admin
      is_super_admin IS NOT DISTINCT FROM (
        SELECT u.is_super_admin FROM public.users u WHERE u.id = auth.uid()
      )
      OR public.is_super_admin()
    )
  );

-- Super admins can update any profile
CREATE POLICY "Super admins can update all profiles"
  ON public.users FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================
-- AVATARS STORAGE BUCKET
-- ============================================

-- Create avatars bucket (public read, authenticated write)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Users can upload their own avatar
CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT
TO authenticated WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own avatar
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE
TO authenticated USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own avatar
CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE
TO authenticated USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Public read access to avatars
CREATE POLICY "Public avatar access" ON storage.objects FOR SELECT
TO public USING (bucket_id = 'avatars');
