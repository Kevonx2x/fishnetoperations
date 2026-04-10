-- Pipeline: allow archiving deals as declined (hidden from active pipeline).
-- Notifications: client notice when agent declines an inquiry.

alter table public.leads drop constraint if exists leads_pipeline_stage_check;

alter table public.leads add constraint leads_pipeline_stage_check check (
  pipeline_stage in ('lead', 'viewing', 'offer', 'reservation', 'closed', 'declined')
);

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
    'deal_declined'
  )
);
