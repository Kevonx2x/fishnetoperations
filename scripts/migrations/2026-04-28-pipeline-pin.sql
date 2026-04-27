-- Pipeline pinning support (agents can pin deals to top of stage).
-- Run manually in Supabase SQL editor / psql.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

