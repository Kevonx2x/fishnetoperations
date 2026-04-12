-- Dual sale+rent listings + team_members for admin RBAC

alter table public.properties add column if not exists listing_type text;
alter table public.properties add column if not exists rent_price text;

update public.properties
set listing_type = case when status = 'for_rent' then 'rent' else 'sale' end
where listing_type is null;

update public.properties set listing_type = 'sale' where listing_type is null;

alter table public.properties alter column listing_type set default 'sale';
alter table public.properties alter column listing_type set not null;

alter table public.properties drop constraint if exists properties_listing_type_check;
alter table public.properties add constraint properties_listing_type_check check (
  listing_type in ('sale', 'rent', 'both')
);

alter table public.properties drop constraint if exists properties_status_check;
alter table public.properties add constraint properties_status_check check (
  status in ('for_sale', 'for_rent', 'sold', 'rented', 'both')
);

comment on column public.properties.listing_type is 'sale | rent | both (sale+rent dual listing)';
comment on column public.properties.rent_price is 'Monthly rent when listing_type is rent or both';

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null unique,
  role text not null check (role in ('owner', 'co_founder', 'va_admin')),
  created_by uuid references auth.users (id) on delete set null
);

create index if not exists team_members_email_lower_idx on public.team_members (lower(email));

comment on table public.team_members is 'BahayGo internal team; sidebar access derived from role';

alter table public.team_members enable row level security;

drop policy if exists "team_members_select_admin" on public.team_members;
create policy "team_members_select_admin"
  on public.team_members for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "team_members_insert_admin" on public.team_members;
create policy "team_members_insert_admin"
  on public.team_members for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "team_members_delete_admin" on public.team_members;
create policy "team_members_delete_admin"
  on public.team_members for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
