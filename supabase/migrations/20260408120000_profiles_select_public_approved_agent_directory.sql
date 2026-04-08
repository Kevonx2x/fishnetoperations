-- Public directory (homepage, /agents): allow reading profile rows (incl. role) for
-- users who are approved + verified agents, so the app can filter role = 'agent'
-- without exposing arbitrary profiles.

drop policy if exists "profiles_select_public_approved_agent_directory" on public.profiles;
create policy "profiles_select_public_approved_agent_directory"
  on public.profiles for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.agents a
      where a.user_id = profiles.id
        and a.status = 'approved'
        and a.verified = true
    )
  );
