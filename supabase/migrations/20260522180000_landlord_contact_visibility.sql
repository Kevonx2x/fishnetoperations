-- Landlord contact channels + public visibility toggles (detail card icons)

alter table public.profiles add column if not exists landlord_viber text;
alter table public.profiles add column if not exists landlord_show_phone boolean default true;
alter table public.profiles add column if not exists landlord_show_whatsapp boolean default true;
alter table public.profiles add column if not exists landlord_show_email boolean default true;
alter table public.profiles add column if not exists landlord_show_viber boolean default true;
alter table public.profiles add column if not exists landlord_show_facebook boolean default true;
alter table public.profiles add column if not exists landlord_show_instagram boolean default true;

comment on column public.profiles.landlord_viber is 'Optional Viber number (PH, with country code).';
comment on column public.profiles.landlord_show_phone is 'Show phone call on public dormspace landlord card.';
comment on column public.profiles.landlord_show_whatsapp is 'Show WhatsApp on public dormspace landlord card (uses phone).';
comment on column public.profiles.landlord_show_email is 'Show email on public dormspace landlord card.';
comment on column public.profiles.landlord_show_viber is 'Show Viber on public dormspace landlord card.';
comment on column public.profiles.landlord_show_facebook is 'Show Facebook on public dormspace landlord card.';
comment on column public.profiles.landlord_show_instagram is 'Show Instagram on public dormspace landlord card.';

notify pgrst, 'reload schema';
