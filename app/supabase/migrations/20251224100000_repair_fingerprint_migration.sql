-- Repair migration for fingerprint column
-- The original migration (20251223280000) partially applied - column was added
-- but functions failed due to UUID->TEXT cast issue. This repairs that.

-- ============================================
-- CREATE FINGERPRINT GENERATION FUNCTION
-- ============================================
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
  time_component := to_char(p_created_at AT TIME ZONE 'UTC', 'YYYYMMDDHH24MI');
  text_component := lower(left(regexp_replace(trim(p_text), '\s+', ' ', 'g'), 200));
  input_string := p_user_id || ':' || time_component || ':' || text_component;
  RETURN left(md5(input_string), 16);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- CREATE TRIGGER FUNCTION FOR AUTO-FINGERPRINT
-- ============================================
CREATE OR REPLACE FUNCTION set_prompt_fingerprint()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.fingerprint IS NULL THEN
    NEW.fingerprint := generate_prompt_fingerprint(NEW.user_id::TEXT, NEW.created_at, NEW.text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ATTACH TRIGGER
-- ============================================
DROP TRIGGER IF EXISTS tr_prompts_set_fingerprint ON prompts;
CREATE TRIGGER tr_prompts_set_fingerprint
  BEFORE INSERT ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION set_prompt_fingerprint();

-- ============================================
-- BACKFILL EXISTING PROMPTS
-- ============================================
UPDATE prompts
SET fingerprint = generate_prompt_fingerprint(user_id::TEXT, created_at, text)
WHERE fingerprint IS NULL;

-- ============================================
-- CREATE UNIQUE INDEX FOR DEDUPLICATION
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompts_fingerprint
  ON prompts (fingerprint)
  WHERE fingerprint IS NOT NULL;

-- ============================================
-- ADD COMMENT
-- ============================================
COMMENT ON COLUMN prompts.fingerprint IS
  'Deduplication fingerprint: MD5(user_id:YYYYMMDDHHMM:normalized_text[0:200])[0:16]. Used to detect duplicate imports.';
