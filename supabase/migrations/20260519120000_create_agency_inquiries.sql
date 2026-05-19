-- Agency contact form inquiries (marketplace /agencies/[id] "Contact agency")

CREATE TABLE IF NOT EXISTS public.agency_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agency_inquiries_agency_id ON public.agency_inquiries(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_inquiries_status ON public.agency_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_agency_inquiries_created_at ON public.agency_inquiries(created_at DESC);

ALTER TABLE public.agency_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY agency_inquiries_insert_any ON public.agency_inquiries
  FOR INSERT WITH CHECK (true);

CREATE POLICY agency_inquiries_select_own ON public.agency_inquiries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agencies ag
      WHERE ag.id = agency_id AND ag.user_id = auth.uid()
    )
  );

CREATE POLICY agency_inquiries_select_admin ON public.agency_inquiries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY agency_inquiries_update_own ON public.agency_inquiries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.agencies ag
      WHERE ag.id = agency_id AND ag.user_id = auth.uid()
    )
  );
