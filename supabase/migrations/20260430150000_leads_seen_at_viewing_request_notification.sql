-- Per-lead "seen" timestamps for agent pipeline green-dot trail + notification type for updated viewing requests.

alter table public.leads add column if not exists new_lead_seen_at timestamptz;
alter table public.leads add column if not exists new_viewing_request_seen_at timestamptz;

comment on column public.leads.new_lead_seen_at is 'Set when the agent opens the card overflow menu; NULL means show new-lead indicator until then.';
comment on column public.leads.new_viewing_request_seen_at is 'Set when the agent acknowledges the viewing request row or confirms/declines; NULL with a viewing_request_id means show viewing-request indicator.';

-- Historical leads: no retroactive "new" badges.
update public.leads
set new_lead_seen_at = coalesce(created_at, now())
where new_lead_seen_at is null;

update public.leads
set new_viewing_request_seen_at = coalesce(updated_at, created_at, now())
where viewing_request_id is not null
  and new_viewing_request_seen_at is null;

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
    'closure_pending_confirmation',
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
    'viewing_declined',
    'viewing_request'
  )
);
