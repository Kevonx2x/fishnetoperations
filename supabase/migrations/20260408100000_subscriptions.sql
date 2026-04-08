CREATE TABLE public.subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid REFERENCES public.agents(id),
  tier text NOT NULL,
  status text DEFAULT 'active',
  paymongo_payment_id text,
  paymongo_link_id text,
  amount bigint,
  currency text DEFAULT 'PHP',
  started_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_agent_id_idx ON public.subscriptions (agent_id);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_paymongo_payment_id_unique
  ON public.subscriptions (paymongo_payment_id)
  WHERE paymongo_payment_id IS NOT NULL;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_see_own_subscriptions"
ON public.subscriptions FOR SELECT TO authenticated
USING (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));

CREATE POLICY "service_role_insert_subscriptions"
ON public.subscriptions FOR INSERT TO service_role
WITH CHECK (true);
