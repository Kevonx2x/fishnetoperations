-- Reservations tracking (lightweight) + notification type: reservation_created

-- ---------------------------------------------------------------------------
-- reservations: minimal tracking of a reservation initiated by an agent
-- ---------------------------------------------------------------------------
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id bigint not null references public.leads (id) on delete cascade,
  offer_id uuid references public.offers (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  amount numeric not null,
  currency text not null default 'PHP',
  deadline_at date not null,
  refund_policy text,
  notes text,
  agreement_file_url text,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'cancelled', 'expired', 'completed')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'refunded', 'void'))
);

create index if not exists reservations_lead_id_idx on public.reservations (lead_id);
create index if not exists reservations_offer_id_idx on public.reservations (offer_id);
create index if not exists reservations_created_at_idx on public.reservations (created_at desc);

alter table public.reservations enable row level security;

drop policy if exists "reservations_select_own_leads" on public.reservations;
create policy "reservations_select_own_leads"
  on public.reservations for select to authenticated
  using (
    exists (
      select 1 from public.leads l
      where l.id = reservations.lead_id
        and (l.agent_id = auth.uid() or public.is_admin())
    )
  );

-- Reservations are inserted via server routes (service role); no direct client insert policy.

-- ---------------------------------------------------------------------------
-- notifications: extend allowed type list with reservation_created
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;

alter table public.notifications add constraint notifications_type_check check (
  type in (
    'agent_followed',
    'agent_message',
    'agent_pending_review',
    'broker_pending_review',
    'client_feed_badge',
    'client_feed_price_drop',
    'client_feed_property_like',
    'client_feed_property_save',
    'client_feed_viewing',
    'client_reply',
    'co_agent_request',
    'deal_declined',
    'deal_pipeline',
    'document_received',
    'document_request',
    'document_shared',
    'general',
    'lead_created',
    'license_expiring',
    'listing_expiry',
    'message',
    'new_lead',
    'offer_sent',
    'property_match',
    'reservation_created',
    'signup',
    'system',
    'team_invite',
    'verification',
    'verification_approved',
    'verification_rejected',
    'viewing_confirmed',
    'viewing_declined'
  )
);

