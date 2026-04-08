-- Set demo agent to Pro tier for testing / demos.
UPDATE public.agents
SET listing_tier = 'pro'
WHERE email = 'testagent5@gmail.com';
