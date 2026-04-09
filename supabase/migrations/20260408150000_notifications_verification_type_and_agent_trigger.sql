-- Allow type 'verification' for identity/PRC verification notifications.
-- Agent registration status notifications are sent from the admin API instead of this trigger
-- to avoid duplicate rows and to use the verification-specific copy.

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
    'verification'
  )
);

create or replace function public.notify_user_verification_result_agent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Agent application notifications (type verification) are inserted by
  -- app/api/admin/verification/agents/[id] when an admin approves or rejects.
  return new;
end;
$$;
