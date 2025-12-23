-- Sentiment Analysis Migration
-- Story 21-3: Sentiment Analysis
-- Adds sentiment tracking to prompts and session-level frustration tracking

-- ============================================
-- PROMPTS TABLE: SENTIMENT COLUMNS
-- ============================================

-- Sentiment classification (polite, frustrated, neutral, directive, collaborative)
ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20);

-- Confidence score for the sentiment classification (0.00 - 1.00)
ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS sentiment_confidence DECIMAL(3,2);

-- Individual sentiment scores as JSONB
-- Format: {"polite": 0.35, "frustrated": 0.1, "directive": 0.2, "collaborative": 0.15}
ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS sentiment_scores JSONB;

-- Constraint for valid sentiment values
ALTER TABLE prompts
ADD CONSTRAINT valid_sentiment CHECK (
  sentiment IS NULL OR sentiment IN ('polite', 'frustrated', 'neutral', 'directive', 'collaborative')
);

-- Index for filtering by sentiment
CREATE INDEX IF NOT EXISTS idx_prompts_sentiment ON prompts(sentiment);

-- ============================================
-- SESSIONS TABLE: FRUSTRATION TRACKING COLUMNS
-- ============================================

-- Frustration trend within session (increasing, decreasing, stable)
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS frustration_trend VARCHAR(20);

-- Flag for sessions with rising frustration (3+ consecutive frustrated prompts or >0.3 increase)
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS frustration_rising BOOLEAN DEFAULT false;

-- Politeness ratio: polite_count / (polite_count + frustrated_count)
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS politeness_ratio DECIMAL(3,2);

-- Constraint for valid frustration trend values
ALTER TABLE sessions
ADD CONSTRAINT valid_frustration_trend CHECK (
  frustration_trend IS NULL OR frustration_trend IN ('increasing', 'decreasing', 'stable')
);

-- Partial index for sessions with rising frustration (for alerts/review)
CREATE INDEX IF NOT EXISTS idx_sessions_frustration_rising ON sessions(frustration_rising)
  WHERE frustration_rising = true;

-- ============================================
-- COLUMN COMMENTS
-- ============================================

COMMENT ON COLUMN prompts.sentiment IS
  'Sentiment classification of the prompt: polite, frustrated, neutral, directive, or collaborative';

COMMENT ON COLUMN prompts.sentiment_confidence IS
  'Confidence score (0.00-1.00) for the sentiment classification';

COMMENT ON COLUMN prompts.sentiment_scores IS
  'Individual sentiment scores as JSONB: {polite, frustrated, directive, collaborative}';

COMMENT ON COLUMN sessions.frustration_trend IS
  'Frustration trend within session: increasing, decreasing, or stable';

COMMENT ON COLUMN sessions.frustration_rising IS
  'Flag for sessions with rising frustration (3+ consecutive frustrated or >0.3 increase)';

COMMENT ON COLUMN sessions.politeness_ratio IS
  'Ratio of polite prompts to polite + frustrated prompts (0.00-1.00)';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== SENTIMENT COLUMNS MIGRATION COMPLETE ===';
  RAISE NOTICE 'Added sentiment, sentiment_confidence, sentiment_scores to prompts';
  RAISE NOTICE 'Added frustration_trend, frustration_rising, politeness_ratio to sessions';
  RAISE NOTICE 'Created indexes for efficient queries';
  RAISE NOTICE '============================================';
END $$;
