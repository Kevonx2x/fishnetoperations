-- Listing visibility expiry (public hide when past expires_at), renewal tracking, expiry notifications.

alter table public.properties add column if not exists expires_at timestamptz;
alter table public.properties add column if not exists renewed_at timestamptz;
alter table public.properties add column if not exists expiry_notified_at timestamptz;

create index if not exists properties_expires_at_idx on public.properties (expires_at);

-- ---------------------------------------------------------------------------
-- Notifications: listing_expiry
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
    'listing_expiry'
  )
);
