-- Seed test sessions for Phase 3 UI testing
-- Uses test user IDs from CLAUDE.md

-- Only insert if no sessions exist for test user
DO $$
DECLARE
  test_user_id UUID := '11111111-1111-1111-1111-111111111111';
  test_team_id UUID := '22222222-2222-2222-2222-222222222222';
  test_project_id UUID := '44444444-4444-4444-4444-444444444444';
  session_count INTEGER;
BEGIN
  -- Check if test user exists
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = test_user_id) THEN
    RAISE NOTICE 'Test user does not exist, skipping session seed';
    RETURN;
  END IF;

  -- Check if sessions already exist
  SELECT COUNT(*) INTO session_count FROM sessions WHERE user_id = test_user_id;
  IF session_count > 0 THEN
    RAISE NOTICE 'Sessions already exist for test user, skipping seed';
    RETURN;
  END IF;

  -- Insert test sessions
  INSERT INTO sessions (
    session_id, user_id, team_id, project_id,
    started_at, ended_at, end_reason,
    git_branch, claude_code_version, slug, cwd,
    total_prompts, total_tokens,
    primary_stage, has_debugging_loop, conversation_score, user_message_count
  ) VALUES
    -- Session 1: Recent implementation session
    (
      'test-session-001',
      test_user_id, test_team_id, test_project_id,
      NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', 'completed',
      'feature/auth-flow', '1.0.23', 'Implement OAuth login', '/Users/test/project',
      15, 45000,
      'implementation', false, 78, 15
    ),
    -- Session 2: Debugging session with loop
    (
      'test-session-002',
      test_user_id, test_team_id, test_project_id,
      NOW() - INTERVAL '5 hours', NOW() - INTERVAL '3 hours', 'completed',
      'fix/database-issue', '1.0.23', 'Fix database connection timeout', '/Users/test/project',
      28, 82000,
      'debugging', true, 62, 28
    ),
    -- Session 3: Planning session
    (
      'test-session-003',
      test_user_id, test_team_id, test_project_id,
      NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '45 minutes', 'completed',
      'main', '1.0.22', 'Plan API refactoring', '/Users/test/project',
      8, 25000,
      'planning', false, 85, 8
    ),
    -- Session 4: Active session (no end time)
    (
      'test-session-004',
      test_user_id, test_team_id, test_project_id,
      NOW() - INTERVAL '30 minutes', NULL, NULL,
      'feature/new-ui', '1.0.23', 'Build conversation UI', '/Users/test/project',
      5, 15000,
      'implementation', false, NULL, 5
    ),
    -- Session 5: Old documentation session
    (
      'test-session-005',
      test_user_id, test_team_id, test_project_id,
      NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '2 hours', 'completed',
      'docs/api-reference', '1.0.21', 'Write API documentation', '/Users/test/project',
      12, 35000,
      'documentation', false, 91, 12
    );

  RAISE NOTICE 'Inserted 5 test sessions for user %', test_user_id;

  -- Insert test prompts for the sessions
  INSERT INTO prompts (
    id, session_uuid, user_id, team_id, project_id,
    content, prompt_type, sequence_number,
    created_at, detected_stage, is_in_debugging_loop
  )
  SELECT
    gen_random_uuid(),
    s.id,
    test_user_id,
    test_team_id,
    test_project_id,
    CASE (random() * 4)::int
      WHEN 0 THEN 'Help me implement the login form with email and password validation'
      WHEN 1 THEN 'Why is this function returning undefined? Here is the code...'
      WHEN 2 THEN 'Can you refactor this to use async/await instead of callbacks?'
      WHEN 3 THEN 'Write unit tests for the authentication service'
      ELSE 'Explain how the middleware works in this codebase'
    END,
    CASE (random() * 3)::int
      WHEN 0 THEN 'question'
      WHEN 1 THEN 'instruction'
      WHEN 2 THEN 'debugging'
      ELSE 'context'
    END,
    seq,
    s.started_at + (seq * INTERVAL '5 minutes'),
    s.primary_stage,
    s.has_debugging_loop AND seq > 5
  FROM sessions s
  CROSS JOIN generate_series(1, LEAST(s.user_message_count, 10)) AS seq
  WHERE s.user_id = test_user_id;

  RAISE NOTICE 'Inserted test prompts for test sessions';
END $$;
