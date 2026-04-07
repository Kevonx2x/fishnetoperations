-- Allow an agent to remove their own row from property_agents (e.g. "Leave listing" for co-listed)

DROP POLICY IF EXISTS "property_agents_delete_own_agent" ON public.property_agents;

CREATE POLICY "property_agents_delete_own_agent"
  ON public.property_agents FOR DELETE TO authenticated
  USING (
    agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
  );
