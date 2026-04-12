-- Within 5 minutes, merge price_drop activity_log rows per property (update instead of insert).

create or replace function public.log_property_price_drop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_id uuid;
  anchor_old text;
  prev_meta jsonb;
begin
  if tg_op = 'UPDATE' and new.price is distinct from old.price then
    select id, metadata into recent_id, prev_meta
    from public.activity_log
    where entity_type = 'price_drop'
      and entity_id = new.id::text
      and created_at > now() - interval '5 minutes'
    order by created_at desc
    limit 1;

    if recent_id is not null then
      anchor_old := coalesce(prev_meta->>'old_price', old.price::text);
      update public.activity_log
      set
        metadata = jsonb_build_object(
          'property_id', new.id,
          'old_price', anchor_old,
          'new_price', new.price::text,
          'source', 'price_change'
        ),
        created_at = now(),
        actor_id = auth.uid()
      where id = recent_id;
    else
      insert into public.activity_log (actor_id, action, entity_type, entity_id, metadata)
      values (
        auth.uid(),
        'price_drop',
        'price_drop',
        new.id::text,
        jsonb_build_object(
          'property_id', new.id,
          'old_price', old.price::text,
          'new_price', new.price::text,
          'source', 'price_change'
        )
      );
    end if;
  end if;
  return new;
end;
$$;
