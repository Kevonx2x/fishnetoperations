-- Pending dormspaces are publicly visible (with badge) until admin approves or rejects.

DROP POLICY IF EXISTS dormspaces_select_public ON public.dormspaces;
CREATE POLICY dormspaces_select_public ON public.dormspaces
  FOR SELECT USING (status IN ('pending', 'approved'));

DROP POLICY IF EXISTS dormspace_photos_select_public ON public.dormspace_photos;
CREATE POLICY dormspace_photos_select_public ON public.dormspace_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.dormspaces
      WHERE id = dormspace_id AND status IN ('pending', 'approved')
    )
  );
