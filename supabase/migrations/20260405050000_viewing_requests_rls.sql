-- Re-enable RLS on viewing_requests and replace policies. Inserts from the browser client require a valid session;
-- authenticated INSERT uses WITH CHECK (true); SELECT limited to agent, client, or admin.
-- UPDATE policy kept for agents confirming/declining viewings (dashboard + API routes).

ALTER TABLE public.viewing_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "viewing_requests_insert_authenticated" ON public.viewing_requests;
DROP POLICY IF EXISTS "viewing_requests_select_own" ON public.viewing_requests;
DROP POLICY IF EXISTS "viewing_requests_insert_own" ON public.viewing_requests;
DROP POLICY IF EXISTS "viewing_requests_insert_as_listing_agent" ON public.viewing_requests;
DROP POLICY IF EXISTS "viewing_requests_insert_as_client_for_property" ON public.viewing_requests;
DROP POLICY IF EXISTS "viewing_requests_insert_as_client_for_agent_general" ON public.viewing_requests;
DROP POLICY IF EXISTS "viewing_requests_update_own" ON public.viewing_requests;

CREATE POLICY "viewing_requests_insert_authenticated"
  ON public.viewing_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "viewing_requests_select_own"
  ON public.viewing_requests
  FOR SELECT
  TO authenticated
  USING (
    agent_user_id = auth.uid()
    OR client_user_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY "viewing_requests_update_agent_or_admin"
  ON public.viewing_requests
  FOR UPDATE
  TO authenticated
  USING (
    agent_user_id = auth.uid()
    OR public.is_admin()
  )
  WITH CHECK (
    agent_user_id = auth.uid()
    OR public.is_admin()
  );
