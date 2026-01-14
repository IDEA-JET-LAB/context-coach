-- Backfill Stage Analysis Status Migration
-- Story 31-2: Stage Persistence & Backfill
--
-- Updates existing sessions to have 'pending' status so they can be analyzed.

-- Update existing sessions that have NULL status to 'pending'
UPDATE sessions
SET stage_analysis_status = 'pending'
WHERE stage_analysis_status IS NULL;

DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '=== STAGE STATUS BACKFILL COMPLETE ===';
  RAISE NOTICE 'Updated % sessions to pending status', updated_count;
  RAISE NOTICE '=====================================';
END $$;
