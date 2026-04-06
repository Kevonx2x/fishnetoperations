-- Listing lifecycle (separate from for_sale / for_rent) + notification type for co-agent updates

alter table public.properties add column if not exists listing_status text;

update public.properties set listing_status = 'active' where listing_status is null;

alter table public.properties alter column listing_status set default 'active';

alter table public.properties alter column listing_status set not null;

alter table public.properties drop constraint if exists properties_listing_status_check;

alter table public.properties add constraint properties_listing_status_check check (
  listing_status in ('active', 'under_offer', 'sold', 'off_market')
);

comment on column public.properties.listing_status is 'Marketplace lifecycle: active, under_offer, sold, off_market';

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
    'general'
  )
);
