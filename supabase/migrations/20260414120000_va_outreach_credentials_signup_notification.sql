-- VA Outreach CRM, daily reports, admin credentials vault, signup notification type.

-- ---------------------------------------------------------------------------
-- notifications: signup
-- ---------------------------------------------------------------------------
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
    'viewing_declined',
    'general',
    'team_invite',
    'verification',
    'message',
    'deal_pipeline',
    'document_request',
    'document_shared',
    'listing_expiry',
    'deal_declined',
    'client_feed_property_like',
    'client_feed_property_save',
    'client_feed_price_drop',
    'client_feed_badge',
    'client_feed_viewing',
    'signup'
  )
);

-- ---------------------------------------------------------------------------
-- va_leads (Outreach CRM)
-- ---------------------------------------------------------------------------
create table if not exists public.va_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  role text,
  phone text,
  email text,
  platform text,
  listing_link text,
  status text not null default 'not_contacted' check (
    status in ('not_contacted', 'contacted', 'replied', 'booked', 'no_response')
  ),
  follow_up_stage text,
  last_contacted_at timestamptz,
  assigned_to text,
  notes text,
  messages_sent int not null default 0
);

create index if not exists va_leads_created_at_idx on public.va_leads (created_at desc);
create index if not exists va_leads_status_idx on public.va_leads (status);
create index if not exists va_leads_assigned_to_idx on public.va_leads (assigned_to);

create or replace function public.va_leads_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_va_leads_updated_at on public.va_leads;
create trigger trg_va_leads_updated_at
  before update on public.va_leads
  for each row execute function public.va_leads_set_updated_at();

alter table public.va_leads enable row level security;

drop policy if exists "va_leads_admin_all" on public.va_leads;
create policy "va_leads_admin_all"
  on public.va_leads for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- va_daily_reports
-- ---------------------------------------------------------------------------
create table if not exists public.va_daily_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  va_name text not null,
  report_date date not null,
  leads_found int not null default 0,
  contacts_made int not null default 0,
  replies int not null default 0,
  meetings_booked int not null default 0,
  unique (va_name, report_date)
);

create index if not exists va_daily_reports_date_idx on public.va_daily_reports (report_date desc);

alter table public.va_daily_reports enable row level security;

drop policy if exists "va_daily_reports_admin_all" on public.va_daily_reports;
create policy "va_daily_reports_admin_all"
  on public.va_daily_reports for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- admin_credentials (super-admin UI; RLS admin-only)
-- ---------------------------------------------------------------------------
create table if not exists public.admin_credentials (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  service_name text not null,
  username text not null,
  password_plain text not null,
  monthly_cost numeric(14, 2) not null default 0,
  notes text
);

create index if not exists admin_credentials_service_idx on public.admin_credentials (service_name);

alter table public.admin_credentials enable row level security;

drop policy if exists "admin_credentials_admin_all" on public.admin_credentials;
create policy "admin_credentials_admin_all"
  on public.admin_credentials for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Seed default services once (approximate PHP monthly where noted)
insert into public.admin_credentials (service_name, username, password_plain, monthly_cost, notes)
select v.service_name, v.username, v.password_plain, v.monthly_cost, v.notes
from (
  values
    ('Vercel', '', '', 1120.00, '≈ USD $20/mo'),
    ('Supabase', '', '', 0, '$0 free tier'),
    ('Cloudinary', '', '', 0, '$0 free tier'),
    ('Twilio', '', '', 0, 'Variable usage'),
    ('Resend', '', '', 0, '$0 free tier'),
    ('PayMongo', '', '', 0, '$0 free tier'),
    ('Namecheap', '', '', 0, '$15/yr — enter prorated monthly in cost if desired'),
    ('Google Workspace', '', '', 672.00, '≈ USD $12/mo'),
    ('Anthropic', '', '', 0, 'Variable usage'),
    ('GitHub', '', '', 0, '$0 free tier')
) as v(service_name, username, password_plain, monthly_cost, notes)
where not exists (select 1 from public.admin_credentials limit 1);
