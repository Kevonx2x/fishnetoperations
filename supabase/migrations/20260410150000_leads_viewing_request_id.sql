-- Link pipeline leads to the viewing request that created/updated them
alter table public.leads
  add column if not exists viewing_request_id uuid references public.viewing_requests (id) on delete set null;

create index if not exists leads_viewing_request_id_idx on public.leads (viewing_request_id)
  where viewing_request_id is not null;

comment on column public.leads.viewing_request_id is 'Latest viewing_requests row tied to this deal (client + agent + property)';
