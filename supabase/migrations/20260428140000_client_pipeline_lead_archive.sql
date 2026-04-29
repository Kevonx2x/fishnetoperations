-- Client soft-archive from pipeline: never delete leads; optional viewing cancel status.

alter table public.leads add column if not exists archived_by_client boolean not null default false;
alter table public.leads add column if not exists archived_at timestamptz;
alter table public.leads add column if not exists archive_reason text;
alter table public.leads add column if not exists archive_note text;
alter table public.leads add column if not exists stage_at_archive text;

comment on column public.leads.archived_by_client is 'True when the client removed the deal from their active pipeline (soft archive).';
comment on column public.leads.archived_at is 'When the client archived the lead.';
comment on column public.leads.archive_reason is 'Structured reason key (e.g. not_interested, other).';
comment on column public.leads.archive_note is 'Optional detail; required context when archive_reason is other.';
comment on column public.leads.stage_at_archive is 'public.leads.pipeline_stage at time of client archive.';

create index if not exists leads_client_archived_idx on public.leads (client_id, archived_by_client)
  where archived_by_client = true;

-- Allow client-initiated cancellation on viewing_requests (separate from agent declined).
alter table public.viewing_requests drop constraint if exists viewing_requests_status_check;

alter table public.viewing_requests add constraint viewing_requests_status_check check (
  status in ('pending', 'confirmed', 'declined', 'rescheduled', 'cancelled')
);

-- Append notification type (full list from prior migration + lead_archived).
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
