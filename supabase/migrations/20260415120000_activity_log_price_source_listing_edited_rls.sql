-- Tag price_drop activity_log rows as genuine price changes (not engagement-driven).
-- Allow clients who saved/liked a property to read agent listing_edited activity for that property.

create or replace function public.log_property_price_drop()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.price is distinct from old.price then
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
  return new;
end;
$$;

drop policy if exists "activity_log_select_listing_edited_interested" on public.activity_log;
create policy "activity_log_select_listing_edited_interested"
  on public.activity_log for select
  to authenticated
  using (
    entity_type = 'property'
    and action = 'listing_edited'
    and entity_id in (
      select property_id::text from public.saved_properties where user_id = auth.uid()
      union
      select property_id::text from public.property_likes where user_id = auth.uid()
    )
  );

comment on policy "activity_log_select_listing_edited_interested" on public.activity_log is
  'Clients may read listing_edited activity for properties they saved or liked (feed).';
