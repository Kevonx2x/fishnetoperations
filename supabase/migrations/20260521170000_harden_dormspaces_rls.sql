-- Harden Dormspaces direct Data API access.
-- Listing creation and moderation state changes must go through server routes
-- using the service role so users cannot bypass review from the browser.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'ops_admin', 'broker', 'agent', 'client', 'team_member', 'landlord'));

CREATE OR REPLACE FUNCTION public.auth_user_is_landlord()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_landlord = TRUE
      AND (
        p.role IS NULL
        OR p.role NOT IN ('admin', 'ops_admin', 'broker', 'agent', 'team_member')
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.prevent_profile_self_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.id
    AND NOT public.is_admin()
    AND (
      NEW.role IS DISTINCT FROM OLD.role
      OR NEW.is_landlord IS DISTINCT FROM OLD.is_landlord
    )
  THEN
    RAISE EXCEPTION 'Profile role and landlord capability cannot be changed by the owning user';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_self_privilege_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_self_privilege_escalation
  BEFORE UPDATE OF role, is_landlord ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_self_privilege_escalation();

DROP POLICY IF EXISTS dormspaces_insert_any ON public.dormspaces;
DROP POLICY IF EXISTS dormspace_photos_insert_any ON public.dormspace_photos;

DROP POLICY IF EXISTS dormspaces_update_own_pending ON public.dormspaces;
DROP POLICY IF EXISTS dormspaces_update_own_landlord ON public.dormspaces;
