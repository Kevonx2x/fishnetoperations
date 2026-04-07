-- Public bucket for listing photos; paths: {auth.uid()}/<filename>
insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', true)
on conflict (id) do nothing;

drop policy if exists "property_images_public_read" on storage.objects;
create policy "property_images_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'property-images');

drop policy if exists "property_images_insert_own" on storage.objects;
create policy "property_images_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "property_images_update_own" on storage.objects;
create policy "property_images_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "property_images_delete_own" on storage.objects;
create policy "property_images_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Listing owners can manage property_photos for their listings
drop policy if exists "property_photos_insert_listing_owner" on public.property_photos;
create policy "property_photos_insert_listing_owner"
  on public.property_photos for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.properties p
      where p.id = property_photos.property_id
        and p.listed_by = auth.uid()
    )
  );

drop policy if exists "property_photos_update_listing_owner" on public.property_photos;
create policy "property_photos_update_listing_owner"
  on public.property_photos for update
  to authenticated
  using (
    exists (
      select 1
      from public.properties p
      where p.id = property_photos.property_id
        and p.listed_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.properties p
      where p.id = property_photos.property_id
        and p.listed_by = auth.uid()
    )
  );

drop policy if exists "property_photos_delete_listing_owner" on public.property_photos;
create policy "property_photos_delete_listing_owner"
  on public.property_photos for delete
  to authenticated
  using (
    exists (
      select 1
      from public.properties p
      where p.id = property_photos.property_id
        and p.listed_by = auth.uid()
    )
  );
