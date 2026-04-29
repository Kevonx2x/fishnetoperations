-- ---------------------------------------------------------------------------
-- LABEL: Supabase SQL Editor — extend notifications.type for document_received
-- Run this block in the Supabase SQL Editor if you apply DB changes manually.
-- Merges current allowed types (post agent_followers migration) with
-- agent_message, client_reply (still used by app), and document_received.
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
