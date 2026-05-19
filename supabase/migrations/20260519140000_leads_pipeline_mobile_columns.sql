-- Mobile pipeline: follow-up scheduling + stage change tracking for badges
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.leads.follow_up_at IS 'Agent-set follow-up reminder (mobile pipeline Follow up badge).';
COMMENT ON COLUMN public.leads.stage_changed_at IS 'Last pipeline stage change; used for Hot badge when unchanged since inquiry.';

-- Backfill stage_changed_at from updated_at for existing rows (best-effort)
UPDATE public.leads
SET stage_changed_at = COALESCE(updated_at, created_at)
WHERE stage_changed_at IS NULL;
