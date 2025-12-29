-- Fix seed test prompts (previous seed used wrong column names)
-- This migration properly inserts test prompts for conversation UI testing

DO $$
DECLARE
  test_user_id UUID := '11111111-1111-1111-1111-111111111111';
  test_team_id UUID := '22222222-2222-2222-2222-222222222222';
  test_project_id UUID := '44444444-4444-4444-4444-444444444444';
  session_record RECORD;
  prompt_texts TEXT[] := ARRAY[
    'Help me implement the login form with email and password validation',
    'Why is this function returning undefined? Here is the code snippet: const getData = async () => { fetch(url); }',
    'Can you refactor this to use async/await instead of callbacks?',
    'Write unit tests for the authentication service',
    'Explain how the middleware works in this codebase'
  ];
  i INTEGER;
BEGIN
  -- Delete any existing test prompts for these sessions (in case of re-run)
  -- sessions.user_id is UUID, prompts.user_id is TEXT
  DELETE FROM prompts
  WHERE session_uuid IN (
    SELECT id FROM sessions WHERE user_id = test_user_id
  );

  -- Insert prompts for each test session
  FOR session_record IN
    SELECT id, started_at, user_message_count, primary_stage, has_debugging_loop
    FROM sessions
    WHERE user_id = test_user_id
    ORDER BY started_at DESC
  LOOP
    FOR i IN 1..LEAST(session_record.user_message_count, 5) LOOP
      INSERT INTO prompts (
        id, session_uuid, user_id, team_id, project_id,
        text, char_count, word_count,
        sequence_number, created_at,
        detected_stage, is_in_debugging_loop,
        analysis_status
      ) VALUES (
        gen_random_uuid(),
        session_record.id,
        test_user_id::TEXT,  -- prompts.user_id is TEXT type
        test_team_id,
        test_project_id,
        prompt_texts[1 + ((i - 1) % 5)],
        LENGTH(prompt_texts[1 + ((i - 1) % 5)]),
        array_length(string_to_array(prompt_texts[1 + ((i - 1) % 5)], ' '), 1),
        i,
        session_record.started_at + (i * INTERVAL '5 minutes'),
        session_record.primary_stage,
        session_record.has_debugging_loop AND i > 3,
        'complete'
      );
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Inserted test prompts for test sessions';
END $$;

-- Insert test analyses for the prompts
DO $$
DECLARE
  test_user_id UUID := '11111111-1111-1111-1111-111111111111';
  prompt_record RECORD;
  base_score NUMERIC;
BEGIN
  FOR prompt_record IN
    SELECT p.id, p.session_uuid, p.is_in_debugging_loop
    FROM prompts p
    INNER JOIN sessions s ON s.id = p.session_uuid
    WHERE s.user_id = test_user_id
      AND NOT EXISTS (SELECT 1 FROM prompt_analyses pa WHERE pa.prompt_id = p.id)
  LOOP
    -- Generate a score between 6 and 9
    base_score := 6.0 + (random() * 3.0);

    -- Lower score for debugging loop prompts
    IF prompt_record.is_in_debugging_loop THEN
      base_score := base_score - 1.5;
    END IF;

    INSERT INTO prompt_analyses (
      prompt_id,
      overall_score,
      dimension_scores,
      suggestions,
      created_at
    ) VALUES (
      prompt_record.id,
      ROUND(base_score::NUMERIC, 1),
      jsonb_build_object(
        'clarity', ROUND((base_score + (random() - 0.5))::NUMERIC, 1),
        'specificity', ROUND((base_score + (random() - 0.5))::NUMERIC, 1),
        'context', ROUND((base_score + (random() - 0.5))::NUMERIC, 1),
        'actionability', ROUND((base_score + (random() - 0.5))::NUMERIC, 1)
      ),
      '[]'::jsonb,
      NOW()
    );
  END LOOP;

  RAISE NOTICE 'Inserted test analyses for prompts';
END $$;
