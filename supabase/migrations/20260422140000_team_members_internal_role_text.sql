-- Allow arbitrary job titles for internal team (agent_id null); agent roster rows keep flexible role strings.

alter table public.team_members drop constraint if exists team_members_role_check;

alter table public.team_members
  add constraint team_members_role_check check (
    (agent_id is null and length(trim(role)) >= 1 and length(role) <= 120)
    or (agent_id is not null and length(trim(role)) >= 1 and length(role) <= 120)
  );
