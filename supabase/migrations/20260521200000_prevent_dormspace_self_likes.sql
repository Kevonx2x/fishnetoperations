-- Prevent landlords from liking/saving their own dormspaces; remove existing self-rows

delete from public.dormspace_likes dl
using public.dormspaces d
where d.id = dl.dormspace_id
  and dl.user_id = d.landlord_user_id;

delete from public.dormspace_saves ds
using public.dormspaces d
where d.id = ds.dormspace_id
  and ds.user_id = d.landlord_user_id;

create or replace function public.prevent_dormspace_self_like()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.dormspaces
    where id = new.dormspace_id
      and landlord_user_id = new.user_id
  ) then
    raise exception 'Cannot like or save your own dormspace';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_dormspace_likes_self on public.dormspace_likes;
create trigger prevent_dormspace_likes_self
  before insert on public.dormspace_likes
  for each row
  execute function public.prevent_dormspace_self_like();

drop trigger if exists prevent_dormspace_saves_self on public.dormspace_saves;
create trigger prevent_dormspace_saves_self
  before insert on public.dormspace_saves
  for each row
  execute function public.prevent_dormspace_self_like();

notify pgrst, 'reload schema';
