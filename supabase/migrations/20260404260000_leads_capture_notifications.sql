-- Lead capture: property scoping + dedupe; viewing client link; notification types

alter table public.leads add column if not exists property_id uuid references public.properties (id) on delete set null;

create unique index if not exists leads_client_agent_property_dedupe_idx
  on public.leads (client_id, agent_id, (coalesce(property_id::text, '')))
  where client_id is not null and agent_id is not null;

alter table public.viewing_requests add column if not exists client_user_id uuid references public.profiles (id) on delete set null;

create index if not exists viewing_requests_client_user_id_idx on public.viewing_requests (client_user_id);

alter table public.notifications drop constraint if exists notifications_type_check;

alter table public.notifications add constraint notifications_type_check check (
  type in (
    'lead_created',
    'property_match',
    'system',
    'broker_pending_review',
    'agent_pending_review',
    'verification_approved',
    'verification_rejected',
    'license_expiring',
    'co_agent_request',
    'new_lead',
    'viewing_confirmed',
    'viewing_declined'
  )
);
