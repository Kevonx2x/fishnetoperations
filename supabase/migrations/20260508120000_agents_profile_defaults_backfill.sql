-- Backfill empty agent profile fields so public sidebars and dashboards match registration defaults.
UPDATE public.agents
SET
  bio = CASE
    WHEN bio IS NULL OR trim(bio) = '' THEN 'Happily guiding your real-estate moves.'
    ELSE bio
  END,
  languages_spoken = CASE
    WHEN languages_spoken IS NULL OR trim(languages_spoken) = '' THEN 'English, Filipino'
    ELSE languages_spoken
  END,
  specialties = CASE
    WHEN specialties IS NULL OR trim(specialties) = '' THEN 'Condo, Rental'
    ELSE specialties
  END
WHERE
  bio IS NULL OR trim(bio) = ''
  OR languages_spoken IS NULL OR trim(languages_spoken) = ''
  OR specialties IS NULL OR trim(specialties) = '';
