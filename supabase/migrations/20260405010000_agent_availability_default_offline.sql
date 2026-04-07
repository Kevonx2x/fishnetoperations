-- Default availability to Offline; normalize existing rows that are not explicitly "Available Now"

ALTER TABLE public.agents ALTER COLUMN availability SET DEFAULT 'Offline';

UPDATE public.agents
SET availability = 'Offline'
WHERE availability IS DISTINCT FROM 'Available Now';
