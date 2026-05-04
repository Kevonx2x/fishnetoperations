-- Client signup (and any auth signUp) can store split names; full_name remains the display fallback.

alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;

comment on column public.profiles.first_name is 'Given name from signup metadata when provided; optional for legacy rows.';
comment on column public.profiles.last_name is 'Family name from signup metadata when provided; optional for legacy rows.';

-- Keep team_member role handling + email column; add first_name / last_name + full_name derivation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
  meta jsonb;
  v_fn text;
  v_ln text;
  v_full text;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  r := coalesce(meta->>'role', 'client');
  if r <> 'team_member' then
    r := 'client';
  end if;

  v_fn := nullif(trim(coalesce(meta->>'first_name', '')), '');
  v_ln := nullif(trim(coalesce(meta->>'last_name', '')), '');
  v_full := nullif(trim(coalesce(meta->>'full_name', meta->>'name', '')), '');

  if v_full is null or v_full = '' then
    if v_fn is not null and v_ln is not null then
      v_full := v_fn || ' ' || v_ln;
    elsif v_fn is not null then
      v_full := v_fn;
    elsif v_ln is not null then
      v_full := v_ln;
    else
      v_full := '';
    end if;
  end if;

  insert into public.profiles (id, first_name, last_name, full_name, avatar_url, role, email)
  values (
    new.id,
    v_fn,
    v_ln,
    v_full,
    nullif(trim(coalesce(meta->>'avatar_url', '')), ''),
    r,
    new.email
  );
  return new;
exception
  when unique_violation then
    return new;
end;
$$;
