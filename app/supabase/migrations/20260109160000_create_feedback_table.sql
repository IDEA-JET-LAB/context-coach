-- ============================================
-- Feedback Table for VS Code Extension
-- Story: User feedback collection and admin review
-- ============================================

-- Create feedback category enum
CREATE TYPE feedback_category AS ENUM (
  'suggestion',
  'question',
  'bug',
  'feature-request',
  'other'
);

-- Create feedback status enum
CREATE TYPE feedback_status AS ENUM (
  'new',
  'reviewed',
  'in-progress',
  'resolved',
  'archived'
);

-- ============================================
-- TABLE CREATION
-- ============================================
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category feedback_category NOT NULL,
  message TEXT NOT NULL,
  extension_version VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT now(),
  status feedback_status DEFAULT 'new',
  admin_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_category ON feedback(category);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Users can submit their own feedback
CREATE POLICY "Users can insert own feedback" ON feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback" ON feedback
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can do everything (for admin API)
CREATE POLICY "Service role full access" ON feedback
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE feedback IS 'User feedback submitted from VS Code extension';
COMMENT ON COLUMN feedback.category IS 'Type of feedback: suggestion, question, bug, feature-request, other';
COMMENT ON COLUMN feedback.status IS 'Admin review status: new, reviewed, in-progress, resolved, archived';
COMMENT ON COLUMN feedback.extension_version IS 'Version of VS Code extension when feedback was submitted';
