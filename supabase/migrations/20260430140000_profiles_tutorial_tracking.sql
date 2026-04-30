-- Interactive onboarding: driver tour + checklist (agent & client dashboards)
alter table public.profiles
  add column if not exists tutorial_completed boolean not null default false,
  add column if not exists tutorial_dismissed_at timestamptz null;

comment on column public.profiles.tutorial_completed is 'When true, onboarding tour and checklist are hidden for this user.';
comment on column public.profiles.tutorial_dismissed_at is 'Set when user dismisses the driver tour early; stops auto-launch.';

-- Existing accounts (before rollout) skip the tutorial
update public.profiles
set tutorial_completed = true
where created_at < '2026-04-30T00:00:00+00'::timestamptz;
