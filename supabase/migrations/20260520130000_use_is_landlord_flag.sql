-- Landlord capability via profiles.is_landlord (multi-role: client + landlord)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_landlord BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.is_landlord IS
  'When true, user may manage dormspace listings (dashboard, own rows). Independent of role for client+landlord accounts.';

UPDATE public.profiles
SET is_landlord = TRUE
WHERE role = 'landlord' AND is_landlord IS DISTINCT FROM TRUE;

-- Helper: authenticated user with landlord capability
CREATE OR REPLACE FUNCTION public.auth_user_is_landlord()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_landlord = TRUE
  );
$$;

COMMENT ON FUNCTION public.auth_user_is_landlord() IS
  'True when the current user has dormspace landlord capability (is_landlord flag).';

-- Dormspaces: own rows require landlord flag + ownership
DROP POLICY IF EXISTS dormspaces_select_own ON public.dormspaces;
CREATE POLICY dormspaces_select_own ON public.dormspaces
  FOR SELECT USING (
    landlord_user_id = auth.uid() AND public.auth_user_is_landlord()
  );

DROP POLICY IF EXISTS dormspaces_update_own_landlord ON public.dormspaces;
CREATE POLICY dormspaces_update_own_landlord ON public.dormspaces
  FOR UPDATE USING (
    landlord_user_id = auth.uid() AND public.auth_user_is_landlord()
  );

DROP POLICY IF EXISTS dormspaces_delete_own_landlord ON public.dormspaces;
CREATE POLICY dormspaces_delete_own_landlord ON public.dormspaces
  FOR DELETE USING (
    landlord_user_id = auth.uid() AND public.auth_user_is_landlord()
  );

-- Inquiries on own listings
DROP POLICY IF EXISTS dormspace_inquiries_select_landlord ON public.dormspace_inquiries;
CREATE POLICY dormspace_inquiries_select_landlord ON public.dormspace_inquiries
  FOR SELECT USING (
    public.auth_user_is_landlord()
    AND EXISTS (
      SELECT 1 FROM public.dormspaces d
      WHERE d.id = dormspace_id AND d.landlord_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS dormspace_inquiries_update_landlord ON public.dormspace_inquiries;
CREATE POLICY dormspace_inquiries_update_landlord ON public.dormspace_inquiries
  FOR UPDATE USING (
    public.auth_user_is_landlord()
    AND EXISTS (
      SELECT 1 FROM public.dormspaces d
      WHERE d.id = dormspace_id AND d.landlord_user_id = auth.uid()
    )
  );

-- Photos for own listings
DROP POLICY IF EXISTS dormspace_photos_select_own ON public.dormspace_photos;
CREATE POLICY dormspace_photos_select_own ON public.dormspace_photos
  FOR SELECT USING (
    public.auth_user_is_landlord()
    AND EXISTS (
      SELECT 1 FROM public.dormspaces d
      WHERE d.id = dormspace_id AND d.landlord_user_id = auth.uid()
    )
  );
