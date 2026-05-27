-- Fix university avatar URLs that 404 on Unsplash (Benilde, Mapúa, Ateneo seeds).
-- Run in Supabase SQL Editor after 20260529120000_create_universities_table.sql.

update public.universities set image_url = 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=400&h=400&q=80'
where id = 'a8000000-0000-0000-0000-000000000001';

update public.universities set image_url = 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=400&h=400&q=80'
where id = 'a8000000-0000-0000-0000-000000000002';

update public.universities set image_url = 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=400&h=400&q=80'
where id = 'a8000000-0000-0000-0000-000000000003';

update public.universities set image_url = 'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&w=400&h=400&q=80'
where id = 'a8000000-0000-0000-0000-000000000004';

update public.universities set image_url = 'https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=400&h=400&q=80'
where id = 'a8000000-0000-0000-0000-000000000005';

update public.universities set image_url = 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=400&h=400&q=80'
where id = 'a8000000-0000-0000-0000-000000000006';

update public.universities set image_url = 'https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=400&h=400&q=80'
where id = 'a8000000-0000-0000-0000-000000000007';

update public.universities set image_url = 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=400&h=400&q=80'
where id = 'a8000000-0000-0000-0000-000000000008';

update public.universities set image_url = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=400&h=400&q=80'
where id = 'a8000000-0000-0000-0000-000000000009';

update public.universities set image_url = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=400&h=400&q=80'
where id = 'a8000000-0000-0000-0000-000000000010';
