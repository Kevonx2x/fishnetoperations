-- Co-agent join requests (agent asks to be linked to an existing listing)
CREATE TABLE IF NOT EXISTS public.co_agent_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS co_agent_requests_one_pending_per_property_agent
  ON public.co_agent_requests (property_id, agent_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS co_agent_requests_status_created_idx
  ON public.co_agent_requests (status, created_at DESC);

ALTER TABLE public.co_agent_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agents_can_insert_own" ON public.co_agent_requests;
CREATE POLICY "agents_can_insert_own"
  ON public.co_agent_requests FOR INSERT TO authenticated
  WITH CHECK (
    agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "agents_can_read_own" ON public.co_agent_requests;
CREATE POLICY "agents_can_read_own"
  ON public.co_agent_requests FOR SELECT TO authenticated
  USING (
    agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
  );
