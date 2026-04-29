-- Mirror of supabase/migrations/20260428140000_client_pipeline_lead_archive.sql
-- Run in Supabase SQL editor if applying manually.

alter table public.leads add column if not exists archived_by_client boolean not null default false;
alter table public.leads add column if not exists archived_at timestamptz;
alter table public.leads add column if not exists archive_reason text;
alter table public.leads add column if not exists archive_note text;
alter table public.leads add column if not exists stage_at_archive text;

create index if not exists leads_client_archived_idx on public.leads (client_id, archived_by_client)
  where archived_by_client = true;

alter table public.viewing_requests drop constraint if exists viewing_requests_status_check;

alter table public.viewing_requests add constraint viewing_requests_status_check check (
  status in ('pending', 'confirmed', 'declined', 'rescheduled', 'cancelled')
);

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
    'lead_archived',
    'lead_created',
    'license_expiring',
    'listing_expiry',
    'message',
    'new_lead',
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
