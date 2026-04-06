-- Ensure a profiles row exists before agents insert (FK: agents.user_id -> profiles.id).
-- Callable only when auth.uid() matches the target user.
create or replace function public.ensure_agent_profile(
  p_id uuid,
  p_email text,
  p_full_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_id then
    raise exception 'forbidden';
  end if;
  insert into public.profiles (id, email, full_name, role)
  values (
    p_id,
    nullif(trim(p_email), ''),
    nullif(trim(p_full_name), ''),
    'client'
  )
  on conflict (id) do nothing;
end;
$$;

grant execute on function public.ensure_agent_profile(uuid, text, text) to authenticated;

comment on function public.ensure_agent_profile(uuid, text, text) is
  'Insert profiles row if missing (ON CONFLICT DO NOTHING); agent registration should call before inserting agents.';
