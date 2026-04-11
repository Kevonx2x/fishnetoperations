-- Client notification preferences + price_drop rows in activity_log for mobile feed.

alter table public.profiles add column if not exists notification_preferences jsonb not null default '{}'::jsonb;

comment on column public.profiles.notification_preferences is
  'JSON toggles (default true when key omitted): price_drop, new_listing_followed_agent, badge_earned, document_request, pipeline_stage, viewing_request_confirmed';

-- ---------------------------------------------------------------------------
-- Log price changes for feed (one row per price update on a property)
-- ---------------------------------------------------------------------------
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
        'new_price', new.price::text
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_activity_log_price_drop on public.properties;
create trigger trg_activity_log_price_drop
  after update of price on public.properties
  for each row execute function public.log_property_price_drop();

-- ---------------------------------------------------------------------------
-- RLS: clients may read price_drop activity for properties they saved or liked
-- ---------------------------------------------------------------------------
drop policy if exists "activity_log_select_price_drop_interested" on public.activity_log;
create policy "activity_log_select_price_drop_interested"
  on public.activity_log for select
  to authenticated
  using (
    entity_type = 'price_drop'
    and entity_id in (
      select property_id::text from public.saved_properties where user_id = auth.uid()
      union
      select property_id::text from public.property_likes where user_id = auth.uid()
    )
  );
