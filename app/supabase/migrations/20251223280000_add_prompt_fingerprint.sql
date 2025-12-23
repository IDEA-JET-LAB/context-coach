-- Story 17-4: Deduplication Logic - Add Fingerprint Column
--
-- Adds a fingerprint column to the prompts table for deduplication.
-- The fingerprint is a 16-character hex string generated from:
-- - user_id
-- - timestamp (minute precision, UTC)
-- - first 200 characters of normalized text (lowercase, collapsed whitespace)
--
-- CRITICAL: The fingerprint algorithm MUST match:
-- - TypeScript: lib/import/fingerprint.ts
-- - SQL trigger: generate_prompt_fingerprint() below

-- ============================================
-- ADD FINGERPRINT COLUMN
-- ============================================
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(16);

-- ============================================
-- CREATE FINGERPRINT GENERATION FUNCTION
-- ============================================
-- This function generates the same fingerprint as the TypeScript implementation.
-- Used by triggers on INSERT to automatically set fingerprints.
--
-- Algorithm:
-- 1. Format timestamp as YYYYMMDDHHMM (UTC)
-- 2. Normalize text: lowercase, collapse whitespace, take first 200 chars
-- 3. Create input string: "{user_id}:{timestamp}:{normalized_text}"
-- 4. Hash with MD5 and take first 16 hex characters
CREATE OR REPLACE FUNCTION generate_prompt_fingerprint(
  p_user_id TEXT,
  p_created_at TIMESTAMPTZ,
  p_text TEXT
) RETURNS VARCHAR(16) AS $$
DECLARE
  time_component TEXT;
  text_component TEXT;
  input_string TEXT;
BEGIN
  -- Format timestamp as YYYYMMDDHHMM (minute precision, UTC)
  time_component := to_char(p_created_at AT TIME ZONE 'UTC', 'YYYYMMDDHH24MI');

  -- Normalize text: trim, collapse whitespace, lowercase, first 200 chars
  text_component := lower(left(regexp_replace(trim(p_text), '\s+', ' ', 'g'), 200));

  -- Build input string
  input_string := p_user_id || ':' || time_component || ':' || text_component;

  -- Generate MD5 and take first 16 characters
  RETURN left(md5(input_string), 16);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- CREATE TRIGGER FUNCTION FOR AUTO-FINGERPRINT
-- ============================================
-- Automatically generates fingerprint on INSERT if not provided.
-- This ensures all prompts (both real-time capture and historical import) have fingerprints.
CREATE OR REPLACE FUNCTION set_prompt_fingerprint()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set fingerprint if not already provided
  IF NEW.fingerprint IS NULL THEN
    NEW.fingerprint := generate_prompt_fingerprint(NEW.user_id, NEW.created_at, NEW.text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ATTACH TRIGGER
-- ============================================
-- Drop existing trigger if it exists (idempotent)
DROP TRIGGER IF EXISTS tr_prompts_set_fingerprint ON prompts;

-- Create trigger to auto-generate fingerprint on INSERT
CREATE TRIGGER tr_prompts_set_fingerprint
  BEFORE INSERT ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION set_prompt_fingerprint();

-- ============================================
-- BACKFILL EXISTING PROMPTS
-- ============================================
-- Generate fingerprints for all existing prompts that don't have one.
-- This is safe to run multiple times (idempotent).
UPDATE prompts
SET fingerprint = generate_prompt_fingerprint(user_id, created_at, text)
WHERE fingerprint IS NULL;

-- ============================================
-- CREATE UNIQUE INDEX FOR DEDUPLICATION
-- ============================================
-- This index enables:
-- 1. Fast duplicate detection via ON CONFLICT
-- 2. Efficient lookup when filtering duplicates from batches
--
-- Using a partial index (WHERE fingerprint IS NOT NULL) to:
-- - Exclude any legacy rows that somehow have NULL fingerprint
-- - Slightly reduce index size
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompts_fingerprint
  ON prompts (fingerprint)
  WHERE fingerprint IS NOT NULL;

-- ============================================
-- ADD COMMENT FOR DOCUMENTATION
-- ============================================
COMMENT ON COLUMN prompts.fingerprint IS
  'Deduplication fingerprint: MD5(user_id:YYYYMMDDHHMM:normalized_text[0:200])[0:16]. Used to detect duplicate imports.';
