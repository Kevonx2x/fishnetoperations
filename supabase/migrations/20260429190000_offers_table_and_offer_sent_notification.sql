-- Offers tracking (lightweight) + notification type: offer_sent

-- ---------------------------------------------------------------------------
-- offers: minimal tracking of an offer sent by an agent
-- ---------------------------------------------------------------------------
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id bigint not null references public.leads (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  amount numeric not null,
  currency text not null default 'PHP',
  terms_text text,
  valid_until date,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled'))
);

create index if not exists offers_lead_id_idx on public.offers (lead_id);
create index if not exists offers_created_by_idx on public.offers (created_by);
create index if not exists offers_created_at_idx on public.offers (created_at desc);

alter table public.offers enable row level security;

-- Agents can read offers for leads they own; admins can read all.
drop policy if exists "offers_select_own_leads" on public.offers;
create policy "offers_select_own_leads"
  on public.offers for select to authenticated
  using (
    exists (
      select 1 from public.leads l
      where l.id = offers.lead_id
        and (l.agent_id = auth.uid() or public.is_admin())
    )
  );

-- Offers are inserted via server routes (service role); no direct client insert policy.

-- ---------------------------------------------------------------------------
-- notifications: extend allowed type list with offer_sent
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

