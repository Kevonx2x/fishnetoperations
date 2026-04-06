-- Run in Supabase SQL Editor. Seed data uses stable UUIDs (see fishnet_residences_home_seed).

-- 1) Rico Garcia's profile / agent user id
select user_id, id as agent_id, name
from public.agents
where name = 'Rico Garcia';

-- Expected from seed migrations:
--   user_id   = e5000000-0000-0000-0000-000000000007
--   agent_id  = f6000000-0000-0000-0000-000000000007

-- 2) Link Rico to a second property he is not already on (example: BGC Penthouse).
--    Skip if this pair already exists (primary key on property_id, agent_id).
insert into public.property_agents (property_id, agent_id)
values (
  'a7000000-0000-0000-0000-000000000002',
  'f6000000-0000-0000-0000-000000000007'
)
on conflict (property_id, agent_id) do nothing;
