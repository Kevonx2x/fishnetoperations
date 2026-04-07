-- Showing assistants linked to a listing agent (UI + data only; permissions later)

CREATE TABLE IF NOT EXISTS public.agent_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents (id) ON DELETE CASCADE,
  assistant_email text NOT NULL,
  assistant_name text,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_team_members_agent_email_lower_idx
  ON public.agent_team_members (agent_id, lower(trim(assistant_email)));

CREATE INDEX IF NOT EXISTS agent_team_members_agent_id_idx ON public.agent_team_members (agent_id);

ALTER TABLE public.agent_team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_team_members_select_own" ON public.agent_team_members;
CREATE POLICY "agent_team_members_select_own"
  ON public.agent_team_members FOR SELECT TO authenticated
  USING (
    agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "agent_team_members_insert_own" ON public.agent_team_members;
CREATE POLICY "agent_team_members_insert_own"
  ON public.agent_team_members FOR INSERT TO authenticated
  WITH CHECK (
    agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "agent_team_members_update_own" ON public.agent_team_members;
CREATE POLICY "agent_team_members_update_own"
  ON public.agent_team_members FOR UPDATE TO authenticated
  USING (
    agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
  )
  WITH CHECK (
    agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "agent_team_members_delete_own" ON public.agent_team_members;
CREATE POLICY "agent_team_members_delete_own"
  ON public.agent_team_members FOR DELETE TO authenticated
  USING (
    agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
  );

-- Notification type for assistant invites
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'lead_created',
    'property_match',
    'system',
    'broker_pending_review',
    'agent_pending_review',
    'verification_approved',
    'verification_rejected',
    'license_expiring',
    'co_agent_request',
    'new_lead',
    'viewing_confirmed',
    'viewing_declined',
    'general',
    'team_invite'
  )
);

CREATE OR REPLACE FUNCTION public.notify_team_invite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_agent_name text;
BEGIN
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE lower(trim(COALESCE(email, ''))) = lower(trim(NEW.assistant_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_agent_name FROM public.agents WHERE id = NEW.agent_id LIMIT 1;

  INSERT INTO public.notifications (user_id, type, title, body)
  VALUES (
    v_user_id,
    'team_invite',
    'Showing Assistant invitation',
    format(
      '%s invited you as a Showing Assistant on BahayGo.',
      COALESCE(NULLIF(trim(v_agent_name), ''), 'An agent')
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agent_team_members_notify_after_insert ON public.agent_team_members;
CREATE TRIGGER agent_team_members_notify_after_insert
  AFTER INSERT ON public.agent_team_members
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_team_invite();

COMMENT ON TABLE public.agent_team_members IS 'Assistants (showing) invited by a listing agent; status invited/active.';
