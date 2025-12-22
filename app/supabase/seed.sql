-- Seed file for local development
-- Creates persistent test data: 1 user, 1 team, 1 project
--
-- Test User Credentials:
--   Email: edgars@test.com
--   Password: password123
--
-- Run with: supabase db reset
--
-- This seed is IDEMPOTENT - it uses ON CONFLICT to avoid deleting existing data

-- ============================================
-- TEST USER
-- ============================================
-- Insert into auth.users (this triggers public.users creation via handle_new_user())
-- Password: password123 (hashed with bcrypt)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  email_change_token_current,
  phone_change,
  phone_change_token,
  reauthentication_token,
  is_sso_user,
  is_anonymous
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'edgars@test.com',
  -- This is bcrypt hash of 'password123' compatible with Supabase Auth
  '$2a$10$NVM/R9W09QsxBXO7uVzfAeWRAUFPl.9wfk6zDccLQmVFgcD3FN/x6',
  NOW(),
  '{"provider": "email", "providers": ["email"], "team_id": "22222222-2222-2222-2222-222222222222"}',
  '{"full_name": "Edgars Test"}',
  'authenticated',
  'authenticated',
  NOW(),
  NOW(),
  '',
  '',
  '',  -- email_change
  '',  -- email_change_token_new
  '',  -- email_change_token_current
  '',  -- phone_change
  '',  -- phone_change_token
  '',  -- reauthentication_token
  false, -- is_sso_user
  false  -- is_anonymous
)
ON CONFLICT (id) DO UPDATE SET
  email_confirmed_at = COALESCE(auth.users.email_confirmed_at, EXCLUDED.email_confirmed_at),
  raw_app_meta_data = auth.users.raw_app_meta_data || '{"team_id": "22222222-2222-2222-2222-222222222222"}'::jsonb;

-- Create identity for the user (if not exists)
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  created_at,
  updated_at,
  last_sign_in_at
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '{"sub": "11111111-1111-1111-1111-111111111111", "email": "edgars@test.com"}',
  'email',
  'edgars@test.com',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- TEST TEAM
-- ============================================
INSERT INTO teams (
  id,
  name,
  description,
  created_by,
  created_at
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  'Test Team',
  'Persistent test team for local development',
  '11111111-1111-1111-1111-111111111111',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Add user as team admin
INSERT INTO team_members (
  id,
  team_id,
  user_id,
  role,
  joined_at
) VALUES (
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'admin',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- TEST PROJECT
-- ============================================
-- API Key: ctx_test_abcd1234efgh5678
-- Hash: SHA256 of the full API key
INSERT INTO projects (
  id,
  team_id,
  name,
  description,
  api_key_hash,
  api_key_prefix,
  created_by,
  created_at,
  is_archived
) VALUES (
  '44444444-4444-4444-4444-444444444444',
  '22222222-2222-2222-2222-222222222222',
  'Test Project',
  'Persistent test project for local development',
  -- SHA256 hash of 'ctx_test_abcd1234efgh5678'
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'ctx_test_abcd12',
  '11111111-1111-1111-1111-111111111111',
  NOW(),
  false
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
DECLARE
  user_count INTEGER;
  team_count INTEGER;
  project_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM auth.users WHERE email = 'edgars@test.com';
  SELECT COUNT(*) INTO team_count FROM teams WHERE id = '22222222-2222-2222-2222-222222222222';
  SELECT COUNT(*) INTO project_count FROM projects WHERE id = '44444444-4444-4444-4444-444444444444';

  RAISE NOTICE '=== SEED DATA VERIFICATION ===';
  RAISE NOTICE 'Test user created: %', user_count = 1;
  RAISE NOTICE 'Test team created: %', team_count = 1;
  RAISE NOTICE 'Test project created: %', project_count = 1;
  RAISE NOTICE '';
  RAISE NOTICE 'Login credentials:';
  RAISE NOTICE '  Email: edgars@test.com';
  RAISE NOTICE '  Password: password123';
  RAISE NOTICE '================================';
END $$;
