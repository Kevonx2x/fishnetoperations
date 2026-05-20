-- Dormspaces & coliving listings (bedspace MVP)

CREATE TABLE IF NOT EXISTS public.dormspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  landlord_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  landlord_name TEXT NOT NULL,
  landlord_email TEXT NOT NULL,
  landlord_phone TEXT,

  landlord_id_url TEXT,
  proof_of_billing_url TEXT,

  title TEXT NOT NULL,
  description TEXT,
  monthly_price NUMERIC(10, 2) NOT NULL,
  deposit_months NUMERIC(3, 1) DEFAULT 1,

  room_type TEXT NOT NULL CHECK (room_type IN ('private', 'shared_2', 'shared_4', 'shared_6_plus')),
  gender_preference TEXT CHECK (gender_preference IN ('any', 'male', 'female')),

  address TEXT NOT NULL,
  city TEXT,
  neighborhood TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  near_school TEXT,

  has_wifi BOOLEAN DEFAULT FALSE,
  has_aircon BOOLEAN DEFAULT FALSE,
  has_kitchen BOOLEAN DEFAULT FALSE,
  has_laundry BOOLEAN DEFAULT FALSE,
  has_water_included BOOLEAN DEFAULT FALSE,
  has_electricity_included BOOLEAN DEFAULT FALSE,
  has_security BOOLEAN DEFAULT FALSE,

  curfew TEXT,
  rules_notes TEXT,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
  rejection_reason TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.dormspace_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dormspace_id UUID NOT NULL REFERENCES public.dormspaces(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dormspace_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dormspace_id UUID NOT NULL REFERENCES public.dormspaces(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dormspaces_status ON public.dormspaces(status);
CREATE INDEX IF NOT EXISTS idx_dormspaces_city ON public.dormspaces(city);
CREATE INDEX IF NOT EXISTS idx_dormspaces_neighborhood ON public.dormspaces(neighborhood);
CREATE INDEX IF NOT EXISTS idx_dormspaces_created_at ON public.dormspaces(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dormspace_photos_dormspace_id ON public.dormspace_photos(dormspace_id);
CREATE INDEX IF NOT EXISTS idx_dormspace_inquiries_dormspace_id ON public.dormspace_inquiries(dormspace_id);
CREATE INDEX IF NOT EXISTS idx_dormspace_inquiries_created_at ON public.dormspace_inquiries(created_at DESC);

CREATE OR REPLACE FUNCTION public.set_dormspaces_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dormspaces_updated_at ON public.dormspaces;
CREATE TRIGGER dormspaces_updated_at
  BEFORE UPDATE ON public.dormspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.set_dormspaces_updated_at();

ALTER TABLE public.dormspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dormspace_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dormspace_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY dormspaces_select_public ON public.dormspaces
  FOR SELECT USING (status IN ('pending', 'approved'));

CREATE POLICY dormspaces_select_own ON public.dormspaces
  FOR SELECT USING (landlord_user_id = auth.uid());

-- Listing creation goes through validated server API routes using the service role.

CREATE POLICY dormspaces_update_admin ON public.dormspaces
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY dormspaces_update_own_pending ON public.dormspaces
  FOR UPDATE USING (landlord_user_id = auth.uid() AND status = 'pending');

CREATE POLICY dormspace_photos_select_public ON public.dormspace_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.dormspaces
      WHERE id = dormspace_id AND status IN ('pending', 'approved')
    )
  );

CREATE POLICY dormspace_photos_select_own ON public.dormspace_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.dormspaces d
      WHERE d.id = dormspace_id AND d.landlord_user_id = auth.uid()
    )
  );

-- Photo and inquiry writes go through validated server API routes using the service role.

CREATE POLICY dormspace_inquiries_select_admin ON public.dormspace_inquiries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('dormspace-photos', 'dormspace-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('dormspace-verification', 'dormspace-verification', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS dormspace_photos_public_read ON storage.objects;
CREATE POLICY dormspace_photos_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'dormspace-photos');

DROP POLICY IF EXISTS dormspace_photos_insert ON storage.objects;
-- Storage uploads go through validated server API routes using the service role.

DROP POLICY IF EXISTS dormspace_verification_admin_read ON storage.objects;
CREATE POLICY dormspace_verification_admin_read ON storage.objects
  FOR SELECT USING (
    bucket_id = 'dormspace-verification'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS dormspace_verification_insert ON storage.objects;
-- Verification uploads go through validated server API routes using the service role.
