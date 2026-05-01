-- Client-initiated reschedule: pending viewing_requests row linked from viewings.reschedule_request_id.

alter table public.viewings
  add column if not exists reschedule_request_id uuid references public.viewing_requests (id) on delete set null;

create index if not exists viewings_reschedule_request_id_idx
  on public.viewings (reschedule_request_id)
  where reschedule_request_id is not null;

comment on column public.viewings.reschedule_request_id is
  'When set, client has proposed a new time; agent accepts/declines/counters without changing calendar until resolved.';

-- Extend viewing_requests lifecycle for reschedule accept + superseded original row.
alter table public.viewing_requests drop constraint if exists viewing_requests_status_check;

alter table public.viewing_requests add constraint viewing_requests_status_check check (
  status in ('pending', 'confirmed', 'declined', 'rescheduled', 'cancelled', 'accepted', 'superseded')
);

-- Agent + client notifications for reschedule flow.
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
    'viewing_request',
    'viewing_reschedule_requested',
    'viewing_reschedule_accepted',
    'viewing_reschedule_declined',
    'viewing_reschedule_countered'
  )
);
