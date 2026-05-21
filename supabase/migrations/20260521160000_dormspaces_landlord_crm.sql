-- Landlord role + dormspace inquiry CRM (landlord inbox, admin read-all)

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'ops_admin', 'broker', 'agent', 'client', 'team_member', 'landlord'));

-- Inquiry workflow columns (table may already exist from create_dormspaces)
ALTER TABLE public.dormspace_inquiries
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

UPDATE public.dormspace_inquiries
SET status = 'new'
WHERE status IS NULL OR status NOT IN ('new', 'responded', 'archived');

ALTER TABLE public.dormspace_inquiries DROP CONSTRAINT IF EXISTS dormspace_inquiries_status_check;
ALTER TABLE public.dormspace_inquiries
  ADD CONSTRAINT dormspace_inquiries_status_check
  CHECK (status IN ('new', 'responded', 'archived'));

CREATE INDEX IF NOT EXISTS idx_dormspace_inquiries_status ON public.dormspace_inquiries(status);

-- Landlord can read inquiries on their listings
DROP POLICY IF EXISTS dormspace_inquiries_select_landlord ON public.dormspace_inquiries;
CREATE POLICY dormspace_inquiries_select_landlord ON public.dormspace_inquiries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.dormspaces d
      WHERE d.id = dormspace_id AND d.landlord_user_id = auth.uid()
    )
  );

-- Landlord can update inquiry status on their listings
DROP POLICY IF EXISTS dormspace_inquiries_update_landlord ON public.dormspace_inquiries;
CREATE POLICY dormspace_inquiries_update_landlord ON public.dormspace_inquiries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.dormspaces d
      WHERE d.id = dormspace_id AND d.landlord_user_id = auth.uid()
    )
  );

-- Landlord can manage their own listings (not only while pending)
DROP POLICY IF EXISTS dormspaces_update_own_pending ON public.dormspaces;
DROP POLICY IF EXISTS dormspaces_update_own_landlord ON public.dormspaces;
CREATE POLICY dormspaces_update_own_landlord ON public.dormspaces
  FOR UPDATE USING (landlord_user_id = auth.uid());

DROP POLICY IF EXISTS dormspaces_delete_own_landlord ON public.dormspaces;
CREATE POLICY dormspaces_delete_own_landlord ON public.dormspaces
  FOR DELETE USING (landlord_user_id = auth.uid());
