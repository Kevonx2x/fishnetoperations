-- Quick reply + threading + dismiss flags for notifications

alter table public.notifications
  add column if not exists parent_id uuid references public.notifications (id) on delete cascade;

alter table public.notifications
  add column if not exists property_name text;

alter table public.notifications
  add column if not exists reply_message text;

alter table public.notifications
  add column if not exists dismissed_by_client boolean not null default false;

alter table public.notifications
  add column if not exists dismissed_by_agent boolean not null default false;

create index if not exists notifications_parent_id_idx on public.notifications (parent_id);

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
    'agent_message',
    'client_reply',
    'deal_pipeline',
    'document_request',
    'document_shared',
    'listing_expiry',
    'deal_declined',
    'client_feed_property_like',
    'client_feed_property_save',
    'client_feed_price_drop',
    'client_feed_badge',
    'client_feed_viewing'
  )
);

