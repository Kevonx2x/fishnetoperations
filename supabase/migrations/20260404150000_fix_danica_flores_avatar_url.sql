-- photo-1594744803329 was removed from Unsplash (404). Point demo agent to a stable portrait.
update public.agents
set image_url = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=256&h=256&fit=crop&crop=face'
where id = 'f6000000-0000-0000-0000-00000000000f';
